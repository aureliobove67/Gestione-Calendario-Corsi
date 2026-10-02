import { Routes, Route, Navigate } from 'react-router-dom';
import PublicCalendar from './pages/PublicCalendar';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import AdminCalendarPage from './pages/AdminCalendarPage';
import CourseEditor from './components/admin/CourseEditor';
import TeacherEditor from './components/admin/TeacherEditor';
import PeriodManager from './components/admin/PeriodManager';
import UserManagement from './components/admin/UserManagement';
import AuditLogViewer from './components/admin/AuditLogViewer';
import ChangePassword from './components/auth/ChangePassword';

export default function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/" element={<PublicCalendar />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Admin Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<AdminCalendarPage />} />
        <Route path="courses" element={<CourseEditor />} />
        <Route path="teachers" element={<TeacherEditor />} />
        <Route path="periods" element={<PeriodManager />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="audit" element={<AuditLogViewer />} />
        <Route path="change-password" element={<ChangePassword />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
