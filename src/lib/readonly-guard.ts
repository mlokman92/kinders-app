import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client-enforced read-only guard for "View as" impersonation. When active, any
 * table mutation (insert/update/delete/upsert), mutating RPC, or storage write
 * throws — so a director inspecting the app as another user can look but not
 * change anything. This is a client guardrail (the swapped session is a real
 * login); pair it with the server-side audit for defense in depth.
 */

let readOnly = false;
export function setReadOnly(value: boolean) {
  readOnly = value;
}
export function isReadOnly() {
  return readOnly;
}

export const READONLY_MESSAGE =
  'Read-only: you are viewing the app as another user. Exit “View as” to make changes.';

const BLOCKED_QUERY = new Set(['insert', 'update', 'delete', 'upsert']);
const BLOCKED_STORAGE = new Set([
  'upload',
  'uploadToSignedUrl',
  'update',
  'remove',
  'move',
  'copy',
  'createSignedUploadUrl',
  'emptyBucket',
]);

// RPCs that only READ are allowed while impersonating; everything else is blocked
// (safer default than trying to enumerate every mutating RPC).
const READ_RPCS = new Set([
  'my_profile',
  'my_permissions',
  'reconcile_my_role',
  'my_unread_count',
  'my_linked_guardian_emails',
  'debug_scope_preview',
  'impersonation_targets',
  'can_impersonate_email',
  'list_my_conversations',
  'conversation_header',
  'list_blocked_users',
  'message_contact_ids',
]);

// A chainable, awaitable stand-in for a blocked write. It mirrors Supabase's own
// contract — RESOLVING to `{ data: null, error }` (the client never REJECTS for
// query/RPC/storage errors) — so callers see the block via `.error` exactly like
// any DB error, with no uncaught promise rejections whether they await, `.then()`,
// or fire-and-forget. Chained builder methods (`.insert().select().single()`) all
// resolve to the same error.
function blockedResult(): unknown {
  const result = {
    data: null,
    error: {
      message: READONLY_MESSAGE,
      details: '',
      hint: '',
      code: 'read_only',
      name: 'ReadOnlyError',
    },
  };
  const resolved = Promise.resolve(result);
  const handler: ProxyHandler<() => void> = {
    get(_t, prop) {
      if (prop === 'then') return resolved.then.bind(resolved);
      if (prop === 'catch') return resolved.catch.bind(resolved);
      if (prop === 'finally') return resolved.finally.bind(resolved);
      return () => blockedResult(); // any chained builder method → another blocked result
    },
    apply() {
      return blockedResult();
    },
  };
  return new Proxy(function noop() {}, handler);
}

/** Wrap a Supabase client so writes are rejected while the read-only flag is on. */
export function wrapReadOnly<T extends SupabaseClient>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'from' && typeof value === 'function') {
        return (...args: unknown[]) => {
          const builder = (value as (...a: unknown[]) => unknown).apply(target, args);
          return new Proxy(builder as object, {
            get(b, p, r) {
              if (readOnly && typeof p === 'string' && BLOCKED_QUERY.has(p)) {
                return () => blockedResult();
              }
              const v = Reflect.get(b, p, r);
              return typeof v === 'function' ? v.bind(b) : v;
            },
          });
        };
      }

      if (prop === 'rpc' && typeof value === 'function') {
        return (fn: string, ...rest: unknown[]) => {
          if (readOnly && !READ_RPCS.has(fn)) return blockedResult();
          return (value as (...a: unknown[]) => unknown).call(target, fn, ...rest);
        };
      }

      if (prop === 'storage') {
        const storage = value as { from?: (...a: unknown[]) => unknown };
        return new Proxy(storage as object, {
          get(s, p, r) {
            if (p === 'from' && typeof (s as typeof storage).from === 'function') {
              return (...args: unknown[]) => {
                const bucket = (s as typeof storage).from!.apply(s, args);
                return new Proxy(bucket as object, {
                  get(bk, bp, br) {
                    if (readOnly && typeof bp === 'string' && BLOCKED_STORAGE.has(bp)) {
                      return () => blockedResult();
                    }
                    const bv = Reflect.get(bk, bp, br);
                    return typeof bv === 'function' ? bv.bind(bk) : bv;
                  },
                });
              };
            }
            const sv = Reflect.get(s, p, r);
            return typeof sv === 'function' ? sv.bind(s) : sv;
          },
        });
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as T;
}
