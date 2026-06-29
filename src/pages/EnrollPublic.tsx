import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  Button,
  DateInput,
  ErrorState,
  Field,
  Loading,
  Select,
  Spinner,
  Textarea,
  TextInput,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type PublicCenter = {
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function socialLinks(c: PublicCenter): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  const httpify = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
  if (c.website) links.push({ label: 'Website', href: httpify(c.website) });
  if (c.instagram)
    links.push({
      label: 'Instagram',
      href: /^https?:\/\//i.test(c.instagram)
        ? c.instagram
        : `https://instagram.com/${c.instagram.replace(/^@/, '')}`,
    });
  if (c.facebook)
    links.push({
      label: 'Facebook',
      href: /^https?:\/\//i.test(c.facebook) ? c.facebook : `https://facebook.com/${c.facebook}`,
    });
  if (c.whatsapp)
    links.push({ label: 'WhatsApp', href: `https://wa.me/${c.whatsapp.replace(/[^0-9]/g, '')}` });
  return links;
}

export function EnrollPublic() {
  const { slug } = useParams();

  const [center, setCenter] = useState<PublicCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childGender, setChildGender] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState(''); // bots fill this; humans never see it

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_center_public', {
          p_slug: slug ?? '',
        });
        if (!active) return;
        const c = (data ?? null) as unknown as PublicCenter | null;
        if (rpcErr || !c) setNotFound(true);
        else setCenter(c);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const submit = async () => {
    setError(null);
    if (honeypot.trim()) {
      setSubmitted(true); // silently drop bot submissions
      return;
    }
    if (!childName.trim()) {
      setError("Please enter the child's name.");
      return;
    }
    if (parentEmail.trim() && !EMAIL_RE.test(parentEmail.trim())) {
      setError('Please enter a valid email, or leave it blank.');
      return;
    }
    setBusy(true);
    try {
      const { error: rpcErr } = await supabase.rpc('submit_enrollment_application', {
        p_slug: slug ?? '',
        p_child_name: childName.trim(),
        p_child_dob: (childDob || null) as unknown as string,
        p_child_gender: childGender,
        p_parent_name: parentName,
        p_parent_email: parentEmail,
        p_parent_phone: parentPhone,
        p_note: note,
      });
      if (rpcErr) throw rpcErr;
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(1200px 600px at 50% -10%, ${Brand.primaryContainer}, ${Brand.background})`,
        padding: '40px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </div>
  );

  if (loading) return shell(<Loading label="Loading…" />);

  if (notFound || !center) {
    return shell(
      <div
        style={{
          background: Brand.white,
          border: `1px solid ${Brand.outlineVariant}`,
          borderRadius: Radius.xl,
          padding: 32,
          textAlign: 'center',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: Brand.onSurface }}>Center not found</h1>
        <p style={{ marginTop: 10, fontSize: 14.5, color: Brand.onSurfaceVariant }}>
          Please check the link from your center.
        </p>
      </div>,
    );
  }

  const links = socialLinks(center);

  return shell(
    <>
      {/* Center header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        {center.logo_url ? (
          <img
            src={center.logo_url}
            alt={center.name}
            style={{
              width: 72,
              height: 72,
              borderRadius: Radius.lg,
              objectFit: 'cover',
              boxShadow: 'var(--shadow-card)',
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: Radius.lg,
              background: Brand.primary,
              color: Brand.onPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 30,
            }}
          >
            {center.name.trim().charAt(0).toUpperCase() || 'K'}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: Brand.onSurface, marginTop: 12 }}>
          {center.name}
        </h1>
        {center.description ? (
          <p
            style={{
              marginTop: 8,
              fontSize: 14.5,
              color: Brand.onSurfaceVariant,
              lineHeight: 1.55,
            }}
          >
            {center.description}
          </p>
        ) : null}
        {links.length > 0 ? (
          <div
            style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}
          >
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: Brand.onPrimaryContainer,
                  background: Brand.primaryContainer,
                  borderRadius: Radius.full,
                  padding: '5px 12px',
                  textDecoration: 'none',
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {/* Application form / thank-you */}
      <div
        style={{
          background: Brand.white,
          border: `1px solid ${Brand.outlineVariant}`,
          borderRadius: Radius.xl,
          padding: 28,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: Brand.onSurface }}>
              Application received
            </h2>
            <p style={{ marginTop: 10, fontSize: 14.5, color: Brand.onSurfaceVariant, lineHeight: 1.5 }}>
              Thank you! {center.name} will review your application and get in touch soon.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: Brand.onSurface, margin: 0 }}>
              Enroll your child
            </h2>
            {error ? <ErrorState message={error} /> : null}

            <Field label="Child's full name">
              <TextInput value={childName} onChange={setChildName} placeholder="Child's name" />
            </Field>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Date of birth">
                <DateInput value={childDob} onChange={setChildDob} />
              </Field>
              <Field label="Gender">
                <Select
                  value={childGender}
                  onChange={setChildGender}
                  options={[
                    { label: '—', value: '' },
                    { label: 'Male', value: 'male' },
                    { label: 'Female', value: 'female' },
                    { label: 'Other', value: 'other' },
                  ]}
                />
              </Field>
            </div>

            <Field label="Your name (parent / guardian)">
              <TextInput value={parentName} onChange={setParentName} placeholder="Your name" />
            </Field>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Email">
                <TextInput value={parentEmail} onChange={setParentEmail} placeholder="you@email.com" type="email" />
              </Field>
              <Field label="Phone">
                <TextInput value={parentPhone} onChange={setParentPhone} placeholder="Phone" type="tel" />
              </Field>
            </div>

            <Field label="Anything we should know? (optional)">
              <Textarea value={note} onChange={setNote} placeholder="Preferred start date, questions, etc." />
            </Field>

            {/* Honeypot: hidden from humans, catches bots */}
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <Button onClick={submit} disabled={busy} style={{ width: '100%' }}>
              {busy ? <Spinner size={16} /> : 'Submit application'}
            </Button>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: Brand.onSurfaceVariant }}>
        Powered by Kinders
      </div>
    </>,
  );
}
