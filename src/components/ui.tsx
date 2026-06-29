import type { CSSProperties, ReactNode } from 'react';

import { Brand, Radius } from '@/lib/theme';

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  style,
  padding = 20,
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number;
}) {
  return (
    <div
      style={{
        background: Brand.white,
        borderRadius: Radius.lg,
        boxShadow: 'var(--shadow-card)',
        border: `1px solid ${Brand.outlineVariant}`,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- PageHeader */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: Brand.onSurface, letterSpacing: -0.3 }}>
          {title}
        </h1>
        {subtitle ? (
          <p style={{ marginTop: 4, fontSize: 15, color: Brand.onSurfaceVariant }}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- Stat tile */

export function Stat({
  label,
  value,
  hint,
  accent = Brand.primary,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon != null ? (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: Radius.md,
              background: accent + '22',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            {icon}
          </div>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: Brand.onSurfaceVariant }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: Brand.onSurface, lineHeight: 1.1 }}>
            {value}
          </div>
          {hint ? (
            <div style={{ fontSize: 12, color: Brand.onSurfaceVariant, marginTop: 2 }}>{hint}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: Brand.surfaceContainerHigh, fg: Brand.onSurfaceVariant },
  primary: { bg: Brand.primaryContainer, fg: Brand.onPrimaryContainer },
  success: { bg: Brand.successContainer, fg: Brand.onSuccessContainer },
  warning: { bg: Brand.tertiaryContainer, fg: Brand.onTertiaryContainer },
  error: { bg: Brand.errorContainer, fg: Brand.onErrorContainer },
};

export function Badge({
  children,
  tone = 'neutral',
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  style?: CSSProperties;
}) {
  const t = BADGE_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: t.bg,
        color: t.fg,
        borderRadius: Radius.full,
        padding: '3px 10px',
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  size = 36,
  src,
}: {
  name: string | null;
  size?: number;
  src?: string | null;
}) {
  const safeName = (name ?? '').trim();
  if (src) {
    return (
      <img
        src={src}
        alt={safeName}
        style={{
          width: size,
          height: size,
          borderRadius: Radius.full,
          objectFit: 'cover',
          flexShrink: 0,
          background: Brand.surfaceContainerHigh,
        }}
      />
    );
  }
  const initials = safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Radius.full,
        background: Brand.primaryContainer,
        color: Brand.onPrimaryContainer,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials || '·'}
    </div>
  );
}

/* --------------------------------------------------------------- Spinner */

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid ${Brand.outlineVariant}`,
        borderTopColor: Brand.primary,
        borderRadius: '50%',
        animation: 'kinders-spin 0.7s linear infinite',
      }}
    />
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '64px 0',
        color: Brand.onSurfaceVariant,
      }}
    >
      <Spinner size={28} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}

/* ----------------------------------------------------- Empty / error states */

export function EmptyState({
  title,
  message,
  icon = '🗂️',
}: {
  title: string;
  message?: string;
  icon?: string;
}) {
  return (
    <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: Brand.onSurface }}>{title}</div>
      {message ? (
        <p style={{ marginTop: 6, fontSize: 14, color: Brand.onSurfaceVariant }}>{message}</p>
      ) : null}
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card style={{ borderColor: Brand.error, background: Brand.errorContainer }}>
      <div style={{ fontWeight: 700, color: Brand.onErrorContainer, marginBottom: 4 }}>
        Something went wrong
      </div>
      <div style={{ fontSize: 14, color: Brand.onErrorContainer }}>{message}</div>
    </Card>
  );
}

/* ----------------------------------------------------------------- Table */

export function Table({ children }: { children: ReactNode }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: 14 }}>{children}</table>
      </div>
    </Card>
  );
}

export function Th({
  children,
  align = 'left',
  width,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '12px 16px',
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: Brand.onSurfaceVariant,
        background: Brand.surfaceContainerLow,
        borderBottom: `1px solid ${Brand.outlineVariant}`,
        whiteSpace: 'nowrap',
        width,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  style,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: '12px 16px',
        borderBottom: `1px solid ${Brand.outlineVariant}`,
        color: Brand.onSurface,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/* ---------------------------------------------------------------- Button */

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    border: 'none',
    borderRadius: Radius.full,
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    transition: 'filter 0.15s',
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: Brand.primary, color: Brand.onPrimary },
    secondary: { background: Brand.surfaceContainerHigh, color: Brand.onSurface },
    outline: { background: 'transparent', color: Brand.onSurface, border: `1px solid ${Brand.outline}` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------- Form controls */

const controlStyle: CSSProperties = {
  height: 42,
  borderRadius: Radius.md,
  border: `1px solid ${Brand.outlineVariant}`,
  background: Brand.white,
  padding: '0 12px',
  fontSize: 14,
  color: Brand.onSurface,
  outline: 'none',
  minWidth: 160,
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant }}>{label}</span>
      {children}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  style?: CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...controlStyle, cursor: 'pointer', ...style }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function DateInput({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...controlStyle, ...style }}
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  style,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...controlStyle, width: '100%', ...style }}
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        ...controlStyle,
        height: 'auto',
        width: '100%',
        padding: '10px 12px',
        resize: 'vertical',
        fontFamily: 'inherit',
        lineHeight: 1.5,
        ...style,
      }}
    />
  );
}

/** A horizontal toolbar that wraps filter controls. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Chip */

/** A toggleable pill chip for single/multi selections (days, status, etc.). */
export function Chip({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${selected ? Brand.primary : Brand.outlineVariant}`,
        background: selected ? Brand.primaryContainer : Brand.white,
        color: selected ? Brand.onPrimaryContainer : Brand.onSurface,
        borderRadius: Radius.full,
        padding: '7px 14px',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {label}
    </button>
  );
}

/* ----------------------------------------------------------------- Modal */

/** A centered modal dialog over a dimmed backdrop. Click outside or Esc closes. */
export function Modal({
  title,
  children,
  onClose,
  width = 420,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 23, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: Brand.white,
          borderRadius: Radius.lg,
          boxShadow: 'var(--shadow-card)',
          padding: 24,
          width: '100%',
          maxWidth: width,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, color: Brand.onSurface, marginBottom: 10 }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
