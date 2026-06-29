import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import {
  TeacherForm,
  type FormAssignment,
  type Gender,
  type TeacherFormInitial,
  type TeacherSubmitPayload,
} from '@/components/TeacherForm';
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getStudentPhotoUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

function toGender(value: string | null): Gender | '' {
  return value === 'male' || value === 'female' || value === 'other' ? value : '';
}

export function TeacherEdit() {
  const { id } = useParams();
  const tid = Number(id);
  const navigate = useNavigate();
  const { role } = useAuth();

  const [initial, setInitial] = useState<TeacherFormInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [teacherRes, assignRes] = await Promise.all([
          supabase
            .from('teachers')
            .select('id, name, email, phone, dob, gender, profile_picture_url')
            .eq('id', tid)
            .maybeSingle(),
          supabase
            .from('teacher_assignments')
            .select('classroom_id, status, days')
            .eq('teacher_id', tid)
            .order('id'),
        ]);
        if (!active) return;
        if (teacherRes.error) throw teacherRes.error;
        if (assignRes.error) throw assignRes.error;

        const teacher = teacherRes.data as {
          name: string;
          email: string | null;
          phone: string | null;
          dob: string | null;
          gender: string | null;
          profile_picture_url: string | null;
        } | null;
        if (!teacher) {
          setInitial(null);
          return;
        }

        const photoPath = teacher.profile_picture_url;
        const photoUrl = photoPath ? await getStudentPhotoUrl(photoPath) : null;
        if (!active) return;

        const assignments: FormAssignment[] = (assignRes.data ?? []).map((a) => ({
          classroomId: (a as { classroom_id: number | null }).classroom_id,
          status: (a as { status: string | null }).status === 'inactive' ? 'inactive' : 'active',
          days: ((a as { days: string[] | null }).days ?? []) as string[],
        }));

        setInitial({
          name: teacher.name,
          email: teacher.email ?? '',
          phone: teacher.phone ?? '',
          dob: teacher.dob ?? '',
          gender: toGender(teacher.gender),
          photoPath,
          photoUrl,
          assignments,
        });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load teacher.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tid]);

  const onSubmit = async (payload: TeacherSubmitPayload) => {
    const { error: rpcError } = await supabase.rpc('update_teacher', {
      p_id: tid,
      p_name: payload.name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_dob: payload.dob ?? (null as unknown as string),
      p_gender: payload.gender,
      p_photo_url: payload.photoPath,
      p_assignments: payload.assignments,
    });
    if (rpcError) throw rpcError;
    navigate(`/teachers/${tid}`, { replace: true });
  };

  // Teacher management is director-only (RLS allows only owners to write `teachers`).
  if (role !== 'director') return <Navigate to="/teachers" replace />;

  const backLink = (
    <Link
      to={`/teachers/${tid}`}
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Cancel
    </Link>
  );

  return (
    <div>
      <PageHeader title="Edit teacher" actions={backLink} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : !initial ? (
        <EmptyState title="Teacher not found" icon="🔍" />
      ) : (
        <TeacherForm
          submitLabel="Save changes"
          initial={initial}
          onSubmit={onSubmit}
          onCancel={() => navigate(`/teachers/${tid}`)}
        />
      )}
    </div>
  );
}
