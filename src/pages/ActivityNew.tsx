import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ActivityForm, type ActivitySubmitPayload } from '@/components/ActivityForm';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

export function ActivityNew() {
  const navigate = useNavigate();
  const { can } = useAuth();

  // Creating activities needs manage_activities — RLS enforces the same rule.
  if (!can('manage_activities')) return <Navigate to="/activities" replace />;

  const onSubmit = async (payload: ActivitySubmitPayload) => {
    const { data, error } = await supabase.rpc('add_activity', {
      p_title: payload.title,
      p_description: payload.description,
      p_materials: payload.materials,
      p_instructions: payload.instructions,
      p_skill_ids: payload.skillIds,
    });
    if (error) throw error;
    navigate(`/activities/${data}`, { replace: true });
  };

  const backLink = (
    <Link to="/activities" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Activities
    </Link>
  );

  return (
    <div>
      <PageHeader title="New activity" actions={backLink} />
      <ActivityForm
        submitLabel="Create activity"
        onSubmit={onSubmit}
        onCancel={() => navigate('/activities')}
      />
    </div>
  );
}
