import { setReadOnly } from './readonly-guard';
import { supabase } from './supabase';

/**
 * "View as" impersonation client. Swaps the current session for a target user's
 * (minted by the `impersonate` Edge Function) so the app runs — and RLS scopes —
 * exactly as that user. The director's own session is stashed so we can restore
 * it on exit. Read-only is enforced by the readonly-guard while active.
 */

const STASH_KEY = 'kinders.impersonation';

export type ImpersonationTarget = {
  id: string;
  email: string;
  role: string | null;
  name: string;
};

type Stash = {
  director: { access_token: string; refresh_token: string };
  target: ImpersonationTarget;
  mode: 'read_only';
};

export function getImpersonation(): Stash | null {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    return raw ? (JSON.parse(raw) as Stash) : null;
  } catch {
    return null;
  }
}

export function isImpersonating(): boolean {
  return getImpersonation() !== null;
}

/** Sync the read-only guard flag with the persisted stash (call on app load). */
export function syncReadOnlyFromStash(): boolean {
  const active = getImpersonation() !== null;
  setReadOnly(active);
  return active;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } };
  try {
    const body = await err.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    /* fall through to the generic message */
  }
  return err.message ?? 'Could not start “View as”.';
}

/** Begin viewing the app as `email`. Returns the resolved target on success. */
export async function startImpersonation(email: string): Promise<ImpersonationTarget> {
  if (getImpersonation()) throw new Error('Already viewing as another user — exit first.');

  const { data: sessionData } = await supabase.auth.getSession();
  const mine = sessionData.session;
  if (!mine) throw new Error('Not signed in.');

  const { data, error } = await supabase.functions.invoke('impersonate', { body: { email } });
  if (error) throw new Error(await functionErrorMessage(error));

  const { access_token, refresh_token, target } = data as {
    access_token: string;
    refresh_token: string;
    target: ImpersonationTarget;
  };

  // Stash the director's tokens BEFORE swapping (setSession overwrites the shared
  // storage key), then flip on the read-only guard, then become the target.
  const stash: Stash = {
    director: { access_token: mine.access_token, refresh_token: mine.refresh_token },
    target,
    mode: 'read_only',
  };
  localStorage.setItem(STASH_KEY, JSON.stringify(stash));
  setReadOnly(true);

  const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
  if (setErr) {
    localStorage.removeItem(STASH_KEY);
    setReadOnly(false);
    throw setErr;
  }
  return target;
}

/** Restore the director's session and leave read-only mode. */
export async function stopImpersonation(): Promise<void> {
  const stash = getImpersonation();
  localStorage.removeItem(STASH_KEY);
  setReadOnly(false);
  if (!stash) return;

  const { error } = await supabase.auth.setSession(stash.director);
  if (error) {
    // The stashed director token was rotated/expired elsewhere — fall back to login.
    await supabase.auth.signOut({ scope: 'local' });
    window.location.assign('/login');
  }
}
