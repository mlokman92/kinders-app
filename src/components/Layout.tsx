import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import logo from '@/assets/kinders-logo.png';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import type { Capability } from '@/lib/permissions';
import { getStudentPhotoUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';
import { EditProfileModal, type MyProfile } from './EditProfileModal';
import { useImpersonation } from './Impersonation';
import { Avatar } from './ui';

type Access = { can: (c: Capability) => boolean; isOwner: boolean };
type NavItem = { to: string; label: string; icon: string; visible?: (a: Access) => boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/reports', label: 'Reports', icon: '📈', visible: (a) => a.can('view_reports') },
  { to: '/students', label: 'Students', icon: '🧒' },
  { to: '/contacts', label: 'Contacts', icon: '📇' },
  { to: '/classrooms', label: 'Classrooms', icon: '🏫' },
  { to: '/activities', label: 'Activities', icon: '🎨' },
  { to: '/plans', label: 'Lesson plans', icon: '🗓️' },
  { to: '/announcements', label: 'Announcements', icon: '📣', visible: (a) => a.can('send_broadcast') },
  { to: '/assessments', label: 'Assessments', icon: '📝' },
  { to: '/attendance', label: 'Attendance', icon: '🕒', visible: (a) => a.can('view_attendance') },
  { to: '/enrollments', label: 'Enrollments', icon: '📥', visible: (a) => a.can('manage_enrollment_applications') },
  { to: '/staff', label: 'Staff', icon: '👩‍🏫', visible: (a) => a.can('manage_staff') },
  { to: '/branches', label: 'Branches', icon: '🏢', visible: (a) => a.isOwner },
  { to: '/levels', label: 'Levels', icon: '🎯', visible: (a) => a.isOwner },
  { to: '/roles', label: 'Roles', icon: '🧑‍💼', visible: (a) => a.isOwner },
  { to: '/access', label: 'Access', icon: '🔑', visible: (a) => a.isOwner },
  { to: '/settings', label: 'Settings', icon: '⚙️', visible: (a) => a.isOwner },
];

export function Layout() {
  const { user, role, can, isOwner, signOut } = useAuth();
  const { branches, branchId, setBranchId } = useBranch();
  const navigate = useNavigate();
  const { active: impersonating, openPicker } = useImpersonation();
  const [centerName, setCenterName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

  // Load the caller's own profile (name/photo) for the footer + Edit-profile modal.
  useEffect(() => {
    let active = true;
    supabase.rpc('my_profile').then(({ data, error }) => {
      if (active && !error && data) setProfile(data as unknown as MyProfile);
    });
    return () => {
      active = false;
    };
  }, []);

  // Resolve a signed URL for the footer avatar whenever the stored photo changes.
  useEffect(() => {
    let active = true;
    const path = profile?.photo_url;
    const pending = path ? getStudentPhotoUrl(path) : Promise.resolve(null);
    pending.then((url) => {
      if (active) setAvatarUrl(url);
    });
    return () => {
      active = false;
    };
  }, [profile?.photo_url]);

  const items = NAV.filter((n) => !n.visible || n.visible({ can, isOwner }));
  const displayName = profile?.full_name?.trim() || user?.email || '?';

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
        <div style={{ flexShrink: 0, padding: '22px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logo}
              alt="Kinders"
              style={{ width: 34, height: 34, objectFit: 'contain' }}
            />
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
          {branches.length > 1 ? (
            <select
              value={branchId === null ? 'all' : String(branchId)}
              onChange={(e) => setBranchId(e.target.value === 'all' ? null : Number(e.target.value))}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '7px 10px',
                borderRadius: Radius.md,
                border: `1px solid ${Brand.outlineVariant}`,
                background: Brand.white,
                fontSize: 13,
                fontWeight: 600,
                color: Brand.onSurface,
              }}
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <nav
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '4px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
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

        {/* User footer — locked; click to reveal sign out */}
        <div
          ref={footerRef}
          style={{ position: 'relative', flexShrink: 0, padding: 12, borderTop: `1px solid ${Brand.outlineVariant}` }}
        >
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 8px',
              border: 'none',
              background: menuOpen ? Brand.surfaceContainer : 'transparent',
              borderRadius: Radius.md,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Avatar name={displayName} size={34} src={avatarUrl} />
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
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: Brand.onSurfaceVariant, textTransform: 'capitalize' }}>
                {role}
              </div>
            </div>
            <span style={{ fontSize: 12, color: Brand.onSurfaceVariant }}>⋯</span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 'calc(100% - 4px)',
                background: Brand.white,
                border: `1px solid ${Brand.outlineVariant}`,
                borderRadius: Radius.md,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: 6,
                zIndex: 10,
              }}
            >
              {!impersonating ? (
                <button
                  role="menuitem"
                  disabled={!profile}
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    background: 'transparent',
                    borderRadius: Radius.sm,
                    padding: '9px 10px',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: Brand.onSurface,
                    cursor: profile ? 'pointer' : 'default',
                    opacity: profile ? 1 : 0.5,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15 }}>👤</span> Edit profile
                </button>
              ) : null}
              {isOwner && !impersonating ? (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    openPicker();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    background: 'transparent',
                    borderRadius: Radius.sm,
                    padding: '9px 10px',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: Brand.onSurface,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15 }}>👁</span> View as…
                </button>
              ) : null}
              <button
                role="menuitem"
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                  navigate('/login', { replace: true });
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: Radius.sm,
                  padding: '9px 10px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: Brand.error,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15 }}>↩</span> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {editOpen && profile ? (
        <EditProfileModal
          initial={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => setProfile(next)}
        />
      ) : null}

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 36px 64px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
