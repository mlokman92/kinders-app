import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

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
  Select,
  Spinner,
  TextInput,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type StaffRole = Tables<'staff_roles'>;
type Level = { id: number; name: string };

export function StaffRoles() {
  const { isOwner } = useAuth();
  const { branches, loading: branchesLoading } = useBranch();

  const [centerId, setCenterId] = useState<number | null>(null);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create/edit form modal. editId null = create.
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [fName, setFName] = useState('');
  const [fBranchId, setFBranchId] = useState('');
  const [fLevelId, setFLevelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<StaffRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const centerRes = await supabase
      .from('centers')
      .select('id')
      .order('id')
      .limit(1)
      .maybeSingle();
    if (centerRes.error) throw centerRes.error;
    const cid = (centerRes.data as { id: number } | null)?.id ?? null;
    setCenterId(cid);
    if (cid == null) {
      setRoles([]);
      setLevels([]);
      return;
    }

    const [rolesRes, levelsRes] = await Promise.all([
      supabase.from('staff_roles').select('*').eq('center_id', cid).order('id'),
      supabase.from('levels').select('id, name').eq('center_id', cid).order('sort_order').order('id'),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (levelsRes.error) throw levelsRes.error;
    setRoles((rolesRes.data ?? []) as StaffRole[]);
    setLevels((levelsRes.data ?? []) as Level[]);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load roles.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  if (!isOwner) return <Navigate to="/" replace />;

  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? 'Branch';
  const levelName = (id: number) => levels.find((l) => l.id === id)?.name ?? 'Level';

  /** Scope reads as: both, level only (all branches), or whole branch. */
  const scopeLabel = (r: StaffRole): string => {
    if (r.level_id != null && r.branch_id != null)
      return `🎯 ${levelName(r.level_id)} · ${branchName(r.branch_id)}`;
    if (r.level_id != null) return `🎯 ${levelName(r.level_id)} (all branches)`;
    return `🏢 ${branchName(r.branch_id as number)}`;
  };

  const openCreate = () => {
    setEditId(null);
    setFName('');
    setFBranchId('');
    setFLevelId('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (r: StaffRole) => {
    setEditId(r.id);
    setFName(r.name);
    setFBranchId(r.branch_id != null ? String(r.branch_id) : '');
    setFLevelId(r.level_id != null ? String(r.level_id) : '');
    setFormError(null);
    setFormOpen(true);
  };

  const saveForm = async () => {
    setFormError(null);
    const trimmed = fName.trim();
    if (!trimmed) {
      setFormError('Role name is required.');
      return;
    }
    if (centerId == null) {
      setFormError('No center found.');
      return;
    }
    const branchId = fBranchId ? Number(fBranchId) : null;
    const levelId = fLevelId ? Number(fLevelId) : null;
    if (branchId == null && levelId == null) {
      setFormError('Pick a branch, a level, or both.');
      return;
    }

    setSaving(true);
    try {
      if (editId == null) {
        const { error: insertError } = await supabase
          .from('staff_roles')
          .insert({ center_id: centerId, name: trimmed, branch_id: branchId, level_id: levelId });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('staff_roles')
          .update({ name: trimmed, branch_id: branchId, level_id: levelId })
          .eq('id', editId);
        if (updateError) throw updateError;
      }
      await load();
      setFormOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save role.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      const { error: delError } = await supabase
        .from('staff_roles')
        .delete()
        .eq('id', confirmDelete.id);
      if (delError) throw delError;
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete role.');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const branchOptions = [
    { label: 'Any branch', value: '' },
    ...branches.map((b) => ({ label: b.name, value: String(b.id) })),
  ];
  const levelOptions = [
    { label: 'Any level', value: '' },
    ...levels.map((l) => ({ label: l.name, value: String(l.id) })),
  ];

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="What data a staff member can see — a branch and/or a level."
        actions={<Button onClick={openCreate}>+ Add role</Button>}
      />

      {loading || branchesLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {actionError ? <ErrorState message={actionError} /> : null}

          {roles.length === 0 ? (
            <EmptyState title="No roles" message="Create your first custom role." icon="🧩" />
          ) : (
            roles.map((r) => (
              <Card key={r.id}>
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
                      {r.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <Badge tone="neutral">{scopeLabel(r)}</Badge>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button variant="secondary" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionError(null);
                        setConfirmDelete(r);
                      }}
                      style={{ color: Brand.error, borderColor: Brand.error }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {formOpen ? (
        <Modal
          title={editId == null ? 'New role' : 'Edit role'}
          onClose={() => (saving ? null : setFormOpen(false))}
          width={480}
        >
          {formError ? (
            <div style={{ marginBottom: 14 }}>
              <ErrorState message={formError} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Role name" required>
              <TextInput value={fName} onChange={setFName} placeholder="e.g. Toddler lead" autoFocus />
            </Field>
            <Field label="Branch">
              <Select value={fBranchId} onChange={setFBranchId} options={branchOptions} />
            </Field>
            <Field label="Level">
              <Select value={fLevelId} onChange={setFLevelId} options={levelOptions} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveForm} disabled={saving}>
              {saving ? <Spinner size={16} /> : editId == null ? 'Create' : 'Save'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete role?" onClose={() => (deleting ? null : setConfirmDelete(null))}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            This removes <strong>{confirmDelete.name}</strong>. Staff with this role return to default
            access.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={deleteRole}
              disabled={deleting}
              style={{ background: Brand.error, color: Brand.onError }}
            >
              {deleting ? <Spinner size={16} /> : 'Delete role'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
