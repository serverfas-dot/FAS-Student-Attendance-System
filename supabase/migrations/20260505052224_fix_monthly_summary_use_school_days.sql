/*
  # Fix monthly attendance summary to use school days

  total_days = number of unique school days recorded in the month
  present/absent/sick/late = number of student-days with that status
  (i.e. across all students, how many days were they present/absent/etc)

  This matches what a teacher expects: "17 school days in February,
  students were present X times total across all students and days."
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
  WITH student_day_status AS (
    SELECT
      EXTRACT(MONTH FROM a.attendance_date)::int AS mn,
      a.attendance_date,
      a.student_id,
      CASE
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'present'
         AND MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'present' THEN 'present'
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'absent'
         AND MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'absent'  THEN 'absent'
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'sick'
          OR MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'sick'    THEN 'sick'
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'late'
          OR MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'late'    THEN 'late'
        WHEN MAX(CASE WHEN a.session = 'before_break' THEN a.status END) = 'present'
          OR MAX(CASE WHEN a.session = 'after_break'  THEN a.status END) = 'present' THEN 'present'
        ELSE COALESCE(
          MAX(CASE WHEN a.session = 'before_break' THEN a.status END),
          MAX(CASE WHEN a.session = 'after_break'  THEN a.status END)
        )
      END AS day_status
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE s.grade_id = p_grade_id
      AND EXTRACT(YEAR FROM a.attendance_date) = p_year
    GROUP BY a.student_id, a.attendance_date
  )
  SELECT
    mn                                                              AS month_num,
    TRIM(TO_CHAR(TO_DATE(mn::text, 'MM'), 'Month'))                AS month_name,
    p_year                                                         AS year_num,
    COUNT(DISTINCT attendance_date)                                AS total_days,
    COUNT(*) FILTER (WHERE day_status = 'present')                AS present,
    COUNT(*) FILTER (WHERE day_status = 'absent')                 AS absent,
    COUNT(*) FILTER (WHERE day_status = 'sick')                   AS sick,
    COUNT(*) FILTER (WHERE day_status = 'late')                   AS late
  FROM student_day_status
  GROUP BY mn
  ORDER BY mn;
$func$;
