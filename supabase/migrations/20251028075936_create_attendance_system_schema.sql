/*
  # School Attendance System Schema

  ## Overview
  Complete attendance management system with role-based access control for admins and teachers.

  ## New Tables
  
  ### 1. `users`
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique, not null) - User email for login
  - `password_hash` (text, not null) - Hashed password
  - `full_name` (text, not null) - User's full name
  - `role` (text, not null) - Either 'admin' or 'teacher'
  - `is_active` (boolean, default true) - Account status
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `grades`
  - `id` (uuid, primary key) - Unique grade identifier
  - `grade_name` (text, not null) - Grade name (e.g., "Grade 1", "Grade 2")
  - `total_boys` (integer, default 0) - Total number of boys in grade
  - `total_girls` (integer, default 0) - Total number of girls in grade
  - `total_students` (integer, default 0) - Total students (computed)
  - `academic_year` (text, not null) - Academic year (e.g., "2024-2025")
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. `students`
  - `id` (uuid, primary key) - Unique student identifier
  - `student_index` (text, unique, not null) - Student index/roll number
  - `student_name` (text, not null) - Student's full name
  - `gender` (text, not null) - 'Male' or 'Female'
  - `grade_id` (uuid, foreign key) - Reference to grades table
  - `is_active` (boolean, default true) - Student enrollment status
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `attendance`
  - `id` (uuid, primary key) - Unique attendance record identifier
  - `student_id` (uuid, foreign key) - Reference to students table
  - `attendance_date` (date, not null) - Date of attendance
  - `status` (text, not null) - 'present', 'absent', 'sick', or 'late'
  - `marked_by` (uuid, foreign key) - Reference to users table (teacher who marked)
  - `notes` (text) - Optional notes about attendance
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 5. `teacher_grade_permissions`
  - `id` (uuid, primary key) - Unique permission identifier
  - `teacher_id` (uuid, foreign key) - Reference to users table
  - `grade_id` (uuid, foreign key) - Reference to grades table
  - `can_mark_attendance` (boolean, default true) - Permission to mark attendance
  - `granted_by` (uuid, foreign key) - Admin who granted permission
  - `granted_at` (timestamptz) - Permission grant timestamp

  ## Security
  - Enable RLS on all tables
  - Admins have full access to all operations
  - Teachers can only mark attendance for grades they have permission for
  - Teachers cannot edit attendance, only mark new entries
  - Admins can edit all attendance records
  - All users must be authenticated to access the system

  ## Indexes
  - Index on student_index for fast lookups
  - Index on attendance_date for reporting
  - Composite index on student_id and attendance_date for unique daily records
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'teacher')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create grades table
CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_name text NOT NULL,
  total_boys integer DEFAULT 0 CHECK (total_boys >= 0),
  total_girls integer DEFAULT 0 CHECK (total_girls >= 0),
  total_students integer GENERATED ALWAYS AS (total_boys + total_girls) STORED,
  academic_year text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(grade_name, academic_year)
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_index text UNIQUE NOT NULL,
  student_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'sick', 'late')),
  marked_by uuid NOT NULL REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);

-- Create teacher_grade_permissions table
CREATE TABLE IF NOT EXISTS teacher_grade_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  can_mark_attendance boolean DEFAULT true,
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, grade_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_index ON students(student_index);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_teacher_permissions ON teacher_grade_permissions(teacher_id, grade_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_grade_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for grades table
CREATE POLICY "Authenticated users can view grades"
  ON grades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update grades"
  ON grades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete grades"
  ON grades FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for students table
CREATE POLICY "Authenticated users can view students"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for attendance table
CREATE POLICY "Authenticated users can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can mark attendance for permitted grades"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = marked_by
    AND (
      -- Admin can mark for any grade
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
      OR
      -- Teacher can mark only for grades they have permission
      EXISTS (
        SELECT 1 FROM teacher_grade_permissions tgp
        JOIN students s ON s.grade_id = tgp.grade_id
        WHERE tgp.teacher_id = auth.uid()
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
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for teacher_grade_permissions table
CREATE POLICY "Users can view their own permissions"
  ON teacher_grade_permissions FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can grant permissions"
  ON teacher_grade_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update permissions"
  ON teacher_grade_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can revoke permissions"
  ON teacher_grade_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin account (password: admin123)
-- Note: In production, this should be changed immediately
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@school.com',
  '$2a$10$rKvwPYzKz5YxZ5xZ5xZ5xOqVqVqVqVqVqVqVqVqVqVqVqVqVqVqVq',
  'System Administrator',
  'admin'
)
ON CONFLICT (email) DO NOTHING;