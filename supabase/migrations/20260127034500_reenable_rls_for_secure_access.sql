/*
  # Re-enable RLS for Secure Public Access

  ## Overview
  Re-enables Row Level Security on all tables to prevent unauthorized direct database access.
  All legitimate operations now go through secured Edge Functions that use the service role key.

  ## Changes Made

  1. **Security Enhancement**
     - Re-enable RLS on all tables (users, grades, students, attendance, teacher_grade_permissions)
     - Create restrictive policies that block all direct access
     - Edge Functions bypass RLS using service role key
     - Frontend uses anon key which respects RLS policies

  2. **RLS Policies**
     - All tables: Deny all direct access (SELECT, INSERT, UPDATE, DELETE)
     - Only Edge Functions with service role can access data
     - Frontend must authenticate through Edge Functions

  ## Security Model
  - Frontend → Edge Function (with auth token) → Database (service role bypasses RLS)
  - Direct Frontend → Database access is blocked by RLS policies
  - This prevents unauthorized access even if anon key is exposed
*/

-- Re-enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_grade_permissions ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies that deny all direct access
-- These policies ensure only Edge Functions (using service role) can access data

-- Users table: No direct access allowed
CREATE POLICY "Deny all direct access to users"
  ON users
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Grades table: No direct access allowed
CREATE POLICY "Deny all direct access to grades"
  ON grades
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Students table: No direct access allowed
CREATE POLICY "Deny all direct access to students"
  ON students
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Attendance table: No direct access allowed
CREATE POLICY "Deny all direct access to attendance"
  ON attendance
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Teacher grade permissions table: No direct access allowed
CREATE POLICY "Deny all direct access to teacher_grade_permissions"
  ON teacher_grade_permissions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
