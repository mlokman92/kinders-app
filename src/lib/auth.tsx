import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabase';

export type Role = 'director' | 'teacher' | 'parent';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /**
   * The signed-in user's role, DERIVED server-side via `reconcile_my_role` (the same source of
   * truth as the mobile app). `null` means "pending" — authenticated but not yet recognized by
   * any center. The web dashboard only admits `director`/`teacher`; see `isStaff`.
   */
  role: Role | null;
  /** Convenience: the role is a director or teacher (the web app's allowed roles). */
  isStaff: boolean;
  /** True until the session has loaded AND (if present) the role has resolved. */
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
  return value === 'director' || value === 'teacher' || value === 'parent' ? value : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
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

  // Reconcile (derive + persist) the role server-side. Falls back to a plain profile read so a
  // transient RPC failure doesn't strand a valid user.
  const resolveRole = useCallback(async (theUid: string): Promise<Role | null> => {
    const { data, error } = await supabase.rpc('reconcile_my_role');
    if (error) {
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', theUid)
        .maybeSingle();
      return toRole(p?.role);
    }
    return toRole(data);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid) {
        if (active) {
          setRole(null);
          setRoleLoadedFor(null);
        }
        return;
      }
      const resolved = await resolveRole(uid);
      if (!active) return;
      setRole(resolved);
      setRoleLoadedFor(uid);
    })();
    return () => {
      active = false;
    };
  }, [uid, resolveRole]);

  const refreshRole = useCallback(async (): Promise<Role | null> => {
    if (!uid) return null;
    const resolved = await resolveRole(uid);
    setRole(resolved);
    setRoleLoadedFor(uid);
    return resolved;
  }, [uid, resolveRole]);

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
      isStaff: role === 'director' || role === 'teacher',
      initializing,
      sendCode,
      verifyCode,
      refreshRole,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, role, initializing, sendCode, verifyCode, refreshRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
