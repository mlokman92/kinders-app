/**
 * The 12 journal entry types — web port of the mobile `entry-actions.ts`, but without the
 * React Native image `require()`s. We keep key + label + a single emoji for compact display
 * in reports/feeds (the mobile app uses PNG icons that don't apply on the web).
 */
export type EntryAction = { key: string; label: string; emoji: string };

export const ENTRY_ACTIONS: EntryAction[] = [
  { key: 'check_in', label: 'Check in', emoji: '👋' },
  { key: 'activity', label: 'Activity', emoji: '🎨' },
  { key: 'health', label: 'Health', emoji: '🩺' },
  { key: 'temperature', label: 'Temperature', emoji: '🌡️' },
  { key: 'food', label: 'Food', emoji: '🍎' },
  { key: 'sleep', label: 'Sleep', emoji: '😴' },
  { key: 'toilet', label: 'Toilet', emoji: '🚽' },
  { key: 'mood', label: 'Mood', emoji: '😊' },
  { key: 'supplies', label: 'Supplies', emoji: '🧷' },
  { key: 'notes', label: 'Notes', emoji: '📝' },
  { key: 'move_rooms', label: 'Move rooms', emoji: '🚪' },
  { key: 'checkout', label: 'Checkout', emoji: '🏡' },
];

export const ENTRY_LABELS: Record<string, string> = Object.fromEntries(
  ENTRY_ACTIONS.map((a) => [a.key, a.label]),
);

export const ENTRY_EMOJI: Record<string, string> = Object.fromEntries(
  ENTRY_ACTIONS.map((a) => [a.key, a.emoji]),
);

/** Human label for an entry type key, falling back to a title-cased version of the key. */
export function entryLabel(type: string): string {
  return ENTRY_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
