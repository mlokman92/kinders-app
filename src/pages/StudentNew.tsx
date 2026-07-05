import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { StudentForm, type StudentSubmitPayload } from '@/components/StudentForm';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

export function StudentNew() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params] = useSearchParams();
  const classroomId = params.get('classroom');

  // Adding students needs the manage_students capability (RLS enforces the same).
  if (!can('manage_students')) return <Navigate to="/students" replace />;

  const onSubmit = async (payload: StudentSubmitPayload) => {
    const { data, error } = await supabase.rpc('add_student', {
      p_name: payload.name,
      p_dob: payload.dob ?? (null as unknown as string),
      p_gender: payload.gender,
      p_nric: payload.nric ?? '',
      p_photo_url: payload.photoPath,
      p_branch_id: payload.branchId ?? undefined,
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
        allowBranchSelect
        initialClassroomId={classroomId ? Number(classroomId) : null}
        onSubmit={onSubmit}
        onCancel={() => navigate('/students')}
      />
    </div>
  );
}
