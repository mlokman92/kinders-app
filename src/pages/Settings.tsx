import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Spinner,
  Textarea,
  TextInput,
  Toggle,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fileToLogoDataUrl } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type CenterRow = {
  id: number;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  enrollment_required_fields: string[] | null;
};

// The enrollment-form fields a center can require. Child name, parent name, and phone are
// always required (locked); the rest are togglable. Keys mirror the DB config + public form.
const ENROLL_FIELDS: { key: string; label: string; locked?: boolean }[] = [
  { key: 'child_name', label: "Child's name", locked: true },
  { key: 'child_nric', label: "Child's NRIC" },
  { key: 'child_dob', label: 'Date of birth' },
  { key: 'child_gender', label: 'Gender' },
  { key: 'parent_name', label: 'Parent / guardian name', locked: true },
  { key: 'parent_email', label: 'Email' },
  { key: 'parent_phone', label: 'Phone', locked: true },
  { key: 'note', label: 'Notes' },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function Settings() {
  const { isOwner, user } = useAuth();

  const [centerId, setCenterId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await supabase
          .from('centers')
          .select(
            'id, name, slug, logo_url, description, website, instagram, facebook, whatsapp, enrollment_required_fields',
          )
          .eq('owner_id', user?.id ?? '')
          .order('id')
          .limit(1)
          .maybeSingle();
        if (!active) return;
        if (res.error) throw res.error;
        const c = (res.data ?? null) as CenterRow | null;
        if (c) {
          setCenterId(c.id);
          setName(c.name ?? '');
          setSlug(c.slug ?? '');
          setLogoUrl(c.logo_url);
          setDescription(c.description ?? '');
          setWebsite(c.website ?? '');
          setInstagram(c.instagram ?? '');
          setFacebook(c.facebook ?? '');
          setWhatsapp(c.whatsapp ?? '');
          setRequiredFields(
            Array.isArray(c.enrollment_required_fields) ? c.enrollment_required_fields : [],
          );
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load settings.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const previewLogo = useMemo(
    () => (newLogo ? URL.createObjectURL(newLogo) : logoUrl),
    [newLogo, logoUrl],
  );
  useEffect(() => {
    return () => {
      if (newLogo && previewLogo) URL.revokeObjectURL(previewLogo);
    };
  }, [newLogo, previewLogo]);

  const publicUrl = `${window.location.origin}/enroll/${slugify(slug) || 'your-center'}`;

  const toggleRequired = (key: string) =>
    setRequiredFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const save = async () => {
    if (centerId == null) return;
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError('Center name is required.');
      return;
    }
    if (!slugify(slug)) {
      setError('A web address (slug) is required.');
      return;
    }
    setBusy(true);
    try {
      let finalLogo = logoUrl;
      if (newLogo) {
        // Resize + inline as a data-URI; saved via the authenticated RPC below.
        finalLogo = await fileToLogoDataUrl(newLogo);
      }
      const { error: rpcError } = await supabase.rpc('update_center_settings', {
        p_center_id: centerId,
        p_name: name.trim(),
        p_slug: slug,
        p_logo_url: finalLogo ?? '',
        p_description: description,
        p_website: website,
        p_instagram: instagram,
        p_facebook: facebook,
        p_whatsapp: whatsapp,
        p_enrollment_required_fields: requiredFields,
      });
      if (rpcError) throw rpcError;
      setLogoUrl(finalLogo);
      setSlug(slugify(slug));
      setNewLogo(null);
      if (fileRef.current) fileRef.current.value = '';
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader title="Center settings" subtitle="Your public profile and enrollment page." />

      {loading ? (
        <Loading />
      ) : error && centerId == null ? (
        <ErrorState message={error} />
      ) : (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error ? <ErrorState message={error} /> : null}
          {saved ? (
            <Card style={{ borderColor: Brand.success, background: Brand.successContainer }}>
              <span style={{ fontWeight: 700, color: Brand.onSuccessContainer }}>Settings saved.</span>
            </Card>
          ) : null}

          {/* Public profile */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>Public profile</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {previewLogo ? (
                <img
                  src={previewLogo}
                  alt="Logo"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: Radius.md,
                    objectFit: 'cover',
                    background: Brand.surfaceContainerHigh,
                  }}
                />
              ) : (
                <Avatar name={name || '·'} size={64} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => setNewLogo(e.target.files?.[0] ?? null)}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  {previewLogo ? 'Change logo' : 'Add logo'}
                </Button>
              </div>
            </div>

            <Field label="Center name">
              <TextInput value={name} onChange={setName} placeholder="Your center's name" />
            </Field>

            <Field label="Web address (slug)">
              <TextInput value={slug} onChange={setSlug} placeholder="your-center" />
            </Field>
            <div style={{ marginTop: -8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: Brand.onSurfaceVariant }}>Enrollment page</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: Brand.primaryContainer,
                    color: Brand.onPrimaryContainer,
                    fontWeight: 700,
                    fontSize: 13.5,
                    padding: '9px 14px',
                    borderRadius: Radius.full,
                    textDecoration: 'none',
                    wordBreak: 'break-all',
                  }}
                >
                  <span aria-hidden>🔗</span>
                  <span>{publicUrl}</span>
                  <span aria-hidden style={{ opacity: 0.6 }}>
                    ↗
                  </span>
                </a>
                <Button variant="secondary" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <Field label="Short description">
              <Textarea
                value={description}
                onChange={setDescription}
                placeholder="A short, friendly description shown on your enrollment page."
              />
            </Field>
          </Card>

          {/* Social links */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>Social links</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Website">
                <TextInput value={website} onChange={setWebsite} placeholder="https://…" />
              </Field>
              <Field label="WhatsApp number">
                <TextInput value={whatsapp} onChange={setWhatsapp} placeholder="60123456789" type="tel" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Instagram">
                <TextInput value={instagram} onChange={setInstagram} placeholder="handle or URL" />
              </Field>
              <Field label="Facebook">
                <TextInput value={facebook} onChange={setFacebook} placeholder="handle or URL" />
              </Field>
            </div>
          </Card>

          {/* Enrollment form — which fields families must fill in */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface }}>Enrollment form</div>
            <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: -6 }}>
              Choose which fields families must fill in.
            </div>
            {ENROLL_FIELDS.map((f) => {
              const on = requiredFields.includes(f.key);
              return (
                <div
                  key={f.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 14, color: Brand.onSurface }}>{f.label}</span>
                  {f.locked ? (
                    <Badge tone="primary">Always required</Badge>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: on ? Brand.onSurface : Brand.onSurfaceVariant,
                          minWidth: 52,
                          textAlign: 'right',
                        }}
                      >
                        {on ? 'Required' : 'Optional'}
                      </span>
                      <Toggle
                        checked={on}
                        onChange={() => toggleRequired(f.key)}
                        label={`${f.label} required`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={save} disabled={busy || centerId == null}>
              {busy ? <Spinner size={16} /> : 'Save settings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
