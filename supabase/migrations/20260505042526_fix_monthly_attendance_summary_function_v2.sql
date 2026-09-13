/*
  # Fix monthly attendance summary function

  Resolves ambiguous column reference by switching to SQL language and
  aliasing month number as "mn" internally.
*/

CREATE OR REPLACE FUNCTION get_monthly_attendance_summary(
  p_grade_id uuid,
  p_year int
)
RETURNS TABLE (
  month_num int,
  month_name text,
  year_num int,
  total_days numeric,
  present numeric,
  absent numeric,
  sick numeric,
  late numeric
)
LANGUAGE sql
AS $func$
  WITH student_day_sessions AS (
    SELECT
      a.student_id,
      a.attendance_date,
      EXTRACT(MONTH FROM a.attendance_date)::int AS mn,
      MAX(CASE WHEN a.session = 'before_break' THEN a.status END) AS before_break,
      MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) AS after_break
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE s.grade_id = p_grade_id
      AND EXTRACT(YEAR FROM a.attendance_date) = p_year
    GROUP BY a.student_id, a.attendance_date
  ),
  day_status AS (
    SELECT
      mn,
      CASE
        WHEN before_break IS NOT NULL AND after_break IS NOT NULL THEN
          CASE
            WHEN before_break = 'present' AND after_break = 'present' THEN 'present'
            WHEN before_break = 'absent'  AND after_break = 'absent'  THEN 'absent'
            WHEN before_break = 'sick'    OR  after_break = 'sick'    THEN 'sick'
            WHEN before_break = 'late'    OR  after_break = 'late'    THEN 'late'
            WHEN before_break = 'present' OR  after_break = 'present' THEN 'present'
            ELSE 'absent'
          END
        ELSE COALESCE(before_break, after_break)
      END AS resolved_status,
      CASE
        WHEN before_break IS NOT NULL AND after_break IS NOT NULL THEN 1.0
        ELSE 0.5
      END AS day_weight
    FROM student_day_sessions
  )
  SELECT
    ds.mn                                                                          AS month_num,
    TRIM(TO_CHAR(TO_DATE(ds.mn::text, 'MM'), 'Month'))                            AS month_name,
    p_year                                                                         AS year_num,
    SUM(ds.day_weight)                                                             AS total_days,
    COALESCE(SUM(ds.day_weight) FILTER (WHERE ds.resolved_status = 'present'), 0) AS present,
    COALESCE(SUM(ds.day_weight) FILTER (WHERE ds.resolved_status = 'absent'),  0) AS absent,
    COALESCE(SUM(ds.day_weight) FILTER (WHERE ds.resolved_status = 'sick'),    0) AS sick,
    COALESCE(SUM(ds.day_weight) FILTER (WHERE ds.resolved_status = 'late'),    0) AS late
  FROM day_status ds
  GROUP BY ds.mn
  ORDER BY ds.mn;
$func$;
