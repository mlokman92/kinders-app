import { useState } from 'react';

import { Select, TextInput } from '@/components/ui';
import { AGE_PRESETS, presetKeyFor } from '@/lib/age';
import { Brand } from '@/lib/theme';

const SELECT_OPTIONS = [
  { value: 'none', label: 'No age range' },
  ...AGE_PRESETS.map((p) => ({ value: p.key, label: p.label })),
  { value: 'custom', label: 'Custom…' },
];

/**
 * Optional classroom age range. Directors pick a year band (or "Custom" for a
 * free year range); the value is emitted to the parent as month bounds. Local
 * state seeds once from the incoming range, so the component is remounted per
 * modal-open (both call sites render it behind a conditional `{open ? … }`).
 */
export function AgeRangeField({
  min,
  max,
  onChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const [mode, setMode] = useState(() => presetKeyFor(min, max));
  const yearsStr = (m: number | null) => (m == null ? '' : String(+(m / 12).toFixed(1)));
  const [minYears, setMinYears] = useState(() => yearsStr(min));
  const [maxYears, setMaxYears] = useState(() => yearsStr(max));

  const toMonths = (s: string): number | null => {
    const n = parseFloat(s);
    return s.trim() === '' || Number.isNaN(n) || n < 0 ? null : Math.round(n * 12);
  };

  const selectMode = (key: string) => {
    setMode(key);
    if (key === 'none') {
      onChange(null, null);
    } else if (key === 'custom') {
      onChange(toMonths(minYears), toMonths(maxYears));
    } else {
      const preset = AGE_PRESETS.find((p) => p.key === key)!;
      setMinYears(yearsStr(preset.min));
      setMaxYears(yearsStr(preset.max));
      onChange(preset.min, preset.max);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Select value={mode} onChange={selectMode} options={SELECT_OPTIONS} />
      {mode === 'custom' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TextInput
            value={minYears}
            onChange={(v) => {
              setMinYears(v);
              onChange(toMonths(v), toMonths(maxYears));
            }}
            placeholder="Min"
            inputMode="numeric"
          />
          <span style={{ color: Brand.onSurfaceVariant, fontSize: 13 }}>to</span>
          <TextInput
            value={maxYears}
            onChange={(v) => {
              setMaxYears(v);
              onChange(toMonths(minYears), toMonths(v));
            }}
            placeholder="Max"
            inputMode="numeric"
          />
          <span style={{ color: Brand.onSurfaceVariant, fontSize: 13, whiteSpace: 'nowrap' }}>
            years
          </span>
        </div>
      ) : null}
    </div>
  );
}
