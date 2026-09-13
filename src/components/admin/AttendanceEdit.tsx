import React, { useState, useEffect } from 'react';
import { supabase, Student, Grade, Attendance, AttendanceStatus, AttendanceSession } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Search, Save, Calendar, Sun, Moon } from 'lucide-react';

type StudentWithAttendance = Student & {
  grades?: Grade;
  attendance?: Attendance[];
};

type SessionAttendance = {
  before_break?: { id?: string; status: AttendanceStatus };
  after_break?: { id?: string; status: AttendanceStatus };
};

export default function AttendanceEdit() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, SessionAttendance>>({});

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    if (selectedGrade) {
      fetchStudentsAndAttendance();
    }
  }, [selectedGrade, selectedDate]);

  async function fetchGrades() {
    if (!user) return;
    try {
      const data = await api.grades.getAll(user.id);
      setGrades(data);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  }

  async function fetchStudentsAndAttendance() {
    if (!user) return;
    setIsLoading(true);
    try {
      const studentsData = await api.students.getAll(user.id, selectedGrade);

      const attendanceData = await api.attendance.getAll(user.id, {
        grade_id: selectedGrade,
        date: selectedDate,
      });

      const attendanceByStudent: Record<string, SessionAttendance> = {};

      attendanceData?.forEach((att: any) => {
        if (!attendanceByStudent[att.student_id]) {
          attendanceByStudent[att.student_id] = {};
        }
        attendanceByStudent[att.student_id][att.session as AttendanceSession] = {
          id: att.id,
          status: att.status,
        };
      });

      setAttendanceMap(attendanceByStudent);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function updateAttendance(studentId: string, session: AttendanceSession, status: AttendanceStatus) {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [session]: {
          ...prev[studentId]?.[session],
          status,
        },
      },
    }));
  }

  async function saveAttendance(studentId: string, session: AttendanceSession) {
    if (!user) return;
    const sessionAttendance = attendanceMap[studentId]?.[session];
    if (!sessionAttendance) return;

    setSavingId(`${studentId}-${session}`);
    try {
      const isHalfDay = sessionAttendance.status === 'present';

      if (sessionAttendance.id) {
        await api.attendance.update(user.id, sessionAttendance.id, {
          status: sessionAttendance.status,
          is_half_day: isHalfDay,
        });
      } else {
        const newAttendance = await api.attendance.create(user.id, {
          student_id: studentId,
          attendance_date: selectedDate,
          status: sessionAttendance.status,
          session: session,
          is_half_day: isHalfDay,
        });

        if (newAttendance) {
          setAttendanceMap((prev) => ({
            ...prev,
            [studentId]: {
              ...prev[studentId],
              [session]: {
                id: newAttendance.id,
                status: sessionAttendance.status,
              },
            },
          }));
        }
      }

      await fetchStudentsAndAttendance();
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance');
    } finally {
      setSavingId(null);
    }
  }

  const filteredStudents = students.filter((student) =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_index.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    present: 'bg-green-100 text-green-800 border-green-300',
    absent: 'bg-red-100 text-red-800 border-red-300',
    sick: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    late: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Attendance Records</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Grade</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a grade</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.grade_name} ({grade.academic_year})
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Name or index..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading students...</div>
      ) : !selectedGrade ? (
        <div className="text-center py-12 text-gray-500">Please select a grade to view students</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Index</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Gender</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900 bg-amber-50">
                  <div className="flex items-center justify-center gap-2">
                    <Sun className="w-4 h-4 text-amber-600" />
                    Before Break
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900 bg-blue-50">
                  <div className="flex items-center justify-center gap-2">
                    <Moon className="w-4 h-4 text-blue-600" />
                    After Break
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const sessions = attendanceMap[student.id] || {};
                const beforeBreak = sessions.before_break;
                const afterBreak = sessions.after_break;

                return (
                  <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-sm">{student.student_index}</td>
                    <td className="py-3 px-4">{student.student_name}</td>
                    <td className="py-3 px-4">{student.gender}</td>

                    <td className="py-3 px-4 bg-amber-50/30">
                      <div className="space-y-2">
                        <div className="flex justify-center gap-1">
                          {(['present', 'absent', 'sick', 'late'] as AttendanceStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => updateAttendance(student.id, 'before_break', status)}
                              className={`px-2 py-1 text-xs font-medium rounded border transition-all ${
                                beforeBreak?.status === status
                                  ? statusColors[status]
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {status.charAt(0).toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {beforeBreak && (
                          <div className="flex justify-center">
                            <button
                              onClick={() => saveAttendance(student.id, 'before_break')}
                              disabled={savingId === `${student.id}-before_break`}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Save className="w-3 h-3" />
                              {savingId === `${student.id}-before_break` ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 bg-blue-50/30">
                      <div className="space-y-2">
                        <div className="flex justify-center gap-1">
                          {(['present', 'absent', 'sick', 'late'] as AttendanceStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => updateAttendance(student.id, 'after_break', status)}
                              className={`px-2 py-1 text-xs font-medium rounded border transition-all ${
                                afterBreak?.status === status
                                  ? statusColors[status]
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {status.charAt(0).toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {afterBreak && (
                          <div className="flex justify-center">
                            <button
                              onClick={() => saveAttendance(student.id, 'after_break')}
                              disabled={savingId === `${student.id}-after_break`}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Save className="w-3 h-3" />
                              {savingId === `${student.id}-after_break` ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can edit attendance for both sessions independently.
              Changes will update existing records and be reflected in teacher dashboard and all reports.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
