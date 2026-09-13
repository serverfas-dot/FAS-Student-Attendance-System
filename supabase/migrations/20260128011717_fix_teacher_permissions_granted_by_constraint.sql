/*
  # Fix Teacher Permissions Granted By Constraint

  1. Changes
    - Drop existing foreign key constraint on teacher_grade_permissions.granted_by
    - Recreate it with ON DELETE SET NULL instead of NO ACTION
    - This allows admins who granted permissions to be deleted
  
  2. Security
    - No RLS changes needed
*/

-- Drop the existing constraint
ALTER TABLE teacher_grade_permissions 
DROP CONSTRAINT IF EXISTS teacher_grade_permissions_granted_by_fkey;

-- Recreate with SET NULL on delete
ALTER TABLE teacher_grade_permissions 
ADD CONSTRAINT teacher_grade_permissions_granted_by_fkey 
FOREIGN KEY (granted_by) 
REFERENCES users(id) 
ON DELETE SET NULL;
