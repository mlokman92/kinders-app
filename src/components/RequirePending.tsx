import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { Loading } from './ui';

/**
 * Gate the not-yet-recognised area (/pending, /setup) — the mirror image of RequireStaff:
 *  - still resolving       -> spinner (never decide before the role lands)
 *  - no session            -> /login
 *  - already staff         -> /  (an owner must never reach /setup: create_my_center replaces
 *                                 their classrooms, and mobile relies on the same reachability
 *                                 rule — /pending only exists while the role is null)
 *  - parent                -> /  (RequireStaff owns the "use the mobile app" notice)
 *  - role null (pending)   -> render
 */
export function RequirePending() {
  const { initializing, session, role, isStaff } = useAuth();

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loading label="Signing you in…" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (isStaff || role === 'parent') return <Navigate to="/" replace />;

  return <Outlet />;
}
