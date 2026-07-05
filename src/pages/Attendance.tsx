import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  Badge,
  Button,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Toolbar,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type AttendanceRow = {
  id: number;
  staff_name: string | null;
  branch_id: number;
  branch_name: string;
  kind: string;
  recorded_at: string;
  local_time: string;
  within_geofence: boolean | null;
  low_accuracy: boolean;
  accepted_with_tolerance: boolean;
  mocked: boolean;
  location_unavailable: boolean;
  needs_review: boolean;
  review_status: string;
};

/** Local YYYY-MM-DD (en-CA renders ISO date), offset by whole days. */
const dayStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
};

/** Branch-local timestamp string -> "YYYY-MM-DD HH:MM" without any tz reinterpretation. */
const fmtLocal = (s: string) => s.slice(0, 16).replace('T', ' ');

export function Attendance() {
  const { can } = useAuth();
  const { branches, loading: branchesLoading } = useBranch();

  const [branchId, setBranchId] = useState<number | null>(null);
  const [from, setFrom] = useState(dayStr(-6));
  const [to, setTo] = useState(dayStr(0));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Default to the first branch once branches resolve.
  useEffect(() => {
    if (branchId == null && branches.length > 0) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const load = useCallback(async () => {
    if (branchId == null) return;
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('list_branch_attendance', {
      p_branch_id: branchId,
      p_from: from,
      p_to: to,
    });
    if (rpcError) setError(rpcError.message);
    setRows((data ?? []) as AttendanceRow[]);
    setLoading(false);
  }, [branchId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: number, status: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      const { error: rpcError } = await supabase.rpc('set_attendance_review', {
        p_id: id,
        p_status: status,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update review.');
    } finally {
      setBusyId(null);
    }
  };

  const branchOptions = useMemo(
    () => branches.map((b) => ({ label: b.name, value: String(b.id) })),
    [branches],
  );

  if (!can('view_attendance')) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Staff check-ins by branch." />

      <Toolbar>
        <Field label="Branch">
          <Select
            value={branchId != null ? String(branchId) : ''}
            onChange={(v) => setBranchId(Number(v))}
            options={branchOptions.length ? branchOptions : [{ label: '—', value: '' }]}
          />
        </Field>
        <Field label="From">
          <DateInput value={from} onChange={setFrom} />
        </Field>
        <Field label="To">
          <DateInput value={to} onChange={setTo} />
        </Field>
        <Button variant="secondary" onClick={load} disabled={loading || branchId == null}>
          Refresh
        </Button>
      </Toolbar>

      {error ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} />
        </div>
      ) : null}

      {branchesLoading || loading ? (
        <Loading />
      ) : branches.length === 0 ? (
        <EmptyState title="No branches" message="Add a branch and set its location first." icon="📍" />
      ) : rows.length === 0 ? (
        <EmptyState title="No check-ins" message="Nothing recorded for this range." icon="🕒" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Staff</Th>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Location</Th>
              <Th>Flags</Th>
              <Th align="right">Review</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td style={{ fontWeight: 600 }}>{r.staff_name ?? '—'}</Td>
                <Td style={{ whiteSpace: 'nowrap', color: Brand.onSurfaceVariant }}>
                  {fmtLocal(r.local_time)}
                </Td>
                <Td>
                  <Badge tone={r.kind === 'check_in' ? 'success' : 'neutral'}>
                    {r.kind === 'check_in' ? 'Check in' : 'Check out'}
                  </Badge>
                </Td>
                <Td>
                  {r.location_unavailable ? (
                    <Badge tone="warning">No location</Badge>
                  ) : r.within_geofence ? (
                    <Badge tone="success">On site</Badge>
                  ) : (
                    <Badge tone="error">Off site</Badge>
                  )}
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.low_accuracy ? <Badge tone="warning">Low accuracy</Badge> : null}
                    {r.accepted_with_tolerance ? <Badge tone="warning">Edge</Badge> : null}
                    {r.mocked ? <Badge tone="error">Mock GPS</Badge> : null}
                    {!r.low_accuracy && !r.accepted_with_tolerance && !r.mocked && !r.location_unavailable ? (
                      <span style={{ color: Brand.onSurfaceVariant }}>—</span>
                    ) : null}
                  </div>
                </Td>
                <Td align="right">
                  {r.review_status === 'pending' ? (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <Button
                        variant="secondary"
                        onClick={() => review(r.id, 'approved')}
                        disabled={busyId === r.id}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => review(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        style={{ color: Brand.error, borderColor: Brand.error }}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : r.review_status === 'approved' ? (
                    <Badge tone="success">Approved</Badge>
                  ) : r.review_status === 'rejected' ? (
                    <Badge tone="error">Rejected</Badge>
                  ) : (
                    <span style={{ color: Brand.onSurfaceVariant }}>—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
