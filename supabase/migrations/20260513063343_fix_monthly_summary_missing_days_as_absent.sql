/*
  # Fix monthly summary: missing student-days count as absent

  Problem: If a teacher didn't record a student on a particular school day,
  that student showed fewer total days than classmates.

  Fix: For each student, days not recorded (but recorded for other students
  in the grade) are counted as absent. Every student in the same grade
  will now show the same total_days = grade-wide unique school days.

  Total_days = grade-wide unique school days per month.
  Present/absent/sick/late = student-day counts with missing days as absent.
  Attendance rate is computed on the frontend as present / (present + absent).
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
  -- All unique school days per month for this grade
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
  -- All students in this grade
  grade_students AS (
    SELECT id AS student_id FROM students WHERE grade_id = p_grade_id
  ),
  -- Cross join: every student x every school day = expected record
  expected AS (
    SELECT gs.mn, gd.attendance_date, gst.student_id
    FROM grade_school_days gs
    JOIN (SELECT DISTINCT mn FROM grade_school_days) gsd ON gsd.mn = gs.mn
    -- re-join to get full cross product per month
    JOIN grade_school_days gd ON gd.mn = gs.mn
    JOIN grade_students gst ON true
    -- deduplicate
    GROUP BY gs.mn, gd.attendance_date, gst.student_id
  ),
  -- Actual recorded status per student per day
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
  -- Merge expected with actual; missing = absent
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
    COUNT(*) FILTER (WHERE day_status = 'present')   AS present,
    COUNT(*) FILTER (WHERE day_status = 'absent')    AS absent,
    COUNT(*) FILTER (WHERE day_status = 'sick')      AS sick,
    COUNT(*) FILTER (WHERE day_status = 'late')      AS late
  FROM full_status
  GROUP BY mn
  ORDER BY mn;
$func$;
