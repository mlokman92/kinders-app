/** Shared helpers for the activity library. */

/**
 * Trim each entry and drop blanks — used for materials/instructions before saving,
 * mirroring the mobile activity form's `clean()`.
 */
export function clean(items: string[]): string[] {
  return items.map((s) => s.trim()).filter((s) => s.length > 0);
}
