import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
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
  isTeacher: boolean;
  isAdmin: boolean;
  branchIds: number[];
  /** Current custom roles (owner-assigned). Empty = default access. */
  staffRoleIds: number[];
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
  isTeacher: boolean;
  /** null = leave unchanged (non-owners may not touch admin duty). */
  isAdmin: boolean | null;
  branchIds: number[];
  /** Owner-only custom role assignments (reconciled via the join table). Empty = default access. */
  staffRoleIds: number[];
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

/** A labelled checkbox row (duties, branch membership). */
function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
        color: Brand.onSurface,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}

/* ----------------------------------------------------------- Component */

export function TeacherForm({ submitLabel, initial, onSubmit, onCancel }: Props) {
  const { user, isOwner } = useAuth();
  const { branches, branchId } = useBranch();

  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '');
  const [teaching, setTeaching] = useState(initial?.isTeacher ?? true);
  const [admin, setAdmin] = useState(initial?.isAdmin ?? false);
  const [branchIds, setBranchIds] = useState<number[]>(
    () => initial?.branchIds ?? (branchId != null ? [branchId] : branches.map((b) => b.id)),
  );
  const [staffRoleIds, setStaffRoleIds] = useState<number[]>(initial?.staffRoleIds ?? []);
  const [staffRoles, setStaffRoles] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [assignments, setAssignments] = useState<FormAssignment[]>(
    initial?.assignments?.length ? initial.assignments : [newAssignment()],
  );

  // New-staff mode: if branches hadn't loaded when state initialized, seed once they do.
  const branchesSeeded = useRef(Boolean(initial) || branches.length > 0);
  useEffect(() => {
    if (branchesSeeded.current || branches.length === 0) return;
    branchesSeeded.current = true;
    setBranchIds(branchId != null ? [branchId] : branches.map((b) => b.id));
  }, [branches, branchId]);

  const [classrooms, setClassrooms] = useState<{ id: number; name: string }[]>([]);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Scope the assignable-classroom picker to the selected branch, like every other
      // classroom loader — otherwise staff could be assigned to a room outside the branch.
      let q = supabase.from('classrooms').select('id, name').order('name');
      if (branchId !== null) q = q.eq('branch_id', branchId);
      const res = await q;
      if (active && !res.error) setClassrooms((res.data ?? []) as { id: number; name: string }[]);
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  // Custom roles are an owner-only assignment; only load (and show) them for owners.
  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    (async () => {
      const res = await supabase.from('staff_roles').select('id, name').order('id');
      if (active && !res.error)
        setStaffRoles((res.data ?? []) as { id: number; name: string }[]);
    })();
    return () => {
      active = false;
    };
  }, [isOwner]);

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
      setError('Name is required.');
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    // Non-owners can't change admin duty, so count the row's existing value.
    const effectiveAdmin = isOwner ? admin : initial?.isAdmin ?? false;
    if (!teaching && !effectiveAdmin) {
      setError('Select at least one duty.');
      return;
    }
    if (branches.length > 1 && branchIds.length === 0) {
      setError('Select at least one branch.');
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
        isTeacher: teaching,
        isAdmin: isOwner ? admin : null,
        branchIds,
        // Only owners may set roles; others carry the existing set through unchanged.
        staffRoleIds: isOwner ? staffRoleIds : initial?.staffRoleIds ?? [],
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
          <TextInput value={name} onChange={setName} placeholder="Full name" autoFocus />
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant }}>
            Duties
          </span>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <CheckRow label="Teaching" checked={teaching} onChange={setTeaching} />
            {isOwner ? <CheckRow label="Admin" checked={admin} onChange={setAdmin} /> : null}
          </div>
        </div>

        {branches.length > 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant }}>
              Branches
            </span>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {branches.map((b) => (
                <CheckRow
                  key={b.id}
                  label={b.name}
                  checked={branchIds.includes(b.id)}
                  onChange={(on) =>
                    setBranchIds((prev) =>
                      on ? [...prev, b.id] : prev.filter((id) => id !== b.id),
                    )
                  }
                />
              ))}
            </div>
          </div>
        ) : null}

        {isOwner && staffRoles.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant }}>
              Roles
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffRoles.map((r) => (
                <label
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: Brand.onSurface,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={staffRoleIds.includes(r.id)}
                    onChange={(e) =>
                      setStaffRoleIds((prev) =>
                        e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                      )
                    }
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
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
