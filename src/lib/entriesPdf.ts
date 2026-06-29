import type { jsPDF } from 'jspdf';

import { entryLabel } from '@/constants/entry-actions';
import { formatDisplayDate, parseISODate } from './dates';
import { entryReportLine, entryTimeLabel, type ClassroomRef } from './entries';
import { supabase } from './supabase';

const PRIMARY: [number, number, number] = [0, 204, 203];
const ON_PRIMARY: [number, number, number] = [0, 50, 47];

/**
 * jsPDF's Latin core fonts can't render smart punctuation cleanly, so fold the
 * common Unicode dashes/quotes/ellipsis to ASCII (mirrors `assessmentPdf.ts`).
 */
function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');
}

/** The signed-in staff member is scoped to a single center; grab its name for the header. */
async function centerName(): Promise<string> {
  const { data } = await supabase.from('centers').select('name').limit(1).maybeSingle();
  return data?.name ?? 'Kinders';
}

type RawEntry = {
  entry_date: string;
  created_at: string;
  type: string;
  data: Record<string, unknown> | null;
  media: { path: string; type: string }[] | null;
  students?: { name: string } | null;
  classrooms: { name: string } | null;
  entry_activities?: ({ activities: { title: string } | null } | null)[] | null;
};

function activityTitles(e: RawEntry): string[] {
  return (e.entry_activities ?? [])
    .map((ea) => ea?.activities?.title)
    .filter((t): t is string => !!t);
}

function detailCell(e: RawEntry, classrooms: ClassroomRef[]): string {
  return clean(
    entryReportLine(e.type, e.data, {
      activities: activityTitles(e),
      mediaCount: e.media?.length ?? 0,
      classrooms,
    }),
  );
}

/** Shared table styling for both exports. */
const TABLE_STYLE = {
  styles: { fontSize: 8, cellPadding: 3, valign: 'top' as const, overflow: 'linebreak' as const },
  headStyles: { fillColor: PRIMARY, textColor: ON_PRIMARY, fontStyle: 'bold' as const },
};

function infoBlock(doc: jsPDF, margin: number, startY: number, rows: [string, string][]): number {
  let y = startY;
  doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, margin + 90, y);
    y += 15;
  }
  return y + 8;
}

function heading(doc: jsPDF, margin: number, center: string, subtitle: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(clean(center), margin, 50);
  doc.setFontSize(12);
  doc.text(subtitle, margin, 70);
  return 92;
}

export type ReportEntry = RawEntry & { students: { name: string } | null };

/**
 * Center-wide journal report: every entry in the chosen range/classroom/type as a
 * Date · Time · Student · Room · Type · Detail table. `entries` should already be
 * filtered + ordered the way the caller wants them to appear.
 */
export async function downloadEntriesReportPdf(
  entries: ReportEntry[],
  meta: { from: string; to: string; classroomName: string; typeLabel: string; classrooms: ClassroomRef[] },
): Promise<void> {
  const center = await centerName();
  // Lazy-load jsPDF (~1 MB) only when a report is actually requested.
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;

  let y = heading(doc, margin, center, 'Journal Reports');
  y = infoBlock(doc, margin, y, [
    ['Range', `${formatDisplayDate(parseISODate(meta.from))} - ${formatDisplayDate(parseISODate(meta.to))}`],
    ['Classroom', clean(meta.classroomName)],
    ['Type', clean(meta.typeLabel)],
    ['Entries', String(entries.length)],
  ]);

  const body = entries.map((e) => [
    formatDisplayDate(parseISODate(e.entry_date)),
    entryTimeLabel(e.data, e.created_at),
    clean(e.students?.name ?? ''),
    clean(e.classrooms?.name ?? ''),
    entryLabel(e.type),
    detailCell(e, meta.classrooms),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Time', 'Student', 'Room', 'Type', 'Detail']],
    body: body.length ? body : [['', '', '', '', '', 'No entries in range']],
    margin: { left: margin, right: margin },
    ...TABLE_STYLE,
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 48 },
      2: { cellWidth: 82 },
      3: { cellWidth: 70 },
      4: { cellWidth: 56 },
      5: { cellWidth: 'auto' },
    },
  });

  doc.save(`journal-reports-${meta.from}-to-${meta.to}.pdf`);
}

/**
 * Per-student journal: the child's full entry history (newest first) as a
 * Date · Time · Type · Room · Detail table. Fetches its own data so the export
 * isn't limited to whatever the detail screen happened to load.
 */
export async function downloadStudentJournalPdf(studentId: number): Promise<void> {
  const [center, studentRes, classroomsRes, entriesRes] = await Promise.all([
    centerName(),
    supabase.from('students').select('name').eq('id', studentId).maybeSingle(),
    supabase.from('classrooms').select('id, name'),
    supabase
      .from('entries')
      .select(
        'entry_date, created_at, type, data, media, classrooms(name), entry_activities(activities(title))',
      )
      .eq('student_id', studentId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  if (studentRes.error) throw studentRes.error;
  if (entriesRes.error) throw entriesRes.error;

  const student = studentRes.data as unknown as { name: string } | null;
  const classrooms = (classroomsRes.data ?? []) as unknown as ClassroomRef[];
  const rows = (entriesRes.data ?? []) as unknown as RawEntry[];

  // Lazy-load jsPDF (~1 MB) only when a report is actually requested.
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;

  let y = heading(doc, margin, center, 'Student Journal');
  y = infoBlock(doc, margin, y, [
    ['Student', clean(student?.name ?? 'Student')],
    ['Entries', String(rows.length)],
    ['Generated', formatDisplayDate(new Date())],
  ]);

  const body = rows.map((e) => [
    formatDisplayDate(parseISODate(e.entry_date)),
    entryTimeLabel(e.data, e.created_at),
    entryLabel(e.type),
    clean(e.classrooms?.name ?? ''),
    detailCell(e, classrooms),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Time', 'Type', 'Room', 'Detail']],
    body: body.length ? body : [['', '', '', '', 'No journal entries yet']],
    margin: { left: margin, right: margin },
    ...TABLE_STYLE,
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 50 },
      2: { cellWidth: 58 },
      3: { cellWidth: 76 },
      4: { cellWidth: 'auto' },
    },
  });

  const safe = (student?.name ?? 'student').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`journal-${safe}.pdf`);
}
