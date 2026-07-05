import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import {
  StudentForm,
  type FormContact,
  type FormEnrollment,
  type Gender,
  type StudentFormInitial,
  type StudentSubmitPayload,
} from '@/components/StudentForm';
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { toISODate } from '@/lib/dates';
import { getStudentPhotoUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

function toGender(value: string | null): Gender | '' {
  return value === 'male' || value === 'female' || value === 'other' ? value : '';
}

export function StudentEdit() {
  const { id } = useParams();
  const sid = Number(id);
  const navigate = useNavigate();
  const { can } = useAuth();

  const [initial, setInitial] = useState<StudentFormInitial | null>(null);
  const [linkedEmails, setLinkedEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [studentRes, enrollRes, guardianRes, linkedRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, name, dob, gender, nric, profile_picture_url')
            .eq('id', sid)
            .maybeSingle(),
          supabase
            .from('enrollments')
            .select('classroom_id, status, enrollment_date, days')
            .eq('student_id', sid)
            .order('id'),
          supabase
            .from('guardians')
            .select('name, email, phone, relationship')
            .eq('student_id', sid)
            .order('id'),
          supabase.rpc('my_linked_guardian_emails'),
        ]);
        if (!active) return;
        if (studentRes.error) throw studentRes.error;
        if (enrollRes.error) throw enrollRes.error;
        if (guardianRes.error) throw guardianRes.error;

        const student = studentRes.data as {
          name: string;
          dob: string | null;
          gender: string | null;
          nric: string | null;
          profile_picture_url: string | null;
        } | null;
        if (!student) {
          setInitial(null);
          return;
        }

        const photoPath = student.profile_picture_url;
        const photoUrl = photoPath ? await getStudentPhotoUrl(photoPath) : null;
        if (!active) return;

        const enrollments: FormEnrollment[] = (enrollRes.data ?? []).map((e) => ({
          classroomId: (e as { classroom_id: number | null }).classroom_id,
          status:
            (e as { status: string | null }).status === 'upcoming' ? 'upcoming' : 'active',
          date: (e as { enrollment_date: string | null }).enrollment_date || toISODate(new Date()),
          days: ((e as { days: string[] | null }).days ?? []) as string[],
        }));

        const contacts: FormContact[] = (guardianRes.data ?? []).map((g) => {
          const rel = (g as { relationship: string | null }).relationship;
          return {
            name: (g as { name: string | null }).name ?? '',
            email: (g as { email: string | null }).email ?? '',
            phone: (g as { phone: string | null }).phone ?? '',
            relationship: rel === 'parent' || rel === 'guardian' ? rel : '',
          };
        });

        setInitial({
          name: student.name,
          dob: student.dob ?? '',
          gender: toGender(student.gender),
          nric: student.nric ?? '',
          photoPath,
          photoUrl,
          enrollments,
          contacts,
        });
        setLinkedEmails(
          new Set(((linkedRes.data as string[] | null) ?? []).map((e) => e.toLowerCase())),
        );
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load student.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sid]);

  const onSubmit = async (payload: StudentSubmitPayload) => {
    const { error: rpcError } = await supabase.rpc('update_student', {
      p_id: sid,
      p_name: payload.name,
      p_dob: payload.dob ?? (null as unknown as string),
      p_gender: payload.gender,
      p_nric: payload.nric ?? '',
      p_photo_url: payload.photoPath,
      p_enrollments: payload.enrollments,
      p_guardians: payload.guardians,
    });
    if (rpcError) throw rpcError;
    navigate(`/students/${sid}`, { replace: true });
  };

  const backLink = (
    <Link
      to={`/students/${sid}`}
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Cancel
    </Link>
  );

  // 'Edit student profiles' is the capability that gates this page; enrollments and contacts
  // have their own gated surfaces. Without it update_student would silently drop profile edits.
  if (!can('edit_students')) return <Navigate to={`/students/${sid}`} replace />;

  return (
    <div>
      <PageHeader title="Edit student" actions={backLink} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : !initial ? (
        <EmptyState title="Student not found" icon="🔍" />
      ) : (
        <StudentForm
          submitLabel="Save changes"
          initial={initial}
          canEditEnrollments={can('manage_enrollments')}
          canManageGuardians={can('manage_guardians')}
          linkedEmails={linkedEmails}
          onSubmit={onSubmit}
          onCancel={() => navigate(`/students/${sid}`)}
        />
      )}
    </div>
  );
}
