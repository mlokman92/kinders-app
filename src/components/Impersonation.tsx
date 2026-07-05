import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getImpersonation,
  startImpersonation,
  stopImpersonation,
  syncReadOnlyFromStash,
  type ImpersonationTarget,
} from '@/lib/impersonation';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Loading, Modal, TextInput } from './ui';

/* ----------------------------------------------------------------- Context */

type Ctx = {
  /** The user currently being viewed-as, or null. */
  target: ImpersonationTarget | null;
  active: boolean;
  busy: boolean;
  begin: (email: string) => Promise<void>;
  end: () => Promise<void>;
  openPicker: () => void;
  closePicker: () => void;
  pickerOpen: boolean;
};

const ImpersonationContext = createContext<Ctx | undefined>(undefined);

export function useImpersonation(): Ctx {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ImpersonationTarget | null>(
    () => getImpersonation()?.target ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // On load, an existing stash means the persisted session is an impersonated
  // one — re-arm the read-only guard so writes stay blocked after a refresh.
  useEffect(() => {
    syncReadOnlyFromStash();
  }, []);

  const begin = useCallback(async (email: string) => {
    setBusy(true);
    try {
      const t = await startImpersonation(email);
      setTarget(t);
      setPickerOpen(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const end = useCallback(async () => {
    setBusy(true);
    try {
      await stopImpersonation();
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      target,
      active: target !== null,
      busy,
      begin,
      end,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
      pickerOpen,
    }),
    [target, busy, begin, end, pickerOpen],
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
      <ImpersonationBanner />
      {pickerOpen ? <ImpersonationPicker /> : null}
    </ImpersonationContext.Provider>
  );
}

/* ------------------------------------------------------------------ Banner */

function ImpersonationBanner() {
  const { active, target, end, busy } = useImpersonation();
  if (!active || !target) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: Brand.tertiary,
        color: Brand.onTertiaryContainer,
        borderTop: `2px solid ${Brand.onTertiaryContainer}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 18px',
        fontSize: 14,
        fontWeight: 700,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
      }}
    >
      <span style={{ fontSize: 16 }}>👁</span>
      <span>
        Viewing as {target.name}
        {target.role ? ` · ${target.role}` : ''}
      </span>
      <span
        style={{
          background: Brand.onTertiaryContainer,
          color: Brand.tertiaryContainer,
          borderRadius: Radius.full,
          padding: '2px 9px',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Read-only
      </span>
      <div style={{ flex: 1 }} />
      <Button variant="secondary" onClick={end} disabled={busy}>
        {busy ? 'Exiting…' : 'Exit View as'}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ Picker */

type TargetRow = {
  email: string;
  name: string;
  kind: 'staff' | 'parent';
  center_id: number;
  center_name: string;
  has_auth: boolean;
};

function ImpersonationPicker() {
  const { closePicker, begin, busy } = useImpersonation();
  const [rows, setRows] = useState<TargetRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc('impersonation_targets').then(({ data, error: rpcErr }) => {
      if (!active) return;
      if (rpcErr) setLoadError(rpcErr.message);
      else setRows((data ?? []) as unknown as TargetRow[]);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const onPick = async (email: string) => {
    setError(null);
    setPendingEmail(email);
    try {
      await begin(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start “View as”.');
      setPendingEmail(null);
    }
  };

  return (
    <Modal title="View as another user" onClose={busy ? () => {} : closePicker} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, lineHeight: 1.5, margin: 0 }}>
          See the app exactly as this person does (read-only). Parents open in the mobile app — on
          web you’ll see a notice, but you can still exit here.
        </p>
        {error ? <ErrorState message={error} /> : null}

        <Field label="Search">
          <TextInput value={query} onChange={setQuery} placeholder="Name or email…" autoFocus />
        </Field>

        {loadError ? (
          <ErrorState message={loadError} />
        ) : rows === null ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState title="No one to view as" icon="🔍" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 380, overflowY: 'auto' }}>
            {filtered.map((r) => (
              <div
                key={`${r.kind}:${r.email}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 4px',
                  borderBottom: `1px solid ${Brand.outlineVariant}`,
                }}
              >
                <Avatar name={r.name} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: Brand.onSurface, fontSize: 14 }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant }}>{r.email}</div>
                </div>
                <Badge tone={r.kind === 'staff' ? 'primary' : 'neutral'}>
                  {r.kind === 'staff' ? 'Staff' : 'Parent'}
                </Badge>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onPick(r.email)}
                >
                  {pendingEmail === r.email ? 'Starting…' : 'View as'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
