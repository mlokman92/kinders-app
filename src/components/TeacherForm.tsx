import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { uploadStudentPhoto } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import {
  Avatar,
  Button,
  Card,
  Chip,
  DateInput,
  ErrorState,
  Field,
  Select,
  Spinner,
  TextInput,
} from './ui';

/* ---------------------------------------------------------------- Types */

export type Gender = 'male' | 'female' | 'other';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

export type FormAssignment = {
  classroomId: number | null;
  status: 'active' | 'inactive';
  days: string[];
};

/** Shape passed in to seed the form for editing. */
export type TeacherFormInitial = {
  name: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD or ''
  gender: Gender | '';
  photoPath: string | null; // existing storage path, kept unless replaced
  photoUrl: string | null; // signed URL for preview only
  assignments: FormAssignment[];
};

/** Shape handed to the parent on submit — maps 1:1 to the add/update_teacher RPCs. */
export type TeacherSubmitPayload = {
  name: string;
  email: string;
  phone: string;
  dob: string | null;
  gender: string;
  photoPath: string; // '' when none
  assignments: { classroom_id: number; status: string; days: string[] }[];
};

type Props = {
  submitLabel: string;
  initial?: TeacherFormInitial;
  onSubmit: (payload: TeacherSubmitPayload) => Promise<void>;
  onCancel: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const newAssignment = (): FormAssignment => ({
  classroomId: null,
  status: 'active',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
});

/* ----------------------------------------------------------- Component */

export function TeacherForm({ submitLabel, initial, onSubmit, onCancel }: Props) {
  const { user } = useAuth();

  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '');
  const [assignments, setAssignments] = useState<FormAssignment[]>(
    initial?.assignments?.length ? initial.assignments : [newAssignment()],
  );

  const [classrooms, setClassrooms] = useState<{ id: number; name: string }[]>([]);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await supabase.from('classrooms').select('id, name').order('name');
      if (active && !res.error) setClassrooms((res.data ?? []) as { id: number; name: string }[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  const previewUrl = useMemo(
    () => (newFile ? URL.createObjectURL(newFile) : initial?.photoUrl ?? null),
    [newFile, initial?.photoUrl],
  );
  useEffect(() => {
    return () => {
      if (newFile && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [newFile, previewUrl]);

  const classroomOptions = useMemo(
    () => [
      { label: 'Select a class…', value: '' },
      ...classrooms.map((c) => ({ label: c.name, value: String(c.id) })),
    ],
    [classrooms],
  );

  /* ------------------------------------------------------- mutations */

  const setAssignment = (i: number, patch: Partial<FormAssignment>) =>
    setAssignments((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const toggleDay = (i: number, day: string) =>
    setAssignment(i, {
      days: assignments[i].days.includes(day)
        ? assignments[i].days.filter((d) => d !== day)
        : [...assignments[i].days, day],
    });

  /* ---------------------------------------------------------- submit */

  const handleSave = async () => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Teacher name is required.');
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    // Classroom is optional; dedupe so the same class isn't assigned twice.
    const seenClass = new Set<number>();
    const cleanAssignments = assignments.filter((a) => {
      if (a.classroomId == null || seenClass.has(a.classroomId)) return false;
      seenClass.add(a.classroomId);
      return true;
    });

    setBusy(true);
    try {
      let photoPath = initial?.photoPath ?? null;
      if (newFile) {
        if (!user) throw new Error('Not signed in.');
        photoPath = await uploadStudentPhoto(user.id, newFile);
      }

      const payload: TeacherSubmitPayload = {
        name: trimmedName,
        email: trimmedEmail,
        phone: phone.trim(),
        dob: dob || null,
        gender: gender || '',
        photoPath: photoPath ?? '',
        assignments: cleanAssignments.map((a) => ({
          classroom_id: a.classroomId as number,
          status: a.status,
          days: a.days,
        })),
      };

      await onSubmit(payload);
      // On success the parent navigates away; leave `busy` true to avoid a flash.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ view */

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error ? <ErrorState message={error} /> : null}

      {/* Profile */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={name || '·'} size={64} src={previewUrl} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {previewUrl ? 'Change photo' : 'Add photo'}
            </Button>
            {newFile ? (
              <button
                type="button"
                onClick={() => {
                  setNewFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: Brand.onSurfaceVariant,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        </div>

        <Field label="Full name">
          <TextInput value={name} onChange={setName} placeholder="Teacher's name" autoFocus />
        </Field>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Field label="Email">
            <TextInput value={email} onChange={setEmail} placeholder="name@center.com" type="email" />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={setPhone} placeholder="Phone" type="tel" />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Field label="Date of birth">
            <DateInput value={dob} onChange={setDob} />
          </Field>
          <Field label="Gender">
            <Select
              value={gender}
              onChange={(v) => setGender(v as Gender | '')}
              options={[
                { label: '—', value: '' },
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Other', value: 'other' },
              ]}
            />
          </Field>
        </div>
      </Card>

      {/* Classroom assignments */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>
          Classrooms{' '}
          <span style={{ fontWeight: 600, color: Brand.onSurfaceVariant }}>(optional)</span>
        </div>

        {assignments.map((a, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 14,
              borderRadius: Radius.md,
              border: `1px solid ${Brand.outlineVariant}`,
              background: Brand.surfaceContainerLow,
            }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Field label="Classroom">
                <Select
                  value={a.classroomId != null ? String(a.classroomId) : ''}
                  onChange={(v) => setAssignment(i, { classroomId: v ? Number(v) : null })}
                  options={classroomOptions}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={a.status}
                  onChange={(v) => setAssignment(i, { status: v as 'active' | 'inactive' })}
                  options={[
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' },
                  ]}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant }}>
                Days
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DAYS.map((d) => (
                  <Chip
                    key={d.key}
                    label={d.label}
                    selected={a.days.includes(d.key)}
                    onClick={() => toggleDay(i, d.key)}
                  />
                ))}
              </div>
            </div>

            {assignments.length > 1 ? (
              <button
                type="button"
                onClick={() => setAssignments((prev) => prev.filter((_, idx) => idx !== i))}
                style={{
                  alignSelf: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  color: Brand.error,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Remove class
              </button>
            ) : null}
          </div>
        ))}

        <Button variant="outline" onClick={() => setAssignments((prev) => [...prev, newAssignment()])}>
          + Assign another class
        </Button>
      </Card>

      {/* Actions */}
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
