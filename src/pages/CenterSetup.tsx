import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthCard, ErrorLine } from '@/components/AuthCard';
import { Button, Field, Spinner, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

/**
 * Center setup — the self-serve director commit, ported from mobile
 * `src/app/(auth)/sign-up/classrooms.tsx`. Reached from /pending after the user has already
 * signed in, and gated by RequirePending so only a role-less account can open it. Collects the
 * director's name + phone and the center name; classrooms are OPTIONAL (they can be added later
 * from /classrooms). Creates everything atomically via create_my_center. On success the role
 * re-derives to 'director' and RequireStaff routes home.
 */

export function CenterSetup() {
  const navigate = useNavigate();
  const { refreshRole } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [centerName, setCenterName] = useState('');
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const setAt = (index: number, value: string) => {
    clearError('classrooms');
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  async function onFinish() {
    setSubmitError(null);

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Please enter your name.';
    // Required here only — create_my_center leaves p_phone optional so the shipped App Store build,
    // which doesn't send it, can still create a center.
    if (!phone.trim()) next.phone = 'Please enter your phone number.';
    if (!centerName.trim()) next.centerName = 'Please enter your center name.';

    // Trim, drop blanks, de-duplicate case-insensitively (preserve first-seen order).
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const raw of names) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(trimmed);
      }
    }
    // Classrooms are optional — no minimum, and an empty array is fine (they can add rooms later
    // from /classrooms). Duplicates still block: create_my_center drops them silently (first-seen
    // wins), so without this the director would quietly get fewer rooms than they typed.
    if (unique.length < names.filter((n) => n.trim()).length) {
      next.classrooms = 'Classroom names must be unique.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const { error } = await supabase.rpc('create_my_center', {
      p_center_name: centerName.trim(),
      p_classroom_names: unique,
      p_full_name: name.trim(),
      p_phone: phone.trim(),
    });

    if (error) {
      setBusy(false);
      setSubmitError(error.message);
      return;
    }

    // Owning a center re-derives the role to 'director'; let RequireStaff route to the dashboard.
    // Don't navigate on a null role: create_my_center doesn't write profiles.role (reconcile does),
    // so a failed re-derive reads back the stale 'pending' and would bounce this brand-new director
    // to /pending — telling them we can't find their invitation right after they made their center.
    const role = await refreshRole();
    setBusy(false);
    if (role) navigate('/', { replace: true });
    else setSubmitError('Your center was created, but we couldn’t load it. Please refresh.');
  }

  return (
    <AuthCard width={520}>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: Brand.onSurface }}>Set up your center</h1>
      <p style={{ marginTop: 8, marginBottom: 20, fontSize: 14, color: Brand.onSurfaceVariant }}>
        Add your details — classrooms are optional.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Your name" required>
          <TextInput
            value={name}
            onChange={(v) => {
              setName(v);
              clearError('name');
            }}
            placeholder="Your full name"
            autoFocus
          />
        </Field>
        {errors.name ? <ErrorLine text={errors.name} /> : null}

        {/* Required, digits only, but no format check. Deliberately type="text" + inputMode=
            "numeric": type="number" would drop a leading 0 and accept e/+/-. profiles.phone is text. */}
        <Field label="Mobile phone" required>
          <TextInput
            value={phone}
            onChange={(v) => {
              setPhone(v.replace(/\D/g, ''));
              clearError('phone');
            }}
            placeholder="e.g. 0123456789"
            inputMode="numeric"
          />
        </Field>
        {errors.phone ? <ErrorLine text={errors.phone} /> : null}

        <Field label="Center name" required>
          <TextInput
            value={centerName}
            onChange={(v) => {
              setCenterName(v);
              clearError('centerName');
            }}
            placeholder="Your kindergarten / center"
          />
        </Field>
        {errors.centerName ? <ErrorLine text={errors.centerName} /> : null}

        <div style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant, marginTop: 6 }}>
          Classrooms
        </div>
        {names.map((value, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <TextInput
                value={value}
                onChange={(text) => setAt(index, text)}
                placeholder={`Enter Classroom ${index + 1} Name`}
              />
            </div>
            {names.length > 1 ? (
              <button
                type="button"
                aria-label={`Remove classroom ${index + 1}`}
                onClick={() => setNames((prev) => prev.filter((_, i) => i !== index))}
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  border: 'none',
                  borderRadius: Radius.full,
                  background: Brand.surfaceContainerHigh,
                  color: Brand.onSurfaceVariant,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setNames((prev) => [...prev, ''])}
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: 'none',
            padding: '8px 4px',
            color: Brand.primary,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ＋ Add more
        </button>

        {errors.classrooms ? <ErrorLine text={errors.classrooms} /> : null}
        {submitError ? <ErrorLine text={submitError} /> : null}

        <Button onClick={onFinish} disabled={busy} style={{ width: '100%', marginTop: 4 }}>
          {busy ? <Spinner size={16} /> : 'Get Started'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/pending')} style={{ width: '100%' }}>
          Back
        </Button>
      </div>
    </AuthCard>
  );
}
