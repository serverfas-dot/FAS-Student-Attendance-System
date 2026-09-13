/*
  # Add can_edit_attendance Permission to Teacher Grade Permissions

  1. Changes
    - Add `can_edit_attendance` column to teacher_grade_permissions table
      - Defaults to false for security (admins must explicitly grant edit rights)
      - Allows admins to control whether teachers can edit existing attendance records

  2. Security
    - Column is boolean with NOT NULL constraint
    - Defaults to false to ensure teachers don't automatically have edit access
    - Existing records will be set to false (safer default)

  3. Purpose
    - Separates "mark attendance" (create new) from "edit attendance" (modify existing)
    - Gives admins granular control over teacher permissions
*/

-- Add can_edit_attendance column to teacher_grade_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teacher_grade_permissions'
    AND column_name = 'can_edit_attendance'
  ) THEN
    ALTER TABLE teacher_grade_permissions
    ADD COLUMN can_edit_attendance boolean NOT NULL DEFAULT false;
  END IF;
END $$;