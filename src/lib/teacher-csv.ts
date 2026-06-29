/**
 * CSV bulk-import helpers for teachers.
 *
 * Self-contained domain logic (no UI imports), mirroring the single-add rules:
 *   gender ∈ {male,female,other}, status ∈ {active,inactive},
 *   days ⊆ {mon..sun}, ISO YYYY-MM-DD dates, email must match EMAIL_RE.
 * Reuses the RFC-4180 parser and download helper from `./csv`.
 */

import { MAX_IMPORT_ROWS, parseCsv, downloadCsv } from './csv';
import { parseISODate, toISODate } from './dates';

export { MAX_IMPORT_ROWS, parseCsv, downloadCsv };

/* ----------------------------------------------------------- domain sets */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const GENDERS = ['male', 'female', 'other'];
const STATUSES = ['active', 'inactive'];

/** Canonical, ordered columns of the downloadable template. */
export const TEMPLATE_COLUMNS = [
  'name',
  'email',
  'phone',
  'dob',
  'gender',
  'classroom',
  'status',
  'days',
] as const;

type Field = (typeof TEMPLATE_COLUMNS)[number];

/* ----------------------------------------------------------- header map */

const STATIC_ALIASES: Record<string, Field> = {
  name: 'name',
  'full name': 'name',
  'teacher name': 'name',
  teacher: 'name',
  staff: 'name',
  'staff name': 'name',
  email: 'email',
  'email address': 'email',
  'e mail': 'email',
  mail: 'email',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  contact: 'phone',
  tel: 'phone',
  dob: 'dob',
  'date of birth': 'dob',
  'birth date': 'dob',
  birthdate: 'dob',
  birthday: 'dob',
  born: 'dob',
  gender: 'gender',
  sex: 'gender',
  classroom: 'classroom',
  'classroom name': 'classroom',
  class: 'classroom',
  'class name': 'classroom',
  room: 'classroom',
  group: 'classroom',
  status: 'status',
  'assignment status': 'status',
  days: 'days',
  schedule: 'days',
  'days of week': 'days',
  'working days': 'days',
};

/** Normalize a raw header and resolve it to a canonical field, or null. */
function headerToField(rawHeader: string): Field | null {
  const h = rawHeader
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, ' ')
    .trim();
  return STATIC_ALIASES[h] ?? null;
}

/** Map header cells to column indexes (first occurrence wins). */
export function mapHeaders(headerRow: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  headerRow.forEach((raw, idx) => {
    const field = headerToField(raw);
    if (field && map[field] === undefined) map[field] = idx;
  });
  return map;
}

/* ----------------------------------------------------------- validation */

export type AssignmentInput = {
  classroom_id: number;
  status: string;
  days: string[];
};

export type PreviewRow = {
  /** 1-based position among data rows, for display ("Row 3"). */
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  dob: string | null;
  gender: string;
  classroomName: string;
  classroomId: number | null;
  status: string;
  days: string[];
  errors: string[];
  warnings: string[];
  /** True when the email matches a teacher already on the roster. */
  duplicateOfRoster: boolean;
  /** True when an earlier row in the same file has the same email. */
  duplicateInFile: boolean;
  /** No blocking errors → eligible to import. */
  importable: boolean;
};

export type Classroom = { id: number; name: string };
export type RosterEntry = { email: string | null };

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISODate(s);
  if (Number.isNaN(d.getTime())) return false;
  return toISODate(d) === s; // rejects impossible dates like 2021-02-30
}

/**
 * Validate parsed data rows against the center's classrooms and existing
 * teacher roster. Returns one PreviewRow per data row with resolved values.
 */
export function validateRows(
  dataRows: string[][],
  headers: Partial<Record<Field, number>>,
  classrooms: Classroom[],
  roster: RosterEntry[],
): PreviewRow[] {
  const classByName = new Map<string, number>();
  for (const c of classrooms) {
    const key = c.name.trim().toLowerCase();
    if (!classByName.has(key)) classByName.set(key, c.id);
  }
  const rosterEmails = new Set(
    roster.map((r) => (r.email ?? '').trim().toLowerCase()).filter(Boolean),
  );
  const seenEmails = new Set<string>();

  const cellOf = (raw: string[], field: Field): string => {
    const idx = headers[field];
    return idx === undefined ? '' : (raw[idx] ?? '').trim();
  };

  return dataRows.map((raw, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = cellOf(raw, 'name');
    if (!name) errors.push('Name is required.');

    // email
    const email = cellOf(raw, 'email');
    if (email && !EMAIL_RE.test(email)) errors.push(`Email "${email}" is invalid.`);

    const phone = cellOf(raw, 'phone');

    // dob
    let dob: string | null = null;
    const dobRaw = cellOf(raw, 'dob');
    if (dobRaw) {
      if (isValidISODate(dobRaw)) dob = dobRaw;
      else errors.push(`Date of birth "${dobRaw}" must be YYYY-MM-DD.`);
    }

    // gender
    let gender = '';
    const genderRaw = cellOf(raw, 'gender').toLowerCase();
    if (genderRaw) {
      if (GENDERS.includes(genderRaw)) gender = genderRaw;
      else errors.push(`Gender "${genderRaw}" must be male, female, or other.`);
    }

    // classroom (optional; resolves a name to an id)
    const classroomName = cellOf(raw, 'classroom');
    let classroomId: number | null = null;
    if (classroomName) {
      const found = classByName.get(classroomName.toLowerCase());
      if (found === undefined) errors.push(`Classroom "${classroomName}" not found.`);
      else classroomId = found;
    }

    // status (defaults to active)
    let status = 'active';
    const statusRaw = cellOf(raw, 'status').toLowerCase();
    if (statusRaw) {
      if (STATUSES.includes(statusRaw)) status = statusRaw;
      else errors.push(`Status "${statusRaw}" must be active or inactive.`);
    }

    // days (space/comma/pipe/semicolon separated)
    const daysRaw = cellOf(raw, 'days');
    let days: string[] = [];
    if (daysRaw) {
      const tokens = daysRaw
        .toLowerCase()
        .split(/[\s,;|]+/)
        .filter(Boolean);
      const bad = tokens.filter((t) => !DAY_KEYS.includes(t));
      if (bad.length) errors.push(`Unknown day(s): ${bad.join(', ')}. Use mon–sun.`);
      days = DAY_KEYS.filter((d) => tokens.includes(d)); // valid, deduped, ordered
    }

    // Schedule fields require a classroom; warn so the data loss isn't silent.
    if (!classroomName && (days.length > 0 || status === 'inactive')) {
      warnings.push('Status and schedule were skipped (no classroom set).');
    }

    // Duplicate detection by email — the unique identity (the DB enforces a unique
    // index on lower(email) per center). Name-only rows are NOT deduped: two teachers
    // can legitimately share a name, and there's no DB constraint on name.
    let duplicateOfRoster = false;
    let duplicateInFile = false;
    const emailKey = email.trim().toLowerCase();
    if (emailKey) {
      if (rosterEmails.has(emailKey)) {
        duplicateOfRoster = true;
        warnings.push('Already on your roster (email match).');
      }
      if (seenEmails.has(emailKey)) {
        duplicateInFile = true;
        warnings.push('Duplicate email in this file.');
      }
      seenEmails.add(emailKey);
    }

    return {
      rowNumber: i + 1,
      name,
      email,
      phone,
      dob,
      gender,
      classroomName,
      classroomId,
      status,
      days,
      errors,
      warnings,
      duplicateOfRoster,
      duplicateInFile,
      importable: errors.length === 0,
    };
  });
}

/* ------------------------------------------------------------- payload */

export type RpcTeacherRow = {
  index: number;
  name: string;
  email: string;
  phone: string;
  dob: string | null;
  gender: string;
  assignments: AssignmentInput[];
};

export type BulkResult = {
  inserted: number;
  failed: number;
  results: { index: number; ok: boolean; teacher_id?: number; error?: string }[];
};

/**
 * Build the RPC payload from the chosen preview rows. `index` is the preview
 * `rowNumber` so the server's per-row result maps back to the table.
 */
export function toRpcPayload(rows: PreviewRow[]): RpcTeacherRow[] {
  return rows.map((r) => ({
    index: r.rowNumber,
    name: r.name,
    email: r.email,
    phone: r.phone,
    dob: r.dob,
    gender: r.gender,
    assignments:
      r.classroomId != null
        ? [{ classroom_id: r.classroomId, status: r.status, days: r.days }]
        : [],
  }));
}

/* ------------------------------------------------------------ template */

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Header row + one sample data row, matching TEMPLATE_COLUMNS. */
export function buildTemplateCsv(): string {
  const sample = [
    'Aisha Rahman',
    'aisha@example.com',
    '012-3456789',
    '1992-03-14',
    'female',
    'Sunflower Room',
    'active',
    'mon tue wed thu fri',
  ];
  return [TEMPLATE_COLUMNS.join(','), sample.map(csvEscape).join(',')].join('\r\n');
}
