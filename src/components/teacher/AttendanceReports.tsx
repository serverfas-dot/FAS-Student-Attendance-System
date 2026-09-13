import React, { useState, useEffect } from 'react';
import { supabase, Grade, Student } from '../../lib/supabase';
import { api } from '../../lib/api';
import { FileText, Calendar, Download, User, BarChart3, TrendingUp } from 'lucide-react';
import { calculateFullDays, resolveSessionStatus } from '../../lib/attendanceUtils';
import StudentAttendanceDashboard from '../admin/StudentAttendanceDashboard';

type AttendanceStats = {
  student_id: string;
  student_name: string;
  student_index: number;
  total_days: number;
  present: number;
  absent: number;
  sick: number;
  late: number;
  attendance_rate: number;
};

type DailyReport = {
  attendance_date: string;
  total_students: number;
  present: number;
  absent: number;
  sick: number;
  late: number;
  attendance_rate: number;
};

type MonthlyReport = {
  month: string;
  year: number;
  total_days: number;
  present: number;
  absent: number;
  sick: number;
  late: number;
  attendance_rate: number;
};

type StudentAttendanceDetail = {
  attendance_date: string;
  status: string;
};

type MonthlyBreakdown = {
  month: string;
  schoolDays: number;
  present: number;
  absent: number;
  sick: number;
  late: number;
  attendanceRate: number;
};

type DayBreakdownEntry = {
  date: string;
  before_break?: string;
  after_break?: string;
  day_status: string;
};

type ReportType = 'daily' | 'monthly' | 'yearly' | 'student' | 'custom';

type Props = {
  teacherId: string;
  cachedGrades?: Grade[] | null;
};

export default function AttendanceReports({ teacherId, cachedGrades }: Props) {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [studentPeriod, setStudentPeriod] = useState<'monthly' | 'yearly' | 'custom'>('custom');
  const [dailyReportData, setDailyReportData] = useState<DailyReport[]>([]);
  const [monthlyReportData, setMonthlyReportData] = useState<MonthlyReport[]>([]);
  const [studentReportData, setStudentReportData] = useState<StudentAttendanceDetail[]>([]);
  const [studentStats, setStudentStats] = useState<AttendanceStats | null>(null);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyBreakdown[]>([]);
  const [dayBreakdown, setDayBreakdown] = useState<DayBreakdownEntry[]>([]);
  const [studentPhoto, setStudentPhoto] = useState<string | undefined>(undefined);
  const [studentHouse, setStudentHouse] = useState<string | undefined>(undefined);
  const [studentPosition, setStudentPosition] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGrades, setIsLoadingGrades] = useState(cachedGrades === null);
  const [gradeName, setGradeName] = useState('');

  useEffect(() => {
    if (cachedGrades !== null && cachedGrades !== undefined) {
      setGrades(cachedGrades);
      setIsLoadingGrades(false);
      if (cachedGrades.length > 0) {
        setSelectedGrade(cachedGrades[0].id);
        setGradeName(cachedGrades[0].grade_name);
      }
    } else if (cachedGrades === null) {
      fetchPermittedGrades();
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, [teacherId, cachedGrades]);

  useEffect(() => {
    if (selectedGrade && reportType === 'student') {
      fetchStudents();
    }
  }, [selectedGrade, reportType]);

  async function fetchPermittedGrades() {
    setIsLoadingGrades(true);
    try {
      const permissions = await api.teacherPermissions.getAll(teacherId, teacherId);
      const gradesList = permissions
        .filter((p: any) => p.can_view_reports === true)
        .map((p: any) => p.grades)
        .filter(Boolean);

      setGrades(gradesList);
      if (gradesList.length > 0) {
        setSelectedGrade(gradesList[0].id);
        setGradeName(gradesList[0].grade_name);
      }
    } catch (error) {
      console.error('Error fetching permitted grades:', error);
      setGrades([]);
    } finally {
      setIsLoadingGrades(false);
    }
  }

  async function fetchStudents() {
    if (!teacherId) return;
    try {
      // Teachers need userId for API calls, using teacherId as userId
      const data = await api.students.getAll(teacherId, selectedGrade);
      setStudents(data);
      if (data.length > 0) {
        setSelectedStudent(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  }

  async function generateDailyReport() {
    if (!selectedGrade || !startDate || !endDate) return;

    setIsLoading(true);

    try {
      const [studentsData, attendance] = await Promise.all([
        api.students.getAll(teacherId, selectedGrade),
        api.attendance.getAll(teacherId, {
          grade_id: selectedGrade,
          start_date: startDate,
          end_date: endDate,
        }),
      ]);

      if (!studentsData || studentsData.length === 0) {
        setDailyReportData([]);
        setIsLoading(false);
        return;
      }

      const dateGroups: Record<string, any[]> = {};
      attendance?.forEach((record: any) => {
        if (!dateGroups[record.attendance_date]) {
          dateGroups[record.attendance_date] = [];
        }
        dateGroups[record.attendance_date].push(record);
      });

      const dailyMap: Record<string, DailyReport> = {};
      Object.entries(dateGroups).forEach(([date, records]) => {
        const studentSessionMap: Record<string, { before_break?: string; after_break?: string }> = {};

        records.forEach((record: any) => {
          if (!studentSessionMap[record.student_id]) {
            studentSessionMap[record.student_id] = {};
          }
          const session = record.session as 'before_break' | 'after_break';
          studentSessionMap[record.student_id][session] = record.status;
        });

        const dayCounts = { present: 0, absent: 0, sick: 0, late: 0 };

        Object.values(studentSessionMap).forEach(sessions => {
          const status = resolveSessionStatus(sessions.before_break, sessions.after_break);
          if (status === 'present') dayCounts.present++;
          else if (status === 'late') { dayCounts.present++; dayCounts.late++; }
          else if (status === 'sick') dayCounts.sick++;
          else if (status === 'absent') dayCounts.absent++;
        });

        const rateBase = dayCounts.present + dayCounts.absent + dayCounts.sick;
        dailyMap[date] = {
          attendance_date: date,
          total_students: studentsData.length,
          present: dayCounts.present,
          absent: dayCounts.absent,
          sick: dayCounts.sick,
          late: dayCounts.late,
          attendance_rate: rateBase > 0 ? Math.round((dayCounts.present / rateBase) * 100) : 0,
        };
      });

      setDailyReportData(Object.values(dailyMap).sort((a, b) => a.attendance_date.localeCompare(b.attendance_date)));
    } catch (error) {
      console.error('Error generating daily report:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateMonthlyReport() {
    if (!selectedGrade || !selectedYear) return;

    setIsLoading(true);

    try {
      const monthPad = String(selectedMonth).padStart(2, '0');
      const monthStart = `${selectedYear}-${monthPad}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthEnd = `${selectedYear}-${monthPad}-${String(lastDay).padStart(2, '0')}`;

      const [studentsData, attendance] = await Promise.all([
        api.students.getAll(teacherId, selectedGrade),
        api.attendance.getAll(teacherId, {
          grade_id: selectedGrade,
          start_date: monthStart,
          end_date: monthEnd,
        }),
      ]);

      if (!studentsData || studentsData.length === 0) {
        setMonthlyReportData([]);
        setIsLoading(false);
        return;
      }

      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

      // Count student-day statuses using session-pair logic per student per day
      const studentDayMap: Record<string, Record<string, { before?: string; after?: string }>> = {};
      attendance.forEach((r: any) => {
        if (!studentDayMap[r.student_id]) studentDayMap[r.student_id] = {};
        if (!studentDayMap[r.student_id][r.attendance_date]) studentDayMap[r.student_id][r.attendance_date] = {};
        if (r.session === 'before_break') studentDayMap[r.student_id][r.attendance_date].before = r.status;
        else studentDayMap[r.student_id][r.attendance_date].after = r.status;
      });

      let present = 0, absent = 0, sick = 0, late = 0;
      Object.values(studentDayMap).forEach(days => {
        Object.values(days).forEach(({ before, after }) => {
          const s = resolveSessionStatus(before, after);
          if (s === 'present') present++;
          else if (s === 'late') { present++; late++; }
          else if (s === 'sick') sick++;
          else if (s === 'absent') absent++;
        });
      });

      // Only count days the teacher actually filled. Unrecorded days are ignored.
      const totalDays = present + absent + sick;
      const rateBase = totalDays;

      setMonthlyReportData([{
        month: monthNames[selectedMonth - 1],
        year: selectedYear,
        total_days: totalDays,
        present,
        absent,
        sick,
        late,
        attendance_rate: rateBase > 0 ? Math.round((present / rateBase) * 100) : 0,
      }]);
    } catch (error) {
      console.error('Error generating monthly report:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateYearlyReport() {
    if (!selectedGrade || !selectedYear) return;

    setIsLoading(true);

    try {
      const [studentsData, summary] = await Promise.all([
        api.students.getAll(teacherId, selectedGrade),
        api.attendance.getMonthlySummary(teacherId, selectedGrade, selectedYear),
      ]);

      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const summaryByMonth = new Map<number, any>();
      (summary || []).forEach((row: any) => summaryByMonth.set(Number(row.month_num), row));

      const reports = monthNames.map((name, index) => {
        const monthNum = index + 1;
        const row = summaryByMonth.get(monthNum);
        if (!row) return null;

        const present = Number(row.present) || 0;
        const absent = Number(row.absent) || 0;
        const sick = Number(row.sick) || 0;
        const late = Number(row.late) || 0;
        // Only count days the teacher actually filled.
        const totalDays = present + absent + sick;
        const rateBase = totalDays;

        return {
          month: name,
          year: selectedYear,
          total_days: totalDays,
          present,
          absent,
          sick,
          late,
          attendance_rate: rateBase > 0 ? Math.round((present / rateBase) * 100) : 0,
        };
      }).filter(Boolean) as MonthlyReport[];

      setMonthlyReportData(reports);
    } catch (error) {
      console.error('Error generating yearly report:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateStudentReport() {
    if (!selectedStudent) return;

    let effectiveStart = startDate;
    let effectiveEnd = endDate;

    if (studentPeriod === 'monthly') {
      const monthPad = String(selectedMonth).padStart(2, '0');
      effectiveStart = `${selectedYear}-${monthPad}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      effectiveEnd = `${selectedYear}-${monthPad}-${String(lastDay).padStart(2, '0')}`;
    } else if (studentPeriod === 'yearly') {
      effectiveStart = `${selectedYear}-01-01`;
      effectiveEnd = `${selectedYear}-12-31`;
    }

    if (!effectiveStart || !effectiveEnd) return;

    setIsLoading(true);

    try {
      // Fetch only this student's records directly — avoids grade-wide row limit truncation
      const [allStudents, attendance] = await Promise.all([
        api.students.getAll(teacherId, selectedGrade),
        api.attendance.getAll(teacherId, {
          student_id: selectedStudent,
          start_date: effectiveStart,
          end_date: effectiveEnd,
        }),
      ]);

      const studentData = allStudents.find((s: any) => s.id === selectedStudent);

      if (!studentData) {
        setIsLoading(false);
        return;
      }

      attendance.sort((a: any, b: any) => a.attendance_date.localeCompare(b.attendance_date));
      setStudentReportData(attendance);

      const calculatedStats = calculateFullDays(attendance);

      const stats: AttendanceStats = {
        student_id: studentData.id,
        student_name: studentData.student_name,
        student_index: studentData.student_index,
        total_days: calculatedStats.totalDays,
        present: calculatedStats.present,
        absent: calculatedStats.absent,
        sick: calculatedStats.sick,
        late: calculatedStats.late,
        attendance_rate: calculatedStats.attendance_rate,
      };

      setStudentStats(stats);
      setStudentPhoto(studentData.photo_url);
      setStudentHouse(studentData.house);
      setStudentPosition(studentData.position);

      // Build day-level breakdown
      const dateMap: Record<string, { before_break?: string; after_break?: string }> = {};
      attendance.forEach((record: any) => {
        if (!dateMap[record.attendance_date]) dateMap[record.attendance_date] = {};
        dateMap[record.attendance_date][record.session as 'before_break' | 'after_break'] = record.status;
      });

      const dayBreakdownList: DayBreakdownEntry[] = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, sessions]) => ({
          date,
          before_break: sessions.before_break,
          after_break: sessions.after_break,
          day_status: resolveSessionStatus(sessions.before_break, sessions.after_break),
        }));
      setDayBreakdown(dayBreakdownList);

      // Build monthly breakdown
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthlyBreakdownList = monthNames.map((month, index) => {
        const monthNumber = index + 1;
        const monthRecords = attendance.filter((record: any) => Number(record.attendance_date.slice(5, 7)) === monthNumber);
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
      }).filter((m) => m.schoolDays > 0 || m.late > 0);
      setMonthlyBreakdown(monthlyBreakdownList);
    } catch (error) {
      console.error('Error generating student report:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function exportToCSV() {
    let csvContent = '';
    let filename = '';

    if ((reportType === 'daily' || reportType === 'custom') && dailyReportData.length > 0) {
      const headers = ['Date', 'Total Students', 'Present', 'Absent', 'Sick', 'Late', 'Attendance Rate'];
      const rows = dailyReportData.map(day => [
        day.attendance_date,
        day.total_students,
        day.present,
        day.absent,
        day.sick,
        day.late,
        `${day.attendance_rate}%`,
      ]);
      csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      filename = `daily-report-${gradeName}-${startDate}-to-${endDate}.csv`;
    } else if ((reportType === 'monthly' || reportType === 'yearly') && monthlyReportData.length > 0) {
      const headers = reportType === 'yearly'
        ? ['Year', 'Total Days', 'Present', 'Absent', 'Sick', 'Late', 'Attendance Rate']
        : ['Month', 'Year', 'Total Days', 'Present', 'Absent', 'Sick', 'Late', 'Attendance Rate'];
      const rows = monthlyReportData.map(data =>
        reportType === 'yearly'
          ? [data.year, data.total_days, data.present, data.absent, data.sick, data.late, `${data.attendance_rate}%`]
          : [data.month, data.year, data.total_days, data.present, data.absent, data.sick, data.late, `${data.attendance_rate}%`]
      );
      csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      filename = `${reportType}-report-${gradeName}-${selectedYear}.csv`;
    } else if (reportType === 'student' && studentStats) {
      const headers = ['Date', 'Status'];
      const rows = studentReportData.map(record => [record.attendance_date, record.status]);
      csvContent = [
        `Student: ${studentStats.student_name}`,
        `Index: ${studentStats.student_index}`,
        `Period: ${startDate} to ${endDate}`,
        `Total Days: ${studentStats.total_days}`,
        `Present: ${studentStats.present}`,
        `Absent: ${studentStats.absent}`,
        `Sick: ${studentStats.sick}`,
        `Late: ${studentStats.late}`,
        `Attendance Rate: ${studentStats.attendance_rate}%`,
        '',
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');
      filename = `student-report-${studentStats.student_name}-${startDate}-to-${endDate}.csv`;
    }

    if (csvContent) {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    }
  }

  const handleGradeChange = (gradeId: string) => {
    setSelectedGrade(gradeId);
    const grade = grades.find(g => g.id === gradeId);
    if (grade) {
      setGradeName(grade.grade_name);
    }
  };

  async function generateCustomReport() {
    if (!selectedGrade || !startDate || !endDate) return;

    setIsLoading(true);

    try {
      const [studentsData, attendance] = await Promise.all([
        api.students.getAll(teacherId, selectedGrade),
        api.attendance.getAll(teacherId, {
          grade_id: selectedGrade,
          start_date: startDate,
          end_date: endDate,
        }),
      ]);

      if (!studentsData || studentsData.length === 0) {
        setDailyReportData([]);
        setIsLoading(false);
        return;
      }

      const dateGroups: Record<string, any[]> = {};
      attendance?.forEach((record: any) => {
        if (!dateGroups[record.attendance_date]) {
          dateGroups[record.attendance_date] = [];
        }
        dateGroups[record.attendance_date].push(record);
      });

      const dailyMap: Record<string, DailyReport> = {};
      Object.entries(dateGroups).forEach(([date, records]) => {
        const studentSessionMap: Record<string, { before_break?: string; after_break?: string }> = {};

        records.forEach((record: any) => {
          if (!studentSessionMap[record.student_id]) {
            studentSessionMap[record.student_id] = {};
          }
          const session = record.session as 'before_break' | 'after_break';
          studentSessionMap[record.student_id][session] = record.status;
        });

        const dayCounts = { present: 0, absent: 0, sick: 0, late: 0 };

        Object.values(studentSessionMap).forEach(sessions => {
          const status = resolveSessionStatus(sessions.before_break, sessions.after_break);
          if (status === 'present') dayCounts.present++;
          else if (status === 'late') { dayCounts.present++; dayCounts.late++; }
          else if (status === 'sick') dayCounts.sick++;
          else if (status === 'absent') dayCounts.absent++;
        });

        const rateBase = dayCounts.present + dayCounts.absent + dayCounts.sick;
        dailyMap[date] = {
          attendance_date: date,
          total_students: studentsData.length,
          present: dayCounts.present,
          absent: dayCounts.absent,
          sick: dayCounts.sick,
          late: dayCounts.late,
          attendance_rate: rateBase > 0 ? Math.round((dayCounts.present / rateBase) * 100) : 0,
        };
      });

      setDailyReportData(Object.values(dailyMap).sort((a, b) => a.attendance_date.localeCompare(b.attendance_date)));
    } catch (error) {
      console.error('Error generating custom report:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleGenerateReport = () => {
    switch (reportType) {
      case 'daily':
        generateDailyReport();
        break;
      case 'monthly':
        generateMonthlyReport();
        break;
      case 'yearly':
        generateYearlyReport();
        break;
      case 'student':
        generateStudentReport();
        break;
      case 'custom':
        generateCustomReport();
        break;
    }
  };

  const hasReportData = () => {
    switch (reportType) {
      case 'daily':
      case 'custom':
        return dailyReportData.length > 0;
      case 'monthly':
      case 'yearly':
        return monthlyReportData.length > 0;
      case 'student':
        return studentReportData.length > 0;
      default:
        return false;
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Attendance Reports</h2>
      </div>

      {isLoadingGrades ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading permissions...</p>
        </div>
      ) : grades.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">You don't have permission to view reports for any grade.</p>
          <p className="text-sm text-gray-500 mt-2">Please contact your administrator.</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={() => setReportType('daily')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  reportType === 'daily'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Daily
              </button>
              <button
                onClick={() => setReportType('monthly')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  reportType === 'monthly'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Monthly
              </button>
              <button
                onClick={() => setReportType('yearly')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  reportType === 'yearly'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                Yearly
              </button>
              <button
                onClick={() => setReportType('custom')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  reportType === 'custom'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Custom
              </button>
              <button
                onClick={() => setReportType('student')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  reportType === 'student'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <User className="w-5 h-5" />
                Student
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => handleGradeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.grade_name} ({grade.academic_year})
                  </option>
                ))}
              </select>
            </div>

            {reportType === 'student' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Student</label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
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
                    <option value="custom">Custom Date Range</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {studentPeriod === 'monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => (
                          <option key={i + 1} value={i + 1}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {studentPeriod === 'yearly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}
                {studentPeriod === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        max={endDate}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {(reportType === 'daily' || reportType === 'custom') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={endDate}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {(reportType === 'monthly' || reportType === 'yearly') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reportType === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>

            {hasReportData() && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export to CSV
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Generating report...</p>
            </div>
          ) : (
            <>
              {(reportType === 'daily' || reportType === 'custom') && dailyReportData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Total Students</th>
                        <th className="text-center py-3 px-4 font-semibold text-green-700">Present</th>
                        <th className="text-center py-3 px-4 font-semibold text-red-700">Absent</th>
                        <th className="text-center py-3 px-4 font-semibold text-yellow-700">Sick</th>
                        <th className="text-center py-3 px-4 font-semibold text-orange-700">Late</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReportData.map((day) => (
                        <tr key={day.attendance_date} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">{new Date(day.attendance_date).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-center">{day.total_students}</td>
                          <td className="py-3 px-4 text-center text-green-700 font-medium">{day.present}</td>
                          <td className="py-3 px-4 text-center text-red-700 font-medium">{day.absent}</td>
                          <td className="py-3 px-4 text-center text-yellow-700 font-medium">{day.sick}</td>
                          <td className="py-3 px-4 text-center text-orange-700 font-medium">{day.late}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                day.attendance_rate >= 90
                                  ? 'bg-green-100 text-green-800'
                                  : day.attendance_rate >= 75
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {day.attendance_rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(reportType === 'monthly' || reportType === 'yearly') && monthlyReportData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Month</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Year</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Total Days</th>
                        <th className="text-center py-3 px-4 font-semibold text-green-700">Present</th>
                        <th className="text-center py-3 px-4 font-semibold text-red-700">Absent</th>
                        <th className="text-center py-3 px-4 font-semibold text-yellow-700">Sick</th>
                        <th className="text-center py-3 px-4 font-semibold text-orange-700">Late</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyReportData.map((data, index) => (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">{data.month}</td>
                          <td className="py-3 px-4">{data.year}</td>
                          <td className="py-3 px-4 text-center">{data.total_days}</td>
                          <td className="py-3 px-4 text-center text-green-700 font-medium">{data.present}</td>
                          <td className="py-3 px-4 text-center text-red-700 font-medium">{data.absent}</td>
                          <td className="py-3 px-4 text-center text-yellow-700 font-medium">{data.sick}</td>
                          <td className="py-3 px-4 text-center text-orange-700 font-medium">{data.late}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                data.attendance_rate >= 90
                                  ? 'bg-green-100 text-green-800'
                                  : data.attendance_rate >= 75
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {data.attendance_rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'student' && studentStats && (
                <StudentAttendanceDashboard
                  student={{
                    id: studentStats.student_id,
                    indexNumber: studentStats.student_index,
                    name: studentStats.student_name,
                    photo: studentPhoto,
                    grade: grades.find((g) => g.id === selectedGrade)?.grade_name || selectedGrade,
                    house: studentHouse || 'Not assigned',
                    position: studentPosition || 'Not assigned',
                  }}
                  attendance={{
                    present: studentStats.present,
                    absent: studentStats.absent,
                    sick: studentStats.sick,
                    late: studentStats.late,
                    totalSchoolDays: studentStats.total_days,
                    monthlyAttendance: monthlyBreakdown,
                    dayBreakdown,
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
