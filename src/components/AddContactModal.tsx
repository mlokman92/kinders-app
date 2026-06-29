import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { Button, ErrorState, Field, Modal, Select, Spinner, TextInput } from './ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quick "add one contact" dialog — inserts a single guardian for a student. */
export function AddContactModal({
  studentId,
  studentName,
  onClose,
  onAdded,
}: {
  studentId: number;
  studentName: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const n = name.trim();
    const e = email.trim();
    const p = phone.trim();
    if (!n && !e && !p) {
      setError('Add a name, email, or phone.');
      return;
    }
    if (e && !EMAIL_RE.test(e)) {
      setError('That email looks invalid.');
      return;
    }
    setBusy(true);
    try {
      const { error: insErr } = await supabase.from('guardians').insert({
        student_id: studentId,
        name: n || null,
        email: e || null,
        phone: p || null,
        relationship: relationship || null,
      });
      if (insErr) throw insErr;
      onAdded();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not add contact.';
      setError(
        /duplicate key|unique/i.test(msg)
          ? 'That email is already a contact for this child.'
          : msg,
      );
      setBusy(false);
    }
  };

  return (
    <Modal title={`Add contact — ${studentName}`} onClose={() => (busy ? undefined : onClose())}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? <ErrorState message={error} /> : null}
        <Field label="Name">
          <TextInput value={name} onChange={setName} placeholder="Contact name" autoFocus />
        </Field>
        <Field label="Relationship">
          <Select
            value={relationship}
            onChange={setRelationship}
            options={[
              { label: '—', value: '' },
              { label: 'Parent', value: 'parent' },
              { label: 'Guardian', value: 'guardian' },
            ]}
          />
        </Field>
        <Field label="Email">
          <TextInput value={email} onChange={setEmail} placeholder="name@email.com" type="email" />
        </Field>
        <Field label="Phone">
          <TextInput value={phone} onChange={setPhone} placeholder="Phone" type="tel" />
        </Field>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner size={16} /> : 'Add contact'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
