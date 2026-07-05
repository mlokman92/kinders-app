import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { BranchGeofenceModal, type BranchGeofence } from '@/components/BranchGeofenceModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Spinner,
  TextInput,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch, type Branch } from '@/lib/branch';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

/** Postgres blocks the delete while classrooms/students still reference the branch. */
const isFkViolation = (e: unknown) =>
  (e as { code?: string })?.code === '23503' ||
  (e instanceof Error && /foreign key/i.test(e.message));

export function Branches() {
  const { isOwner } = useAuth();
  const { branches, loading: branchesLoading, refresh } = useBranch();

  const [centerId, setCenterId] = useState<number | null>(null);
  const [classroomCounts, setClassroomCounts] = useState<Map<number, number>>(new Map());
  const [studentCounts, setStudentCounts] = useState<Map<number, number>>(new Map());
  const [geofences, setGeofences] = useState<Map<number, BranchGeofence>>(new Map());
  const [geofenceTarget, setGeofenceTarget] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const [classroomsRes, studentsRes, centerRes, geofencesRes] = await Promise.all([
      supabase.from('classrooms').select('branch_id'),
      supabase.from('students').select('branch_id'),
      supabase.from('centers').select('id').order('id').limit(1).maybeSingle(),
      supabase.from('branch_geofences').select('*'),
    ]);
    if (classroomsRes.error) throw classroomsRes.error;
    if (studentsRes.error) throw studentsRes.error;
    if (centerRes.error) throw centerRes.error;
    if (geofencesRes.error) throw geofencesRes.error;

    const tally = (rows: { branch_id: number | null }[]) => {
      const map = new Map<number, number>();
      for (const r of rows) {
        if (r.branch_id != null) map.set(r.branch_id, (map.get(r.branch_id) ?? 0) + 1);
      }
      return map;
    };
    setClassroomCounts(tally((classroomsRes.data ?? []) as { branch_id: number | null }[]));
    setStudentCounts(tally((studentsRes.data ?? []) as { branch_id: number | null }[]));
    setCenterId((centerRes.data as { id: number } | null)?.id ?? null);
    setGeofences(
      new Map((geofencesRes.data ?? []).map((g) => [g.branch_id, g as BranchGeofence])),
    );
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadCounts();
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load branches.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadCounts]);

  if (!isOwner) return <Navigate to="/" replace />;

  const createBranch = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Branch name is required.');
      return;
    }
    if (centerId == null) {
      setCreateError('No center found.');
      return;
    }
    setCreating(true);
    try {
      const { error: insertError } = await supabase.from('branches').insert({
        center_id: centerId,
        name: newName.trim(),
        address: newAddress.trim() || null,
        phone: newPhone.trim() || null,
      });
      if (insertError) throw insertError;
      await Promise.all([refresh(), loadCounts()]);
      setCreateOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create branch.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (b: Branch) => {
    setActionError(null);
    setEditId(b.id);
    setEditName(b.name);
    setEditAddress(b.address ?? '');
    setEditPhone(b.phone ?? '');
  };

  const saveEdit = async () => {
    if (editId == null) return;
    setActionError(null);
    if (!editName.trim()) {
      setActionError('Branch name is required.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('branches')
        .update({
          name: editName.trim(),
          address: editAddress.trim() || null,
          phone: editPhone.trim() || null,
        })
        .eq('id', editId);
      if (updateError) throw updateError;
      await refresh();
      setEditId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save branch.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBranch = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      const { error: delError } = await supabase
        .from('branches')
        .delete()
        .eq('id', confirmDelete.id);
      if (delError) throw delError;
      await Promise.all([refresh(), loadCounts()]);
    } catch (e) {
      setActionError(
        isFkViolation(e)
          ? 'Move its classrooms and students first.'
          : e instanceof Error
            ? e.message
            : 'Could not delete branch.',
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Your center's locations."
        actions={
          <Button
            onClick={() => {
              setNewName('');
              setNewAddress('');
              setNewPhone('');
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            + Add branch
          </Button>
        }
      />

      {loading || branchesLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {actionError ? <ErrorState message={actionError} /> : null}

          {branches.length === 0 ? (
            <EmptyState title="No branches" message="Add your first branch." icon="📍" />
          ) : (
            branches.map((b) =>
              editId === b.id ? (
                <Card key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Branch name" required>
                    <TextInput value={editName} onChange={setEditName} autoFocus />
                  </Field>
                  <Field label="Address">
                    <TextInput value={editAddress} onChange={setEditAddress} />
                  </Field>
                  <Field label="Phone">
                    <TextInput value={editPhone} onChange={setEditPhone} type="tel" />
                  </Field>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => setEditId(null)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={saveEdit} disabled={saving}>
                      {saving ? <Spinner size={16} /> : 'Save'}
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card key={b.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface }}>
                        {b.name}
                      </div>
                      {b.address ? (
                        <div style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, marginTop: 4 }}>
                          {b.address}
                        </div>
                      ) : null}
                      {b.phone ? (
                        <div style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                          {b.phone}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <Badge tone="primary">🏫 {classroomCounts.get(b.id) ?? 0} classrooms</Badge>
                        <Badge tone="success">🧒 {studentCounts.get(b.id) ?? 0} students</Badge>
                        {geofences.get(b.id)?.geofence_enabled ? (
                          <Badge tone="primary">📍 Attendance on</Badge>
                        ) : (
                          <Badge tone="neutral">📍 Attendance off</Badge>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button variant="secondary" onClick={() => setGeofenceTarget(b)}>
                        Location
                      </Button>
                      <Button variant="secondary" onClick={() => startEdit(b)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setActionError(null);
                          setConfirmDelete(b);
                        }}
                        style={{ color: Brand.error, borderColor: Brand.error }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ),
            )
          )}
        </div>
      )}

      {createOpen ? (
        <Modal title="Add branch" onClose={() => (creating ? null : setCreateOpen(false))}>
          {createError ? (
            <div style={{ marginBottom: 14 }}>
              <ErrorState message={createError} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Branch name" required>
              <TextInput value={newName} onChange={setNewName} placeholder="e.g. Bangsar" autoFocus />
            </Field>
            <Field label="Address">
              <TextInput value={newAddress} onChange={setNewAddress} />
            </Field>
            <Field label="Phone">
              <TextInput value={newPhone} onChange={setNewPhone} type="tel" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createBranch} disabled={creating}>
              {creating ? <Spinner size={16} /> : 'Create'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete branch?" onClose={() => (deleting ? null : setConfirmDelete(null))}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            This permanently removes <strong>{confirmDelete.name}</strong>. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={deleteBranch}
              disabled={deleting}
              style={{ background: Brand.error, color: Brand.onError }}
            >
              {deleting ? <Spinner size={16} /> : 'Delete branch'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {geofenceTarget && centerId != null ? (
        <BranchGeofenceModal
          branch={geofenceTarget}
          centerId={centerId}
          initial={geofences.get(geofenceTarget.id) ?? null}
          onClose={() => setGeofenceTarget(null)}
          onSaved={loadCounts}
        />
      ) : null}
    </div>
  );
}
