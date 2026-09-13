import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, GraduationCap, UserCheck, Settings, ClipboardList } from 'lucide-react';
import GradeManagement from '../components/admin/GradeManagement';
import StudentManagement from '../components/admin/StudentManagement';
import TeacherManagement from '../components/admin/TeacherManagement';
import AttendanceReports from '../components/admin/AttendanceReports';
import AttendanceEdit from '../components/admin/AttendanceEdit';

type Tab = 'grades' | 'students' | 'teachers' | 'reports' | 'attendance';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('grades');

  const tabs = [
    { id: 'grades' as Tab, label: 'Grades', icon: GraduationCap },
    { id: 'students' as Tab, label: 'Students', icon: Users },
    { id: 'teachers' as Tab, label: 'Teachers', icon: UserCheck },
    { id: 'attendance' as Tab, label: 'Edit Attendance', icon: ClipboardList },
    { id: 'reports' as Tab, label: 'Reports', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
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
        <div className="flex gap-6">
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sticky top-8">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className={activeTab === 'grades' ? 'block' : 'hidden'}>
              <GradeManagement />
            </div>
            <div className={activeTab === 'students' ? 'block' : 'hidden'}>
              <StudentManagement />
            </div>
            <div className={activeTab === 'teachers' ? 'block' : 'hidden'}>
              <TeacherManagement />
            </div>
            <div className={activeTab === 'attendance' ? 'block' : 'hidden'}>
              <AttendanceEdit />
            </div>
            <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
              <AttendanceReports />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
