/*
  # Add Foreign Key Indexes

  ## Changes
  - Add indexes for foreign keys to improve query performance
  
  ## New Indexes
  1. `idx_attendance_marked_by` - Index on attendance.marked_by for queries filtering by user
  2. `idx_teacher_permissions_grade_id` - Index on teacher_grade_permissions.grade_id for grade lookups
  3. `idx_teacher_permissions_granted_by` - Index on teacher_grade_permissions.granted_by for audit queries
  
  ## Performance Impact
  - These indexes will improve JOIN performance
  - Speeds up queries that filter by these foreign keys
  - Minimal storage overhead
  
  ## Note on RLS
  - RLS is intentionally disabled for this application
  - The system uses custom authentication (not Supabase Auth)
  - All security is handled at the application layer
*/

-- Add index for attendance.marked_by foreign key
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by 
ON attendance(marked_by);

-- Add index for teacher_grade_permissions.grade_id foreign key
CREATE INDEX IF NOT EXISTS idx_teacher_permissions_grade_id 
ON teacher_grade_permissions(grade_id);

-- Add index for teacher_grade_permissions.granted_by foreign key
CREATE INDEX IF NOT EXISTS idx_teacher_permissions_granted_by 
ON teacher_grade_permissions(granted_by);