import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import {
  ActivityForm,
  type ActivityFormInitial,
  type ActivitySubmitPayload,
} from '@/components/ActivityForm';
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

export function ActivityEdit() {
  const { id } = useParams();
  const aid = Number(id);
  const navigate = useNavigate();
  const { role } = useAuth();

  const [initial, setInitial] = useState<ActivityFormInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [activityRes, skillRes] = await Promise.all([
          supabase
            .from('activities')
            .select('title, description, materials, instructions')
            .eq('id', aid)
            .maybeSingle(),
          supabase.from('activity_skills').select('skill_id').eq('activity_id', aid),
        ]);
        if (!active) return;
        if (activityRes.error) throw activityRes.error;
        if (skillRes.error) throw skillRes.error;

        const a = activityRes.data as {
          title: string;
          description: string | null;
          materials: string[] | null;
          instructions: string[] | null;
        } | null;
        if (!a) {
          setInitial(null);
          return;
        }
        setInitial({
          title: a.title,
          description: a.description ?? '',
          materials: a.materials ?? [],
          instructions: a.instructions ?? [],
          skillIds: ((skillRes.data ?? []) as { skill_id: number }[]).map((r) => r.skill_id),
        });
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

  // Only directors can edit activities (mirrors mobile + the RLS owner-only write).
  if (role !== 'director') return <Navigate to={`/activities/${aid}`} replace />;

  const onSubmit = async (payload: ActivitySubmitPayload) => {
    const { error: rpcError } = await supabase.rpc('update_activity', {
      p_id: aid,
      p_title: payload.title,
      p_description: payload.description,
      p_materials: payload.materials,
      p_instructions: payload.instructions,
      p_skill_ids: payload.skillIds,
    });
    if (rpcError) throw rpcError;
    navigate(`/activities/${aid}`, { replace: true });
  };

  const backLink = (
    <Link
      to={`/activities/${aid}`}
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Cancel
    </Link>
  );

  return (
    <div>
      <PageHeader title="Edit activity" actions={backLink} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : !initial ? (
        <EmptyState title="Activity not found" icon="🔍" />
      ) : (
        <ActivityForm
          submitLabel="Save changes"
          initial={initial}
          onSubmit={onSubmit}
          onCancel={() => navigate(`/activities/${aid}`)}
        />
      )}
    </div>
  );
}
