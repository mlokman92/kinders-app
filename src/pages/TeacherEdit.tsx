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
  const { can, isOwner } = useAuth();

  const [initial, setInitial] = useState<TeacherFormInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [teacherRes, assignRes, branchRes, roleRes] = await Promise.all([
          supabase
            .from('teachers')
            .select(
              'id, name, email, phone, dob, gender, profile_picture_url, is_teacher, is_admin',
            )
            .eq('id', tid)
            .maybeSingle(),
          supabase
            .from('teacher_assignments')
            .select('classroom_id, status, days')
            .eq('teacher_id', tid)
            .order('id'),
          supabase.from('staff_branches').select('branch_id').eq('teacher_id', tid),
          supabase.from('staff_role_assignments').select('staff_role_id').eq('teacher_id', tid),
        ]);
        if (!active) return;
        if (teacherRes.error) throw teacherRes.error;
        if (assignRes.error) throw assignRes.error;
        if (branchRes.error) throw branchRes.error;
        if (roleRes.error) throw roleRes.error;

        const teacher = teacherRes.data as {
          name: string;
          email: string | null;
          phone: string | null;
          dob: string | null;
          gender: string | null;
          profile_picture_url: string | null;
          is_teacher: boolean;
          is_admin: boolean;
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
          isTeacher: teacher.is_teacher,
          isAdmin: teacher.is_admin,
          branchIds: (branchRes.data ?? []).map((b) => b.branch_id),
          staffRoleIds: (roleRes.data ?? []).map((r) => r.staff_role_id),
        });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load staff member.');
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
      p_is_teacher: payload.isTeacher,
      // Owner-only; omitting leaves admin duty unchanged.
      p_is_admin: payload.isAdmin ?? undefined,
      p_branch_ids: payload.branchIds.length ? payload.branchIds : undefined,
    });
    if (rpcError) throw rpcError;
    // Role assignments are owner-only and live outside the RPC (staff_role_assignments join
    // table) — reconcile only the diff so we don't needlessly churn rows.
    if (isOwner) {
      const before = new Set(initial?.staffRoleIds ?? []);
      const after = new Set(payload.staffRoleIds);
      const toAdd = payload.staffRoleIds.filter((rid) => !before.has(rid));
      const toRemove = [...before].filter((rid) => !after.has(rid));

      if (toRemove.length > 0) {
        const { error: delError } = await supabase
          .from('staff_role_assignments')
          .delete()
          .eq('teacher_id', tid)
          .in('staff_role_id', toRemove);
        if (delError) throw delError;
      }
      if (toAdd.length > 0) {
        const { error: insError } = await supabase.from('staff_role_assignments').insert(
          toAdd.map((staff_role_id) => ({ teacher_id: tid, staff_role_id })),
        );
        if (insError) throw insError;
      }
    }
    navigate(`/staff/${tid}`, { replace: true });
  };

  // Staff management is capability-gated (RLS enforces server-side).
  if (!can('manage_staff')) return <Navigate to="/staff" replace />;

  const backLink = (
    <Link
      to={`/staff/${tid}`}
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Cancel
    </Link>
  );

  return (
    <div>
      <PageHeader title="Edit staff" actions={backLink} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : !initial ? (
        <EmptyState title="Staff member not found" icon="🔍" />
      ) : (
        <TeacherForm
          submitLabel="Save changes"
          initial={initial}
          onSubmit={onSubmit}
          onCancel={() => navigate(`/staff/${tid}`)}
        />
      )}
    </div>
  );
}
