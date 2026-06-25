/** Format a Date as a local YYYY-MM-DD string (no timezone shift, unlike toISOString). */
export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Human-friendly date for display, e.g. "5 Jan 2026". */
export function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Parse a YYYY-MM-DD string into a LOCAL Date (avoids the UTC-midnight day shift of new Date(str)). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** A new local Date offset from `d` by `days` (may be negative). */
export function addDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** The Monday (local, midnight) of the week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  return addDays(d, day === 0 ? -6 : 1 - day);
}

/** True if two dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
