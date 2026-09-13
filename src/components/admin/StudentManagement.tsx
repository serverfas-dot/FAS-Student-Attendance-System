import React, { useState, useEffect } from 'react';
import { supabase, Student, Grade } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, CreditCard as Edit2, Trash2, Save, X, Search, Upload, Download, FileText, AlertCircle, CheckCircle, User } from 'lucide-react';

type StudentWithGrade = Student & { grades?: Grade };

type BulkUploadResult = {
  success: number;
  failed: number;
  errors: string[];
};

export default function StudentManagement() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithGrade[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    student_index: '',
    student_name: '',
    gender: 'Male' as 'Male' | 'Female',
    grade_id: '',
    house: '',
    position: '',
  });

  useEffect(() => {
    fetchGrades();
    fetchStudents();
  }, []);

  async function fetchGrades() {
    if (!user) return;
    try {
      const data = await api.grades.getAll(user.id);
      setGrades(data);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  }

  async function fetchStudents() {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await api.students.getAll(user.id);
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const savedStudent = editingId
        ? await api.students.update(user.id, editingId, formData)
        : await api.students.create(user.id, formData);
      if (photoFile) {
        await api.students.uploadPhoto(user.id, savedStudent.id, photoFile);
      }
      await fetchStudents();
      resetForm();
    } catch (error: any) {
      console.error('Error saving student:', error);
      const message = error?.message?.includes('already used')
        ? error.message
        : 'Failed to save student';
      alert(message);
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      student_index: '',
      student_name: '',
      gender: 'Male',
      grade_id: '',
      house: '',
      position: '',
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(false);
    setEditingId(null);
  }

  function handleEdit(student: Student) {
    setFormData({
      student_index: student.student_index,
      student_name: student.student_name,
      gender: student.gender,
      grade_id: student.grade_id,
      house: student.house || '',
      position: student.position || '',
    });
    setPhotoFile(null);
    setPhotoPreview(student.photo_url);
    setEditingId(student.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    if (confirm('Are you sure you want to delete this student?')) {
      setDeletingId(id);
      try {
        await api.students.delete(user.id, id);
        await fetchStudents();
      } catch (error) {
        console.error('Error deleting student:', error);
        alert('Failed to delete student');
      } finally {
        setDeletingId(null);
      }
    }
  }

  function downloadTemplate() {
    const gradesList = grades.map(g => g.grade_name).join(', ');

    const csvContent = [
      'Student Index,Student Name,Gender,Grade Name',
      '# Instructions: Fill in the data below. Keep the header row.',
      `# Available Grade Names: ${gradesList}`,
      '# Gender: Use "M" or "F" (or "Male" or "Female")',
      '# IMPORTANT: Use the exact Grade Name from the list above',
      '# Example data:',
      'STU001,John Doe,M,' + (grades[0]?.grade_name || 'Grade 1'),
      'STU002,Jane Smith,F,' + (grades[0]?.grade_name || 'Grade 1'),
      'STU003,Michael Brown,M,' + (grades[1]?.grade_name || 'Grade 2'),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-upload-template-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  async function handleBulkUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('"#');
      });

      if (lines.length < 2) {
        throw new Error('File is empty or contains no data');
      }

      const headerValues = parseCSVLine(lines[0]);
      const headers = headerValues.map(h => h.toLowerCase().replace(/\s+/g, ''));
      const requiredHeaders = ['studentindex', 'studentname', 'gender', 'gradename'];

      const hasAllHeaders = requiredHeaders.every(required =>
        headers.includes(required)
      );

      if (!hasAllHeaders) {
        throw new Error('Invalid CSV format. Please use the provided template.');
      }

      const studentsToInsert = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const [studentIndex, studentName, genderRaw, gradeName] = values;

        if (!studentIndex || !studentName || !genderRaw || !gradeName) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        let gender: 'Male' | 'Female';
        const genderUpper = genderRaw.toUpperCase();
        if (genderUpper === 'M' || genderUpper === 'MALE') {
          gender = 'Male';
        } else if (genderUpper === 'F' || genderUpper === 'FEMALE') {
          gender = 'Female';
        } else {
          errors.push(`Row ${i + 1}: Gender must be "Male", "Female", "M", or "F" (got "${genderRaw}")`);
          continue;
        }

        const normalizeGradeName = (name: string) => name.toLowerCase().replace(/\s+/g, '');
        const matchedGrade = grades.find(g =>
          normalizeGradeName(g.grade_name) === normalizeGradeName(gradeName)
        );
        if (!matchedGrade) {
          errors.push(`Row ${i + 1}: Grade "${gradeName}" not found. Available grades: ${grades.map(g => g.grade_name).join(', ')}`);
          continue;
        }

        studentsToInsert.push({
          student_index: studentIndex,
          student_name: studentName,
          gender: gender,
          grade_id: matchedGrade.id,
        });
      }

      let successCount = 0;

      if (studentsToInsert.length > 0 && user) {
        try {
          const result = await api.students.bulkCreate(user.id, studentsToInsert);
          successCount = result.count || studentsToInsert.length;
        } catch (error: any) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            errors.push('Some student indexes already exist in the database');
          } else {
            errors.push(`Database error: ${error.message}`);
          }
        }
      }

      setUploadResult({
        success: successCount,
        failed: errors.length,
        errors: errors,
      });

      if (successCount > 0) {
        await fetchStudents();
      }
    } catch (error: any) {
      setUploadResult({
        success: 0,
        failed: 1,
        errors: [error.message || 'Failed to process file'],
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_index.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = !filterGrade || student.grade_id === filterGrade;
    return matchesSearch && matchesGrade;
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading students...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {showBulkUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Bulk Upload Students</h3>
                <button
                  onClick={() => {
                    setShowBulkUpload(false);
                    setUploadResult(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">How to Use Bulk Upload</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Download the CSV template below</li>
                      <li>Open it in Excel, Google Sheets, or any spreadsheet editor</li>
                      <li>Fill in student data: Index, Name, Gender (M/F), Grade Name</li>
                      <li>Use exact grade names shown below</li>
                      <li>Save as CSV and upload the file</li>
                    </ol>
                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Available Grades:</p>
                      <p className="text-sm text-blue-800">
                        {grades.length > 0 ? grades.map(g => g.grade_name).join(', ') : 'No grades available. Please add grades first.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download CSV Template
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">THEN UPLOAD YOUR FILE</span>
                </div>
              </div>

              <div>
                <label className="block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleBulkUpload}
                    disabled={isUploading}
                    className="hidden"
                    id="bulk-upload-file"
                  />
                  <label
                    htmlFor="bulk-upload-file"
                    className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isUploading
                        ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                        : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
                    }`}
                  >
                    <Upload className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-700 font-medium">
                      {isUploading ? 'Uploading...' : 'Click to Upload CSV File'}
                    </span>
                  </label>
                </label>
              </div>

              {uploadResult && (
                <div className="space-y-4">
                  {uploadResult.success > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-green-900">Upload Successful</h4>
                          <p className="text-sm text-green-800 mt-1">
                            Successfully added {uploadResult.success} student{uploadResult.success !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadResult.failed > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-900">
                            {uploadResult.failed} Error{uploadResult.failed !== 1 ? 's' : ''} Found
                          </h4>
                          <div className="mt-2 space-y-1">
                            {uploadResult.errors.map((error, index) => (
                              <p key={index} className="text-sm text-red-800">
                                • {error}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadResult.success > 0 && (
                    <button
                      onClick={() => {
                        setShowBulkUpload(false);
                        setUploadResult(null);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Index</label>
              <input
                type="text"
                value={formData.student_index}
                onChange={(e) => setFormData({ ...formData, student_index: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., STU001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
              <input
                type="text"
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter student name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
              <select
                value={formData.grade_id}
                onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Grade</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.grade_name} ({grade.academic_year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">House</label>
              <input
                type="text"
                value={formData.house}
                onChange={(e) => setFormData({ ...formData, house: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Red House"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position / Role</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., School Captain, Prefect"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student Photo</label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg bg-slate-200">
                  {photoPreview ? <img src={photoPreview} alt="Student preview" className="h-full w-full object-cover" /> : <User className="m-3 h-8 w-8 text-slate-400" />}
                </div>
                <label className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                  Choose photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Photo must be 5 MB or smaller.');
                        event.target.value = '';
                        return;
                      }
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WEBP up to 5 MB</p>
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

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or index..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Grades</option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.grade_name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Index</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Gender</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Grade</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 font-mono text-sm">{student.student_index}</td>
                <td className="py-3 px-4">{student.student_name}</td>
                <td className="py-3 px-4">{student.gender}</td>
                <td className="py-3 px-4">{student.grades?.grade_name}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(student)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(student.id)}
                      disabled={deletingId === student.id}
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

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredStudents.length} of {students.length} students
      </div>
    </div>
  );
}
