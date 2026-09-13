/*
# Add student photo support

1. Schema changes
- Add `photo_url` (text, nullable) to `students` to store the public URL of an uploaded student photo.
2. Storage
- Create a public bucket `student-photos` for storing student profile images.
- Allow anon + authenticated to SELECT (read) and INSERT (upload) objects in the bucket so the
  browser (anon key) can upload and display photos.
3. Notes
- No existing data is modified or deleted.
- The column is nullable so existing students remain valid without a photo.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read student photos (public bucket)
DROP POLICY IF EXISTS "anon_read_student_photos" ON storage.objects;
CREATE POLICY "anon_read_student_photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'student-photos');

-- Allow anon + authenticated to upload student photos
DROP POLICY IF EXISTS "anon_insert_student_photos" ON storage.objects;
CREATE POLICY "anon_insert_student_photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'student-photos');

-- Allow anon + authenticated to update (replace) student photos
DROP POLICY IF EXISTS "anon_update_student_photos" ON storage.objects;
CREATE POLICY "anon_update_student_photos"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'student-photos')
  WITH CHECK (bucket_id = 'student-photos');

-- Allow deletion of student photos
DROP POLICY IF EXISTS "anon_delete_student_photos" ON storage.objects;
CREATE POLICY "anon_delete_student_photos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'student-photos');
