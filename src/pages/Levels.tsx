import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AgeRangeField } from '@/components/AgeRangeField';
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
import { classroomAgeLabel } from '@/lib/age';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Level = {
  id: number;
  center_id: number;
  name: string;
  min_age_months: number | null;
  max_age_months: number | null;
  sort_order: number;
};

export function Levels() {
  const { isOwner } = useAuth();

  const [centerId, setCenterId] = useState<number | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [roomCounts, setRoomCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMin, setNewMin] = useState<number | null>(null);
  const [newMax, setNewMax] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editMin, setEditMin] = useState<number | null>(null);
  const [editMax, setEditMax] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Level | null>(null);
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
      setLevels([]);
      setRoomCounts(new Map());
      return;
    }
    const [levelsRes, roomsRes] = await Promise.all([
      supabase
        .from('levels')
        .select('id, center_id, name, min_age_months, max_age_months, sort_order')
        .eq('center_id', cid)
        .order('sort_order')
        .order('id'),
      supabase.from('classrooms').select('level_id').eq('center_id', cid),
    ]);
    if (levelsRes.error) throw levelsRes.error;
    if (roomsRes.error) throw roomsRes.error;
    setLevels((levelsRes.data ?? []) as unknown as Level[]);
    const rooms = (roomsRes.data ?? []) as unknown as { level_id: number | null }[];
    const counts = new Map<number, number>();
    for (const r of rooms) {
      if (r.level_id != null) counts.set(r.level_id, (counts.get(r.level_id) ?? 0) + 1);
    }
    setRoomCounts(counts);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load levels.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  if (!isOwner) return <Navigate to="/" replace />;

  const nextSort = () => levels.reduce((m, l) => Math.max(m, l.sort_order), -1) + 1;

  const createLevel = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Level name is required.');
      return;
    }
    if (centerId == null) {
      setCreateError('No center found.');
      return;
    }
    setCreating(true);
    try {
      const { error: insertError } = await supabase.from('levels').insert({
        center_id: centerId,
        name: newName.trim(),
        min_age_months: newMin,
        max_age_months: newMax,
        sort_order: nextSort(),
      });
      if (insertError) throw insertError;
      await load();
      setCreateOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create level.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (l: Level) => {
    setActionError(null);
    setEditId(l.id);
    setEditName(l.name);
    setEditMin(l.min_age_months);
    setEditMax(l.max_age_months);
  };

  const saveEdit = async () => {
    if (editId == null) return;
    setActionError(null);
    if (!editName.trim()) {
      setActionError('Level name is required.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('levels')
        .update({ name: editName.trim(), min_age_months: editMin, max_age_months: editMax })
        .eq('id', editId);
      if (updateError) throw updateError;
      await load();
      setEditId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save level.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLevel = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      const { error: delError } = await supabase.from('levels').delete().eq('id', confirmDelete.id);
      if (delError) throw delError;
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete level.');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Levels"
        subtitle="Age bands you group classrooms by."
        actions={
          <Button
            onClick={() => {
              setNewName('');
              setNewMin(null);
              setNewMax(null);
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            + Add level
          </Button>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {actionError ? <ErrorState message={actionError} /> : null}

          {levels.length === 0 ? (
            <EmptyState title="No levels" message="Add your first age band." icon="🪜" />
          ) : (
            levels.map((l) =>
              editId === l.id ? (
                <Card key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Level name" required>
                    <TextInput value={editName} onChange={setEditName} autoFocus />
                  </Field>
                  <Field label="Age range">
                    <AgeRangeField
                      min={editMin}
                      max={editMax}
                      onChange={(mn, mx) => {
                        setEditMin(mn);
                        setEditMax(mx);
                      }}
                    />
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
                <Card key={l.id}>
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
                        {l.name}
                      </div>
                      {classroomAgeLabel(l.min_age_months, l.max_age_months) ? (
                        <div
                          style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, marginTop: 4 }}
                        >
                          {classroomAgeLabel(l.min_age_months, l.max_age_months)}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <Badge tone="primary">🏫 {roomCounts.get(l.id) ?? 0} classrooms</Badge>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button variant="secondary" onClick={() => startEdit(l)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setActionError(null);
                          setConfirmDelete(l);
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
        <Modal title="Add level" onClose={() => (creating ? null : setCreateOpen(false))}>
          {createError ? (
            <div style={{ marginBottom: 14 }}>
              <ErrorState message={createError} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Level name" required>
              <TextInput value={newName} onChange={setNewName} placeholder="e.g. Toddlers" autoFocus />
            </Field>
            <Field label="Age range">
              <AgeRangeField
                min={newMin}
                max={newMax}
                onChange={(mn, mx) => {
                  setNewMin(mn);
                  setNewMax(mx);
                }}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createLevel} disabled={creating}>
              {creating ? <Spinner size={16} /> : 'Create'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete level?" onClose={() => (deleting ? null : setConfirmDelete(null))}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            This removes <strong>{confirmDelete.name}</strong>. Rooms in this level become untagged.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={deleteLevel}
              disabled={deleting}
              style={{ background: Brand.error, color: Brand.onError }}
            >
              {deleting ? <Spinner size={16} /> : 'Delete level'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
