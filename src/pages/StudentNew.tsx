import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { StudentForm, type StudentSubmitPayload } from '@/components/StudentForm';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

export function StudentNew() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [params] = useSearchParams();
  const classroomId = params.get('classroom');

  // Only directors can add students (add_student derives an owned center).
  if (role !== 'director') return <Navigate to="/students" replace />;

  const onSubmit = async (payload: StudentSubmitPayload) => {
    const { data, error } = await supabase.rpc('add_student', {
      p_name: payload.name,
      p_dob: payload.dob ?? (null as unknown as string),
      p_gender: payload.gender,
      p_photo_url: payload.photoPath,
      p_enrollments: payload.enrollments,
      p_guardians: payload.guardians,
    });
    if (error) throw error;
    navigate(`/students/${data}`, { replace: true });
  };

  const backLink = (
    <Link to="/students" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Students
    </Link>
  );

  return (
    <div>
      <PageHeader title="Add student" actions={backLink} />
      <StudentForm
        submitLabel="Add student"
        canEditEnrollments
        initialClassroomId={classroomId ? Number(classroomId) : null}
        onSubmit={onSubmit}
        onCancel={() => navigate('/students')}
      />
    </div>
  );
}
