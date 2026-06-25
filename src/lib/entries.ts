import type { EntryField } from '@/constants/entry-forms';

export type EntryValues = Record<string, unknown>;
export type ClassroomRef = { id: number; name: string };
export type EntryDetailRow = { label: string; value: string };

/** Format a Date as a "HH:MM" 24h string for storage/display. */
export function timeToHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Empty starting values for a form's fields. */
export function initValues(fields: EntryField[]): EntryValues {
  const v: EntryValues = {};
  for (const f of fields) {
    if (f.kind === 'time') v[f.key] = new Date();
    else if (f.kind === 'multi' || f.kind === 'media') v[f.key] = [];
    else if (f.kind === 'toggle') v[f.key] = false;
    else if (f.kind === 'single' || f.kind === 'dropdown' || f.kind === 'activity_picker') v[f.key] = null;
    else v[f.key] = '';
  }
  return v;
}

/** Hydrate form values from a saved entry's `data` (for editing). Media is handled separately. */
export function valuesFromData(fields: EntryField[], data: Record<string, unknown> | null): EntryValues {
  const v = initValues(fields);
  for (const f of fields) {
    if (f.kind === 'media') continue;
    const raw = data?.[f.key];
    if (raw == null) continue;
    if (f.kind === 'time') {
      const [h, m] = String(raw).split(':').map(Number);
      const d = new Date();
      d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
      v[f.key] = d;
    } else if (f.kind === 'multi') {
      v[f.key] = Array.isArray(raw) ? raw : [];
    } else if (f.kind === 'toggle') {
      v[f.key] = Boolean(raw);
    } else if (f.kind === 'number') {
      v[f.key] = String(raw);
    } else {
      v[f.key] = raw;
    }
  }
  return v;
}

/** Turn a saved entry's `data` into readable label/value rows, skipping empty fields. */
export function describeEntry(
  fields: EntryField[],
  data: Record<string, unknown> | null,
  classrooms: ClassroomRef[],
): EntryDetailRow[] {
  const out: EntryDetailRow[] = [];
  for (const f of fields) {
    // `media` lives separately; `activity_picker` tags are relational (entry_activities) and
    // surfaced by callers (log/preview) that fetch the titles — not part of `data`.
    if (f.kind === 'media' || f.kind === 'activity_picker') continue;
    const v = data?.[f.key];
    let text = '';
    if (f.kind === 'toggle') {
      if (v !== true) continue;
      text = 'Yes';
    } else if (f.kind === 'multi') {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      if (arr.length === 0) continue;
      text = arr.join(', ');
    } else if (f.kind === 'dropdown' && f.optionsSource === 'classrooms') {
      if (v == null || v === '') continue;
      const c = classrooms.find((c) => String(c.id) === String(v));
      // Fall back to a neutral label rather than leaking a raw classroom id — this only
      // happens when the room isn't visible to the viewer (e.g. a parent whose child is
      // not enrolled in the move_rooms destination); directors always resolve their own.
      text = c ? c.name : 'Another room';
    } else {
      if (v == null || v === '') continue;
      text = String(v);
    }
    out.push({ label: f.label, value: text });
  }
  return out;
}

/** "HH:MM" (24h) -> "h:mm AM/PM"; returns the input unchanged if it can't be parsed. */
export function to12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = Number(m[1]);
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

export type HumanizedEntry = { summary: string; note?: string };

const TOILET_PHRASE: Record<string, string> = {
  Peed: 'Peed',
  Potty: 'Used the potty',
  Diaper: 'Had a diaper change',
  Underwear: 'Used the toilet',
};

/**
 * Turn a saved entry's `data` into a warm, parent-friendly summary (+ optional note),
 * instead of the staff-facing label/value rows. One sentence per entry type.
 */
export function humanizeEntry(
  type: string,
  data: Record<string, unknown> | null,
  classrooms: ClassroomRef[],
): HumanizedEntry {
  const s = (k: string): string => {
    const v = data?.[k];
    return v == null ? '' : String(v).trim();
  };
  const arr = (k: string): string[] => (Array.isArray(data?.[k]) ? (data?.[k] as string[]) : []);
  const note = s('notes') || undefined;

  switch (type) {
    case 'check_in':
      return { summary: 'Checked in for the day', note };
    case 'checkout':
      return { summary: 'Headed home', note };
    case 'food': {
      const mealRaw = s('meal');
      const isDrink = mealRaw === 'Fluids';
      const verb = isDrink ? 'Drank' : 'Ate';
      const qty = s('quantity');
      const lead =
        qty === 'All' ? `${verb} all of` :
        qty === 'Most' ? `${verb} most of` :
        qty === 'Some' ? 'Had a little of' :
        qty === 'None' ? (isDrink ? "Didn't drink" : "Didn't eat") :
        'Had';
      const meal = isDrink
        ? 'their fluids'
        : !mealRaw || mealRaw === 'Other'
          ? 'their meal'
          : `their ${mealRaw.toLowerCase()}`;
      const food = s('food');
      return { summary: food ? `${lead} ${meal} — ${food}` : `${lead} ${meal}` };
    }
    case 'sleep': {
      if (data?.didnt_sleep === true) return { summary: "Didn't nap today", note };
      const st = s('start_time');
      const en = s('end_time');
      if (st && en) return { summary: `Napped ${to12h(st)} – ${to12h(en)}`, note };
      if (st) return { summary: `Slept from ${to12h(st)}`, note };
      return { summary: 'Had a rest', note };
    }
    case 'toilet': {
      const t = s('type');
      return { summary: TOILET_PHRASE[t] ?? t ?? 'Bathroom break', note };
    }
    case 'mood': {
      const mood = s('mood');
      const level = s('level');
      if (!mood || mood === 'Other') return { summary: 'Had a little mood update', note };
      return {
        summary: level
          ? `Was feeling ${level.toLowerCase()} ${mood.toLowerCase()}`
          : `Was feeling ${mood.toLowerCase()}`,
        note,
      };
    }
    case 'health': {
      const h = s('health');
      const obs = arr('observations');
      let summary =
        h === 'Sick' ? 'Felt a little unwell' : h === 'Injured' ? 'Had a minor injury' : 'Feeling healthy and well';
      if (obs.length) summary += ` — ${obs.join(', ').toLowerCase()}`;
      return { summary, note };
    }
    case 'temperature': {
      const temp = s('temperature');
      const h = s('health');
      let summary = temp ? `Temperature ${temp}°C` : 'Temperature check';
      if (h) summary += ` — ${h.toLowerCase()}`;
      return { summary, note };
    }
    case 'supplies': {
      const items = arr('supplies');
      return {
        summary: items.length ? `Please send more: ${items.join(', ').toLowerCase()}` : 'Supplies update',
        note,
      };
    }
    case 'notes':
      return { summary: note ?? 'Note' };
    case 'activity':
      return { summary: s('description') || 'Took part in an activity' };
    case 'move_rooms': {
      const room = s('room');
      const c = classrooms.find((cl) => String(cl.id) === String(room));
      return { summary: `Moved to ${c ? c.name : 'another room'}`, note };
    }
    default:
      return { summary: 'Update', note };
  }
}
