/*
  # Fix Teacher Deletion

  1. Changes
    - Drop existing foreign key constraint on attendance.marked_by
    - Recreate it with ON DELETE SET NULL instead of NO ACTION
    - This allows teachers to be deleted while preserving attendance history
  
  2. Security
    - No RLS changes needed
*/

-- Drop the existing constraint
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_marked_by_fkey;

-- Recreate with SET NULL on delete
ALTER TABLE attendance 
ADD CONSTRAINT attendance_marked_by_fkey 
FOREIGN KEY (marked_by) 
REFERENCES users(id) 
ON DELETE SET NULL;
