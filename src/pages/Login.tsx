import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AppStoreBadge, GooglePlayBadge } from '@/components/StoreBadges';
import { Button, Spinner, TextInput } from '@/components/ui';
import logo from '@/assets/kinders_logo_transparent.png';
import { useAuth } from '@/lib/auth';
import { Brand, Radius } from '@/lib/theme';

export function Login() {
  const { session, initializing, isStaff, sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in as staff -> straight to the dashboard.
  if (!initializing && session && isStaff) return <Navigate to="/" replace />;

  async function handleSendCode() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) setError(error);
    else setStep('code');
  }

  async function handleVerify() {
    setError(null);
    if (code.trim().length < 6) {
      setError('Enter the code from your email.');
      return;
    }
    setBusy(true);
    const { error } = await verifyCode(email, code);
    setBusy(false);
    // On success, AuthProvider updates the session/role and RequireStaff/redirect takes over.
    if (error) setError(error);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: `radial-gradient(1200px 600px at 50% -10%, ${Brand.primaryContainer}, ${Brand.background})`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: Brand.white,
          border: `1px solid ${Brand.outlineVariant}`,
          borderRadius: Radius.xl,
          padding: 32,
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <img src={logo} alt="Kinders" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: Brand.onSurface }}>Kinders</div>
            <div style={{ fontSize: 13, color: Brand.onSurfaceVariant }}>Director & teacher portal</div>
          </div>
        </div>

        {step === 'email' ? (
          <>
            <label style={{ fontSize: 13, fontWeight: 600, color: Brand.onSurfaceVariant }}>
              Work email
            </label>
            <div style={{ marginTop: 6 }}>
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder="you@center.com"
                type="email"
                autoFocus
              />
            </div>
            <p style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 8, lineHeight: 1.5 }}>
              We’ll email you a sign-in code. No password needed.
            </p>
            {error ? <ErrorLine text={error} /> : null}
            <div style={{ marginTop: 18 }}>
              <Button onClick={handleSendCode} disabled={busy} style={{ width: '100%' }}>
                {busy ? <Spinner size={16} /> : 'Continue'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <label style={{ fontSize: 13, fontWeight: 600, color: Brand.onSurfaceVariant }}>
              Enter the code sent to {email}
            </label>
            <div style={{ marginTop: 6 }}>
              <TextInput
                value={code}
                onChange={(v) => setCode(v.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                autoFocus
                style={{ letterSpacing: 6, fontSize: 18, textAlign: 'center', fontWeight: 700 }}
              />
            </div>
            {error ? <ErrorLine text={error} /> : null}
            <div style={{ marginTop: 18 }}>
              <Button onClick={handleVerify} disabled={busy} style={{ width: '100%' }}>
                {busy ? <Spinner size={16} /> : 'Verify & sign in'}
              </Button>
            </div>
            <button
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              style={{
                marginTop: 14,
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: Brand.onSurfaceVariant,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ← Use a different email
            </button>
          </>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 18px' }}>
          <div style={{ flex: 1, height: 1, background: Brand.outlineVariant }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: Brand.onSurfaceVariant }}>or</span>
          <div style={{ flex: 1, height: 1, background: Brand.outlineVariant }} />
        </div>

        {/* Get the app */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurface }}>Get the mobile app</div>
          <div
            style={{
              fontSize: 12.5,
              color: Brand.onSurfaceVariant,
              marginTop: 4,
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            Create your center or sign in on the go.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            <AppStoreBadge height={46} />
            <GooglePlayBadge height={46} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        background: Brand.errorContainer,
        color: Brand.onErrorContainer,
        borderRadius: Radius.md,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
