import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  Button,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
  Toggle,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CAPABILITIES, CAPABILITY_LABELS, defaultAllowed, type Capability } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type MatrixRole = 'teacher' | 'admin';

const ROLES: { key: MatrixRole; label: string }[] = [
  { key: 'teacher', label: 'Teacher' },
  { key: 'admin', label: 'Admin' },
];

/** Matrix overrides loaded from role_permissions; missing cells fall back to defaults. */
type Overrides = Record<MatrixRole, Partial<Record<Capability, boolean>>>;

const emptyOverrides = (): Overrides => ({ teacher: {}, admin: {} });

export function AccessKeys() {
  const { isOwner } = useAuth();

  const [centerId, setCenterId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(emptyOverrides);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState<MatrixRole | null>(null);
  const [resetting, setResetting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [permsRes, centerRes] = await Promise.all([
          supabase.from('role_permissions').select('role, capability, allowed'),
          supabase.from('centers').select('id').order('id').limit(1).maybeSingle(),
        ]);
        if (!active) return;
        if (permsRes.error) throw permsRes.error;
        if (centerRes.error) throw centerRes.error;

        const next = emptyOverrides();
        for (const row of (permsRes.data ?? []) as {
          role: string;
          capability: string;
          allowed: boolean;
        }[]) {
          if (
            (row.role === 'teacher' || row.role === 'admin') &&
            (CAPABILITIES as readonly string[]).includes(row.capability)
          ) {
            next[row.role][row.capability as Capability] = row.allowed;
          }
        }
        setOverrides(next);
        setCenterId((centerRes.data as { id: number } | null)?.id ?? null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load access keys.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!isOwner) return <Navigate to="/" replace />;

  const effective = (role: MatrixRole, cap: Capability) =>
    overrides[role][cap] ?? defaultAllowed(role, cap);

  const toggle = async (role: MatrixRole, cap: Capability) => {
    if (centerId == null) return;
    const key = `${role}:${cap}`;
    if (pending.has(key)) return;
    setActionError(null);
    setPending((prev) => new Set(prev).add(key));
    const allowed = !effective(role, cap);
    try {
      const { error: upsertError } = await supabase
        .from('role_permissions')
        .upsert(
          { center_id: centerId, role, capability: cap, allowed },
          { onConflict: 'center_id,role,capability' },
        );
      if (upsertError) throw upsertError;
      setOverrides((prev) => ({ ...prev, [role]: { ...prev[role], [cap]: allowed } }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const resetRole = async () => {
    if (!confirmReset || centerId == null) return;
    setResetting(true);
    setActionError(null);
    try {
      const { error: delError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('center_id', centerId)
        .eq('role', confirmReset);
      if (delError) throw delError;
      setOverrides((prev) => ({ ...prev, [confirmReset]: {} }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not reset.');
    } finally {
      setResetting(false);
      setConfirmReset(null);
    }
  };

  return (
    <div>
      <PageHeader title="Access" subtitle="What teachers and admins can do." />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {actionError ? <ErrorState message={actionError} /> : null}

          <Table>
            <thead>
              <tr>
                <Th>Capability</Th>
                {ROLES.map((r) => (
                  <Th key={r.key} align="center" width={160}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{r.label}</span>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(r.key)}
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          fontSize: 11.5,
                          fontWeight: 700,
                          textTransform: 'none',
                          letterSpacing: 0,
                          color: Brand.onPrimaryContainer,
                          cursor: 'pointer',
                        }}
                      >
                        Reset to defaults
                      </button>
                    </div>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <tr key={cap}>
                  <Td>{CAPABILITY_LABELS[cap]}</Td>
                  {ROLES.map((r) => {
                    const on = effective(r.key, cap);
                    const modified = on !== defaultAllowed(r.key, cap);
                    const busy = pending.has(`${r.key}:${cap}`);
                    return (
                      <Td key={r.key} align="center">
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            opacity: busy ? 0.5 : 1,
                            pointerEvents: busy ? 'none' : 'auto',
                          }}
                        >
                          <Toggle
                            checked={on}
                            onChange={() => void toggle(r.key, cap)}
                            label={`${CAPABILITY_LABELS[cap]} — ${r.label}`}
                          />
                          <span
                            title={modified ? 'Changed from default' : undefined}
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: modified ? Brand.tertiary : 'transparent',
                            }}
                          />
                        </div>
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {confirmReset ? (
        <Modal
          title={`Reset ${confirmReset} keys?`}
          onClose={() => (resetting ? null : setConfirmReset(null))}
        >
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            All {confirmReset} toggles return to their defaults.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmReset(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button onClick={resetRole} disabled={resetting}>
              {resetting ? <Spinner size={16} /> : 'Reset'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
