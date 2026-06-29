import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type ActivityRow = {
  id: number;
  title: string;
  description: string | null;
  materials: string[];
  instructions: string[];
  activity_skills: { id: number }[];
};

export function Activities() {
  const { role } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await supabase
          .from('activities')
          .select('id, title, description, materials, instructions, activity_skills(id)')
          .order('title');
        if (!active) return;
        if (res.error) throw res.error;
        setActivities((res.data ?? []) as unknown as ActivityRow[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load activities.');
      } finally {
        if (active) setLoading(false);
      }
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

  return (
    <div>
      <PageHeader
        title="Activities"
        subtitle={`${activities.length} reusable ${activities.length === 1 ? 'activity' : 'activities'} in your library.`}
        actions={
          role === 'director' ? (
            <Link to="/activities/new">
              <Button>+ New activity</Button>
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <Toolbar>
            <Field label="Search">
              <TextInput value={search} onChange={setSearch} placeholder="Search by title…" />
            </Field>
          </Toolbar>

          {filtered.length === 0 ? (
            <EmptyState
              title="No activities"
              message={
                search
                  ? 'No activities match your search.'
                  : role === 'director'
                    ? 'Create your first activity with “+ New activity”.'
                    : 'Activities created by your director will appear here.'
              }
              icon="🎨"
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
              }}
            >
              {filtered.map((a) => (
                <Card key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link
                    to={`/activities/${a.id}`}
                    style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, letterSpacing: -0.2 }}
                  >
                    {a.title}
                  </Link>
                  {a.description ? (
                    <p
                      style={{
                        fontSize: 13.5,
                        color: Brand.onSurfaceVariant,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {a.description}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto' }}>
                    <Badge tone="neutral">📋 {a.materials.length} materials</Badge>
                    <Badge tone="neutral">🪜 {a.instructions.length} steps</Badge>
                    <Badge tone="primary">🎯 {a.activity_skills.length} skills</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
