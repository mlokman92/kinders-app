/**
 * CSV bulk-import helpers for students.
 *
 * Self-contained (no UI imports) so the parser/validator can be reasoned about
 * and unit-tested in isolation. Mirrors the single-add domain rules:
 *   gender ∈ {male,female,other}, status ∈ {active,upcoming},
 *   relationship ∈ {parent,guardian}, days ⊆ {mon..sun}, ISO YYYY-MM-DD dates,
 *   guardian email must match EMAIL_RE and be unique within a student.
 */

import { parseISODate, toISODate } from './dates';

/* ----------------------------------------------------------- domain sets */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const GENDERS = ['male', 'female', 'other'];
const STATUSES = ['active', 'upcoming'];
const RELATIONSHIPS = ['parent', 'guardian'];

/** Canonical, ordered columns of the downloadable template. */
export const TEMPLATE_COLUMNS = [
  'name',
  'dob',
  'gender',
  'nric',
  'classroom',
  'status',
  'enrollment_date',
  'days',
  'guardian1_name',
  'guardian1_email',
  'guardian1_phone',
  'guardian1_relationship',
  'guardian2_name',
  'guardian2_email',
  'guardian2_phone',
  'guardian2_relationship',
] as const;

type Field = (typeof TEMPLATE_COLUMNS)[number];

/** Soft cap on rows per import (keeps it to one RPC round-trip). */
export const MAX_IMPORT_ROWS = 500;

/* --------------------------------------------------------- RFC-4180 parse */

/**
 * Parse CSV text into rows of string cells. Handles: BOM, quoted fields,
 * `""` escapes, commas/newlines inside quotes, and CRLF/CR/LF line endings.
 * Fully-empty lines are dropped. Ragged rows are returned as-is (callers read
 * cells by header index and treat missing cells as blank).
 */
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let atFieldStart = true; // a quote only opens a quoted field at the field's start
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = '';
    atFieldStart = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  let i = 0;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (c === '\r') {
        field += '\n'; // normalize CRLF / lone CR inside a quoted field to LF
        i += text[i + 1] === '\n' ? 2 : 1;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    // A quote is only special at the start of a field; a stray quote mid-field
    // is treated as a literal so column boundaries (commas) are preserved.
    if (c === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
      i++;
      continue;
    }
    if (c === ',') {
      endField();
      i++;
      continue;
    }
    if (c === '\r') {
      endRow();
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (c === '\n') {
      endRow();
      i++;
      continue;
    }
    field += c;
    atFieldStart = false;
    i++;
  }
  // Flush a trailing field/row when the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) endRow();

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/* ----------------------------------------------------------- header map */

const STATIC_ALIASES: Record<string, Field> = {
  name: 'name',
  'full name': 'name',
  'student name': 'name',
  'child name': 'name',
  student: 'name',
  child: 'name',
  pupil: 'name',
  dob: 'dob',
  'date of birth': 'dob',
  'birth date': 'dob',
  birthdate: 'dob',
  birthday: 'dob',
  born: 'dob',
  gender: 'gender',
  sex: 'gender',
  nric: 'nric',
  ic: 'nric',
  'ic number': 'nric',
  'ic no': 'nric',
  'identity card': 'nric',
  mykid: 'nric',
  'birth certificate': 'nric',
  'birth cert': 'nric',
  classroom: 'classroom',
  'classroom name': 'classroom',
  class: 'classroom',
  'class name': 'classroom',
  room: 'classroom',
  group: 'classroom',
  status: 'status',
  'enrollment status': 'status',
  'enrolment status': 'status',
  days: 'days',
  schedule: 'days',
  'days of week': 'days',
  'attendance days': 'days',
  'enrollment date': 'enrollment_date',
  'enrolment date': 'enrollment_date',
  'start date': 'enrollment_date',
  start: 'enrollment_date',
  enrolled: 'enrollment_date',
  'date enrolled': 'enrollment_date',
};

/** Normalize a raw header and resolve it to a canonical field, or null. */
function headerToField(rawHeader: string): Field | null {
  const h = rawHeader
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, ' ')
    .trim();
  if (STATIC_ALIASES[h]) return STATIC_ALIASES[h];
  const m = h.match(/^(?:guardian|parent|contact)\s*([12]?)\s*(name|email|phone|relationship|relation)$/);
  if (m) {
    const num = m[1] === '2' ? '2' : '1';
    const part = m[2] === 'relation' ? 'relationship' : m[2];
    return `guardian${num}_${part}` as Field;
  }
  return null;
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

export type GuardianInput = {
  name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
};

export type EnrollmentInput = {
  classroom_id: number;
  status: string;
  enrollment_date: string;
  days: string[];
};

export type PreviewRow = {
  /** 1-based position among data rows, for display ("Row 3"). */
  rowNumber: number;
  name: string;
  dob: string | null;
  gender: string;
  nric: string;
  classroomName: string;
  classroomId: number | null;
  status: string;
  enrollmentDate: string | null;
  days: string[];
  guardians: GuardianInput[];
  errors: string[];
  warnings: string[];
  /** True when name+dob match a student already on the roster. */
  duplicateOfRoster: boolean;
  /** True when an earlier row in the same file has the same name+dob. */
  duplicateInFile: boolean;
  /** No blocking errors → eligible to import. */
  importable: boolean;
};

export type Classroom = { id: number; name: string };
export type RosterEntry = { name: string; dob: string | null };

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISODate(s);
  if (Number.isNaN(d.getTime())) return false;
  return toISODate(d) === s; // rejects impossible dates like 2021-02-30
}

const rosterKey = (name: string, dob: string | null) =>
  `${name.trim().toLowerCase()}|${dob ?? ''}`;

/**
 * Validate parsed data rows against the center's classrooms and existing
 * roster. Returns one PreviewRow per data row with resolved values + issues.
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
  const rosterKeys = new Set(roster.map((r) => rosterKey(r.name, r.dob)));
  const seenInFile = new Set<string>();

  const cellOf = (raw: string[], field: Field): string => {
    const idx = headers[field];
    return idx === undefined ? '' : (raw[idx] ?? '').trim();
  };

  return dataRows.map((raw, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = cellOf(raw, 'name');
    if (!name) errors.push('Name is required.');

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

    // nric — digits only; silently strip separators (dashes/spaces) so "200101-14-1234" works.
    const nric = cellOf(raw, 'nric').replace(/\D/g, '');

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
      else errors.push(`Status "${statusRaw}" must be active or upcoming.`);
    }

    // enrollment date (blank → server uses today)
    let enrollmentDate: string | null = null;
    const enrollRaw = cellOf(raw, 'enrollment_date');
    if (enrollRaw) {
      if (isValidISODate(enrollRaw)) enrollmentDate = enrollRaw;
      else errors.push(`Enrollment date "${enrollRaw}" must be YYYY-MM-DD.`);
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
    if (!classroomName && (days.length > 0 || enrollmentDate !== null || (statusRaw && statusRaw !== 'active'))) {
      warnings.push('Status, schedule, and start date were skipped (no classroom set).');
    }

    // guardians (two fixed groups; present if any cell non-blank)
    const guardians: GuardianInput[] = [];
    const emailsSeen: string[] = [];
    for (const g of [1, 2] as const) {
      const gName = cellOf(raw, `guardian${g}_name` as Field);
      const gEmail = cellOf(raw, `guardian${g}_email` as Field);
      const gPhone = cellOf(raw, `guardian${g}_phone` as Field);
      const gRelRaw = cellOf(raw, `guardian${g}_relationship` as Field).toLowerCase();
      // A relationship alone is meaningless (and the server drops it), so a
      // group counts as present only if it has a name, email, or phone.
      if (!gName && !gEmail && !gPhone) continue;

      if (gEmail && !EMAIL_RE.test(gEmail)) {
        errors.push(`Guardian ${g} email "${gEmail}" is invalid.`);
      }
      let rel: string | null = null;
      if (gRelRaw) {
        if (RELATIONSHIPS.includes(gRelRaw)) rel = gRelRaw;
        else errors.push(`Guardian ${g} relationship must be parent or guardian.`);
      }
      if (gEmail) emailsSeen.push(gEmail.toLowerCase());
      guardians.push({
        name: gName || null,
        email: gEmail || null,
        phone: gPhone || null,
        relationship: rel,
      });
    }
    if (emailsSeen.length === 2 && emailsSeen[0] === emailsSeen[1]) {
      errors.push('Both guardians have the same email.');
    }

    // duplicate detection (warnings, never blocking)
    let duplicateOfRoster = false;
    let duplicateInFile = false;
    if (name) {
      const key = rosterKey(name, dob);
      if (rosterKeys.has(key)) {
        duplicateOfRoster = true;
        warnings.push('Already on your roster (name + DOB match).');
      }
      if (seenInFile.has(key)) {
        duplicateInFile = true;
        warnings.push('Duplicate of another row in this file.');
      }
      seenInFile.add(key);
    }

    return {
      rowNumber: i + 1,
      name,
      dob,
      gender,
      nric,
      classroomName,
      classroomId,
      status,
      enrollmentDate,
      days,
      guardians,
      errors,
      warnings,
      duplicateOfRoster,
      duplicateInFile,
      importable: errors.length === 0,
    };
  });
}

/* ------------------------------------------------------------- payload */

export type RpcStudentRow = {
  index: number;
  name: string;
  dob: string | null;
  gender: string;
  nric: string;
  enrollments: EnrollmentInput[];
  guardians: GuardianInput[];
};

export type BulkResult = {
  inserted: number;
  failed: number;
  results: { index: number; ok: boolean; student_id?: number; error?: string }[];
};

/**
 * Build the RPC payload from the chosen preview rows. `index` is the preview
 * `rowNumber` so the server's per-row result maps back to the table.
 */
export function toRpcPayload(rows: PreviewRow[]): RpcStudentRow[] {
  const today = toISODate(new Date());
  return rows.map((r) => ({
    index: r.rowNumber,
    name: r.name,
    dob: r.dob,
    gender: r.gender,
    nric: r.nric,
    enrollments:
      r.classroomId != null
        ? [
            {
              classroom_id: r.classroomId,
              status: r.status,
              enrollment_date: r.enrollmentDate ?? today,
              days: r.days,
            },
          ]
        : [],
    guardians: r.guardians,
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
    '2021-03-14',
    'female',
    '210314140087',
    'Sunflower',
    'active',
    '2026-01-06',
    'mon tue wed thu fri',
    'Nadia Rahman',
    'nadia@example.com',
    '012-3456789',
    'parent',
    'Imran Rahman',
    'imran@example.com',
    '019-8765432',
    'parent',
  ];
  return [TEMPLATE_COLUMNS.join(','), sample.map(csvEscape).join(',')].join('\r\n');
}

/** Trigger a client-side download of CSV text. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
