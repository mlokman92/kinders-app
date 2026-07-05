import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Capability } from './permissions';
import { supabase } from './supabase';

export type Role = 'director' | 'admin' | 'teacher' | 'parent';

type Perms = Record<string, boolean>;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /**
   * The signed-in user's role, DERIVED server-side via `reconcile_my_role` (the same source of
   * truth as the mobile app). `null` means "pending" — authenticated but not yet recognized by
   * any center. The web dashboard admits `director`/`admin`/`teacher`; see `isStaff`.
   */
  role: Role | null;
  /** Convenience: the role is a director, admin, or teacher (the web app's allowed roles). */
  isStaff: boolean;
  /** The signed-in user owns the center (director). Owner-only UI hangs off this. */
  isOwner: boolean;
  /**
   * Effective capability check, resolved server-side by `my_permissions` (matrix row for the
   * user's role at their center, else the role default; owner is always true). RLS enforces the
   * same rules — this only drives UI.
   */
  can: (capability: Capability) => boolean;
  /** True until the session has loaded AND (if present) role + permissions have resolved. */
  initializing: boolean;
  /** Request an email OTP code (creates the auth user if needed; role is derived, not chosen). */
  sendCode: (email: string) => Promise<{ error: string | null }>;
  /** Verify the 6–10 digit email OTP code; resolves the role on success. */
  verifyCode: (email: string, token: string) => Promise<{ error: string | null }>;
  refreshRole: () => Promise<Role | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toRole(value: unknown): Role | null {
  return value === 'director' || value === 'admin' || value === 'teacher' || value === 'parent'
    ? value
    : null;
}

async function fetchPerms(): Promise<Perms> {
  const { data, error } = await supabase.rpc('my_permissions');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data as Perms;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [perms, setPerms] = useState<Perms>({});
  const [roleLoadedFor, setRoleLoadedFor] = useState<string | null>(null);

  const uid = session?.user?.id ?? null;

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setSessionLoaded(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Reconcile (derive + persist) the role server-side, then load the effective capability set.
  // Falls back to a plain profile read so a transient RPC failure doesn't strand a valid user.
  const resolveAccess = useCallback(async (theUid: string): Promise<{ role: Role | null; perms: Perms }> => {
    let resolved: Role | null;
    const { data, error } = await supabase.rpc('reconcile_my_role');
    if (error) {
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', theUid)
        .maybeSingle();
      resolved = toRole(p?.role);
    } else {
      resolved = toRole(data);
    }
    const isStaffRole = resolved === 'director' || resolved === 'admin' || resolved === 'teacher';
    return { role: resolved, perms: isStaffRole ? await fetchPerms() : {} };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid) {
        if (active) {
          setRole(null);
          setPerms({});
          setRoleLoadedFor(null);
        }
        return;
      }
      const resolved = await resolveAccess(uid);
      if (!active) return;
      setRole(resolved.role);
      setPerms(resolved.perms);
      setRoleLoadedFor(uid);
    })();
    return () => {
      active = false;
    };
  }, [uid, resolveAccess]);

  const refreshRole = useCallback(async (): Promise<Role | null> => {
    if (!uid) return null;
    const resolved = await resolveAccess(uid);
    setRole(resolved.role);
    setPerms(resolved.perms);
    setRoleLoadedFor(uid);
    return resolved.role;
  }, [uid, resolveAccess]);

  const sendCode = useCallback(async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    return { error: error?.message ?? null };
  }, []);

  const verifyCode = useCallback(
    async (email: string, token: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const initializing = !sessionLoaded || (uid !== null && roleLoadedFor !== uid);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      isStaff: role === 'director' || role === 'admin' || role === 'teacher',
      isOwner: role === 'director' || perms.is_owner === true,
      can: (capability: Capability) => (role === 'director' ? true : perms[capability] === true),
      initializing,
      sendCode,
      verifyCode,
      refreshRole,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, role, perms, initializing, sendCode, verifyCode, refreshRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
