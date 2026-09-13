/*
  # Add Session-Based Attendance System

  ## Problem
  - School has two sessions per day: before break (BF-BR) and after break (AF-BR)
  - Students may attend only one session (half day)
  - Two half-day attendances should count as one full day
  - Need to track attendance by session

  ## Changes
  1. Add `session` column to attendance table
     - Values: 'before_break' or 'after_break'
     - Default: 'before_break' for backward compatibility
  2. Add `is_half_day` column to track if attendance is for half day
     - Default: false (full day attendance)
  3. Update unique constraint to allow multiple records per day (one per session)
     - Remove old constraint (student_id, attendance_date)
     - Add new constraint (student_id, attendance_date, session)

  ## Impact
  - Allows marking attendance separately for before break and after break sessions
  - Reports will calculate full days from two half-day attendances
  - Backward compatible with existing attendance records
*/

-- Add session column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' 
    AND column_name = 'session'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE attendance 
    ADD COLUMN session text NOT NULL DEFAULT 'before_break' CHECK (session IN ('before_break', 'after_break'));
  END IF;
END $$;

-- Add is_half_day column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' 
    AND column_name = 'is_half_day'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE attendance 
    ADD COLUMN is_half_day boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Drop old unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_student_id_attendance_date_key'
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_attendance_date_key;
  END IF;
END $$;

-- Add new unique constraint for student, date, and session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_student_date_session_unique'
  ) THEN
    ALTER TABLE attendance 
    ADD CONSTRAINT attendance_student_date_session_unique 
    UNIQUE (student_id, attendance_date, session);
  END IF;
END $$;

-- Create index for better query performance on session-based attendance
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(student_id, attendance_date, session);