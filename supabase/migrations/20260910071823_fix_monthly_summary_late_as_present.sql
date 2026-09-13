/*
  # Fix monthly summary: late counts as present

  Per user request:
  - "Late" is a form of present — the student was physically at school.
  - Late days should be included in the present count, not reduce it.
  - Late is still tracked as its own number for reporting.
  - Sick and absent still reduce the present count.
  - Attendance rate = present / (present + absent + sick)

  This updates the existing get_monthly_attendance_summary function.
  No data is modified or deleted — only the function definition changes.
*/

CREATE OR REPLACE FUNCTION get_monthly_attendance_summary(
  p_grade_id uuid,
  p_year int
)
RETURNS TABLE (
  month_num int,
  month_name text,
  year_num int,
  total_days bigint,
  present bigint,
  absent bigint,
  sick bigint,
  late bigint
)
LANGUAGE sql
AS $func$
  WITH grade_school_days AS (
    SELECT
      EXTRACT(MONTH FROM a.attendance_date)::int AS mn,
      a.attendance_date
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE s.grade_id = p_grade_id
      AND EXTRACT(YEAR FROM a.attendance_date) = p_year
    GROUP BY EXTRACT(MONTH FROM a.attendance_date)::int, a.attendance_date
  ),
  grade_students AS (
    SELECT id AS student_id FROM students WHERE grade_id = p_grade_id
  ),
  expected AS (
    SELECT gs.mn, gd.attendance_date, gst.student_id
    FROM grade_school_days gs
    JOIN (SELECT DISTINCT mn FROM grade_school_days) gsd ON gsd.mn = gs.mn
    JOIN grade_school_days gd ON gd.mn = gs.mn
    JOIN grade_students gst ON true
    GROUP BY gs.mn, gd.attendance_date, gst.student_id
  ),
  student_day_status AS (
    SELECT
      EXTRACT(MONTH FROM a.attendance_date)::int AS mn,
      a.attendance_date,
      a.student_id,
      CASE
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'sick'
          OR MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'sick'    THEN 'sick'
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'late'
          OR MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'late'    THEN 'late'
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'present'
          OR MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'present' THEN 'present'
        ELSE 'absent'
      END AS day_status
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE s.grade_id = p_grade_id
      AND EXTRACT(YEAR FROM a.attendance_date) = p_year
    GROUP BY a.student_id, a.attendance_date
  ),
  full_status AS (
    SELECT
      e.mn,
      e.attendance_date,
      e.student_id,
      COALESCE(sds.day_status, 'absent') AS day_status
    FROM expected e
    LEFT JOIN student_day_status sds
      ON sds.student_id = e.student_id
     AND sds.attendance_date = e.attendance_date
  )
  SELECT
    mn                                               AS month_num,
    TRIM(TO_CHAR(TO_DATE(mn::text, 'MM'), 'Month'))  AS month_name,
    p_year                                           AS year_num,
    COUNT(DISTINCT attendance_date)                  AS total_days,
    COUNT(*) FILTER (WHERE day_status IN ('present', 'late')) AS present,
    COUNT(*) FILTER (WHERE day_status = 'absent')    AS absent,
    COUNT(*) FILTER (WHERE day_status = 'sick')      AS sick,
    COUNT(*) FILTER (WHERE day_status = 'late')     AS late
  FROM full_status
  GROUP BY mn
  ORDER BY mn;
$func$;
