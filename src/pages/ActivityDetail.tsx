import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Activity = {
  id: number;
  title: string;
  description: string | null;
  materials: string[] | null;
  instructions: string[] | null;
};

type Skill = {
  id: number;
  code: string;
  name: string;
  area_name: string | null;
};

type SkillRow = {
  learning_skills: {
    id: number;
    code: string;
    name: string;
    learning_areas: { area_name: string } | null;
  } | null;
};

export function ActivityDetail() {
  const { id } = useParams();
  const aid = Number(id);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [activityRes, skillsRes] = await Promise.all([
          supabase
            .from('activities')
            .select('id, title, description, materials, instructions')
            .eq('id', aid)
            .maybeSingle(),
          supabase
            .from('activity_skills')
            .select('learning_skills(id, code, name, learning_areas(area_name))')
            .eq('activity_id', aid),
        ]);
        if (!active) return;
        if (activityRes.error) throw activityRes.error;
        if (skillsRes.error) throw skillsRes.error;
        setActivity((activityRes.data ?? null) as unknown as Activity | null);
        const rows = (skillsRes.data ?? []) as unknown as SkillRow[];
        setSkills(
          rows
            .map((r) => r.learning_skills)
            .filter((s): s is NonNullable<SkillRow['learning_skills']> => s != null)
            .map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              area_name: s.learning_areas?.area_name ?? null,
            })),
        );
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load activity.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [aid]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!activity) return <EmptyState title="Activity not found" icon="🔍" />;

  const materials = activity.materials ?? [];
  const instructions = activity.instructions ?? [];

  return (
    <div>
      <PageHeader
        title={activity.title}
        actions={
          <Link to="/activities">
            <Button variant="outline">← Back</Button>
          </Link>
        }
      />

      {activity.description ? (
        <Card style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: Brand.onSurface, marginBottom: 8 }}>
            Description
          </h2>
          <p style={{ fontSize: 14.5, color: Brand.onSurfaceVariant, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {activity.description}
          </p>
        </Card>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: Brand.onSurface, marginBottom: 10 }}>
          Materials
        </h2>
        {materials.length === 0 ? (
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>No materials listed.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {materials.map((m, i) => (
              <li key={i} style={{ fontSize: 14.5, color: Brand.onSurface }}>
                {m}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: Brand.onSurface, marginBottom: 10 }}>
          Instructions
        </h2>
        {instructions.length === 0 ? (
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>No instructions listed.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {instructions.map((step, i) => (
              <li key={i} style={{ fontSize: 14.5, color: Brand.onSurface, lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: Brand.onSurface, marginBottom: 10 }}>
          Skills developed
        </h2>
        {skills.length === 0 ? (
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>No skills tagged.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skills.map((s) => (
              <Badge key={s.id} tone="primary">
                <span style={{ fontWeight: 700 }}>{s.code}</span>
                <span> · {s.name}</span>
                {s.area_name ? (
                  <span style={{ color: Brand.onSurfaceVariant, fontWeight: 500 }}> · {s.area_name}</span>
                ) : null}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
