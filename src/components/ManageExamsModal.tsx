import { useEffect, useState } from 'react';

import { listExams, type Exam } from '@/lib/assessments';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import { Button, DateInput, Field, Modal, Select, Spinner, TextInput } from './ui';

type Center = { id: number; name: string };

function examMeta(e: Exam): string {
  const range =
    e.starts_on || e.ends_on
      ? [e.starts_on, e.ends_on]
          .filter(Boolean)
          .map((d) => formatDisplayDate(parseISODate(d as string)))
          .join(' – ')
      : '';
  return [e.term, e.year ? String(e.year) : '', range].filter(Boolean).join(' · ');
}

/**
 * Create / edit / delete a center's examinations. Directors only (the `exams`
 * RLS lets only the center owner write). Deleting an exam unlinks any
 * assessments (exam_id → null) but never deletes the assessments themselves.
 */
export function ManageExamsModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [dirtyDone, setDirtyDone] = useState(false);

  // Form (doubles as add / edit).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [centerId, setCenterId] = useState('');
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');

  const reload = async () => {
    const list = await listExams();
    setExams(list);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [list, centersRes] = await Promise.all([
          listExams(),
          supabase.from('centers').select('id, name').order('name'),
        ]);
        if (!active) return;
        setExams(list);
        const cs = (centersRes.data ?? []) as Center[];
        setCenters(cs);
        if (cs.length) setCenterId(String(cs[0].id));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load exams.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setTerm('');
    setYear('');
    setStartsOn('');
    setEndsOn('');
    if (centers.length) setCenterId(String(centers[0].id));
  };

  const startEdit = (e: Exam) => {
    setEditingId(e.id);
    setCenterId(String(e.center_id));
    setName(e.name);
    setTerm(e.term ?? '');
    setYear(e.year != null ? String(e.year) : '');
    setStartsOn(e.starts_on ?? '');
    setEndsOn(e.ends_on ?? '');
    setError(null);
  };

  const submit = async () => {
    if (!name.trim() || !centerId) return;
    setSaving(true);
    setError(null);
    try {
      const yearNum = year.trim() ? parseInt(year, 10) : null;
      const payload = {
        center_id: Number(centerId),
        name: name.trim(),
        term: term.trim() || null,
        year: yearNum != null && !Number.isNaN(yearNum) ? yearNum : null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
      };
      const res = editingId
        ? await supabase.from('exams').update(payload).eq('id', editingId)
        : await supabase.from('exams').insert(payload);
      if (res.error) throw res.error;
      await reload();
      resetForm();
      setDirtyDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the exam.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.from('exams').delete().eq('id', id);
      if (delErr) throw delErr;
      if (editingId === id) resetForm();
      setConfirmId(null);
      await reload();
      setDirtyDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the exam.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (dirtyDone) onChanged();
    onClose();
  };

  return (
    <Modal title="Examinations" onClose={saving ? () => {} : close} width={560}>
      {loading ? (
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Add / edit form */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: 14,
              background: Brand.surfaceContainerLow,
              borderRadius: Radius.md,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: Brand.onSurface }}>
              {editingId ? 'Edit examination' : 'Add examination'}
            </div>
            {centers.length > 1 ? (
              <Field label="Center">
                <Select
                  value={centerId}
                  onChange={setCenterId}
                  options={centers.map((c) => ({ value: String(c.id), label: c.name }))}
                />
              </Field>
            ) : null}
            <Field label="Name">
              <TextInput value={name} onChange={setName} placeholder="e.g. Penilaian Akhir Tahun 2026" />
            </Field>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Field label="Term">
                <TextInput value={term} onChange={setTerm} placeholder="Akhir Tahun" />
              </Field>
              <Field label="Year">
                <TextInput value={year} onChange={setYear} placeholder="2026" type="number" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Field label="Starts">
                <DateInput value={startsOn} onChange={setStartsOn} />
              </Field>
              <Field label="Ends">
                <DateInput value={endsOn} onChange={setEndsOn} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={submit} disabled={!name.trim() || !centerId || saving}>
                {saving ? <Spinner size={16} /> : editingId ? 'Save changes' : 'Add examination'}
              </Button>
              {editingId ? (
                <Button variant="secondary" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div
              style={{
                fontSize: 13,
                color: Brand.onErrorContainer,
                background: Brand.errorContainer,
                padding: '8px 12px',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          ) : null}

          {/* Existing exams */}
          <div style={{ border: `1px solid ${Brand.outlineVariant}`, borderRadius: Radius.md, overflow: 'hidden' }}>
            {exams.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 13.5, color: Brand.onSurfaceVariant }}>
                No examinations yet.
              </div>
            ) : (
              exams.map((e, i) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                    background: editingId === e.id ? Brand.primaryContainer + '33' : 'transparent',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurface }}>{e.name}</div>
                    {examMeta(e) ? (
                      <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                        {examMeta(e)}
                      </div>
                    ) : null}
                  </div>
                  {confirmId === e.id ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmId(null)}
                        disabled={saving}
                        style={{ padding: '7px 12px', fontSize: 13 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => remove(e.id)}
                        disabled={saving}
                        style={{ padding: '7px 12px', fontSize: 13, background: Brand.error, color: Brand.onError }}
                      >
                        Confirm
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => startEdit(e)}
                        disabled={saving}
                        style={{ padding: '7px 12px', fontSize: 13 }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmId(e.id)}
                        disabled={saving}
                        style={{ padding: '7px 12px', fontSize: 13, color: Brand.error, borderColor: Brand.error }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
