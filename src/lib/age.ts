/**
 * Classroom age-range helpers.
 *
 * An age range is stored on `classrooms` as two nullable month bounds
 * (`min_age_months` / `max_age_months`) — the same convention the assessment
 * catalog uses. Directors pick from year presets (or a custom year range) in the
 * UI; months are the storage unit so the band can later be matched against a
 * child's `dob`. Both bounds nullable means "no age range" is a first-class,
 * default state, so signup never has to set them.
 */

export type AgePreset = { key: string; label: string; min: number | null; max: number | null };

/** Year bands directors choose from, stored as months. `none`/`custom` are UI-only. */
export const AGE_PRESETS: AgePreset[] = [
  { key: 'under2', label: 'Under 2', min: 0, max: 24 },
  { key: '2-3', label: '2–3 years', min: 24, max: 36 },
  { key: '3-4', label: '3–4 years', min: 36, max: 48 },
  { key: '4-5', label: '4–5 years', min: 48, max: 60 },
  { key: '5-6', label: '5–6 years', min: 60, max: 72 },
  { key: '6plus', label: '6+ years', min: 72, max: null },
];

/** Which Select mode a stored range maps to: 'none', a preset key, or 'custom'. */
export function presetKeyFor(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'none';
  const preset = AGE_PRESETS.find((p) => p.min === min && p.max === max);
  return preset ? preset.key : 'custom';
}

/** Whole (or one-decimal) years from a month count, as a display string. */
function years(months: number): string {
  const v = months / 12;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Natural band label — "Under 2", "2–3 years", "6+ years" — or null when unset. */
export function classroomAgeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === 0 ? `Under ${years(max)}` : `${years(min)}–${years(max)} years`;
  }
  if (min != null) return `${years(min)}+ years`;
  return `Under ${years(max as number)}`;
}
