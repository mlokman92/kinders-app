import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';
import { Avatar } from './ui';

type NavItem = { to: string; label: string; icon: string; directorOnly?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/reports', label: 'Reports', icon: '📈' },
  { to: '/students', label: 'Students', icon: '🧒' },
  { to: '/classrooms', label: 'Classrooms', icon: '🏫' },
  { to: '/activities', label: 'Activities', icon: '🎨' },
  { to: '/plans', label: 'Lesson plans', icon: '🗓️' },
  { to: '/teachers', label: 'Teachers', icon: '👩‍🏫', directorOnly: true },
];

export function Layout() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [centerName, setCenterName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('centers')
      .select('name')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setCenterName(data?.name ?? null);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = NAV.filter((n) => !n.directorOnly || role === 'director');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: Brand.background }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-w)',
          flexShrink: 0,
          background: Brand.white,
          borderRight: `1px solid ${Brand.outlineVariant}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ padding: '22px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: Radius.md,
                background: Brand.primary,
                color: Brand.onPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              K
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: Brand.onSurface }}>Kinders</div>
          </div>
          {centerName ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                fontWeight: 600,
                color: Brand.onSurfaceVariant,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {centerName}
            </div>
          ) : null}
        </div>

        <nav style={{ flex: 1, padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: Radius.md,
                fontSize: 14.5,
                fontWeight: 600,
                color: isActive ? Brand.onPrimaryContainer : Brand.onSurfaceVariant,
                background: isActive ? Brand.primaryContainer : 'transparent',
              })}
            >
              <span style={{ fontSize: 17 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: 12, borderTop: `1px solid ${Brand.outlineVariant}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px' }}>
            <Avatar name={user?.email ?? '?'} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: Brand.onSurface,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.email}
              </div>
              <div style={{ fontSize: 12, color: Brand.onSurfaceVariant, textTransform: 'capitalize' }}>
                {role}
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
            style={{
              marginTop: 6,
              width: '100%',
              border: `1px solid ${Brand.outlineVariant}`,
              background: 'transparent',
              borderRadius: Radius.md,
              padding: '9px 12px',
              fontSize: 13.5,
              fontWeight: 600,
              color: Brand.onSurfaceVariant,
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 36px 64px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
