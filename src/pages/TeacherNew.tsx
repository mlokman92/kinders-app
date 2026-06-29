import { Link, Navigate, useNavigate } from 'react-router-dom';

import { TeacherForm, type TeacherSubmitPayload } from '@/components/TeacherForm';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

export function TeacherNew() {
  const navigate = useNavigate();
  const { role } = useAuth();

  // Teacher management is director-only (RLS allows only owners to write `teachers`).
  if (role !== 'director') return <Navigate to="/teachers" replace />;

  const onSubmit = async (payload: TeacherSubmitPayload) => {
    const { data, error } = await supabase.rpc('add_teacher', {
      p_name: payload.name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_dob: payload.dob ?? (null as unknown as string),
      p_gender: payload.gender,
      p_photo_url: payload.photoPath,
      p_assignments: payload.assignments,
    });
    if (error) throw error;
    navigate(`/teachers/${data}`, { replace: true });
  };

  const backLink = (
    <Link to="/teachers" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Teachers
    </Link>
  );

  return (
    <div>
      <PageHeader title="Add teacher" actions={backLink} />
      <TeacherForm
        submitLabel="Add teacher"
        onSubmit={onSubmit}
        onCancel={() => navigate('/teachers')}
      />
    </div>
  );
}
