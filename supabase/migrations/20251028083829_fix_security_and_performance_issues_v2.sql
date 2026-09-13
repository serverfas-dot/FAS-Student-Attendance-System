/*
  # Fix Security and Performance Issues

  ## Changes
  
  1. **Add Missing Indexes**
     - Add index on attendance.marked_by foreign key
     - Add index on teacher_grade_permissions.grade_id foreign key
     - Add index on teacher_grade_permissions.granted_by foreign key
  
  2. **Optimize RLS Policies**
     - Wrap all auth.uid() calls with (select auth.uid()) to prevent re-evaluation
     - Consolidate multiple permissive SELECT policies into single policy
  
  3. **Fix Function Search Path**
     - Add SET search_path to update_updated_at_column function
  
  ## Performance Impact
  - RLS policies will now cache auth.uid() result per query instead of per row
  - New indexes will improve foreign key lookup performance
  - Search path security prevents function hijacking attacks
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON attendance(marked_by);
CREATE INDEX IF NOT EXISTS idx_teacher_permissions_grade_id ON teacher_grade_permissions(grade_id);
CREATE INDEX IF NOT EXISTS idx_teacher_permissions_granted_by ON teacher_grade_permissions(granted_by);

-- Drop existing RLS policies to recreate them with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

DROP POLICY IF EXISTS "Admins can insert grades" ON grades;
DROP POLICY IF EXISTS "Admins can update grades" ON grades;
DROP POLICY IF EXISTS "Admins can delete grades" ON grades;

DROP POLICY IF EXISTS "Admins can insert students" ON students;
DROP POLICY IF EXISTS "Admins can update students" ON students;
DROP POLICY IF EXISTS "Admins can delete students" ON students;

DROP POLICY IF EXISTS "Teachers can mark attendance for permitted grades" ON attendance;
DROP POLICY IF EXISTS "Only admins can update attendance" ON attendance;
DROP POLICY IF EXISTS "Only admins can delete attendance" ON attendance;

DROP POLICY IF EXISTS "Users can view their own permissions" ON teacher_grade_permissions;
DROP POLICY IF EXISTS "Only admins can grant permissions" ON teacher_grade_permissions;
DROP POLICY IF EXISTS "Only admins can update permissions" ON teacher_grade_permissions;
DROP POLICY IF EXISTS "Only admins can revoke permissions" ON teacher_grade_permissions;

-- Recreate users table RLS policies with optimized auth.uid() and consolidated SELECT
CREATE POLICY "Authenticated users can view users"
  ON users FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- Recreate grades table RLS policies with optimized auth.uid()
CREATE POLICY "Admins can insert grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update grades"
  ON grades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete grades"
  ON grades FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- Recreate students table RLS policies with optimized auth.uid()
CREATE POLICY "Admins can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- Recreate attendance table RLS policies with optimized auth.uid()
CREATE POLICY "Teachers can mark attendance for permitted grades"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = marked_by
    AND (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = (select auth.uid())
        AND users.role = 'admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM teacher_grade_permissions tgp
        JOIN students s ON s.grade_id = tgp.grade_id
        WHERE tgp.teacher_id = (select auth.uid())
        AND s.id = student_id
        AND tgp.can_mark_attendance = true
      )
    )
  );

CREATE POLICY "Only admins can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- Recreate teacher_grade_permissions table RLS policies with optimized auth.uid()
CREATE POLICY "Users can view their own permissions"
  ON teacher_grade_permissions FOR SELECT
  TO authenticated
  USING (
    teacher_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can grant permissions"
  ON teacher_grade_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update permissions"
  ON teacher_grade_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can revoke permissions"
  ON teacher_grade_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

-- Fix function search path security issue
-- Drop triggers first, then function, then recreate
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;

DROP FUNCTION IF EXISTS update_updated_at_column();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();