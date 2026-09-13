import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, Grade, Student, AttendanceStatus, AttendanceSession } from '../lib/supabase';
import { api } from '../lib/api';
import { LogOut, GraduationCap, Calendar, Save, CheckCircle, FileText, ClipboardCheck, Sun, Moon } from 'lucide-react';
import AttendanceReports from '../components/teacher/AttendanceReports';

type StudentWithAttendance = Student & {
  grades?: Grade;
  todayAttendance?: { status: AttendanceStatus } | null;
};

type Tab = 'attendance' | 'reports';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [reportGrades, setReportGrades] = useState<Grade[] | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedGradeData, setSelectedGradeData] = useState<Grade | null>(null);
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession>('before_break');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [sessionAttendanceMap, setSessionAttendanceMap] = useState<Record<string, { before_break?: AttendanceStatus; after_break?: AttendanceStatus }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [gradeEditPermissions, setGradeEditPermissions] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchPermittedGrades();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'reports' && !reportGrades && user) {
      fetchReportGrades();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (selectedGrade) {
      const gradeData = grades.find(g => g.id === selectedGrade);
      setSelectedGradeData(gradeData || null);
      fetchStudents();
    }
  }, [selectedGrade, selectedDate]);

  useEffect(() => {
    if (students.length > 0) {
      const currentSessionMap: Record<string, AttendanceStatus> = {};
      students.forEach((student) => {
        const sessionData = sessionAttendanceMap[student.id];
        if (sessionData && sessionData[selectedSession]) {
          currentSessionMap[student.id] = sessionData[selectedSession];
        }
      });
      setAttendanceMap(currentSessionMap);
    }
  }, [selectedSession]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const isBeforeEditDeadline = (): boolean => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();

    return hours < 9 || (hours === 9 && minutes < 45);
  };

  const getTimeUntilDeadline = (): string => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (hours >= 9 && minutes >= 45) {
      return 'Edit window closed';
    }

    const totalMinutesNow = hours * 60 + minutes;
    const deadlineMinutes = 9 * 60 + 45;
    const remainingMinutes = deadlineMinutes - totalMinutesNow;

    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;

    if (remainingHours > 0) {
      return `${remainingHours}h ${remainingMins}m remaining`;
    }
    return `${remainingMins}m remaining`;
  };

  async function fetchPermittedGrades() {
    if (!user) return;

    try {
      const permissions = await api.teacherPermissions.getAll(user.id, user.id);

      if (permissions) {
        const gradesList = permissions
          .filter((p: any) => p.can_mark_attendance)
          .map((p: any) => p.grades)
          .filter(Boolean);

        const editPermissions: Record<string, boolean> = {};
        permissions.forEach((p: any) => {
          if (p.can_mark_attendance && p.grades) {
            editPermissions[p.grades.id] = p.can_edit_attendance ?? false;
          }
        });
        setGradeEditPermissions(editPermissions);

        setGrades(gradesList);
        if (gradesList.length > 0) {
          setSelectedGrade(gradesList[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  }

  async function fetchReportGrades() {
    if (!user) return;

    try {
      const permissions = await api.teacherPermissions.getAll(user.id, user.id);

      if (permissions) {
        const gradesList = permissions
          .filter((p: any) => p.can_view_reports === true)
          .map((p: any) => p.grades)
          .filter(Boolean);

        setReportGrades(gradesList);
      }
    } catch (error) {
      console.error('Error fetching report permissions:', error);
      setReportGrades([]);
    }
  }

  async function fetchStudents() {
    if (!user || !selectedGrade) return;
    setIsLoading(true);
    setStudents([]);
    try {
      const studentsData = await api.students.getAll(user.id, selectedGrade);

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setSessionAttendanceMap({});
        setAttendanceMap({});
        return;
      }

      const attendanceData = await api.attendance.getAll(user.id, {
        grade_id: selectedGrade,
        date: selectedDate,
      });

      const sessionMap: Record<string, { before_break?: AttendanceStatus; after_break?: AttendanceStatus }> = {};
      const currentSessionMap: Record<string, AttendanceStatus> = {};

      attendanceData?.forEach((att: any) => {
        if (!sessionMap[att.student_id]) {
          sessionMap[att.student_id] = {};
        }
        sessionMap[att.student_id][att.session as AttendanceSession] = att.status;

        if (att.session === selectedSession) {
          currentSessionMap[att.student_id] = att.status;
        }
      });

      setSessionAttendanceMap(sessionMap);
      setAttendanceMap(currentSessionMap);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      alert('Error loading students. Please try again or contact your administrator.');
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  }

  function updateAttendance(studentId: string, status: AttendanceStatus) {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  }

  async function markAttendance(studentId: string) {
    if (!user) return;

    const status = attendanceMap[studentId];
    if (!status) return;

    const studentSessions = sessionAttendanceMap[studentId] || {};
    const hasExistingAttendance = !!studentSessions[selectedSession];
    const hasAdminEditPermission = gradeEditPermissions[selectedGrade] ?? false;
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const hasTimeBasedEditPermission = isToday && isBeforeEditDeadline();
    const canEditAttendance = hasAdminEditPermission || hasTimeBasedEditPermission;

    if (hasExistingAttendance && !canEditAttendance) {
      alert('Attendance already marked for this student in this session. You do not have permission to edit it.');
      return;
    }

    setSavingStatus((prev) => ({
      ...prev,
      [studentId]: true,
    }));

    try {
      const isHalfDay = status === 'present';

      await api.attendance.create(user.id, {
        student_id: studentId,
        attendance_date: selectedDate,
        status,
        session: selectedSession,
        is_half_day: isHalfDay,
      });

      setSessionAttendanceMap((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [selectedSession]: status,
        },
      }));

      setSavingStatus((prev) => ({
        ...prev,
        [studentId]: false,
      }));
    } catch (error) {
      console.error('Error marking attendance:', error);
      setSavingStatus((prev) => ({
        ...prev,
        [studentId]: false,
      }));
      alert('Failed to mark attendance');
    }
  }

  async function markAllAttendance() {
    if (!user) return;

    const records = students
      .filter((student) => {
        const studentSessions = sessionAttendanceMap[student.id] || {};
        return attendanceMap[student.id] && !studentSessions[selectedSession];
      })
      .map((student) => {
        const status = attendanceMap[student.id];
        return {
          student_id: student.id,
          attendance_date: selectedDate,
          status,
          session: selectedSession,
          is_half_day: status === 'present',
        };
      });

    if (records.length === 0) {
      alert('No new attendance to save. All students have been marked.');
      return;
    }

    setIsSavingAll(true);
    try {
      await api.attendance.bulkCreate(user.id, records);

      const updatedSessionMap = { ...sessionAttendanceMap };
      records.forEach((record) => {
        if (!updatedSessionMap[record.student_id]) {
          updatedSessionMap[record.student_id] = {};
        }
        updatedSessionMap[record.student_id][selectedSession] = record.status;
      });
      setSessionAttendanceMap(updatedSessionMap);

      alert(`Successfully saved attendance for ${records.length} student(s)`);
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance');
    } finally {
      setIsSavingAll(false);
    }
  }

  const statusColors = {
    present: 'bg-green-100 text-green-800 border-green-300',
    absent: 'bg-red-100 text-red-800 border-red-300',
    sick: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    late: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Teacher Dashboard</h1>
                <p className="text-sm text-gray-600">{user?.full_name}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'attendance'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ClipboardCheck className="w-5 h-5" />
              Mark Attendance
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'reports'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-5 h-5" />
              View Reports
            </button>
          </div>
        </div>

        {activeTab === 'attendance' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Mark Attendance</h2>

          {grades.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">You don't have permission to mark attendance for any grade.</p>
              <p className="text-sm text-gray-500 mt-2">Please contact your administrator.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Grade</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    {grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.grade_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                  <div className="relative">
                    <Calendar className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Session</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedSession('before_break')}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedSession === 'before_break'
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      Before Break
                    </button>
                    <button
                      onClick={() => setSelectedSession('after_break')}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedSession === 'after_break'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      After Break
                    </button>
                  </div>
                </div>
              </div>

              {selectedGradeData && (
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Grade Statistics</h3>
                    <div className="flex flex-col gap-2 items-end">
                      {gradeEditPermissions[selectedGrade] && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Admin Edit Access
                        </span>
                      )}
                      {isToday && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          isBeforeEditDeadline()
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {getTimeUntilDeadline()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-600 mb-1">Total Boys</p>
                      <p className="text-2xl font-bold text-blue-600">{selectedGradeData.total_boys}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-600 mb-1">Total Girls</p>
                      <p className="text-2xl font-bold text-pink-600">{selectedGradeData.total_girls}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-600 mb-1">Total Students</p>
                      <p className="text-2xl font-bold text-green-600">{selectedGradeData.total_students}</p>
                    </div>
                  </div>
                </div>
              )}

              {!isToday && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Note: You are viewing attendance for a past date. You cannot mark or edit attendance for past dates.
                  </p>
                </div>
              )}

              {isToday && isBeforeEditDeadline() && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-900 mb-1">Daily Edit Window Active</p>
                      <p className="text-sm text-blue-800">
                        You can mark and edit attendance until 9:45 AM today. After that time, attendance will be locked unless admin grants you edit permission.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isToday && !isBeforeEditDeadline() && !gradeEditPermissions[selectedGrade] && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-900 mb-1">Edit Window Closed</p>
                      <p className="text-sm text-red-800">
                        The daily edit window (before 9:45 AM) has closed. You can no longer edit attendance unless admin grants you edit permission.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
                  <p className="text-gray-600">Loading students...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No students found in this grade.</p>
                  <p className="text-sm text-gray-500 mt-2">Please contact your administrator if you think this is an error.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">Index</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-900">Gender</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-900">Sessions</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-900">Mark Attendance</th>
                          {isToday && (
                            <th className="text-center py-3 px-4 font-semibold text-gray-900">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => {
                          const studentSessions = sessionAttendanceMap[student.id] || {};
                          const savedInCurrentSession = studentSessions[selectedSession];
                          const hasMarked = attendanceMap[student.id];
                          const isSaving = savingStatus[student.id];
                          const hasBeforeBreak = studentSessions.before_break && studentSessions.before_break === 'present';
                          const hasAfterBreak = studentSessions.after_break && studentSessions.after_break === 'present';
                          const bothSessions = hasBeforeBreak && hasAfterBreak;
                          const hasAdminEditPermission = gradeEditPermissions[selectedGrade] ?? false;
                          const hasTimeBasedEditPermission = isToday && isBeforeEditDeadline();
                          const canEdit = hasAdminEditPermission || hasTimeBasedEditPermission;
                          const canModify = !savedInCurrentSession || canEdit;

                          return (
                            <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono text-sm">{student.student_index}</td>
                              <td className="py-3 px-4">{student.student_name}</td>
                              <td className="py-3 px-4">{student.gender}</td>
                              <td className="py-3 px-4">
                                <div className="flex justify-center gap-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                    hasBeforeBreak ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    <Sun className="w-3 h-3" />
                                    {hasBeforeBreak ? '✓' : '-'}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                    hasAfterBreak ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    <Moon className="w-3 h-3" />
                                    {hasAfterBreak ? '✓' : '-'}
                                  </span>
                                  {bothSessions && (
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                      Full Day
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex justify-center gap-2">
                                  {(['present', 'absent', 'sick', 'late'] as AttendanceStatus[]).map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => isToday && canModify && updateAttendance(student.id, status)}
                                      disabled={!isToday || !canModify}
                                      className={`px-3 py-1 text-xs font-medium rounded-full border-2 transition-all ${
                                        (hasMarked === status || savedInCurrentSession === status)
                                          ? statusColors[status]
                                          : 'bg-gray-50 text-gray-600 border-gray-200'
                                      } ${(!isToday || !canModify) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                    >
                                      {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              {isToday && (
                                <td className="py-3 px-4 text-center">
                                  {savedInCurrentSession ? (
                                    canEdit ? (
                                      hasMarked ? (
                                        <button
                                          onClick={() => markAttendance(student.id)}
                                          className="inline-flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                                        >
                                          <Save className="w-3 h-3" />
                                          Update
                                        </button>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium">
                                          <CheckCircle className="w-4 h-4" />
                                          Saved (Editable)
                                        </span>
                                      )
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                                        <CheckCircle className="w-4 h-4" />
                                        Saved
                                      </span>
                                    )
                                  ) : isSaving ? (
                                    <span className="inline-flex items-center gap-1 text-gray-600 text-sm font-medium">
                                      <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                                      Saving...
                                    </span>
                                  ) : hasMarked ? (
                                    <button
                                      onClick={() => markAttendance(student.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                      <Save className="w-3 h-3" />
                                      Save
                                    </button>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isToday && (
                    <div className="flex justify-end">
                      <button
                        onClick={markAllAttendance}
                        disabled={isLoading || isSavingAll || Object.keys(attendanceMap).length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-5 h-5" />
                        {isSavingAll ? 'Saving...' : 'Save All Attendance'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          </div>
        ) : (
          <AttendanceReports teacherId={user?.id || ''} cachedGrades={reportGrades} />
        )}
      </div>
    </div>
  );
}
