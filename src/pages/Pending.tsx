import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthCard } from '@/components/AuthCard';
import { Button, Modal, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Brand, Radius } from '@/lib/theme';

/**
 * Shown when an authenticated account's role can't be derived yet (role = null): the email isn't
 * on any staff roster or guardian contact, and they own no center. The web mirror of the mobile
 * `src/app/(app)/pending.tsx` fork — wait for an invite (the common case), or set up your own
 * center (the only path that makes someone a director). The role is never self-selected; it
 * resolves from data once their center adds them, which is what Refresh re-checks.
 */
export function Pending() {
  const navigate = useNavigate();
  const { user, refreshRole, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function onRefresh() {
    setNote(null);
    setBusy(true);
    const role = await refreshRole();
    setBusy(false);
    if (role) navigate('/', { replace: true });
    else setNote('We still don’t see an invitation for this email. Check with your center, then try again.');
  }

  return (
    <AuthCard>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: Brand.onSurface }}>Almost there</h1>
      <p style={{ marginTop: 10, fontSize: 14.5, color: Brand.onSurfaceVariant, lineHeight: 1.5 }}>
        We couldn’t find an invitation for{' '}
        <span style={{ fontWeight: 700, color: Brand.onSurface }}>{user?.email ?? 'your email'}</span> yet.
        Ask your center to add this email, then refresh.
      </p>

      {note ? (
        <div
          style={{
            marginTop: 12,
            background: Brand.tertiaryContainer,
            color: Brand.onTertiaryContainer,
            borderRadius: Radius.md,
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {note}
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <Button onClick={onRefresh} disabled={busy} style={{ width: '100%' }}>
          {busy ? <Spinner size={16} /> : 'Refresh'}
        </Button>
      </div>

      <div style={{ height: 1, background: Brand.outlineVariant, margin: '24px 0 18px' }} />

      <div style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurface }}>Run your own center?</div>
      <p style={{ marginTop: 4, marginBottom: 14, fontSize: 12.5, color: Brand.onSurfaceVariant, lineHeight: 1.5 }}>
        Set up your kindergarten and add classrooms to get started.
      </p>
      <Button variant="secondary" onClick={() => setConfirming(true)} style={{ width: '100%' }}>
        Set up a center
      </Button>

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      {/* Owning a center makes you its director permanently — `role_for` ranks ownership above the
          roster, so a staff member who sets one up by mistake stays a director even after their
          real center adds them. Confirm before that becomes reachable. */}
      {confirming ? (
        <Modal title="Set up your own center?" onClose={() => setConfirming(false)}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, lineHeight: 1.55 }}>
            Only do this if you run the center. If you’re expecting an invitation from a center, ask
            them to add this email instead.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={() => navigate('/setup')}>Continue</Button>
          </div>
        </Modal>
      ) : null}
    </AuthCard>
  );
}
