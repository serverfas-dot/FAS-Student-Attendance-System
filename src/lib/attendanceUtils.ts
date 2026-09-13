export type SessionAttendanceRecord = {
  attendance_date: string;
  session: 'before_break' | 'after_break';
  status: string;
};

// Resolve two session statuses into one day status for a single student.
// Priority: sick > late > present > absent
// Sick and late are NEVER counted as absent.
export function resolveSessionStatus(before?: string, after?: string): string {
  if (before && after) {
    if (before === 'sick' || after === 'sick') return 'sick';
    if (before === 'late' || after === 'late') return 'late';
    if (before === 'present' || after === 'present') return 'present';
    return 'absent';
  }
  return before || after || 'absent';
}

// Calculate per-student stats from their raw session records.
//
// Counting rules (per user request):
//   - Only days the teacher actually filled attendance count. Days with no
//     records (holidays, weekends, days the teacher didn't fill) are ignored
//     entirely — they are NOT counted as absent, present, or anything.
//   - "Late" is a form of present — it does NOT reduce the present count.
//     Late is tracked as its own number but the student was physically present.
//   - "Sick" and "Absent" DO reduce the present count.
//   - Attendance rate = present / (present + absent + sick)
export function calculateFullDays(
  attendanceRecords: SessionAttendanceRecord[],
  gradeTotalDays?: number
): {
  totalDays: number;
  present: number;
  absent: number;
  sick: number;
  late: number;
  attendance_rate: number;
} {
  const dateMap: Record<string, { before_break?: string; after_break?: string }> = {};

  attendanceRecords.forEach(record => {
    if (!dateMap[record.attendance_date]) {
      dateMap[record.attendance_date] = {};
    }
    dateMap[record.attendance_date][record.session] = record.status;
  });

  let present = 0, absent = 0, sick = 0, late = 0;

  Object.values(dateMap).forEach(sessions => {
    const status = resolveSessionStatus(sessions.before_break, sessions.after_break);
    if (status === 'present') present++;
    else if (status === 'late') { present++; late++; }
    else if (status === 'sick') sick++;
    else if (status === 'absent') absent++;
  });

  // Only count days that were actually recorded. No "missing days as absent."
  const totalDays = present + absent + sick;

  const rateBase = present + absent + sick;
  const attendance_rate = rateBase > 0
    ? Math.round((present / rateBase) * 100)
    : 0;

  return { totalDays, present, absent, sick, late, attendance_rate };
}
