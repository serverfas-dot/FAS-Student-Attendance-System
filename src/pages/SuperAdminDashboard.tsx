import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, User } from '../lib/supabase';
import { api } from '../lib/api';
import { LogOut, Shield, Download, Upload, Database, Key, Save, AlertCircle, Clock, Calendar, Settings, History, Cloud } from 'lucide-react';

type BackupData = {
  version: string;
  timestamp: string;
  data: {
    users: any[];
    grades: any[];
    students: any[];
    attendance: any[];
    teacher_grade_permissions: any[];
  };
};

type BackupSettings = {
  id: string;
  schedule_type: 'manual' | 'weekly' | 'monthly';
  is_enabled: boolean;
  google_drive_folder_id: string | null;
  google_drive_access_token: string | null;
  last_backup_at: string | null;
  next_backup_at: string | null;
};

type BackupHistory = {
  id: string;
  backup_type: 'manual' | 'automatic';
  schedule_type: string;
  file_name: string;
  file_size: number;
  google_drive_file_id: string | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
};

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'admins' | 'backup' | 'schedule'>('admins');
  const [admins, setAdmins] = useState<User[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingBackup, setIsLoadingBackup] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [scheduleType, setScheduleType] = useState<'manual' | 'weekly' | 'monthly'>('manual');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState('');
  const [googleDriveAccessToken, setGoogleDriveAccessToken] = useState('');

  useEffect(() => {
    if (user) {
      fetchAdmins();
      fetchBackupSettings();
      fetchBackupHistory();
    }
  }, [user]);

  async function fetchAdmins() {
    if (!user) return;
    setIsLoadingAdmins(true);
    try {
      const data = await api.admins.getAll(user.id);
      setAdmins(data);
    } catch (error) {
      console.error('Failed to fetch admins:', error);
      setMessage({ type: 'error', text: 'Failed to load admins' });
    } finally {
      setIsLoadingAdmins(false);
    }
  }

  async function fetchBackupSettings() {
    if (!user) return;
    setIsLoadingBackup(true);
    try {
      const data = await api.backupSettings.get(user.id);
      if (data) {
        setBackupSettings(data);
        setScheduleType(data.schedule_type);
        setAutoBackupEnabled(data.is_enabled);
        setGoogleDriveFolderId(data.google_drive_folder_id || '');
        setGoogleDriveAccessToken(data.google_drive_access_token || '');
      }
    } catch (error) {
      console.error('Failed to fetch backup settings:', error);
    } finally {
      setIsLoadingBackup(false);
    }
  }

  async function fetchBackupHistory() {
    if (!user) return;
    try {
      const data = await api.backupHistory.getAll(user.id);
      setBackupHistory(data);
    } catch (error) {
      console.error('Failed to fetch backup history:', error);
    }
  }

  async function resetAdminPassword() {
    if (!user || !selectedAdmin || !newPassword) {
      setMessage({ type: 'error', text: 'Please select an admin and enter a new password' });
      return;
    }

    const trimmedPassword = newPassword.trim();

    if (trimmedPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      console.log('Resetting password for:', selectedAdmin);
      console.log('Password (trimmed):', trimmedPassword);
      console.log('Password length:', trimmedPassword.length);

      await api.users.changePassword(user.id, {
        userId: selectedAdmin,
        newPassword: trimmedPassword,
      });

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: adminData, error: fetchError } = await supabase
        .from('users')
        .select('username, password_hash')
        .eq('id', selectedAdmin)
        .maybeSingle();

      console.log('Admin after reset:', adminData?.username);
      console.log('New hash stored:', adminData?.password_hash);
      console.log('Fetch error:', fetchError);

      if (!adminData?.password_hash) {
        console.error('No hash found after update!');
        setMessage({ type: 'error', text: 'Password reset failed - no hash stored' });
        return;
      }

      const testResponse = await fetch(`${SUPABASE_URL}/functions/v1/hash-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPassword: trimmedPassword,
          hash: adminData.password_hash
        }),
      });
      const testResult = await testResponse.json();
      console.log('Hash validation test:', testResult);
      console.log('Test details - Password:', trimmedPassword, 'Length:', trimmedPassword.length);
      console.log('Test details - Hash:', adminData.password_hash);

      setMessage({
        type: 'success',
        text: `Password reset successfully. Test validation: ${testResult.isValid ? 'PASS' : 'FAIL'}`
      });
      setSelectedAdmin('');
      setNewPassword('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to reset password' });
    } finally {
      setIsLoading(false);
    }
  }

  async function createBackup() {
    setIsCreatingBackup(true);
    setMessage(null);

    try {
      const [usersData, gradesData, studentsData, attendanceData, permissionsData] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('grades').select('*'),
        supabase.from('students').select('*'),
        supabase.from('attendance').select('*'),
        supabase.from('teacher_grade_permissions').select('*'),
      ]);

      const backup: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          users: usersData.data || [],
          grades: gradesData.data || [],
          students: studentsData.data || [],
          attendance: attendanceData.data || [],
          teacher_grade_permissions: permissionsData.data || [],
        },
      };

      const backupContent = JSON.stringify(backup, null, 2);
      const blob = new Blob([backupContent], { type: 'application/json' });
      const fileName = `attendance-backup-${new Date().toISOString().split('T')[0]}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (user) {
        await api.backupHistory.create(user.id, {
          backup_type: 'manual',
          schedule_type: 'manual',
          file_name: fileName,
          file_size: blob.size,
          status: 'success',
        });
      }

      setMessage({ type: 'success', text: 'Backup created and downloaded successfully' });
      await fetchBackupHistory();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create backup' });
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: Restoring a backup will replace ALL existing data. This cannot be undone. Are you sure you want to continue?')) {
      event.target.value = '';
      return;
    }

    setIsRestoring(true);
    setMessage(null);

    try {
      const text = await file.text();
      const backup: BackupData = JSON.parse(text);

      if (!backup.version || !backup.data) {
        throw new Error('Invalid backup file format');
      }

      await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('teacher_grade_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('grades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('users').delete().eq('role', 'admin');
      await supabase.from('users').delete().eq('role', 'teacher');

      if (backup.data.users.length > 0) {
        const usersToInsert = backup.data.users.filter(u => u.role !== 'super_admin');
        if (usersToInsert.length > 0) {
          await supabase.from('users').insert(usersToInsert);
        }
      }

      if (backup.data.grades.length > 0) {
        await supabase.from('grades').insert(backup.data.grades);
      }

      if (backup.data.students.length > 0) {
        await supabase.from('students').insert(backup.data.students);
      }

      if (backup.data.teacher_grade_permissions.length > 0) {
        await supabase.from('teacher_grade_permissions').insert(backup.data.teacher_grade_permissions);
      }

      if (backup.data.attendance.length > 0) {
        await supabase.from('attendance').insert(backup.data.attendance);
      }

      setMessage({ type: 'success', text: 'Backup restored successfully' });
      await fetchAdmins();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to restore backup' });
    } finally {
      setIsRestoring(false);
      event.target.value = '';
    }
  }

  async function saveBackupSettings() {
    if (!user) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const now = new Date();
      let nextBackupAt = null;

      if (autoBackupEnabled && scheduleType !== 'manual') {
        nextBackupAt = new Date(now);
        if (scheduleType === 'weekly') {
          nextBackupAt.setDate(nextBackupAt.getDate() + 7);
        } else if (scheduleType === 'monthly') {
          nextBackupAt.setMonth(nextBackupAt.getMonth() + 1);
        }
      }

      const updateData: any = {
        schedule_type: scheduleType,
        is_enabled: autoBackupEnabled,
        google_drive_folder_id: googleDriveFolderId || null,
        google_drive_access_token: googleDriveAccessToken || null,
        updated_at: now.toISOString(),
      };

      if (nextBackupAt) {
        updateData.next_backup_at = nextBackupAt.toISOString();
      }

      await api.backupSettings.save(user.id, updateData);

      setMessage({ type: 'success', text: 'Backup settings saved successfully' });
      await fetchBackupSettings();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setIsLoading(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-xs text-gray-500">{user?.full_name}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`} />
            <p className={`text-sm ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>{message.text}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="border-b border-slate-200">
            <div className="flex gap-2 p-2">
              <button
                onClick={() => setActiveTab('admins')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'admins'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Key className="w-4 h-4" />
                Admin Management
              </button>
              <button
                onClick={() => setActiveTab('backup')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'backup'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Database className="w-4 h-4" />
                Manual Backup
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'schedule'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                Auto Backup Settings
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'admins' && (
              <div className="relative">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="relative">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Reset Admin Password</h2>
                    <div className="space-y-4 relative">
                      <div className="relative z-20">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Admin</label>
                        <select
                          value={selectedAdmin}
                          onChange={(e) => setSelectedAdmin(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                        >
                          <option value="">Choose an admin</option>
                          {admins.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              {admin.full_name} ({admin.email})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="relative z-10">
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 6 characters)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                        />
                      </div>

                      <button
                        onClick={resetAdminPassword}
                        disabled={isLoading || !selectedAdmin || !newPassword}
                        className="relative z-10 w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
                      >
                        <Save className="w-4 h-4" />
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                      </button>

                      {(!selectedAdmin || !newPassword) && !isLoading && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Please select an admin and enter a new password to enable the button
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="relative z-0">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Current Admins</h2>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 sticky top-0 z-0">
                            <tr>
                              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-900">Name</th>
                              <th className="text-center py-2 px-3 text-sm font-semibold text-gray-900">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isLoadingAdmins ? (
                              <tr>
                                <td colSpan={3} className="py-6 text-center text-gray-500">Loading admins...</td>
                              </tr>
                            ) : admins.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-6 text-center text-gray-500">No admins found</td>
                              </tr>
                            ) : admins.map((admin) => (
                              <tr key={admin.id} className="border-t border-slate-100">
                                <td className="py-2 px-3 text-sm">{admin.full_name}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                    admin.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {admin.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Manual Backup</h2>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          Create a backup of all system data including users, grades, students, attendance records, and permissions.
                        </p>
                      </div>

                      <button
                        onClick={createBackup}
                        disabled={isCreatingBackup}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        {isCreatingBackup ? 'Creating Backup...' : 'Create & Download Backup'}
                      </button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">OR</span>
                        </div>
                      </div>

                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-medium mb-2">
                          WARNING: Restoring will replace ALL existing data!
                        </p>
                        <p className="text-xs text-red-700">
                          Super admin accounts will NOT be affected by restore operations.
                        </p>
                      </div>

                      <label className="block">
                        <input
                          type="file"
                          accept=".json"
                          onChange={restoreBackup}
                          disabled={isRestoring}
                          className="hidden"
                          id="restore-file"
                        />
                        <label
                          htmlFor="restore-file"
                          className={`flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors cursor-pointer ${
                            isRestoring ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Upload className="w-4 h-4" />
                          {isRestoring ? 'Restoring...' : 'Restore from Backup'}
                        </label>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Backup History
                    </h2>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        {backupHistory.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No backup history yet</p>
                          </div>
                        ) : (
                          <table className="w-full">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900">Date</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900">Type</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900">Size</th>
                                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-900">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backupHistory.map((history) => (
                                <tr key={history.id} className="border-t border-slate-100">
                                  <td className="py-2 px-3 text-xs text-gray-600">
                                    {new Date(history.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 text-xs">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                      history.backup_type === 'automatic'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {history.backup_type}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-xs text-gray-600">
                                    {formatFileSize(history.file_size)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                      history.status === 'success'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {history.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Automatic Backup Configuration</h2>

                <div className="space-y-6">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-900 mb-1">Automated Backup Schedule</p>
                        <p className="text-xs text-purple-700">
                          Configure automatic backups to Google Drive on a weekly or monthly basis. Backups will be stored in your specified Google Drive folder.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoBackupEnabled}
                          onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                          className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-900">Enable Automatic Backups</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Backup Schedule</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => setScheduleType('manual')}
                          disabled={!autoBackupEnabled}
                          className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                            scheduleType === 'manual'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-300 text-gray-700 hover:border-purple-300'
                          } ${!autoBackupEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Calendar className="w-5 h-5 mx-auto mb-1" />
                          Manual Only
                        </button>
                        <button
                          onClick={() => setScheduleType('weekly')}
                          disabled={!autoBackupEnabled}
                          className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                            scheduleType === 'weekly'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-300 text-gray-700 hover:border-purple-300'
                          } ${!autoBackupEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Clock className="w-5 h-5 mx-auto mb-1" />
                          Weekly
                        </button>
                        <button
                          onClick={() => setScheduleType('monthly')}
                          disabled={!autoBackupEnabled}
                          className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                            scheduleType === 'monthly'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-300 text-gray-700 hover:border-purple-300'
                          } ${!autoBackupEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Calendar className="w-5 h-5 mx-auto mb-1" />
                          Monthly
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Cloud className="w-5 h-5 text-gray-700" />
                        <h3 className="font-semibold text-gray-900">Google Drive Integration</h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Google Drive Folder ID
                          </label>
                          <input
                            type="text"
                            value={googleDriveFolderId}
                            onChange={(e) => setGoogleDriveFolderId(e.target.value)}
                            placeholder="Enter your Google Drive folder ID"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Find the folder ID in your Google Drive folder URL after /folders/
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Google Drive Access Token
                          </label>
                          <input
                            type="password"
                            value={googleDriveAccessToken}
                            onChange={(e) => setGoogleDriveAccessToken(e.target.value)}
                            placeholder="Enter your Google Drive access token"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Generate an access token from Google Cloud Console
                          </p>
                        </div>
                      </div>
                    </div>

                    {backupSettings && backupSettings.next_backup_at && autoBackupEnabled && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Next automatic backup:</span>{' '}
                          {new Date(backupSettings.next_backup_at).toLocaleString()}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={saveBackupSettings}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {isLoading ? 'Saving...' : 'Save Backup Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
