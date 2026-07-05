import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { getStudentPhotoUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Teacher = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  profile_picture_url: string | null;
  is_teacher: boolean;
  is_admin: boolean;
  created_at: string;
};

type Assignment = {
  id: number;
  status: string | null;
  days: string[] | null;
  classrooms: { id: number; name: string } | null;
};

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TeacherDetail() {
  const { id } = useParams();
  const tid = Number(id);
  const navigate = useNavigate();
  const { can, isOwner } = useAuth();
  const { branches } = useBranch();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [branchIds, setBranchIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = can('manage_staff');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [teacherRes, assignmentsRes, branchRes] = await Promise.all([
          supabase
            .from('teachers')
            .select(
              'id, name, email, phone, dob, gender, profile_picture_url, is_teacher, is_admin, created_at',
            )
            .eq('id', tid)
            .maybeSingle(),
          supabase
            .from('teacher_assignments')
            .select('id, status, days, classrooms(id, name)')
            .eq('teacher_id', tid)
            .order('id'),
          supabase.from('staff_branches').select('branch_id').eq('teacher_id', tid),
        ]);
        if (!active) return;
        if (teacherRes.error) throw teacherRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (branchRes.error) throw branchRes.error;
        const loaded = (teacherRes.data ?? null) as unknown as Teacher | null;
        setTeacher(loaded);
        setAssignments((assignmentsRes.data ?? []) as unknown as Assignment[]);
        setBranchIds((branchRes.data ?? []).map((b) => b.branch_id));
        if (loaded?.profile_picture_url) {
          const url = await getStudentPhotoUrl(loaded.profile_picture_url);
          if (active) setPhotoUrl(url);
        }
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

  const deleteTeacher = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      const { data, error: delError } = await supabase
        .from('teachers')
        .delete()
        .eq('id', tid)
        .select('id');
      if (delError) throw delError;
      if (!data || data.length === 0) {
        throw new Error('You do not have permission to delete this staff member.');
      }
      navigate('/staff', { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete staff member.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const backLink = (
    <Link to="/staff" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Staff
    </Link>
  );

  if (loading) {
    return (
      <div>
        <PageHeader title="Staff" actions={backLink} />
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Staff" actions={backLink} />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div>
        <PageHeader title="Staff" actions={backLink} />
        <EmptyState title="Staff member not found" icon="🔍" />
      </div>
    );
  }

  // Deleting an admin row is owner-only (DB-enforced); hide the button otherwise.
  const canDelete = canManage && (isOwner || !teacher.is_admin);
  const branchNames =
    branches.length > 1
      ? branches.filter((b) => branchIds.includes(b.id)).map((b) => b.name)
      : [];

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {backLink}
      {canManage ? (
        <Button variant="secondary" onClick={() => navigate(`/staff/${tid}/edit`)}>
          Edit
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          style={{ color: Brand.error, borderColor: Brand.error }}
        >
          Delete
        </Button>
      ) : null}
    </div>
  );

  return (
    <div>
      <PageHeader title={teacher.name} actions={headerActions} />

      {actionError ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={actionError} />
        </div>
      ) : null}

      <Card style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Avatar name={teacher.name} size={56} src={photoUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: Brand.onSurface }}>{teacher.name}</div>
          <div style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, marginTop: 3 }}>
            {[teacher.email, teacher.phone].filter(Boolean).join(' · ') || 'No contact details'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {teacher.is_teacher ? <Badge tone="primary">Teacher</Badge> : null}
            {teacher.is_admin ? <Badge tone="warning">Admin</Badge> : null}
            {branchNames.map((n) => (
              <Badge key={n} tone="neutral">
                {n}
              </Badge>
            ))}
            {teacher.gender ? <Badge tone="neutral">{capitalize(teacher.gender)}</Badge> : null}
            {teacher.dob ? (
              <Badge tone="neutral">{formatDisplayDate(parseISODate(teacher.dob))}</Badge>
            ) : null}
          </div>
        </div>
      </Card>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Assigned classrooms
      </h2>

      {assignments.length === 0 ? (
        <Card>
          <span style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>No classrooms assigned</span>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {assignments.map((a) => {
            const days = (a.days ?? []).map((d) => DAY_LABELS[d] ?? d).join(' · ');
            const active = a.status !== 'inactive';
            return (
              <Card key={a.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  {a.classrooms ? (
                    <Link to={`/classrooms/${a.classrooms.id}`} style={{ textDecoration: 'none' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: Brand.onSurface }}>
                        {a.classrooms.name}
                      </span>
                    </Link>
                  ) : (
                    <span style={{ fontSize: 15, fontWeight: 700, color: Brand.onSurfaceVariant }}>
                      —
                    </span>
                  )}
                  <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, marginTop: 6 }}>
                  {days || 'No schedule set'}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {confirmOpen ? (
        <Modal title="Delete staff?" onClose={() => (deleting ? null : setConfirmOpen(false))}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            This permanently removes <strong>{teacher.name}</strong> and their classroom assignments.
            They will lose staff access on their next sign-in. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={deleteTeacher}
              disabled={deleting}
              style={{ background: Brand.error, color: Brand.onError }}
            >
              {deleting ? <Spinner size={16} /> : 'Delete'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
