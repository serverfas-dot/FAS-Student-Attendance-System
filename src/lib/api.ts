const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API_BASE = `${SUPABASE_URL}/functions/v1/api`;

function getAuthHeaders(userId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userId}`,
  };
}

async function getResponseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string' && body.error.trim()) {
      return new Error(body.error);
    }
  } catch {
    // Use the fallback when the server does not return JSON.
  }
  return new Error(fallback);
}

export const api = {
  grades: {
    async getAll(userId: string) {
      const response = await fetch(`${API_BASE}/grades`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch grades');
      return response.json();
    },

    async create(userId: string, data: any) {
      const response = await fetch(`${API_BASE}/grades`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create grade');
      return response.json();
    },

    async update(userId: string, gradeId: string, data: any) {
      const response = await fetch(`${API_BASE}/grades/${gradeId}`, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update grade');
      return response.json();
    },

    async delete(userId: string, gradeId: string) {
      const response = await fetch(`${API_BASE}/grades/${gradeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to delete grade');
      return response.json();
    },
  },

  students: {
    async getAll(userId: string, gradeId?: string) {
      const url = gradeId
        ? `${API_BASE}/students?grade_id=${gradeId}`
        : `${API_BASE}/students`;
      const response = await fetch(url, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch students');
      return response.json();
    },

    async create(userId: string, data: any) {
      const response = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw await getResponseError(response, 'Failed to create student');
      }
      return response.json();
    },

    async bulkCreate(userId: string, students: any[]) {
      const response = await fetch(`${API_BASE}/students/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ students }),
      });
      if (!response.ok) throw new Error('Failed to bulk create students');
      return response.json();
    },

    async uploadPhoto(userId: string, studentId: string, file: File) {
      const formData = new FormData();
      formData.append('photo', file);
      const response = await fetch(`${API_BASE}/students/${studentId}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userId}` },
        body: formData,
      });
      if (!response.ok) throw await getResponseError(response, 'Failed to upload student photo');
      return response.json();
    },

    async update(userId: string, studentId: string, data: any) {
      const response = await fetch(`${API_BASE}/students/${studentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw await getResponseError(response, 'Failed to update student');
      }
      return response.json();
    },

    async delete(userId: string, studentId: string) {
      const response = await fetch(`${API_BASE}/students/${studentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to delete student');
      return response.json();
    },
  },

  teachers: {
    async getAll(userId: string) {
      const response = await fetch(`${API_BASE}/teachers`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch teachers');
      return response.json();
    },

    async create(userId: string, data: any) {
      const response = await fetch(`${API_BASE}/teachers`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create teacher: ${error}`);
      }
      return response.json();
    },

    async update(userId: string, teacherId: string, data: any) {
      const response = await fetch(`${API_BASE}/teachers/${teacherId}`, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update teacher: ${error}`);
      }
      return response.json();
    },

    async delete(userId: string, teacherId: string) {
      const response = await fetch(`${API_BASE}/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to delete teacher');
      return response.json();
    },
  },

  teacherPermissions: {
    async getAll(userId: string, teacherId?: string) {
      const url = teacherId
        ? `${API_BASE}/teacher-permissions?teacher_id=${teacherId}`
        : `${API_BASE}/teacher-permissions`;
      const response = await fetch(url, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch teacher permissions');
      return response.json();
    },

    async create(userId: string, data: { teacher_id: string; grade_id: string; can_mark_attendance?: boolean; can_view_reports?: boolean; can_edit_attendance?: boolean }) {
      const response = await fetch(`${API_BASE}/teacher-permissions`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create teacher permission: ${error}`);
      }
      return response.json();
    },

    async update(userId: string, permissionId: string, data: { can_mark_attendance?: boolean; can_view_reports?: boolean; can_edit_attendance?: boolean }) {
      const response = await fetch(`${API_BASE}/teacher-permissions/${permissionId}`, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update teacher permission: ${error}`);
      }
      return response.json();
    },

    async delete(userId: string, permissionId: string) {
      const response = await fetch(`${API_BASE}/teacher-permissions/${permissionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to delete teacher permission');
      return response.json();
    },
  },

  attendance: {
    async getAll(userId: string, params?: { grade_id?: string; student_id?: string; date?: string; session?: string; start_date?: string; end_date?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.grade_id) searchParams.append('grade_id', params.grade_id);
      if (params?.student_id) searchParams.append('student_id', params.student_id);
      if (params?.date) searchParams.append('date', params.date);
      if (params?.session) searchParams.append('session', params.session);
      if (params?.start_date) searchParams.append('start_date', params.start_date);
      if (params?.end_date) searchParams.append('end_date', params.end_date);

      const url = `${API_BASE}/attendance${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      const response = await fetch(url, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    },

    async create(userId: string, data: any) {
      const response = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create attendance');
      return response.json();
    },

    async bulkCreate(userId: string, records: any[]) {
      const response = await fetch(`${API_BASE}/attendance/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ records }),
      });
      if (!response.ok) throw new Error('Failed to bulk create attendance');
      return response.json();
    },

    async update(userId: string, attendanceId: string, data: any) {
      const response = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update attendance');
      return response.json();
    },

    async delete(userId: string, attendanceId: string) {
      const response = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to delete attendance');
      return response.json();
    },

    async getSchoolDays(userId: string, gradeId: string, startDate: string, endDate: string): Promise<number> {
      const params = new URLSearchParams({ grade_id: gradeId, start_date: startDate, end_date: endDate });
      const response = await fetch(`${API_BASE}/attendance/school-days?${params}`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch school days');
      const json = await response.json();
      return json.school_days as number;
    },

    async getMonthlySummary(userId: string, gradeId: string, year: number) {
      const response = await fetch(`${API_BASE}/attendance/monthly-summary?grade_id=${gradeId}&year=${year}`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch monthly summary');
      return response.json();
    },
  },

  users: {
    async changePassword(userId: string, data: { userId: string; newPassword: string }) {
      const response = await fetch(`${API_BASE}/users/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to change password: ${error}`);
      }
      return response.json();
    },
  },

  admins: {
    async getAll(userId: string) {
      const response = await fetch(`${API_BASE}/admins`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch admins');
      return response.json();
    },
  },

  backupSettings: {
    async get(userId: string) {
      const response = await fetch(`${API_BASE}/backup-settings`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch backup settings');
      return response.json();
    },

    async save(userId: string, data: any) {
      const response = await fetch(`${API_BASE}/backup-settings`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save backup settings');
      return response.json();
    },
  },

  backupHistory: {
    async getAll(userId: string) {
      const response = await fetch(`${API_BASE}/backup-history`, {
        headers: getAuthHeaders(userId),
      });
      if (!response.ok) throw new Error('Failed to fetch backup history');
      return response.json();
    },

    async create(userId: string, data: any) {
      const response = await fetch(`${API_BASE}/backup-history`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create backup history');
      return response.json();
    },
  },
};
