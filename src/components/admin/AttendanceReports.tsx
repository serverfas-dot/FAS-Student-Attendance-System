import React, { useState, useEffect } from 'react';
import { Student, Grade } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { FileText, Users, User } from 'lucide-react';
import StudentAttendanceDashboard from './StudentAttendanceDashboard';
import { resolveSessionStatus } from '../../lib/attendanceUtils';

type ReportType = 'daily' | 'monthly' | 'yearly' | 'student' | 'school_daily';

type AttendanceStats = {
  present: number;
  absent: number;
  sick: number;
  late: number;
  total: number;
};

type GenderStats = {
  boys: AttendanceStats;
  girls: AttendanceStats;
};

export default function AttendanceReports() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [studentPeriod, setStudentPeriod] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [studentMonth, setStudentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [studentCustomStart, setStudentCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [studentCustomEnd, setStudentCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    if (selectedGrade) fetchStudents();
  }, [selectedGrade]);

  async function fetchGrades() {
    if (!user) return;
    setIsLoadingGrades(true);
    try {
      const data = await api.grades.getAll(user.id);
      setGrades(data);
    } catch (err) {
      console.error('Error fetching grades:', err);
    } finally {
      setIsLoadingGrades(false);
    }
  }

  async function fetchStudents() {
    if (!user) return;
    try {
      const data = await api.students.getAll(user.id, selectedGrade);
      setStudents(data);
      if (data.length > 0 && reportType === 'student') setSelectedStudent(data[0].id);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }

  function computeGenderStats(studentStatsList: Array<AttendanceStats & { student: any }>): GenderStats {
    const boys: AttendanceStats = { present: 0, absent: 0, sick: 0, late: 0, total: 0 };
    const girls: AttendanceStats = { present: 0, absent: 0, sick: 0, late: 0, total: 0 };
    studentStatsList.forEach(({ student, present, absent, sick, late, total }) => {
      const target = student.gender === 'Male' ? boys : girls;
      target.present += present;
      target.absent += absent;
      target.sick += sick;
      target.late += late;
      target.total += total;
    });
    return { boys, girls };
  }

  async function buildGradeStats(
    gradeStudents: any[],
    attendanceRecords: any[],
  ): Promise<Array<AttendanceStats & { student: any }>> {
    const studentDateMap: Record<string, Record<string, { before_break?: string; after_break?: string }>> = {};

    attendanceRecords.forEach((record: any) => {
      if (!studentDateMap[record.student_id]) studentDateMap[record.student_id] = {};
      if (!studentDateMap[record.student_id][record.attendance_date])
        studentDateMap[record.student_id][record.attendance_date] = {};
      studentDateMap[record.student_id][record.attendance_date][record.session as 'before_break' | 'after_break'] = record.status;
    });

    return gradeStudents.map((student: any) => {
      const dates = studentDateMap[student.id] || {};
      let present = 0, absent = 0, sick = 0, late = 0;
      Object.values(dates).forEach((sessions) => {
        const status = resolveSessionStatus(sessions.before_break, sessions.after_break);
        if (status === 'present') present++;
        else if (status === 'late') { present++; late++; }
        else if (status === 'sick') sick++;
        else if (status === 'absent') absent++;
      });
      // Only count days the teacher actually filled. Unrecorded days are ignored.
      const total = present + absent + sick;
      return { student, present, absent, sick, late, total };
    });
  }

  async function generateReport() {
    if (reportType !== 'school_daily' && !selectedGrade) return;
    if (!user) return;
    if (reportType === 'student' && !selectedStudent) {
      setError('Please select a student for the student report.');
      return;
    }

    setIsLoading(true);
    setReportData(null);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      let startDate: string;
      let endDate: string;

      if (reportType === 'daily' || reportType === 'school_daily') {
        startDate = selectedDate;
        endDate = selectedDate;
      } else if (reportType === 'monthly') {
        startDate = `${selectedMonth}-01`;
        const d = new Date(selectedMonth + '-01');
        d.setMonth(d.getMonth() + 1);
        const next = d.toISOString().split('T')[0];
        endDate = next < today ? new Date(d.getTime() - 86400000).toISOString().split('T')[0] : today;
      } else if (reportType === 'student') {
        if (studentPeriod === 'monthly') {
          startDate = `${studentMonth}-01`;
          const d = new Date(studentMonth + '-01');
          d.setMonth(d.getMonth() + 1);
          endDate = new Date(d.getTime() - 86400000).toISOString().split('T')[0];
        } else if (studentPeriod === 'yearly') {
          startDate = `${selectedYear}-01-01`;
          endDate = `${selectedYear}-12-31`;
        } else {
          startDate = studentCustomStart;
          endDate = studentCustomEnd;
        }
      } else {
        startDate = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        endDate = yearEnd < today ? yearEnd : today;
      }

      // ── School-wide daily report ──────────────────────────────────────────
      if (reportType === 'school_daily') {
        const [allStudents, allAttendance] = await Promise.all([
          api.students.getAll(user.id),
          api.attendance.getAll(user.id, { date: selectedDate }),
        ]);

        if (!allAttendance || allAttendance.length === 0) {
          setError('No attendance data found for the selected date.');
          return;
        }

        // Group students by grade
        const studentsByGrade: Record<string, any[]> = {};
        allStudents.forEach((s: any) => {
          if (!studentsByGrade[s.grade_id]) studentsByGrade[s.grade_id] = [];
          studentsByGrade[s.grade_id].push(s);
        });

        // Build per-grade stats
        const gradeResults: Array<{
          grade: Grade;
          stats: AttendanceStats;
          genderStats: GenderStats;
          studentStats: Array<AttendanceStats & { student: any }>;
        }> = [];

        for (const grade of grades) {
          const gradeStudents = studentsByGrade[grade.id] || [];
          if (gradeStudents.length === 0) continue;
          const gradeRecords = allAttendance.filter((r: any) =>
            gradeStudents.some((s: any) => s.id === r.student_id)
          );
          const studentStatsList = await buildGradeStats(gradeStudents, gradeRecords);

          const stats: AttendanceStats = { present: 0, absent: 0, sick: 0, late: 0, total: 0 };
          studentStatsList.forEach(s => {
            stats.present += s.present; stats.absent += s.absent;
            stats.sick += s.sick; stats.late += s.late; stats.total += s.total;
          });
          const genderStats = computeGenderStats(studentStatsList);
          gradeResults.push({ grade, stats, genderStats, studentStats: studentStatsList });
        }

        // School-wide totals
        const schoolStats: AttendanceStats = { present: 0, absent: 0, sick: 0, late: 0, total: 0 };
        const schoolGender: GenderStats = {
          boys: { present: 0, absent: 0, sick: 0, late: 0, total: 0 },
          girls: { present: 0, absent: 0, sick: 0, late: 0, total: 0 },
        };
        gradeResults.forEach(({ stats, genderStats }) => {
          schoolStats.present += stats.present; schoolStats.absent += stats.absent;
          schoolStats.sick += stats.sick; schoolStats.late += stats.late; schoolStats.total += stats.total;
          (['present', 'absent', 'sick', 'late', 'total'] as const).forEach(k => {
            schoolGender.boys[k] += genderStats.boys[k];
            schoolGender.girls[k] += genderStats.girls[k];
          });
        });

        setReportData({ type: 'school_daily', date: selectedDate, schoolStats, schoolGender, gradeResults });
        return;
      }

      // ── Per-grade student report ──────────────────────────────────────────
      const attendanceFetch = reportType === 'student' && selectedStudent
        ? api.attendance.getAll(user.id, { student_id: selectedStudent, start_date: startDate, end_date: endDate })
        : api.attendance.getAll(user.id, { grade_id: selectedGrade, start_date: startDate, end_date: endDate });

      const [allStudents, attendanceData] = await Promise.all([
        api.students.getAll(user.id, selectedGrade),
        attendanceFetch,
      ]);

      if (!attendanceData || attendanceData.length === 0) {
        setError('No attendance data found for the selected criteria.');
        return;
      }

      if (reportType === 'student' && selectedStudent) {
        const dateMap: Record<string, { before_break?: string; after_break?: string }> = {};
        attendanceData.forEach((record: any) => {
          if (!dateMap[record.attendance_date]) dateMap[record.attendance_date] = {};
          dateMap[record.attendance_date][record.session as 'before_break' | 'after_break'] = record.status;
        });

        let present = 0, absent = 0, sick = 0, late = 0;
        Object.values(dateMap).forEach((sessions) => {
          const status = resolveSessionStatus(sessions.before_break, sessions.after_break);
          if (status === 'present') present++;
          else if (status === 'late') { present++; late++; }
          else if (status === 'sick') sick++;
          else if (status === 'absent') absent++;
        });

        // Only count days the teacher actually filled. Unrecorded days are ignored.
        const stats: AttendanceStats = { present, absent, sick, late, total: present + absent + sick };
        const student = allStudents.find((s: any) => s.id === selectedStudent);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthlyBreakdown = monthNames.map((month, index) => {
          const monthNumber = index + 1;
          const monthRecords = attendanceData.filter((record: any) => Number(record.attendance_date.slice(5, 7)) === monthNumber);
          const monthDates: Record<string, { before_break?: string; after_break?: string }> = {};
          monthRecords.forEach((record: any) => {
            if (!monthDates[record.attendance_date]) monthDates[record.attendance_date] = {};
            monthDates[record.attendance_date][record.session as 'before_break' | 'after_break'] = record.status;
          });
          let monthPresent = 0, monthAbsent = 0, monthSick = 0, monthLate = 0;
          Object.values(monthDates).forEach((sessions) => {
            const status = resolveSessionStatus(sessions.before_break, sessions.after_break);
            if (status === 'present') monthPresent++;
            else if (status === 'late') { monthPresent++; monthLate++; }
            else if (status === 'sick') monthSick++;
            else if (status === 'absent') monthAbsent++;
          });
          // Only count days the teacher actually filled.
          const recordedDays = monthPresent + monthAbsent + monthSick;
          const rateBase = recordedDays;
          return {
            month,
            schoolDays: recordedDays,
            present: monthPresent,
            absent: monthAbsent,
            sick: monthSick,
            late: monthLate,
            attendanceRate: rateBase > 0 ? Math.round((monthPresent / rateBase) * 100) : 0,
          };
        }).filter((month) => month.schoolDays > 0 || month.late > 0);

        const dayBreakdown = Object.entries(dateMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, sessions]) => ({
            date,
            before_break: sessions.before_break,
            after_break: sessions.after_break,
            day_status: resolveSessionStatus(sessions.before_break, sessions.after_break),
          }));

        setReportData({ type: 'student', student, stats, records: attendanceData, dayBreakdown, monthlyBreakdown });
      } else {
        const studentStatsList = await buildGradeStats(allStudents, attendanceData);
        const overallStats: AttendanceStats = { present: 0, absent: 0, sick: 0, late: 0, total: 0 };
        studentStatsList.forEach(s => {
          overallStats.present += s.present; overallStats.absent += s.absent;
          overallStats.sick += s.sick; overallStats.late += s.late; overallStats.total += s.total;
        });
        const genderStats = computeGenderStats(studentStatsList);
        setReportData({ type: reportType, studentStats: studentStatsList, overallStats, genderStats });
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.message || 'Failed to generate report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const pct = (stats: AttendanceStats) => {
    const d = stats.present + stats.absent + stats.sick;
    return d === 0 ? '0.0' : ((stats.present / d) * 100).toFixed(1);
  };

  const pctColor = (p: string) =>
    Number(p) >= 90 ? 'text-green-700' : Number(p) >= 75 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Attendance Reports</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => { setReportType(e.target.value as ReportType); setReportData(null); setError(null); }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily Report</option>
            <option value="monthly">Monthly Report</option>
            <option value="yearly">Yearly Report</option>
            <option value="student">Student Report</option>
            <option value="school_daily">School Daily Report</option>
          </select>
        </div>

        {reportType !== 'school_daily' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Grade</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{isLoadingGrades ? 'Loading grades...' : 'Choose a grade'}</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.grade_name} ({grade.academic_year})
                </option>
              ))}
            </select>
          </div>
        )}

        {(reportType === 'daily' || reportType === 'school_daily') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {reportType === 'monthly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

{(reportType === 'yearly') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {reportType === 'student' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Student</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.student_index} - {student.student_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
              <select
                value={studentPeriod}
                onChange={(e) => setStudentPeriod(e.target.value as 'monthly' | 'yearly' | 'custom')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
            {studentPeriod === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                <input
                  type="month"
                  value={studentMonth}
                  onChange={(e) => setStudentMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            {studentPeriod === 'yearly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            {studentPeriod === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={studentCustomStart}
                    onChange={(e) => setStudentCustomStart(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={studentCustomEnd}
                    onChange={(e) => setStudentCustomEnd(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <button
        onClick={generateReport}
        disabled={
          isLoading ||
          (reportType !== 'school_daily' && !selectedGrade) ||
          (reportType === 'student' && !selectedStudent)
        }
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        <FileText className="w-5 h-5" />
        {isLoading ? 'Generating...' : 'Generate Report'}
      </button>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="mt-6 animate-pulse space-y-4">
          <div className="bg-slate-50 rounded-lg p-6">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="h-4 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportData && !isLoading && (
        <div className="mt-6 space-y-6">

          {/* ── Student report ── */}
          {reportData.type === 'student' && (
            <div className="space-y-6">
              <StudentAttendanceDashboard
                student={{
                  id: reportData.student.id,
                  indexNumber: reportData.student.student_index,
                  name: reportData.student.student_name,
                  photo: reportData.student.photo_url,
                  grade: grades.find((grade) => grade.id === selectedGrade)?.grade_name || selectedGrade,
                  house: reportData.student.house || 'Not assigned',
                  position: reportData.student.position || 'Not assigned',
                }}
                attendance={{
                  present: reportData.stats.present,
                  absent: reportData.stats.absent,
                  sick: reportData.stats.sick,
                  late: reportData.stats.late,
                  totalSchoolDays: reportData.stats.total,
                  monthlyAttendance: reportData.monthlyBreakdown,
                  dayBreakdown: reportData.dayBreakdown,
                }}
              />

              <div className="hidden">
                <aside className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
                  <div className="flex justify-center mb-5">
                    <div className="h-32 w-32 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center overflow-hidden">
                      {reportData.student.photo_url ? (
                        <img src={reportData.student.photo_url} alt={reportData.student.student_name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-16 w-16 text-slate-300" />
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold">{reportData.student.student_name}</h3>
                    <p className="mt-1 text-sm text-slate-300">Student ID: {reportData.student.student_index}</p>
                  </div>
                  <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Gender</span><span className="font-medium">{reportData.student.gender}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-400">Report period</span><span className="font-medium capitalize">{studentPeriod}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-400">School year</span><span className="font-medium">{selectedYear}</span></div>
                  </div>
                </aside>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Student attendance profile</p>
                      <h3 className="mt-1 text-2xl font-bold text-slate-900">Attendance overview</h3>
                    </div>
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{pct(reportData.stats)}% overall</div>
                  </div>
                  <StatGrid stats={reportData.stats} pct={pct} pctColor={pctColor} totalLabel="School Days" />
                  <div className="mt-6 rounded-xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-700">Attendance progress</span><span className="font-bold text-slate-900">{pct(reportData.stats)}%</span></div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct(reportData.stats)}%` }} /></div>
                  </div>
                </section>
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Academic calendar</p><h4 className="mt-1 text-xl font-bold text-slate-900">Monthly attendance history</h4></div><span className="text-sm text-slate-500">{reportData.stats.total} school days in period</span></div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Month</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">School Days</th>
                      <th className="text-center py-3 px-4 font-semibold text-green-700">Present</th>
                      <th className="text-center py-3 px-4 font-semibold text-red-700">Absent</th>
                      <th className="text-center py-3 px-4 font-semibold text-yellow-700">Sick</th>
                      <th className="text-center py-3 px-4 font-semibold text-orange-700">Late</th>
                      <th className="text-center py-3 px-4 font-semibold text-blue-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthlyBreakdown.map((month: any) => (
                      <tr key={month.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{month.month}</td>
                        <td className="py-3 px-4 text-center font-semibold">{month.schoolDays}</td>
                        <td className="py-3 px-4 text-center text-green-700">{month.present}</td>
                        <td className="py-3 px-4 text-center text-red-700">{month.absent}</td>
                        <td className="py-3 px-4 text-center text-yellow-700">{month.sick}</td>
                        <td className="py-3 px-4 text-center text-orange-700">{month.late}</td>
                        <td className="py-3 px-4 text-center font-bold">{month.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="mb-3 text-xl font-bold text-slate-900">Daily attendance details</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">Before Break</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">After Break</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">Day Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.dayBreakdown.map((day: any, index: number) => (
                      <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td className="py-3 px-4 text-center">
                          {day.before_break ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              day.before_break === 'present' ? 'bg-green-100 text-green-800' :
                              day.before_break === 'absent' ? 'bg-red-100 text-red-800' :
                              day.before_break === 'sick' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {day.before_break.charAt(0).toUpperCase() + day.before_break.slice(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Not recorded</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {day.after_break ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              day.after_break === 'present' ? 'bg-green-100 text-green-800' :
                              day.after_break === 'absent' ? 'bg-red-100 text-red-800' :
                              day.after_break === 'sick' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {day.after_break.charAt(0).toUpperCase() + day.after_break.slice(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Not recorded</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            day.day_status === 'present' ? 'bg-green-100 text-green-800' :
                            day.day_status === 'absent' ? 'bg-red-100 text-red-800' :
                            day.day_status === 'sick' ? 'bg-yellow-100 text-yellow-800' :
                            day.day_status === 'late' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {day.day_status ? (day.day_status.charAt(0).toUpperCase() + day.day_status.slice(1)) : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Grade-level report (daily / monthly / yearly) ── */}
          {(reportData.type === 'daily' || reportData.type === 'monthly' || reportData.type === 'yearly') && (
            <div>
              <div className="bg-slate-50 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Overall Statistics</h3>
                <StatGrid stats={reportData.overallStats} pct={pct} pctColor={pctColor} />

                {/* Boys / Girls breakdown */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GenderStatCard
                    label="Boys"
                    icon={<User className="w-4 h-4 text-blue-600" />}
                    color="blue"
                    stats={reportData.genderStats.boys}
                    pct={pct}
                  />
                  <GenderStatCard
                    label="Girls"
                    icon={<User className="w-4 h-4 text-pink-600" />}
                    color="pink"
                    stats={reportData.genderStats.girls}
                    pct={pct}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Index</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-500">Gender</th>
                      <th className="text-center py-3 px-4 font-semibold text-green-700">Present</th>
                      <th className="text-center py-3 px-4 font-semibold text-red-700">Absent</th>
                      <th className="text-center py-3 px-4 font-semibold text-yellow-700">Sick</th>
                      <th className="text-center py-3 px-4 font-semibold text-orange-700">Late</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Total</th>
                      <th className="text-center py-3 px-4 font-semibold text-blue-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.studentStats.map((s: any) => (
                      <tr key={s.student.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-xs text-gray-500">{s.student.student_index}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{s.student.student_name}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.student.gender === 'Male'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-pink-50 text-pink-700'
                          }`}>{s.student.gender}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-green-700">{s.present}</td>
                        <td className="py-3 px-4 text-center font-semibold text-red-700">{s.absent}</td>
                        <td className="py-3 px-4 text-center text-yellow-700">{s.sick}</td>
                        <td className="py-3 px-4 text-center text-orange-700">{s.late}</td>
                        <td className="py-3 px-4 text-center font-semibold text-gray-700">{s.total}</td>
                        <td className={`py-3 px-4 text-center font-bold ${pctColor(pct(s))}`}>
                          {pct(s)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── School Daily Report ── */}
          {reportData.type === 'school_daily' && (
            <div className="space-y-6">
              {/* School-wide summary */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-gray-600" />
                  <h3 className="text-xl font-bold text-gray-900">
                    School Summary — {new Date(reportData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                </div>

                <StatGrid stats={reportData.schoolStats} pct={pct} pctColor={pctColor} />

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GenderStatCard label="Boys" icon={<User className="w-4 h-4 text-blue-600" />} color="blue" stats={reportData.schoolGender.boys} pct={pct} />
                  <GenderStatCard label="Girls" icon={<User className="w-4 h-4 text-pink-600" />} color="pink" stats={reportData.schoolGender.girls} pct={pct} />
                </div>
              </div>

              {/* Per-grade breakdown */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Grade Breakdown</h3>
                <div className="space-y-4">
                  {reportData.gradeResults.map((gr: any) => {
                    const gradePct = pct(gr.stats);
                    return (
                      <div key={gr.grade.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Grade header */}
                        <div className="bg-slate-100 px-5 py-3 flex items-center justify-between">
                          <span className="font-bold text-gray-900">
                            Grade {gr.grade.grade_name} ({gr.grade.academic_year})
                          </span>
                          <span className={`text-sm font-bold ${pctColor(gradePct)}`}>
                            {gradePct}% attendance
                          </span>
                        </div>

                        <div className="p-5 space-y-4">
                          {/* Overall grade stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                              <div className="text-xs text-gray-500 mb-1">Total Students</div>
                              <div className="text-xl font-bold text-gray-900">{gr.studentStats.length}</div>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                              <div className="text-xs text-green-700 mb-1">Present</div>
                              <div className="text-xl font-bold text-green-900">{gr.stats.present}</div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                              <div className="text-xs text-red-700 mb-1">Absent</div>
                              <div className="text-xl font-bold text-red-900">{gr.stats.absent}</div>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                              <div className="text-xs text-yellow-700 mb-1">Sick</div>
                              <div className="text-xl font-bold text-yellow-900">{gr.stats.sick}</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                              <div className="text-xs text-orange-700 mb-1">Late</div>
                              <div className="text-xl font-bold text-orange-900">{gr.stats.late}</div>
                            </div>
                          </div>

                          {/* Boys / Girls split */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <GenderStatCard label="Boys" icon={<User className="w-3.5 h-3.5 text-blue-600" />} color="blue" stats={gr.genderStats.boys} pct={pct} compact />
                            <GenderStatCard label="Girls" icon={<User className="w-3.5 h-3.5 text-pink-600" />} color="pink" stats={gr.genderStats.girls} pct={pct} compact />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function StatGrid({ stats, pct, pctColor, totalLabel = 'Total Days' }: {
  stats: AttendanceStats;
  pct: (s: AttendanceStats) => string;
  pctColor: (p: string) => string;
  totalLabel?: string;
}) {
  const p = pct(stats);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
        <div className="text-xs text-gray-500 mb-1">{totalLabel}</div>
        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
      </div>
      <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
        <div className="text-xs text-green-700 mb-1">Present</div>
        <div className="text-2xl font-bold text-green-900">{stats.present}</div>
      </div>
      <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
        <div className="text-xs text-red-700 mb-1">Absent</div>
        <div className="text-2xl font-bold text-red-900">{stats.absent}</div>
      </div>
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-center">
        <div className="text-xs text-yellow-700 mb-1">Sick</div>
        <div className="text-2xl font-bold text-yellow-900">{stats.sick}</div>
      </div>
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center">
        <div className="text-xs text-orange-700 mb-1">Late</div>
        <div className="text-2xl font-bold text-orange-900">{stats.late}</div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
        <div className="text-xs text-blue-700 mb-1">Attendance Rate</div>
        <div className={`text-2xl font-bold ${pctColor(p)}`}>{p}%</div>
      </div>
    </div>
  );
}

function GenderStatCard({ label, icon, color, stats, pct, compact = false }: {
  label: string;
  icon: React.ReactNode;
  color: 'blue' | 'pink';
  stats: AttendanceStats;
  pct: (s: AttendanceStats) => string;
  compact?: boolean;
}) {
  const bg = color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-pink-50 border-pink-200';
  const text = color === 'blue' ? 'text-blue-800' : 'text-pink-800';
  const subtext = color === 'blue' ? 'text-blue-600' : 'text-pink-600';
  const p = pct(stats);
  const pColor = Number(p) >= 90 ? 'text-green-700' : Number(p) >= 75 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className={`rounded-lg border ${bg} ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-center gap-1.5 mb-3 ${text} font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
        {icon}{label}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <div className={`${compact ? 'text-xs' : 'text-xs'} ${subtext} mb-0.5`}>Total</div>
          <div className={`${compact ? 'text-base' : 'text-lg'} font-bold ${text}`}>{stats.total}</div>
        </div>
        <div className="text-center">
          <div className={`${compact ? 'text-xs' : 'text-xs'} text-green-600 mb-0.5`}>Present</div>
          <div className={`${compact ? 'text-base' : 'text-lg'} font-bold text-green-800`}>{stats.present}</div>
        </div>
        <div className="text-center">
          <div className={`${compact ? 'text-xs' : 'text-xs'} text-red-600 mb-0.5`}>Absent</div>
          <div className={`${compact ? 'text-base' : 'text-lg'} font-bold text-red-800`}>{stats.absent}</div>
        </div>
        <div className="text-center">
          <div className={`${compact ? 'text-xs' : 'text-xs'} ${subtext} mb-0.5`}>Rate</div>
          <div className={`${compact ? 'text-base' : 'text-lg'} font-bold ${pColor}`}>{p}%</div>
        </div>
      </div>
    </div>
  );
}
