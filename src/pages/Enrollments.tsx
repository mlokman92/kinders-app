import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Application = {
  id: number;
  status: string;
  child_name: string;
  child_dob: string | null;
  child_gender: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  note: string | null;
  student_id: number | null;
  created_at: string;
};

type StatusTab = 'pending' | 'approved' | 'rejected';

const STATUS_TONE: Record<string, 'warning' | 'success' | 'error' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export function Enrollments() {
  const { role } = useAuth();

  const [rows, setRows] = useState<Application[]>([]);
  const [classrooms, setClassrooms] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>('pending');

  const [approveFor, setApproveFor] = useState<Application | null>(null);
  const [approveClassroom, setApproveClassroom] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, clsRes] = await Promise.all([
        supabase
          .from('enrollment_applications')
          .select(
            'id, status, child_name, child_dob, child_gender, parent_name, parent_email, parent_phone, note, student_id, created_at',
          )
          .order('created_at', { ascending: false }),
        supabase.from('classrooms').select('id, name').order('name'),
      ]);
      if (appsRes.error) throw appsRes.error;
      if (clsRes.error) throw clsRes.error;
      setRows((appsRes.data ?? []) as unknown as Application[]);
      setClassrooms((clsRes.data ?? []) as { id: number; name: string }[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) if (r.status in c) c[r.status as StatusTab] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  const doApprove = async () => {
    if (!approveFor) return;
    setBusyId(approveFor.id);
    setActionError(null);
    try {
      const cid = approveClassroom ? Number(approveClassroom) : null;
      const { error: rpcErr } = await supabase.rpc(
        'approve_enrollment_application',
        cid ? { p_id: approveFor.id, p_classroom_id: cid } : { p_id: approveFor.id },
      );
      if (rpcErr) throw rpcErr;
      setApproveFor(null);
      setApproveClassroom('');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not approve.');
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async (id: number) => {
    setBusyId(id);
    setActionError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('reject_enrollment_application', { p_id: id });
      if (rpcErr) throw rpcErr;
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not reject.');
    } finally {
      setBusyId(null);
    }
  };

  if (role && role !== 'director') return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader title="Enrollments" subtitle="Applications from your enrollment page." />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          {actionError ? (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={actionError} />
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {(['pending', 'approved', 'rejected'] as StatusTab[]).map((s) => (
              <Chip
                key={s}
                label={`${s[0].toUpperCase()}${s.slice(1)} (${counts[s]})`}
                selected={tab === s}
                onClick={() => setTab(s)}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title={`No ${tab} applications`}
              message={tab === 'pending' ? 'New applications will appear here for review.' : undefined}
              icon="📥"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visible.map((a) => (
                <Card key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>
                          {a.child_name}
                        </span>
                        <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.status}</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: Brand.onSurfaceVariant, marginTop: 3 }}>
                        {[a.child_dob, a.child_gender].filter(Boolean).join(' · ') || 'No child details'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ fontSize: 13.5, color: Brand.onSurface }}>
                    <span style={{ fontWeight: 700 }}>{a.parent_name || 'Parent'}</span>
                    <span style={{ color: Brand.onSurfaceVariant }}>
                      {' '}
                      · {[a.parent_email, a.parent_phone].filter(Boolean).join(' · ') || 'No contact details'}
                    </span>
                  </div>

                  {a.note ? (
                    <div
                      style={{
                        fontSize: 13.5,
                        color: Brand.onSurfaceVariant,
                        background: Brand.surfaceContainerLow,
                        borderRadius: 8,
                        padding: '8px 12px',
                      }}
                    >
                      {a.note}
                    </div>
                  ) : null}

                  {a.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outline"
                        onClick={() => doReject(a.id)}
                        disabled={busyId === a.id}
                        style={{ color: Brand.error, borderColor: Brand.error }}
                      >
                        {busyId === a.id ? <Spinner size={16} /> : 'Reject'}
                      </Button>
                      <Button
                        onClick={() => {
                          setApproveFor(a);
                          setApproveClassroom('');
                          setActionError(null);
                        }}
                        disabled={busyId === a.id}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : a.status === 'approved' && a.student_id ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link
                        to={`/students/${a.student_id}`}
                        style={{ fontSize: 13.5, fontWeight: 700, color: Brand.onPrimaryContainer }}
                      >
                        View student →
                      </Link>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {approveFor ? (
        <Modal title={`Approve ${approveFor.child_name}`} onClose={() => setApproveFor(null)}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 14 }}>
            This creates a student record{approveFor.parent_email || approveFor.parent_name ? ' and a parent contact' : ''}. You can place them in a class now or later.
          </p>
          <Field label="Classroom (optional)">
            <Select
              value={approveClassroom}
              onChange={setApproveClassroom}
              options={[
                { label: 'No class yet', value: '' },
                ...classrooms.map((c) => ({ label: c.name, value: String(c.id) })),
              ]}
            />
          </Field>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setApproveFor(null)} disabled={busyId != null}>
              Cancel
            </Button>
            <Button onClick={doApprove} disabled={busyId != null}>
              {busyId != null ? <Spinner size={16} /> : 'Approve & create student'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
