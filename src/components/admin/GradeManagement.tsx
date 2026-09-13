import React, { useState, useEffect } from 'react';
import { Grade } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, CreditCard as Edit2, Trash2, Save, X } from 'lucide-react';

export default function GradeManagement() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    grade_name: '',
    total_boys: 0,
    total_girls: 0,
    academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
  });

  useEffect(() => {
    if (user) {
      fetchGrades();
    }
  }, [user]);

  async function fetchGrades() {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await api.grades.getAll(user.id);
      setGrades(data);
    } catch (error) {
      console.error('Failed to fetch grades:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      if (editingId) {
        await api.grades.update(user.id, editingId, formData);
      } else {
        await api.grades.create(user.id, formData);
      }
      await fetchGrades();
      resetForm();
    } catch (error) {
      console.error('Failed to save grade:', error);
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      grade_name: '',
      total_boys: 0,
      total_girls: 0,
      academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    });
    setShowForm(false);
    setEditingId(null);
  }

  function handleEdit(grade: Grade) {
    setFormData({
      grade_name: grade.grade_name,
      total_boys: grade.total_boys,
      total_girls: grade.total_girls,
      academic_year: grade.academic_year,
    });
    setEditingId(grade.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    if (confirm('Are you sure you want to delete this grade? All associated students will be affected.')) {
      setDeletingId(id);
      try {
        await api.grades.delete(user.id, id);
        await fetchGrades();
      } catch (error) {
        console.error('Failed to delete grade:', error);
      } finally {
        setDeletingId(null);
      }
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading grades...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Grade Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Grade
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grade Name</label>
              <input
                type="text"
                value={formData.grade_name}
                onChange={(e) => setFormData({ ...formData, grade_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Grade 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
              <input
                type="text"
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2024-2025"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Boys</label>
              <input
                type="number"
                min="0"
                value={formData.total_boys}
                onChange={(e) => setFormData({ ...formData, total_boys: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Girls</label>
              <input
                type="number"
                min="0"
                value={formData.total_girls}
                onChange={(e) => setFormData({ ...formData, total_girls: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Grade Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Academic Year</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900">Total Boys</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900">Total Girls</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900">Total Students</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">{grade.grade_name}</td>
                <td className="py-3 px-4">{grade.academic_year}</td>
                <td className="py-3 px-4 text-center">{grade.total_boys}</td>
                <td className="py-3 px-4 text-center">{grade.total_girls}</td>
                <td className="py-3 px-4 text-center font-semibold">{grade.total_students}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(grade)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(grade.id)}
                      disabled={deletingId === grade.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
