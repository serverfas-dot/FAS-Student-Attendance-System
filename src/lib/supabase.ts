import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '')
  .trim()
  .replace(/^['"]|['"]$/g, '');
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
  .trim()
  .replace(/^['"]|['"]$/g, '');
const validSupabaseUrl = /^https?:\/\//.test(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: /^https?:\/\//.test(supabaseUrl),
    hasKey: !!supabaseAnonKey
  });
}

export const supabase = createClient(
  validSupabaseUrl,
  supabaseAnonKey || 'placeholder-key'
);

export type User = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'super_admin';
};

export type Grade = {
  id: string;
  grade_name: string;
  total_boys: number;
  total_girls: number;
  total_students: number;
  academic_year: string;
  created_at: string;
};

export type Student = {
  id: string;
  student_index: string;
  student_name: string;
  gender: 'Male' | 'Female';
  grade_id: string;
  is_active: boolean;
  photo_url: string | null;
  house: string | null;
  position: string | null;
  created_at: string;
};

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'late';
export type AttendanceSession = 'before_break' | 'after_break';

export type Attendance = {
  id: string;
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  session: AttendanceSession;
  is_half_day: boolean;
  marked_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TeacherGradePermission = {
  id: string;
  teacher_id: string;
  grade_id: string;
  can_mark_attendance: boolean;
  granted_by: string;
  granted_at: string;
};
