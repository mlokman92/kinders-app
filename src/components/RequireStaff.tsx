import { Navigate } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { Brand, Radius } from '@/lib/theme';
import { Button, Loading } from './ui';

/**
 * Gate the authenticated area. The web dashboard is staff-only:
 *  - no session                  -> /login
 *  - session, role pending       -> "ask your center" notice
 *  - session, role parent        -> "use the mobile app" notice
 *  - director / admin / teacher  -> render children
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { initializing, session, role, isStaff, signOut } = useAuth();

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loading label="Signing you in…" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!isStaff) {
    const parent = role === 'parent';
    return (
      <Notice
        title={parent ? 'Use the Kinders mobile app' : 'Your account isn’t set up yet'}
        message={
          parent
            ? 'The web dashboard is for center staff. Parents can view journals and message staff from the Kinders app on your phone.'
            : 'This email isn’t recognised by any center yet. Ask your center director to add you as staff, then sign in again.'
        }
        onSignOut={signOut}
      />
    );
  }

  return <>{children}</>;
}

function Notice({
  title,
  message,
  onSignOut,
}: {
  title: string;
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div
        style={{
          maxWidth: 440,
          textAlign: 'center',
          background: Brand.white,
          border: `1px solid ${Brand.outlineVariant}`,
          borderRadius: Radius.xl,
          padding: 32,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: Brand.onSurface }}>{title}</h1>
        <p style={{ marginTop: 10, fontSize: 14.5, color: Brand.onSurfaceVariant, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ marginTop: 22 }}>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
