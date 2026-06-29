import { useRef, useState } from 'react';

import { Brand, Radius } from '@/lib/theme';

import { Button } from './ui';

let _uid = 0;
const nextId = () => `row_${_uid++}`;

type Row = { id: string; text: string };

/**
 * Editable, drag-to-reorder list of single-line text rows (materials / instructions).
 * Seeds its internal rows once from `value`, then owns order/content and emits the
 * resulting `string[]` upward via `onChange`. The web equivalent of mobile `EditableList`.
 */
export function ListEditor({
  value,
  onChange,
  numbered,
  addLabel,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  numbered?: boolean;
  addLabel: string;
  placeholder?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => value.map((text) => ({ id: nextId(), text })));
  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const emit = (next: Row[]) => {
    setRows(next);
    onChange(next.map((r) => r.text));
  };

  const setText = (id: string, text: string) =>
    emit(rows.map((r) => (r.id === id ? { ...r, text } : r)));
  const remove = (id: string) => emit(rows.filter((r) => r.id !== id));
  const add = () => emit([...rows, { id: nextId(), text: '' }]);

  const onDrop = (targetId: string) => {
    const from = rows.findIndex((r) => r.id === dragId.current);
    const to = rows.findIndex((r) => r.id === targetId);
    dragId.current = null;
    setOverId(null);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    emit(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row, i) => (
        <div
          key={row.id}
          onDragOver={(e) => {
            e.preventDefault();
            if (overId !== row.id) setOverId(row.id);
          }}
          onDrop={() => onDrop(row.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 6,
            borderRadius: Radius.md,
            border: `1px solid ${overId === row.id ? Brand.primary : 'transparent'}`,
            background: overId === row.id ? Brand.primaryContainer : 'transparent',
          }}
        >
          <span
            draggable
            onDragStart={() => {
              dragId.current = row.id;
            }}
            onDragEnd={() => {
              dragId.current = null;
              setOverId(null);
            }}
            title="Drag to reorder"
            style={{
              cursor: 'grab',
              color: Brand.onSurfaceVariant,
              fontSize: 16,
              padding: '0 2px',
              userSelect: 'none',
            }}
          >
            ⠿
          </span>
          {numbered ? (
            <span
              style={{
                width: 22,
                textAlign: 'right',
                fontSize: 14,
                fontWeight: 700,
                color: Brand.onSurfaceVariant,
              }}
            >
              {i + 1}.
            </span>
          ) : null}
          <input
            value={row.text}
            placeholder={placeholder}
            onChange={(e) => setText(row.id, e.target.value)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: Radius.md,
              border: `1px solid ${Brand.outlineVariant}`,
              background: Brand.white,
              padding: '0 12px',
              fontSize: 14,
              color: Brand.onSurface,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            title="Remove"
            style={{
              border: 'none',
              background: 'transparent',
              color: Brand.onSurfaceVariant,
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={add}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
