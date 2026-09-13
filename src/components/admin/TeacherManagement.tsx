import React, { useState, useEffect } from 'react';
import { supabase, User, Grade, TeacherGradePermission } from '../../lib/supabase';
import { api } from '../../lib/api';
import { Plus, Edit2, Trash2, Save, X, Key, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type TeacherWithPermissions = User & {
  permissions?: (TeacherGradePermission & { grades?: Grade })[];
};

export default function TeacherManagement() {
  const { user: currentUser } = useAuth();
  const [teachers, setTeachers] = useState<TeacherWithPermissions[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [gradePermissions, setGradePermissions] = useState<Record<string, { canMarkAttendance: boolean; canViewReports: boolean; canEditAttendance: boolean }>>({});
  const [formSelectedGrades, setFormSelectedGrades] = useState<string[]>([]);
  const [formGradePermissions, setFormGradePermissions] = useState<Record<string, { canMarkAttendance: boolean; canViewReports: boolean; canEditAttendance: boolean }>>({});
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  });

  useEffect(() => {
    async function loadData() {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      try {
        const gradesData = await api.grades.getAll(currentUser.id);
        setGrades(gradesData);
        await fetchTeachers(gradesData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  async function fetchGrades() {
    if (!currentUser) return;
    try {
      const data = await api.grades.getAll(currentUser.id);
      setGrades(data);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  }

  async function fetchTeachers(gradesList?: Grade[]) {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [data, allPermissions] = await Promise.all([
        api.teachers.getAll(currentUser.id),
        api.teacherPermissions.getAll(currentUser.id),
      ]);
      const gradesData = gradesList || grades;

      const permissionsByTeacher: Record<string, any[]> = {};
      (allPermissions || []).forEach((perm: any) => {
        if (!permissionsByTeacher[perm.teacher_id]) permissionsByTeacher[perm.teacher_id] = [];
        const grade = gradesData.find(g => g.id === perm.grade_id);
        permissionsByTeacher[perm.teacher_id].push({
          ...perm,
          grades: grade ? { grade_name: grade.grade_name } : null,
        });
      });

      const teachersWithPermissions = data.map((teacher: User) => ({
        ...teacher,
        permissions: permissionsByTeacher[teacher.id] || [],
      }));

      setTeachers(teachersWithPermissions);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUser) return;

    setIsSaving(true);
    try {
      if (editingId) {
        const updateData: any = {
          email: formData.email,
          full_name: formData.full_name,
        };

        if (formData.password) {
          updateData.password = formData.password;
        }

        await api.teachers.update(currentUser.id, editingId, updateData);

        const existingPermissions = await api.teacherPermissions.getAll(currentUser.id, editingId);

        const existingGradeIds = existingPermissions?.map((p: any) => p.grade_id) || [];
        const toDelete = existingGradeIds.filter((id: string) => !formSelectedGrades.includes(id));
        const toAdd = formSelectedGrades.filter((id) => !existingGradeIds.includes(id));
        const toUpdate = formSelectedGrades.filter((id) => existingGradeIds.includes(id));

        if (toDelete.length > 0) {
          for (const gradeId of toDelete) {
            const permToDelete = existingPermissions?.find((p: any) => p.grade_id === gradeId);
            if (permToDelete) {
              await api.teacherPermissions.delete(currentUser.id, permToDelete.id);
            }
          }
        }

        for (const gradeId of toUpdate) {
          const existingPerm = existingPermissions?.find((p: any) => p.grade_id === gradeId);
          if (existingPerm) {
            const newPerms = formGradePermissions[gradeId];
            if (existingPerm.can_mark_attendance !== newPerms?.canMarkAttendance ||
                existingPerm.can_view_reports !== newPerms?.canViewReports ||
                existingPerm.can_edit_attendance !== newPerms?.canEditAttendance) {
              await api.teacherPermissions.update(currentUser.id, existingPerm.id, {
                can_mark_attendance: newPerms?.canMarkAttendance ?? true,
                can_view_reports: newPerms?.canViewReports ?? true,
                can_edit_attendance: newPerms?.canEditAttendance ?? false,
              });
            }
          }
        }

        for (const gradeId of toAdd) {
          await api.teacherPermissions.create(currentUser.id, {
            teacher_id: editingId,
            grade_id: gradeId,
            can_mark_attendance: formGradePermissions[gradeId]?.canMarkAttendance ?? true,
            can_view_reports: formGradePermissions[gradeId]?.canViewReports ?? true,
            can_edit_attendance: formGradePermissions[gradeId]?.canEditAttendance ?? false,
          });
        }
      } else {
        const createData: any = {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
        };

        const newTeacher = await api.teachers.create(currentUser.id, createData);

        for (const gradeId of formSelectedGrades) {
          await api.teacherPermissions.create(currentUser.id, {
            teacher_id: newTeacher.id,
            grade_id: gradeId,
            can_mark_attendance: formGradePermissions[gradeId]?.canMarkAttendance ?? true,
            can_view_reports: formGradePermissions[gradeId]?.canViewReports ?? true,
            can_edit_attendance: formGradePermissions[gradeId]?.canEditAttendance ?? false,
          });
        }
      }

      const gradesData = await api.grades.getAll(currentUser.id);
      setGrades(gradesData);
      await fetchTeachers(gradesData);
      resetForm();
    } catch (error: any) {
      console.error('Error saving teacher:', error);
      alert(`Failed to save teacher: ${error.message || JSON.stringify(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      email: '',
      password: '',
      full_name: '',
    });
    setFormSelectedGrades([]);
    setFormGradePermissions({});
    setShowForm(false);
    setEditingId(null);
  }

  async function handleEdit(teacher: TeacherWithPermissions) {
    if (!currentUser) return;

    setFormData({
      email: teacher.email,
      password: '',
      full_name: teacher.full_name,
    });

    try {
      const permissions = await api.teacherPermissions.getAll(currentUser.id, teacher.id);

      if (permissions && permissions.length > 0) {
        setFormSelectedGrades(permissions.map((p: any) => p.grade_id));
        const perms: Record<string, { canMarkAttendance: boolean; canViewReports: boolean; canEditAttendance: boolean }> = {};
        permissions.forEach((p: any) => {
          perms[p.grade_id] = {
            canMarkAttendance: p.can_mark_attendance,
            canViewReports: p.can_view_reports,
            canEditAttendance: p.can_edit_attendance ?? false,
          };
        });
        setFormGradePermissions(perms);
      }
    } catch (error) {
      console.error('Error fetching teacher permissions:', error);
    }

    setEditingId(teacher.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!currentUser) return;
    if (confirm('Are you sure you want to delete this teacher?')) {
      setDeletingId(id);
      try {
        await api.teachers.delete(currentUser.id, id);
        await fetchTeachers();
      } catch (error) {
        console.error('Error deleting teacher:', error);
        alert('Failed to delete teacher');
      } finally {
        setDeletingId(null);
      }
    }
  }

  async function handlePermissions(teacherId: string) {
    if (!currentUser) return;

    const permissions = await api.teacherPermissions.getAll(currentUser.id, teacherId);

    if (permissions && permissions.length > 0) {
      setSelectedGrades(permissions.map((p: any) => p.grade_id));
      const perms: Record<string, { canMarkAttendance: boolean; canViewReports: boolean; canEditAttendance: boolean }> = {};
      permissions.forEach((p: any) => {
        perms[p.grade_id] = {
          canMarkAttendance: p.can_mark_attendance,
          canViewReports: p.can_view_reports,
          canEditAttendance: p.can_edit_attendance ?? false,
        };
      });
      setGradePermissions(perms);
    }
    setShowPermissions(teacherId);
  }

  async function savePermissions() {
    if (!showPermissions || !currentUser) return;

    setSavingPermissions(true);
    try {
      const existingPermissions = await api.teacherPermissions.getAll(
        currentUser.id,
        showPermissions
      );

      const existingGradeIds = existingPermissions?.map((p: any) => p.grade_id) || [];
      const toDelete = existingGradeIds.filter((id: string) => !selectedGrades.includes(id));
      const toAdd = selectedGrades.filter((id) => !existingGradeIds.includes(id));
      const toUpdate = selectedGrades.filter((id) => existingGradeIds.includes(id));

      if (toDelete.length > 0) {
        for (const gradeId of toDelete) {
          const permToDelete = existingPermissions?.find((p: any) => p.grade_id === gradeId);
          if (permToDelete) {
            await api.teacherPermissions.delete(currentUser.id, permToDelete.id);
          }
        }
      }

      for (const gradeId of toUpdate) {
        const existingPerm = existingPermissions?.find((p: any) => p.grade_id === gradeId);
        if (existingPerm) {
          const newPerms = gradePermissions[gradeId];
          if (existingPerm.can_mark_attendance !== newPerms?.canMarkAttendance ||
              existingPerm.can_view_reports !== newPerms?.canViewReports ||
              existingPerm.can_edit_attendance !== newPerms?.canEditAttendance) {
            await api.teacherPermissions.update(currentUser.id, existingPerm.id, {
              can_mark_attendance: newPerms?.canMarkAttendance ?? true,
              can_view_reports: newPerms?.canViewReports ?? true,
              can_edit_attendance: newPerms?.canEditAttendance ?? false,
            });
          }
        }
      }

      for (const gradeId of toAdd) {
        await api.teacherPermissions.create(currentUser.id, {
          teacher_id: showPermissions,
          grade_id: gradeId,
          can_mark_attendance: gradePermissions[gradeId]?.canMarkAttendance ?? true,
          can_view_reports: gradePermissions[gradeId]?.canViewReports ?? true,
          can_edit_attendance: gradePermissions[gradeId]?.canEditAttendance ?? false,
        });
      }

      await fetchTeachers();
      setShowPermissions(null);
      setSelectedGrades([]);
      setGradePermissions({});
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert(`Failed to save permissions: ${error.message || error}`);
    } finally {
      setSavingPermissions(false);
    }
  }

  function toggleGrade(gradeId: string) {
    setSelectedGrades((prev) => {
      const isAdding = !prev.includes(gradeId);
      if (isAdding) {
        setGradePermissions((perms) => ({
          ...perms,
          [gradeId]: {
            canMarkAttendance: true,
            canViewReports: true,
          },
        }));
        return [...prev, gradeId];
      } else {
        setGradePermissions((perms) => {
          const newPerms = { ...perms };
          delete newPerms[gradeId];
          return newPerms;
        });
        return prev.filter((id) => id !== gradeId);
      }
    });
  }

  function togglePermission(gradeId: string, permissionType: 'canMarkAttendance' | 'canViewReports' | 'canEditAttendance') {
    setGradePermissions((prev) => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        [permissionType]: !prev[gradeId]?.[permissionType],
      },
    }));
  }

  function toggleFormGrade(gradeId: string) {
    setFormSelectedGrades((prev) => {
      const isAdding = !prev.includes(gradeId);
      if (isAdding) {
        setFormGradePermissions((perms) => ({
          ...perms,
          [gradeId]: {
            canMarkAttendance: true,
            canViewReports: true,
          },
        }));
        return [...prev, gradeId];
      } else {
        setFormGradePermissions((perms) => {
          const newPerms = { ...perms };
          delete newPerms[gradeId];
          return newPerms;
        });
        return prev.filter((id) => id !== gradeId);
      }
    });
  }

  function toggleFormPermission(gradeId: string, permissionType: 'canMarkAttendance' | 'canViewReports' | 'canEditAttendance') {
    setFormGradePermissions((prev) => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        [permissionType]: !prev[gradeId]?.[permissionType],
      },
    }));
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !showPasswordChange || !newPassword) return;

    setSavingPassword(true);
    try {
      await api.teachers.update(currentUser.id, showPasswordChange.id, {
        password: newPassword,
      });
      alert('Password updated successfully!');
      setShowPasswordChange(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      alert(`Failed to update password: ${error.message || error}`);
    } finally {
      setSavingPassword(false);
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading teachers...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Teacher Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Teacher
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="teacher@school.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password {editingId && '(leave blank to keep current)'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingId}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
              />
            </div>
          </div>

          <div className="mb-4 p-4 bg-white rounded-lg border border-slate-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Assign Grades</h4>
            <div className="space-y-3">
              {grades.map((grade) => {
                const isSelected = formSelectedGrades.includes(grade.id);
                return (
                  <div key={grade.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFormGrade(grade.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">
                        {grade.grade_name} - {grade.academic_year}
                      </span>
                    </label>
                    {isSelected && (
                      <div className="ml-6 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formGradePermissions[grade.id]?.canMarkAttendance ?? true}
                            onChange={() => toggleFormPermission(grade.id, 'canMarkAttendance')}
                            className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Can Mark Attendance</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formGradePermissions[grade.id]?.canEditAttendance ?? false}
                            onChange={() => toggleFormPermission(grade.id, 'canEditAttendance')}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">Can Edit Attendance</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formGradePermissions[grade.id]?.canViewReports ?? true}
                            onChange={() => toggleFormPermission(grade.id, 'canViewReports')}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Can View Reports</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {formSelectedGrades.length === 0 && (
              <p className="text-sm text-gray-500 mt-2 italic">No grades selected. Teacher will have no access.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {showPasswordChange && (
        <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border-2 border-orange-200 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Change Password for {showPasswordChange.name}
            </h3>
          </div>
          <form onSubmit={handlePasswordChange}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Enter new password"
                autoFocus
              />
              <p className="text-xs text-gray-600 mt-2">
                The teacher will use this password to login with their username: <strong>{showPasswordChange.name}</strong>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(null);
                  setNewPassword('');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showPermissions && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Grade Permissions</h3>
          <div className="space-y-3 mb-4">
            {grades.map((grade) => {
              const isSelected = selectedGrades.includes(grade.id);
              return (
                <div key={grade.id} className="bg-white p-3 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGrade(grade.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-900">{grade.grade_name}</span>
                  </label>
                  {isSelected && (
                    <div className="ml-6 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gradePermissions[grade.id]?.canMarkAttendance ?? true}
                          onChange={() => togglePermission(grade.id, 'canMarkAttendance')}
                          className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">Can Mark Attendance</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gradePermissions[grade.id]?.canEditAttendance ?? false}
                          onChange={() => togglePermission(grade.id, 'canEditAttendance')}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">Can Edit Attendance</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gradePermissions[grade.id]?.canViewReports ?? true}
                          onChange={() => togglePermission(grade.id, 'canViewReports')}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Can View Reports</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={savePermissions}
              disabled={savingPermissions}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {savingPermissions ? 'Saving...' : 'Save Permissions'}
            </button>
            <button
              onClick={() => {
                setShowPermissions(null);
                setSelectedGrades([]);
                setGradePermissions({});
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Email / User ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Assigned Grades</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">{teacher.full_name}</td>
                <td className="py-3 px-4">{teacher.email}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {teacher.permissions?.map((perm) => (
                      <span
                        key={perm.id}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {perm.grades?.grade_name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowPasswordChange({ id: teacher.id, name: teacher.username })}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Change Password"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePermissions(teacher.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Manage Permissions"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(teacher)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Teacher"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(teacher.id)}
                      disabled={deletingId === teacher.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Teacher"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
