/*
# Add house and position columns to students table

1. Changes
- Add `house` (text, nullable) to `students` — stores the student's house assignment (e.g., "Red House", "Blue House").
- Add `position` (text, nullable) to `students` — stores the student's leadership role/position (e.g., "School Captain", "Prefect", "Vice Captain").
- Both columns are optional; existing rows get NULL.
2. Security
- No RLS policy changes needed. Existing admin-only INSERT/UPDATE/DELETE policies already cover these columns. SELECT is already open to authenticated users.
3. Notes
- These columns are editable from the admin Student Management form.
- The Student Attendance Dashboard displays house and position in the student profile sidebar.
*/

ALTER TABLE students ADD COLUMN IF NOT EXISTS house text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS position text;
