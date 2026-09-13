/*
  # Remove Unused Indexes

  ## Changes
  - Drop unused indexes that are not being utilized by queries
  - Keep only essential indexes for performance
  
  ## Removed Indexes
  1. `idx_teacher_permissions_granted_by` - Not used in queries
  2. `idx_attendance_student` - Not used (composite index covers this)
  3. `idx_attendance_marked_by` - Not used in queries
  4. `idx_teacher_permissions_grade_id` - Not used (composite index covers this)
  
  ## Note on RLS
  - RLS is intentionally disabled for this application
  - The system uses custom authentication (not Supabase Auth)
  - All security is handled at the application layer
  - Only authenticated users with valid credentials can access the API
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_teacher_permissions_granted_by;
DROP INDEX IF EXISTS idx_attendance_student;
DROP INDEX IF EXISTS idx_attendance_marked_by;
DROP INDEX IF EXISTS idx_teacher_permissions_grade_id;