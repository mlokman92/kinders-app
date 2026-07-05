import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Classroom = { id: number; name: string };

type Audience = 'all_teachers' | 'class_parents';

/** Announcements this user has sent (a filtered slice of list_my_conversations). */
type Broadcast = {
  conversation_id: number;
  last_message_at: string;
  last_message_body: string;
  other_name: string;
};

const AUDIENCES: { label: string; value: Audience }[] = [
  { label: 'All staff', value: 'all_teachers' },
  { label: 'Parents by class', value: 'class_parents' },
];

/** Compact "how long ago", falling back to a short date past a week. */
function shortTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A stacked label + control block (like Field, but not a <label> — safe around chip groups). */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant }}>{label}</span>
      {children}
    </div>
  );
}

export function Announcements() {
  const { role, can } = useAuth();
  const { branchId } = useBranch();

  const canChooseAudience = role === 'director' || role === 'admin';

  // Composer state.
  const [composerOpen, setComposerOpen] = useState(false);
  const [audience, setAudience] = useState<Audience>('class_parents');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // History state.
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load classrooms (scoped to the selected branch); prune any stale selection.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingClassrooms(true);
      let query = supabase.from('classrooms').select('id, name').order('name');
      if (branchId !== null) query = query.eq('branch_id', branchId);
      const { data } = await query;
      if (!active) return;
      const rows = (data ?? []) as unknown as Classroom[];
      setClassrooms(rows);
      setSelectedIds((prev) => prev.filter((id) => rows.some((c) => c.id === id)));
      setLoadingClassrooms(false);
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('list_my_conversations');
    if (err) {
      setError(err.message);
      setHistory([]);
    } else {
      const sent = (data ?? [])
        .filter((r) => r.is_broadcast && r.last_message_mine)
        .sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
      setHistory(sent);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (role && !can('send_broadcast')) return <Navigate to="/" replace />;

  const openComposer = () => {
    setAudience('class_parents');
    setSelectedIds([]);
    setBody('');
    setFormError(null);
    setComposerOpen(true);
  };

  const toggleClass = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const send = async () => {
    setFormError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setFormError('Write an announcement.');
      return;
    }
    if (audience === 'class_parents' && selectedIds.length === 0) {
      setFormError('Pick at least one class.');
      return;
    }
    setSending(true);
    const { error: err } = await supabase.rpc('send_broadcast', {
      p_audience: audience,
      p_classroom_ids: audience === 'class_parents' ? selectedIds : [],
      p_body: trimmed,
    });
    if (err) {
      setFormError(err.message);
      setSending(false);
      return;
    }
    setSending(false);
    setComposerOpen(false);
    setBody('');
    setSelectedIds([]);
    await loadHistory();
  };

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="One-way — recipients can't reply. Parents get a push on their phone."
        actions={<Button onClick={openComposer}>+ New announcement</Button>}
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : history.length === 0 ? (
        <EmptyState title="No announcements yet." icon="📣" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Audience</Th>
              <Th>Announcement</Th>
              <Th align="right">Sent</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.conversation_id}>
                <Td>
                  <Badge tone="primary">{r.other_name}</Badge>
                </Td>
                <Td style={{ color: Brand.onSurface }}>{r.last_message_body}</Td>
                <Td align="right" style={{ color: Brand.onSurfaceVariant, whiteSpace: 'nowrap' }}>
                  {shortTime(r.last_message_at)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {composerOpen ? (
        <Modal
          title="New announcement"
          onClose={() => (sending ? null : setComposerOpen(false))}
          width={480}
        >
          {formError ? (
            <div style={{ marginBottom: 14 }}>
              <ErrorState message={formError} />
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {canChooseAudience ? (
              <Group label="Audience">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {AUDIENCES.map((a) => (
                    <Chip
                      key={a.value}
                      label={a.label}
                      selected={audience === a.value}
                      onClick={() => setAudience(a.value)}
                    />
                  ))}
                </div>
              </Group>
            ) : null}

            {audience === 'class_parents' ? (
              <Group label={canChooseAudience ? 'Classes' : 'Send to parents of'}>
                {loadingClassrooms ? (
                  <Spinner size={18} />
                ) : classrooms.length === 0 ? (
                  <div style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>
                    No classes available.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {classrooms.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        selected={selectedIds.includes(c.id)}
                        onClick={() => toggleClass(c.id)}
                      />
                    ))}
                  </div>
                )}
              </Group>
            ) : null}

            <Field label="Message">
              <Textarea
                value={body}
                onChange={setBody}
                placeholder="Type your announcement…"
                rows={5}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setComposerOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending ? <Spinner size={16} /> : 'Send'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
