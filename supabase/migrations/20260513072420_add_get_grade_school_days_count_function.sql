/*
  # Add get_grade_school_days_count function

  Returns the number of unique school days recorded for a grade within a date range.
  Uses COUNT(DISTINCT ...) in SQL — no row limit issues, always accurate.
*/

CREATE OR REPLACE FUNCTION get_grade_school_days_count(
  p_grade_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS bigint
LANGUAGE sql
AS $func$
  SELECT COUNT(DISTINCT a.attendance_date)
  FROM attendance a
  JOIN students s ON s.id = a.student_id
  WHERE s.grade_id = p_grade_id
    AND a.attendance_date >= p_start_date
    AND a.attendance_date <= p_end_date;
$func$;
