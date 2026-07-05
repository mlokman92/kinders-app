import { Link, Navigate, useNavigate } from 'react-router-dom';

import { TeacherForm, type TeacherSubmitPayload } from '@/components/TeacherForm';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

export function TeacherNew() {
  const navigate = useNavigate();
  const { can, isOwner } = useAuth();

  // Staff management is capability-gated (RLS enforces server-side).
  if (!can('manage_staff')) return <Navigate to="/staff" replace />;

  const onSubmit = async (payload: TeacherSubmitPayload) => {
    const { data, error } = await supabase.rpc('add_teacher', {
      p_name: payload.name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_dob: payload.dob ?? (null as unknown as string),
      p_gender: payload.gender,
      p_photo_url: payload.photoPath,
      p_assignments: payload.assignments,
      p_is_teacher: payload.isTeacher,
      p_is_admin: payload.isAdmin ?? undefined,
      p_branch_ids: payload.branchIds.length ? payload.branchIds : undefined,
    });
    if (error) throw error;
    const newId = data as number;
    // Role assignments are owner-only and live outside add_teacher (staff_role_assignments join
    // table) — insert them after the teacher exists.
    if (isOwner && payload.staffRoleIds.length > 0) {
      const { error: roleError } = await supabase.from('staff_role_assignments').insert(
        payload.staffRoleIds.map((staff_role_id) => ({
          teacher_id: newId,
          staff_role_id,
        })),
      );
      if (roleError) throw roleError;
    }
    navigate(`/staff/${newId}`, { replace: true });
  };

  const backLink = (
    <Link to="/staff" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Staff
    </Link>
  );

  return (
    <div>
      <PageHeader title="Add staff" actions={backLink} />
      <TeacherForm
        submitLabel="Add staff"
        onSubmit={onSubmit}
        onCancel={() => navigate('/staff')}
      />
    </div>
  );
}
