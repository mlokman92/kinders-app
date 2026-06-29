import { useState } from 'react';

import { clean } from '@/lib/activities';
import { Brand } from '@/lib/theme';

import { ListEditor } from './ListEditor';
import { SkillPicker } from './SkillPicker';
import { Button, Card, ErrorState, Field, Spinner, TextInput, Textarea } from './ui';

/** Shape passed in to seed the form for editing. */
export type ActivityFormInitial = {
  title: string;
  description: string;
  materials: string[];
  instructions: string[];
  skillIds: number[];
};

/** Shape handed to the parent on submit — maps to the add/update_activity RPCs. */
export type ActivitySubmitPayload = {
  title: string;
  /** undefined when blank, so the RPC's NULL default applies. */
  description: string | undefined;
  materials: string[];
  instructions: string[];
  skillIds: number[];
};

/**
 * Add/edit form for a library activity. Mirrors the mobile `activity/form` screen and
 * the web `StudentForm` conventions (local state, inline validation, busy Spinner,
 * payload → onSubmit; the parent does the RPC + navigation).
 */
export function ActivityForm({
  submitLabel,
  initial,
  onSubmit,
  onCancel,
}: {
  submitLabel: string;
  initial?: ActivityFormInitial;
  onSubmit: (payload: ActivitySubmitPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [materials, setMaterials] = useState<string[]>(initial?.materials ?? []);
  const [instructions, setInstructions] = useState<string[]>(initial?.instructions ?? []);
  const [skills, setSkills] = useState<Set<number>>(new Set(initial?.skillIds ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Add an activity name.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        title: trimmed,
        description: description.trim() || undefined,
        materials: clean(materials),
        instructions: clean(instructions),
        skillIds: Array.from(skills),
      });
      // On success the parent navigates away; leave `busy` true to avoid a flash.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error ? <ErrorState message={error} /> : null}

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Activity name">
          <TextInput
            value={title}
            onChange={setTitle}
            placeholder="e.g. Sensory water play"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={setDescription}
            placeholder="What is this activity about?"
          />
        </Field>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>
          Materials <span style={{ fontWeight: 600, color: Brand.onSurfaceVariant }}>(optional)</span>
        </div>
        <ListEditor
          value={materials}
          onChange={setMaterials}
          addLabel="+ Add material"
          placeholder="e.g. Plastic tub, cups, water"
        />
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>
          Instructions{' '}
          <span style={{ fontWeight: 600, color: Brand.onSurfaceVariant }}>(optional)</span>
        </div>
        <ListEditor
          value={instructions}
          onChange={setInstructions}
          numbered
          addLabel="+ Add step"
          placeholder="Describe the step"
        />
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>
          Skills developed{' '}
          <span style={{ fontWeight: 600, color: Brand.onSurfaceVariant }}>
            {skills.size > 0 ? `· ${skills.size} selected` : '(optional)'}
          </span>
        </div>
        <SkillPicker value={skills} onChange={setSkills} />
      </Card>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          {busy ? <Spinner size={16} /> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
