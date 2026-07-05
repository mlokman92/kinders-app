import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from '@/components/Layout';
import { RequireStaff } from '@/components/RequireStaff';
import { BranchProvider } from '@/lib/branch';
import { AccessKeys } from '@/pages/AccessKeys';
import { Activities } from '@/pages/Activities';
import { Announcements } from '@/pages/Announcements';
import { ActivityDetail } from '@/pages/ActivityDetail';
import { ActivityEdit } from '@/pages/ActivityEdit';
import { ActivityNew } from '@/pages/ActivityNew';
import { AssessmentDetail } from '@/pages/AssessmentDetail';
import { Assessments } from '@/pages/Assessments';
import { Attendance } from '@/pages/Attendance';
import { Branches } from '@/pages/Branches';
import { Classrooms } from '@/pages/Classrooms';
import { Levels } from '@/pages/Levels';
import { StaffRoles } from '@/pages/StaffRoles';
import { ClassroomDetail } from '@/pages/ClassroomDetail';
import { Contacts } from '@/pages/Contacts';
import { Dashboard } from '@/pages/Dashboard';
import { EnrollPublic } from '@/pages/EnrollPublic';
import { Enrollments } from '@/pages/Enrollments';
import { Login } from '@/pages/Login';
import { Plans } from '@/pages/Plans';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { StudentDetail } from '@/pages/StudentDetail';
import { StudentEdit } from '@/pages/StudentEdit';
import { StudentImport } from '@/pages/StudentImport';
import { StudentNew } from '@/pages/StudentNew';
import { Students } from '@/pages/Students';
import { TeacherDetail } from '@/pages/TeacherDetail';
import { TeacherEdit } from '@/pages/TeacherEdit';
import { TeacherImport } from '@/pages/TeacherImport';
import { TeacherNew } from '@/pages/TeacherNew';
import { Teachers } from '@/pages/Teachers';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/enroll/:slug" element={<EnrollPublic />} />

      <Route
        element={
          <RequireStaff>
            <BranchProvider>
              <Layout />
            </BranchProvider>
          </RequireStaff>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="students" element={<Students />} />
        <Route path="students/import" element={<StudentImport />} />
        <Route path="students/new" element={<StudentNew />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="students/:id/edit" element={<StudentEdit />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="classrooms" element={<Classrooms />} />
        <Route path="classrooms/:id" element={<ClassroomDetail />} />
        <Route path="activities" element={<Activities />} />
        <Route path="activities/new" element={<ActivityNew />} />
        <Route path="activities/:id" element={<ActivityDetail />} />
        <Route path="activities/:id/edit" element={<ActivityEdit />} />
        <Route path="plans" element={<Plans />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="assessments/:id" element={<AssessmentDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="staff" element={<Teachers />} />
        <Route path="staff/import" element={<TeacherImport />} />
        <Route path="staff/new" element={<TeacherNew />} />
        <Route path="staff/:id" element={<TeacherDetail />} />
        <Route path="staff/:id/edit" element={<TeacherEdit />} />
        <Route path="enrollments" element={<Enrollments />} />
        <Route path="branches" element={<Branches />} />
        <Route path="levels" element={<Levels />} />
        <Route path="roles" element={<StaffRoles />} />
        <Route path="access" element={<AccessKeys />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
