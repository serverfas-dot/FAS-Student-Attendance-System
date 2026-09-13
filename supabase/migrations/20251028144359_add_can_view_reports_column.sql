/*
  # Add can_view_reports Column to Teacher Permissions

  ## Problem
  - Frontend code expects `can_view_reports` column in teacher_grade_permissions table
  - Column is missing from database schema
  - This causes permission saves to fail silently

  ## Changes
  1. Add `can_view_reports` column to teacher_grade_permissions table
     - Type: boolean
     - Default: true (teachers can view reports by default)
     - Not null constraint

  ## Impact
  - Allows admins to grant/revoke report viewing permissions separately from attendance marking
  - Fixes permission save functionality in admin dashboard
  - Teachers will be able to access both attendance marking and reports as intended
*/

-- Add can_view_reports column to teacher_grade_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teacher_grade_permissions' 
    AND column_name = 'can_view_reports'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE teacher_grade_permissions 
    ADD COLUMN can_view_reports boolean NOT NULL DEFAULT true;
  END IF;
END $$;