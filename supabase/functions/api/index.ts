import { createClient } from "npm:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AuthenticatedRequest {
  userId: string;
  role: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const path = pathParts.slice(pathParts.indexOf('api') + 1).join('/');

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authHeader.replace("Bearer ", "");

    const { data: user } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth: AuthenticatedRequest = { userId: user.id, role: user.role };

    if (path === 'grades' && req.method === 'GET') {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .order("grade_name");

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'grades' && req.method === 'POST') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { data, error } = await supabase
        .from("grades")
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('grades/') && req.method === 'PUT') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const gradeId = path.split('/')[1];
      const body = await req.json();
      const { data, error } = await supabase
        .from("grades")
        .update(body)
        .eq("id", gradeId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('grades/') && req.method === 'DELETE') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const gradeId = path.split('/')[1];
      const { error } = await supabase
        .from("grades")
        .delete()
        .eq("id", gradeId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('students/') && path.endsWith('/photo') && req.method === 'POST') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const studentId = path.split('/')[1];
      const formData = await req.formData();
      const photo = formData.get('photo');
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

      if (!(photo instanceof File) || !allowedTypes.has(photo.type)) {
        return new Response(JSON.stringify({ error: 'Please upload a JPG, PNG, or WEBP image.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (photo.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Photo must be 5 MB or smaller.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const extension = photo.type.split('/')[1].replace('jpeg', 'jpg');
      const objectPath = `${studentId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(objectPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) throw uploadError;

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/student-photos/${objectPath}`;
      const { data, error: updateError } = await supabase
        .from('students')
        .update({ photo_url: photoUrl })
        .eq('id', studentId)
        .select()
        .maybeSingle();

      if (updateError || !data) {
        await supabase.storage.from('student-photos').remove([objectPath]);
        if (updateError) throw updateError;
        return new Response(JSON.stringify({ error: 'Student not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'students' && req.method === 'GET') {
      const gradeId = url.searchParams.get('grade_id');

      let query = supabase
        .from("students")
        .select("*, grades(grade_name)");

      if (gradeId) {
        query = query.eq("grade_id", gradeId);
      }

      const { data, error } = await query.order("student_index");

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'students' && req.method === 'POST') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();

      if (body.student_index) {
        const { data: existing } = await supabase
          .from("students")
          .select("id")
          .eq("student_index", body.student_index)
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({
            error: `Student index "${body.student_index}" is already used by another student. Please use a different index.`
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data, error } = await supabase
        .from("students")
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'students/bulk' && req.method === 'POST') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { data, error } = await supabase
        .from("students")
        .insert(body.students)
        .select();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('students/') && req.method === 'PUT') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const studentId = path.split('/')[1];
      const body = await req.json();

      if (body.student_index) {
        const { data: existing } = await supabase
          .from("students")
          .select("id")
          .eq("student_index", body.student_index)
          .neq("id", studentId)
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({
            error: `Student index "${body.student_index}" is already used by another student. Please use a different index.`
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data, error } = await supabase
        .from("students")
        .update(body)
        .eq("id", studentId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('students/') && req.method === 'DELETE') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const studentId = path.split('/')[1];
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'teachers' && req.method === 'GET') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, username, email, full_name, role")
        .eq("role", "teacher")
        .order("full_name");

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'teachers' && req.method === 'POST') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();

      if (!body.email || !body.password || !body.full_name) {
        return new Response(JSON.stringify({ error: 'Missing required fields: email, password, full_name' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const passwordHash = await bcrypt.hash(body.password, 10);

      const { data, error } = await supabase
        .from("users")
        .insert({
          username: body.email,
          email: body.email,
          password_hash: passwordHash,
          full_name: body.full_name,
          role: 'teacher',
        })
        .select("id, username, email, full_name, role")
        .single();

      if (error) {
        console.error('Error creating teacher:', error);
        let errorMessage = 'Failed to create teacher';

        if (error.code === '23505' && error.message.includes('users_email_key')) {
          errorMessage = `A teacher with email "${body.email}" already exists. Please use a different email address.`;
        } else {
          errorMessage = error.message || 'Failed to create teacher';
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('teachers/') && req.method === 'PUT') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const teacherId = path.split('/')[1];
      const body = await req.json();

      const updateData: any = {
        full_name: body.full_name,
      };

      if (body.email) {
        updateData.email = body.email;
        updateData.username = body.email;
      }

      if (body.password) {
        updateData.password_hash = await bcrypt.hash(body.password, 10);
      }

      const { data, error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", teacherId)
        .select("id, username, email, full_name, role")
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('teachers/') && req.method === 'DELETE') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const teacherId = path.split('/')[1];
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", teacherId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'teacher-permissions' && req.method === 'GET') {
      const teacherId = url.searchParams.get('teacher_id');

      let query = supabase
        .from("teacher_grade_permissions")
        .select("*, grades(id, grade_name, academic_year, total_boys, total_girls, total_students), users!teacher_grade_permissions_teacher_id_fkey(full_name)");

      if (teacherId) {
        query = query.eq("teacher_id", teacherId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'teacher-permissions' && req.method === 'POST') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { data, error } = await supabase
        .from("teacher_grade_permissions")
        .insert({
          ...body,
          granted_by: auth.userId,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('teacher-permissions/') && req.method === 'PUT') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const permissionId = path.split('/')[1];
      const body = await req.json();
      const { data, error } = await supabase
        .from("teacher_grade_permissions")
        .update(body)
        .eq("id", permissionId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Permission not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('teacher-permissions/') && req.method === 'DELETE') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const permissionId = path.split('/')[1];
      const { error } = await supabase
        .from("teacher_grade_permissions")
        .delete()
        .eq("id", permissionId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Returns unique school days count for a grade in a date range using SQL COUNT DISTINCT — no row limit
    if (path === 'attendance/school-days' && req.method === 'GET') {
      const gradeId = url.searchParams.get('grade_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      if (!gradeId) {
        return new Response(JSON.stringify({ error: "grade_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.rpc('get_grade_school_days_count', {
        p_grade_id: gradeId,
        p_start_date: startDate || '1900-01-01',
        p_end_date: endDate || '2999-12-31',
      });

      if (error) throw error;
      return new Response(JSON.stringify({ school_days: data ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'attendance/monthly-summary' && req.method === 'GET') {
      const gradeId = url.searchParams.get('grade_id');
      const year = url.searchParams.get('year');

      if (!gradeId || !year) {
        return new Response(JSON.stringify({ error: "grade_id and year are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.rpc('get_monthly_attendance_summary', {
        p_grade_id: gradeId,
        p_year: parseInt(year),
      });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'attendance' && req.method === 'GET') {
      const gradeId = url.searchParams.get('grade_id');
      const studentId = url.searchParams.get('student_id');
      const date = url.searchParams.get('date');
      const session = url.searchParams.get('session');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      let query = supabase
        .from("attendance")
        .select("*, students!inner(student_index, student_name, grade_id, grades(grade_name))");

      if (gradeId) {
        query = query.eq("students.grade_id", gradeId);
      }
      if (studentId) {
        query = query.eq("student_id", studentId);
      }
      if (date) {
        query = query.eq("attendance_date", date);
      }
      if (session) {
        query = query.eq("session", session);
      }
      if (startDate) {
        query = query.gte("attendance_date", startDate);
      }
      if (endDate) {
        query = query.lte("attendance_date", endDate);
      }

      const { data, error } = await query
        .order("attendance_date", { ascending: true })
        .limit(10000);

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'attendance' && req.method === 'POST') {
      const body = await req.json();

      if (auth.role === 'teacher') {
        const { data: student } = await supabase
          .from("students")
          .select("grade_id")
          .eq("id", body.student_id)
          .maybeSingle();

        if (!student) {
          return new Response(JSON.stringify({ error: "Student not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: hasPermission } = await supabase
          .from("teacher_grade_permissions")
          .select("id")
          .eq("teacher_id", auth.userId)
          .eq("grade_id", student.grade_id)
          .eq("can_mark_attendance", true)
          .maybeSingle();

        if (!hasPermission) {
          return new Response(JSON.stringify({ error: "You don't have permission to mark attendance for this grade" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data, error } = await supabase
        .from("attendance")
        .upsert({
          ...body,
          marked_by: auth.userId,
        }, {
          onConflict: 'student_id,attendance_date,session',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'attendance/bulk' && req.method === 'POST') {
      const body = await req.json();

      if (auth.role === 'teacher' && body.records.length > 0) {
        const { data: student } = await supabase
          .from("students")
          .select("grade_id")
          .eq("id", body.records[0].student_id)
          .maybeSingle();

        if (student) {
          const { data: hasPermission } = await supabase
            .from("teacher_grade_permissions")
            .select("id")
            .eq("teacher_id", auth.userId)
            .eq("grade_id", student.grade_id)
            .maybeSingle();

          if (!hasPermission) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      const recordsWithUser = body.records.map((r: any) => ({
        ...r,
        marked_by: auth.userId,
      }));

      const { data, error } = await supabase
        .from("attendance")
        .insert(recordsWithUser)
        .select();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('attendance/') && req.method === 'PUT') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const attendanceId = path.split('/')[1];
      const body = await req.json();
      const { data, error } = await supabase
        .from("attendance")
        .update(body)
        .eq("id", attendanceId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith('attendance/') && req.method === 'DELETE') {
      if (auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const attendanceId = path.split('/')[1];
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", attendanceId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'users/change-password' && req.method === 'POST') {
      const body = await req.json();

      if (body.userId !== auth.userId && auth.role !== 'admin' && auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const trimmedPassword = body.newPassword?.trim();
      console.log('=== CHANGE PASSWORD REQUEST ===');
      console.log('Changing password for user:', body.userId);
      console.log('New password:', trimmedPassword);
      console.log('New password length (trimmed):', trimmedPassword?.length);
      console.log('Using service role key:', supabaseServiceKey?.substring(0, 20) + '...');

      const passwordHash = await bcrypt.hash(trimmedPassword, 10);
      console.log('Generated hash:', passwordHash);

      const testCompare = await bcrypt.compare(trimmedPassword, passwordHash);
      console.log('Immediate hash test (should be true):', testCompare);

      console.log('Attempting database update...');
      const { data: updateResult, error, count } = await supabase
        .from("users")
        .update({ password_hash: passwordHash })
        .eq("id", body.userId)
        .select("id, username, role, password_hash");

      console.log('Update result:', updateResult);
      console.log('Update count:', count);
      console.log('Update error:', error);

      if (error) {
        console.error('Update error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('No user found with id:', body.userId);
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log('Password updated successfully!');
      console.log('Updated user:', updateResult[0]);
      console.log('Hash in DB after update:', updateResult[0].password_hash);

      return new Response(JSON.stringify({ success: true, user: updateResult[0] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'admins' && req.method === 'GET') {
      if (auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, username, email, full_name, role, is_active")
        .eq("role", "admin")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'backup-settings' && req.method === 'GET') {
      if (auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("backup_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'backup-settings' && req.method === 'POST') {
      if (auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();

      const { data: existing } = await supabase
        .from("backup_settings")
        .select("id")
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from("backup_settings")
          .update(body)
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("backup_settings")
          .insert(body)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      return new Response(JSON.stringify(result.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'backup-history' && req.method === 'GET') {
      if (auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("backup_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === 'backup-history' && req.method === 'POST') {
      if (auth.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { data, error } = await supabase
        .from("backup_history")
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
