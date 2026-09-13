/*
  # Fix Teacher Grade Permissions RLS Policies

  1. Changes
    - Drop the overly restrictive policy that denies all access
    - Add proper policies for teachers to read their own permissions
    - Add proper policies for admins to manage all permissions
  
  2. Security
    - Teachers can only read permissions assigned to them
    - Admins and super admins can read and manage all permissions
    - Only authenticated users can access the table
*/

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Deny all direct access to teacher_grade_permissions" ON teacher_grade_permissions;

-- Allow teachers to view their own permissions
CREATE POLICY "Teachers can view own permissions"
  ON teacher_grade_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.id = teacher_grade_permissions.teacher_id
        OR users.role IN ('admin', 'super_admin')
      )
    )
  );

-- Allow admins to insert permissions
CREATE POLICY "Admins can insert permissions"
  ON teacher_grade_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Allow admins to update permissions
CREATE POLICY "Admins can update permissions"
  ON teacher_grade_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Allow admins to delete permissions
CREATE POLICY "Admins can delete permissions"
  ON teacher_grade_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );
