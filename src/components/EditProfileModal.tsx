import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { getStudentPhotoUrl, uploadStudentPhoto } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

import { Avatar, Button, DateInput, ErrorState, Field, Modal, Select, Spinner, TextInput } from './ui';

/** The caller's own profile, merged from `profiles` + their staff roster row (via `my_profile`). */
export type MyProfile = {
  full_name: string;
  phone: string | null;
  dob: string | null; // YYYY-MM-DD or null
  gender: string | null; // male | female | other | null
  photo_url: string | null; // storage path or null
  has_staff_row: boolean; // dob/gender/photo only persist when the user is on the roster
};

type Props = {
  initial: MyProfile;
  onClose: () => void;
  onSaved: (next: MyProfile) => void;
};

/**
 * Self-service "Edit profile" modal, opened from the sidebar profile menu. Any signed-in staff
 * member (director/admin/teacher) edits their OWN identity — name/phone always, plus photo/DOB/
 * gender when they have a roster row. Saved via `update_my_profile`, which writes `profiles` and
 * mirrors the roster entry. Duties/roles/branches stay owner-controlled and are not shown here.
 */
export function EditProfileModal({ initial, onClose, onSaved }: Props) {
  const { user } = useAuth();

  const [name, setName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [dob, setDob] = useState(initial.dob ?? '');
  const [gender, setGender] = useState(initial.gender ?? '');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve a signed URL for the existing (stored) photo, for preview only.
  useEffect(() => {
    let active = true;
    if (initial.photo_url) {
      getStudentPhotoUrl(initial.photo_url).then((url) => {
        if (active) setExistingPhotoUrl(url);
      });
    }
    return () => {
      active = false;
    };
  }, [initial.photo_url]);

  const previewUrl = useMemo(
    () => (newFile ? URL.createObjectURL(newFile) : existingPhotoUrl),
    [newFile, existingPhotoUrl],
  );
  useEffect(() => {
    return () => {
      if (newFile && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [newFile, previewUrl]);

  const handleSave = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    setBusy(true);
    try {
      let photoPath = initial.photo_url ?? '';
      if (newFile) {
        if (!user) throw new Error('Not signed in.');
        photoPath = await uploadStudentPhoto(user.id, newFile);
      }

      const { error: rpcError } = await supabase.rpc('update_my_profile', {
        p_full_name: trimmedName,
        p_phone: phone.trim(),
        p_dob: (dob || null) as unknown as string,
        p_gender: gender || '',
        p_photo_url: photoPath,
      });
      if (rpcError) throw rpcError;

      onSaved({
        full_name: trimmedName,
        phone: phone.trim() || null,
        dob: dob || null,
        gender: gender || null,
        photo_url: photoPath || null,
        has_staff_row: initial.has_staff_row,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={busy ? () => {} : onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error ? <ErrorState message={error} /> : null}

        {/* Photo is account-level (profiles.avatar_url), so every role — director
            included — can set one. DOB/gender below stay roster-only. */}
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

        <Field label="Full name" required>
          <TextInput value={name} onChange={setName} placeholder="Full name" autoFocus />
        </Field>

        <Field label="Phone">
          <TextInput value={phone} onChange={setPhone} placeholder="Phone" type="tel" />
        </Field>

        {initial.has_staff_row ? (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Field label="Date of birth">
              <DateInput value={dob} onChange={setDob} />
            </Field>
            <Field label="Gender">
              <Select
                value={gender}
                onChange={setGender}
                options={[
                  { label: '—', value: '' },
                  { label: 'Male', value: 'male' },
                  { label: 'Female', value: 'female' },
                  { label: 'Other', value: 'other' },
                ]}
              />
            </Field>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? <Spinner size={16} /> : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
