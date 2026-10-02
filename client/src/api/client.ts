// Use relative path - works both when served from Express (production) and via Vite proxy (dev)
const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data?: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
    this.data = data;
  }
}

async function apiCall<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Errore di rete' }));
    throw new ApiError(body.error || body.message || 'Errore del server', res.status, body);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// ---- Public API ----
export const publicApi = {
  getPeriods: () =>
    apiCall<Period[]>('/public/periods'),

  getCalendarWeek: (periodId: number, week: string) =>
    apiCall<Lesson[]>(`/public/calendar?period_id=${periodId}&week=${week}`),

  getCalendarMonth: (periodId: number, month: string) =>
    apiCall<Lesson[]>(`/public/calendar/month?period_id=${periodId}&month=${month}`),

  getCourses: (periodId?: number) =>
    apiCall<Course[]>(`/public/courses${periodId ? `?period_id=${periodId}` : ''}`),

  getTeachers: (periodId: number) =>
    apiCall<Teacher[]>(`/public/teachers?period_id=${periodId}`),

  getCourseDetail: (courseId: number) =>
    apiCall<CourseDetail>(`/public/detail/course/${courseId}`),

  getTeacherDetail: (teacherId: number, periodId?: number) =>
    apiCall<TeacherDetail>(`/public/detail/teacher/${teacherId}${periodId ? `?period_id=${periodId}` : ''}`),

  getProgress: (periodId: number) =>
    apiCall<PeriodProgress>(`/public/progress?period_id=${periodId}`),
};

// ---- Auth API ----
export const authApi = {
  login: (username: string, password: string) =>
    apiCall<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    apiCall('/auth/logout', { method: 'POST' }),

  me: () =>
    apiCall<{ user: User }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// ---- Admin API ----
export const adminApi = {
  // Users
  getUsers: () => apiCall<AdminUser[]>('/admin/users'),
  createUser: (data: { username: string; password: string; display_name: string }) =>
    apiCall<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    apiCall(`/admin/users/${id}`, { method: 'DELETE' }),

  // Periods
  getPeriods: () => apiCall<Period[]>('/admin/periods'),
  createPeriod: (data: Partial<Period>) =>
    apiCall<Period>('/admin/periods', { method: 'POST', body: JSON.stringify(data) }),
  updatePeriod: (id: number, data: Partial<Period>) =>
    apiCall<Period>(`/admin/periods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePeriod: (id: number) =>
    apiCall(`/admin/periods/${id}`, { method: 'DELETE' }),

  // Courses
  getCourses: (periodId?: number) =>
    apiCall<Course[]>(`/admin/courses${periodId ? `?period_id=${periodId}` : ''}`),
  createCourse: (data: Partial<Course>) =>
    apiCall<Course>('/admin/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id: number, data: Partial<Course>) =>
    apiCall<Course>(`/admin/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourse: (id: number) =>
    apiCall(`/admin/courses/${id}`, { method: 'DELETE' }),

  // Units
  getUnits: (courseId?: number) =>
    apiCall<Unit[]>(`/admin/units${courseId ? `?course_id=${courseId}` : ''}`),
  createUnit: (data: Partial<Unit>) =>
    apiCall<Unit>('/admin/units', { method: 'POST', body: JSON.stringify(data) }),
  updateUnit: (id: number, data: Partial<Unit>) =>
    apiCall<Unit>(`/admin/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnit: (id: number) =>
    apiCall(`/admin/units/${id}`, { method: 'DELETE' }),

  // Teachers
  getTeachers: (periodId?: number) => apiCall<Teacher[]>(`/admin/teachers${periodId ? `?period_id=${periodId}` : ''}`),
  createTeacher: (data: Partial<Teacher>) =>
    apiCall<Teacher>('/admin/teachers', { method: 'POST', body: JSON.stringify(data) }),
  updateTeacher: (id: number, data: Partial<Teacher>) =>
    apiCall<Teacher>(`/admin/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeacher: (id: number) =>
    apiCall(`/admin/teachers/${id}`, { method: 'DELETE' }),

  // Assignments
  getAssignments: (unitId?: number) =>
    apiCall<Assignment[]>(`/admin/assignments${unitId ? `?unit_id=${unitId}` : ''}`),
  createAssignment: (data: Partial<Assignment>) =>
    apiCall<Assignment>('/admin/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id: number, data: Partial<Assignment>) =>
    apiCall<Assignment>(`/admin/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssignment: (id: number) =>
    apiCall(`/admin/assignments/${id}`, { method: 'DELETE' }),
  getAssignmentHoursStatus: (id: number) =>
    apiCall<HoursStatus>(`/admin/assignments/${id}/hours-status`),

  // Lessons
  getLessons: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall<Lesson[]>(`/admin/lessons${query}`);
  },
  getLesson: (id: number) =>
    apiCall<LessonDetail>(`/admin/lessons/${id}`),
  createLesson: (data: Partial<Lesson> & { override_reason?: string }) =>
    apiCall<LessonResponse>('/admin/lessons', { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: (id: number, data: Partial<Lesson> & { override_reason?: string }) =>
    apiCall<LessonResponse>(`/admin/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLesson: (id: number) =>
    apiCall(`/admin/lessons/${id}`, { method: 'DELETE' }),

  // Audit Log
  getAuditLog: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall<AuditEntry[]>(`/admin/audit-log${query}`);
  },

  // Anomalies
  getAnomalies: (periodId: number) =>
    apiCall<AnomaliesResponse>(`/admin/anomalies?period_id=${periodId}`),

  // Detail views
  getCourseDetail: (courseId: number) =>
    apiCall<CourseDetail>(`/admin/detail/course/${courseId}`),
  getTeacherDetail: (teacherId: number, periodId?: number) =>
    apiCall<TeacherDetail>(`/admin/detail/teacher/${teacherId}${periodId ? `?period_id=${periodId}` : ''}`),
};

// ---- Types ----
export interface User {
  id: number;
  username: string;
  display_name: string;
}

export interface AdminUser extends User {
  created_at?: string;
}

export interface Period {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface PeriodProgress {
  period_id: number;
  today: string;
  total_hours: number;
  scheduled_hours: number;
  remaining_hours: number;
  progress_percent: number;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  period_id: number;
  total_hours_aula?: number;
  total_hours_fad?: number;
  total_hours_webinar?: number;
  total_hours_stage?: number;
  total_hours_pw?: number;
  total_hours_extra?: number;
  used_hours_aula?: number;
  used_hours_webinar?: number;
  used_hours_fad?: number;
  used_hours_stage?: number;
  used_hours_pw?: number;
  used_hours_extra?: number;
  non_contract_deadline?: string | null;
  units?: Unit[];
}

export interface Unit {
  id: number;
  name: string;
  course_id: number;
  contracted_hours: number;
  used_hours?: number;
  remaining_hours?: number;
  teacher_name?: string;
  teacher_id?: number;
}

export interface Teacher {
  id: number;
  name: string;
  organization?: string;
  period_id?: number;
}

export interface Assignment {
  id: number;
  unit_id: number;
  teacher_id: number;
  hours: number;
  unit_name?: string;
  teacher_name?: string;
  course_name?: string;
  course_code?: string;
}

export interface Lesson {
  id: number;
  assignment_id?: number;
  course_id?: number;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  location_type: 'AULA' | 'WEBINAR' | 'FAD' | 'PW' | 'STAGE' | 'EXTRA';
  notes?: string;
  course_code?: string;
  course_name?: string;
  unit_name?: string;
  teacher_name?: string;
}

export interface LessonResponse {
  warning: boolean;
  message?: string;
  data: Lesson;
}

export interface LessonDetail extends Lesson {
  course_id: number;
  unit_id?: number;
  teacher_id?: number;
  assignment_total_hours?: number;
  total_hours_extra?: number;
}

export interface HoursStatus {
  totalHours: number;
  usedHours: number;
  remainingHours: number;
}

export interface AuditEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  user_id: number;
  user_username?: string;
  user_name?: string;
  old_values?: any;
  new_values?: any;
  timestamp: string;
  changes?: string;
  created_at: string;
}

export default apiCall;

// ---- Anomalies Types ----
export interface Anomaly {
  type: string;
  severity: 'critical' | 'warning';
  course_code: string;
  course_name: string;
  course_id: number;
  unit_name?: string;
  unit_id?: number;
  teacher_name?: string;
  teacher_id?: number;
  detail: string;
}

export interface AnomaliesResponse {
  period_id: number;
  total: number;
  critical: number;
  warnings: number;
  anomalies: Anomaly[];
}

// ---- Detail View Types ----
export interface CourseDetailLesson {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  location_type: string;
  notes?: string;
}

export interface CourseDetailTeacher {
  teacher_id: number;
  teacher_name: string;
  assignment_id: number;
  assigned_hours: number;
  scheduled_hours: number;
  remaining_hours: number;
  lessons: CourseDetailLesson[];
}

export interface CourseDetailUnit {
  unit_id: number;
  unit_name: string;
  contracted_hours: number;
  teachers: CourseDetailTeacher[];
}

export interface CourseDetail {
  course_id: number;
  course_code: string;
  course_name: string;
  total_hours_aula: number;
  total_hours_pw: number;
  total_contracted: number;
  total_scheduled: number;
  total_remaining: number;
  units: CourseDetailUnit[];
}

export interface TeacherDetailUnit {
  unit_id: number;
  unit_name: string;
  contracted_hours: number;
  assignment_id: number;
  assigned_hours: number;
  scheduled_hours: number;
  remaining_hours: number;
  lessons: CourseDetailLesson[];
}

export interface TeacherDetailCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  units: TeacherDetailUnit[];
}

export interface TeacherDetail {
  teacher_id: number;
  teacher_name: string;
  organization?: string;
  total_assigned_hours: number;
  total_scheduled_hours: number;
  total_remaining_hours: number;
  courses: TeacherDetailCourse[];
}
