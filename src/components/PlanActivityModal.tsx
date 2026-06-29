import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import { Button, EmptyState, ErrorState, Modal, Spinner, TextInput } from './ui';

type ActivityOption = { id: number; title: string };

/**
 * Searchable activity picker for placing one library activity on a single plan day.
 * Calls `add_planned_activities` (director + assigned teacher per RLS), then closes.
 */
export function PlanActivityModal({
  classroomId,
  date,
  dateLabel,
  onClose,
  onAdded,
}: {
  classroomId: number;
  date: string;
  dateLabel: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: err } = await supabase
        .from('activities')
        .select('id, title')
        .order('title');
      if (!active) return;
      if (err) setError(err.message);
      else setActivities((data ?? []) as unknown as ActivityOption[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => a.title.toLowerCase().includes(q));
  }, [activities, search]);

  const place = async (activityId: number) => {
    setError(null);
    setBusyId(activityId);
    try {
      const { error: err } = await supabase.rpc('add_planned_activities', {
        p_classroom_id: classroomId,
        p_activity_id: activityId,
        p_dates: [date],
      });
      if (err) throw err;
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add to plan.');
      setBusyId(null);
    }
  };

  return (
    <Modal
      title={`Add activity — ${dateLabel}`}
      onClose={() => (busyId == null ? onClose() : undefined)}
      width={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? <ErrorState message={error} /> : null}
        <TextInput value={search} onChange={setSearch} placeholder="Search activities…" autoFocus />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spinner size={22} />
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            title="No activities yet"
            message="Create an activity in your library first."
            icon="🎨"
          />
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 14, color: Brand.onSurfaceVariant, padding: '8px 2px' }}>
            No activities match “{search}”.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => place(a.id)}
                disabled={busyId != null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: Radius.md,
                  border: `1px solid ${Brand.outlineVariant}`,
                  background: Brand.white,
                  color: Brand.onSurface,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: busyId != null ? 'default' : 'pointer',
                  opacity: busyId != null && busyId !== a.id ? 0.5 : 1,
                }}
              >
                {a.title}
                {busyId === a.id ? (
                  <Spinner size={16} />
                ) : (
                  <span style={{ color: Brand.primary, fontWeight: 700 }}>+ Add</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <Link
            to="/activities/new"
            style={{ fontSize: 13, fontWeight: 700, color: Brand.onSurfaceVariant }}
          >
            + New activity
          </Link>
          <Button variant="secondary" onClick={onClose} disabled={busyId != null}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
