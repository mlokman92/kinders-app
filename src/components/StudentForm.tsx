import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { toISODate } from '@/lib/dates';
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

export type FormEnrollment = {
  classroomId: number | null;
  status: 'active' | 'upcoming';
  date: string; // YYYY-MM-DD
  days: string[];
};

export type FormContact = {
  name: string;
  email: string;
  phone: string;
  relationship: 'parent' | 'guardian' | '';
};

/** Shape passed in to seed the form for editing. */
export type StudentFormInitial = {
  name: string;
  dob: string; // YYYY-MM-DD or ''
  gender: Gender | '';
  nric: string;
  photoPath: string | null; // existing storage path, kept unless replaced
  photoUrl: string | null; // signed URL for preview only
  enrollments: FormEnrollment[];
  contacts: FormContact[];
};

/** Shape handed to the parent on submit — maps 1:1 to the add/update_student RPCs. */
export type StudentSubmitPayload = {
  name: string;
  dob: string | null;
  gender: string;
  nric: string | null;
  photoPath: string; // '' when none
  /** Branch for the student (selected in the form or from the switcher); null = default. */
  branchId: number | null;
  enrollments: { classroom_id: number; status: string; enrollment_date: string; days: string[] }[];
  guardians: {
    name: string | null;
    email: string | null;
    phone: string | null;
    relationship: string | null;
  }[];
};

type Props = {
  submitLabel: string;
  initial?: StudentFormInitial;
  /** Preselect a classroom for the first enrollment (add-from-classroom flow). */
  initialClassroomId?: number | null;
  /** Directors may set/move classrooms; teachers cannot (matches the RPC + RLS). */
  canEditEnrollments: boolean;
  /**
   * May edit contacts. When false the Contacts editor is hidden — update_student silently
   * skips guardian writes without this capability, so showing it would lose edits. Defaults
   * to true for the add flow (creating a student always seeds its contacts).
   */
  canManageGuardians?: boolean;
  /** Show a Branch select on multi-branch centers (the New page passes true). */
  allowBranchSelect?: boolean;
  /** Lowercased emails of contacts that are registered parents (name/phone read-only). */
  linkedEmails?: Set<string>;
  onSubmit: (payload: StudentSubmitPayload) => Promise<void>;
  onCancel: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const newEnrollment = (classroomId: number | null): FormEnrollment => ({
  classroomId,
  status: 'active',
  date: toISODate(new Date()),
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
});

const newContact = (): FormContact => ({ name: '', email: '', phone: '', relationship: '' });

/* ----------------------------------------------------------- Component */

export function StudentForm({
  submitLabel,
  initial,
  initialClassroomId = null,
  canEditEnrollments,
  canManageGuardians = true,
  allowBranchSelect = false,
  linkedEmails,
  onSubmit,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const { branches, branchId: contextBranchId } = useBranch();

  const [formBranchId, setFormBranchId] = useState<number | null>(contextBranchId);
  const branchId = allowBranchSelect ? formBranchId : contextBranchId;
  const showBranchSelect = allowBranchSelect && branches.length > 1;

  // Default the form's branch to the first one when the switcher is on "all".
  useEffect(() => {
    if (allowBranchSelect && formBranchId == null && branches.length > 0)
      setFormBranchId(branches[0].id);
  }, [allowBranchSelect, formBranchId, branches]);

  const [name, setName] = useState(initial?.name ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '');
  const [nric, setNric] = useState(initial?.nric ?? '');
  const [enrollments, setEnrollments] = useState<FormEnrollment[]>(
    initial?.enrollments?.length
      ? initial.enrollments
      : [newEnrollment(initialClassroomId)],
  );
  const [contacts, setContacts] = useState<FormContact[]>(
    initial?.contacts?.length ? initial.contacts : [newContact()],
  );

  const [classrooms, setClassrooms] = useState<{ id: number; name: string }[]>([]);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Classrooms are only needed when the user can edit enrollments; scoped to the branch.
  useEffect(() => {
    if (!canEditEnrollments) return;
    let active = true;
    (async () => {
      let q = supabase.from('classrooms').select('id, name').order('name');
      if (branchId !== null) q = q.eq('branch_id', branchId);
      const res = await q;
      if (active && !res.error) setClassrooms((res.data ?? []) as { id: number; name: string }[]);
    })();
    return () => {
      active = false;
    };
  }, [canEditEnrollments, branchId]);

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

  const setEnrollment = (i: number, patch: Partial<FormEnrollment>) =>
    setEnrollments((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const toggleDay = (i: number, day: string) =>
    setEnrollment(i, {
      days: enrollments[i].days.includes(day)
        ? enrollments[i].days.filter((d) => d !== day)
        : [...enrollments[i].days, day],
    });

  const setContact = (i: number, patch: Partial<FormContact>) =>
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  /* ---------------------------------------------------------- submit */

  const handleSave = async () => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Student name is required.');
      return;
    }

    // Classroom is optional; dedupe so the same class isn't enrolled twice.
    const seenClass = new Set<number>();
    const cleanEnrollments = enrollments.filter((e) => {
      if (e.classroomId == null || seenClass.has(e.classroomId)) return false;
      seenClass.add(e.classroomId);
      return true;
    });

    const cleanContacts = contacts.filter(
      (c) => c.name.trim() || c.email.trim() || c.phone.trim(),
    );
    const seen = new Set<string>();
    for (const c of cleanContacts) {
      const email = c.email.trim().toLowerCase();
      if (email) {
        if (!EMAIL_RE.test(email)) {
          setError(`"${c.email}" is not a valid email.`);
          return;
        }
        if (seen.has(email)) {
          setError('Each contact must have a different email.');
          return;
        }
        seen.add(email);
      }
    }

    setBusy(true);
    try {
      let photoPath = initial?.photoPath ?? null;
      if (newFile) {
        if (!user) throw new Error('Not signed in.');
        photoPath = await uploadStudentPhoto(user.id, newFile);
      }

      const payload: StudentSubmitPayload = {
        name: trimmedName,
        dob: dob || null,
        gender: gender || '',
        nric: nric.trim() || null,
        photoPath: photoPath ?? '',
        branchId,
        enrollments: cleanEnrollments.map((e) => ({
          classroom_id: e.classroomId as number,
          status: e.status,
          enrollment_date: e.date || toISODate(new Date()),
          days: e.days,
        })),
        // Only submit guardian edits when allowed; update_student skips them otherwise, so
        // sending them would falsely imply they were saved.
        guardians: canManageGuardians
          ? cleanContacts.map((c) => ({
              name: c.name.trim() || null,
              email: c.email.trim() || null,
              phone: c.phone.trim() || null,
              relationship: c.relationship || null,
            }))
          : [],
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
          <TextInput value={name} onChange={setName} placeholder="Child's name" autoFocus />
        </Field>

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

        <Field label="NRIC">
          <TextInput
            value={nric}
            onChange={(v) => setNric(v.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="e.g. 200101141234"
          />
        </Field>

        {showBranchSelect ? (
          <Field label="Branch">
            <Select
              value={formBranchId != null ? String(formBranchId) : ''}
              onChange={(v) => setFormBranchId(v ? Number(v) : null)}
              options={branches.map((b) => ({ label: b.name, value: String(b.id) }))}
            />
          </Field>
        ) : null}
      </Card>

      {/* Enrollment — directors only */}
      {canEditEnrollments ? (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>
            Enrollment <span style={{ fontWeight: 600, color: Brand.onSurfaceVariant }}>(optional)</span>
          </div>

          {enrollments.map((en, i) => (
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
                    value={en.classroomId != null ? String(en.classroomId) : ''}
                    onChange={(v) => setEnrollment(i, { classroomId: v ? Number(v) : null })}
                    options={classroomOptions}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={en.status}
                    onChange={(v) => setEnrollment(i, { status: v as 'active' | 'upcoming' })}
                    options={[
                      { label: 'Active', value: 'active' },
                      { label: 'Upcoming', value: 'upcoming' },
                    ]}
                  />
                </Field>
                <Field label="Start date">
                  <DateInput value={en.date} onChange={(v) => setEnrollment(i, { date: v })} />
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
                      selected={en.days.includes(d.key)}
                      onClick={() => toggleDay(i, d.key)}
                    />
                  ))}
                </div>
              </div>

              {enrollments.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setEnrollments((prev) => prev.filter((_, idx) => idx !== i))}
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

          <Button
            variant="outline"
            onClick={() => setEnrollments((prev) => [...prev, newEnrollment(null)])}
          >
            + Enroll in another class
          </Button>
        </Card>
      ) : null}

      {/* Contacts — hidden without manage_guardians (the RPC would silently drop edits) */}
      {canManageGuardians ? (
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>Contacts</div>

        {contacts.map((c, i) => {
          const linked = !!c.email && !!linkedEmails?.has(c.email.trim().toLowerCase());
          return (
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
              {linked ? (
                <span style={{ fontSize: 12.5, color: Brand.onSurfaceVariant }}>
                  Linked parent — name & phone are managed by them.
                </span>
              ) : null}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Name">
                  <TextInput
                    value={c.name}
                    onChange={(v) => setContact(i, { name: v })}
                    placeholder="Contact name"
                    style={linked ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                  />
                </Field>
                <Field label="Relationship">
                  <Select
                    value={c.relationship}
                    onChange={(v) =>
                      setContact(i, { relationship: v as 'parent' | 'guardian' | '' })
                    }
                    options={[
                      { label: '—', value: '' },
                      { label: 'Parent', value: 'parent' },
                      { label: 'Guardian', value: 'guardian' },
                    ]}
                  />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Email">
                  <TextInput
                    value={c.email}
                    onChange={(v) => setContact(i, { email: v })}
                    placeholder="name@email.com"
                    type="email"
                  />
                </Field>
                <Field label="Phone">
                  <TextInput
                    value={c.phone}
                    onChange={(v) => setContact(i, { phone: v })}
                    placeholder="Phone"
                    type="tel"
                    style={linked ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                  />
                </Field>
              </div>

              {contacts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setContacts((prev) => prev.filter((_, idx) => idx !== i))}
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
                  Remove contact
                </button>
              ) : null}
            </div>
          );
        })}

        <Button variant="outline" onClick={() => setContacts((prev) => [...prev, newContact()])}>
          + Add contact
        </Button>
      </Card>
      ) : null}

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
