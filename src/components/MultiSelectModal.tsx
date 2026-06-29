import { useMemo, useState } from 'react';

import { Brand, Radius } from '@/lib/theme';

import { Avatar, Button, ErrorState, Modal, Spinner, TextInput } from './ui';

export type PickOption = {
  id: number;
  label: string;
  sublabel?: string;
  /** Optional avatar image (signed URL). Falls back to initials when absent. */
  imageUrl?: string | null;
  /** Render an avatar (initials or imageUrl) before the label. */
  showAvatar?: boolean;
};

/** A searchable multi-select dialog. Confirms with the chosen ids. */
export function MultiSelectModal({
  title,
  options,
  confirmLabel,
  emptyText,
  onClose,
  onConfirm,
}: {
  title: string;
  options: PickOption[];
  confirmLabel: (n: number) => string;
  emptyText: string;
  onClose: () => void;
  onConfirm: (ids: number[]) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm([...selected]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={() => (busy ? undefined : onClose())} width={460}>
      {options.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, margin: 0 }}>{emptyText}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error ? <ErrorState message={error} /> : null}
          <TextInput value={query} onChange={setQuery} placeholder="Search…" autoFocus />
          <div
            style={{
              maxHeight: 320,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              border: `1px solid ${Brand.outlineVariant}`,
              borderRadius: Radius.md,
              padding: 6,
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13.5, color: Brand.onSurfaceVariant }}>
                No matches.
              </div>
            ) : (
              filtered.map((o) => {
                const on = selected.has(o.id);
                return (
                  <label
                    key={o.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: Radius.base,
                      cursor: 'pointer',
                      background: on ? Brand.primaryContainer : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(o.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    {o.showAvatar ? <Avatar name={o.label} src={o.imageUrl ?? null} size={36} /> : null}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: Brand.onSurface }}>
                        {o.label}
                      </div>
                      {o.sublabel ? (
                        <div style={{ fontSize: 12, color: Brand.onSurfaceVariant }}>{o.sublabel}</div>
                      ) : null}
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy || selected.size === 0}>
              {busy ? <Spinner size={16} /> : confirmLabel(selected.size)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
