import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from '@/components/Layout';
import { RequireStaff } from '@/components/RequireStaff';
import { Activities } from '@/pages/Activities';
import { ActivityDetail } from '@/pages/ActivityDetail';
import { Classrooms } from '@/pages/Classrooms';
import { ClassroomDetail } from '@/pages/ClassroomDetail';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/Login';
import { Plans } from '@/pages/Plans';
import { Reports } from '@/pages/Reports';
import { StudentDetail } from '@/pages/StudentDetail';
import { Students } from '@/pages/Students';
import { TeacherDetail } from '@/pages/TeacherDetail';
import { Teachers } from '@/pages/Teachers';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequireStaff>
            <Layout />
          </RequireStaff>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="classrooms" element={<Classrooms />} />
        <Route path="classrooms/:id" element={<ClassroomDetail />} />
        <Route path="activities" element={<Activities />} />
        <Route path="activities/:id" element={<ActivityDetail />} />
        <Route path="plans" element={<Plans />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
