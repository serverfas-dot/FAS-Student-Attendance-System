/*
# Restrict student photo storage writes

1. Security changes
- Keep `student-photos` publicly readable so profile images can display in the dashboard.
- Remove direct browser INSERT, UPDATE, and DELETE policies for the bucket.
- Photo writes now happen only through the authenticated API function, which validates the
  administrator role, file type, and file size before using the service role to store the image.
2. Data safety
- Existing photos and the `students.photo_url` column are preserved.
- No rows, files, or columns are deleted by this migration.
*/

DROP POLICY IF EXISTS "anon_insert_student_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_student_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_student_photos" ON storage.objects;
