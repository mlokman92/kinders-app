import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { wrapReadOnly } from './readonly-guard';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web-app/.env, then restart the dev server.',
  );
}

// Same Supabase project + RLS as the mobile app. On the web, the session persists in
// localStorage. We sign in with an email OTP *code* (verifyOtp), not a magic-link URL, so
// detectSessionInUrl stays off.
// The client is wrapped in a read-only guard so that while a director is "viewing as"
// another user, every write is blocked (see readonly-guard.ts). Auth + functions +
// reads pass through untouched, so session swap/restore and normal use are unaffected.
export const supabase = wrapReadOnly(
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }),
);
