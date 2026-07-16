import { Navigate } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { Brand, Radius } from '@/lib/theme';
import { Button, Loading } from './ui';

/**
 * Gate the authenticated area, and act as the single routing authority for a signed-in user —
 * the web analogue of mobile's `src/app/index.tsx`. The web dashboard is staff-only:
 *  - no session                  -> /login
 *  - session, role pending       -> /pending (wait for an invite, or set up a center)
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

  // Not recognised by any center yet — /pending offers the two real choices in context.
  if (role === null) return <Navigate to="/pending" replace />;

  if (!isStaff) {
    return (
      <Notice
        title="Use the Kinders mobile app"
        message="The web dashboard is for center staff. Parents can view journals and message staff from the Kinders app on your phone."
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
