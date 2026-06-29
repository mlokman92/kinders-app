import type { jsPDF } from 'jspdf';
import type { CellHookData } from 'jspdf-autotable';

import { entryLabel } from '@/constants/entry-actions';
import { formatDisplayDate, parseISODate } from './dates';
import { entryReportLine, entryTimeLabel, type ClassroomRef } from './entries';
import { getEntryMediaUrls, getStudentPhotoUrl } from './storage';
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

/* ------------------------------------------------------------------ images */

type LoadedImage = { dataUrl: string; w: number; h: number; format: 'JPEG' };

/**
 * Fetch an image URL and re-encode it to a downscaled JPEG data URL for jsPDF.
 * Going through a fetched blob (same-origin object URL) keeps the canvas un-tainted,
 * and re-encoding normalizes webp/alpha-PNG that `addImage` would otherwise reject.
 * Videos or any failure resolve to null so the report still renders.
 */
async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null; // skip videos / non-images
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('decode failed'));
        im.src = objectUrl;
      });
      const maxSide = 500; // thumbnails never need more — keeps the PDF small
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff'; // flatten any transparency for JPEG
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), w, h, format: 'JPEG' };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** Sign + decode a student profile photo (student-photos bucket) for the header. */
async function loadStudentPhoto(path: string | null | undefined): Promise<LoadedImage | null> {
  if (!path) return null;
  const url = await getStudentPhotoUrl(path);
  return url ? loadImage(url) : null;
}

/** One thumbnail per row — each entry's first attached image, aligned to `rows`. */
async function loadRowThumbnails(rows: RawEntry[]): Promise<(LoadedImage | null)[]> {
  const firstPath = rows.map((e) => (e.media ?? []).find((m) => m.type === 'image')?.path ?? null);
  const unique = [...new Set(firstPath.filter((p): p is string => !!p))];
  if (unique.length === 0) return rows.map(() => null);
  const urls = await getEntryMediaUrls(unique);
  const loaded: Record<string, LoadedImage | null> = {};
  await Promise.all(unique.map(async (p) => {
    loaded[p] = urls[p] ? await loadImage(urls[p]) : null;
  }));
  return firstPath.map((p) => (p ? loaded[p] : null));
}

/** Draw the student photo in the top-right corner, fit within a square. */
function drawHeaderPhoto(doc: jsPDF, img: LoadedImage | null, pageW: number, margin: number): void {
  if (!img) return;
  const box = 56;
  const scale = Math.min(box / img.w, box / img.h);
  doc.addImage(img.dataUrl, img.format, pageW - margin - img.w * scale, 30, img.w * scale, img.h * scale);
}

/** A blank table cell sized to hold a thumbnail (or normal height when there's no image). */
function photoCell(img: LoadedImage | null): { content: string; styles?: { minCellHeight: number } } {
  return img ? { content: '', styles: { minCellHeight: 56 } } : { content: '' };
}

/** An autoTable `didDrawCell` hook that paints each row's thumbnail into the photo column. */
function photoDrawer(
  doc: jsPDF,
  rowImages: (LoadedImage | null)[],
  photoCol: number,
): (data: CellHookData) => void {
  return (data) => {
    if (data.section !== 'body' || data.column.index !== photoCol) return;
    const img = rowImages[data.row.index];
    if (!img) return;
    const pad = 3;
    const scale = Math.min((data.cell.width - pad * 2) / img.w, (data.cell.height - pad * 2) / img.h);
    doc.addImage(img.dataUrl, img.format, data.cell.x + pad, data.cell.y + pad, img.w * scale, img.h * scale);
  };
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
    supabase.from('students').select('name, profile_picture_url').eq('id', studentId).maybeSingle(),
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

  const student = studentRes.data as unknown as { name: string; profile_picture_url: string | null } | null;
  const classrooms = (classroomsRes.data ?? []) as unknown as ClassroomRef[];
  const rows = (entriesRes.data ?? []) as unknown as RawEntry[];

  // Lazy-load jsPDF (~1 MB) only when a report is actually requested.
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();

  // Decode the student photo + per-entry thumbnails (skips videos / failures gracefully).
  const [photo, rowImages] = await Promise.all([
    loadStudentPhoto(student?.profile_picture_url),
    loadRowThumbnails(rows),
  ]);

  let y = heading(doc, margin, center, 'Student Journal');
  drawHeaderPhoto(doc, photo, pageW, margin);
  y = infoBlock(doc, margin, y, [
    ['Student', clean(student?.name ?? 'Student')],
    ['Entries', String(rows.length)],
    ['Generated', formatDisplayDate(new Date())],
  ]);

  const body = rows.map((e, i) => [
    formatDisplayDate(parseISODate(e.entry_date)),
    entryTimeLabel(e.data, e.created_at),
    entryLabel(e.type),
    clean(e.classrooms?.name ?? ''),
    detailCell(e, classrooms),
    photoCell(rowImages[i]),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Time', 'Type', 'Room', 'Detail', 'Photo']],
    body: body.length ? body : [['', '', '', '', 'No journal entries yet', '']],
    margin: { left: margin, right: margin },
    ...TABLE_STYLE,
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 50 },
      2: { cellWidth: 58 },
      3: { cellWidth: 70 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 64 },
    },
    didDrawCell: photoDrawer(doc, rowImages, 5),
  });

  const safe = (student?.name ?? 'student').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`journal-${safe}.pdf`);
}

/**
 * Single-day report for one child — the daily sheet that goes home: the day's entries
 * in chronological order as a Time · Type · Detail table.
 */
export async function downloadStudentDailyReportPdf(studentId: number, date: string): Promise<void> {
  const [center, studentRes, classroomsRes, entriesRes] = await Promise.all([
    centerName(),
    supabase.from('students').select('name, profile_picture_url').eq('id', studentId).maybeSingle(),
    supabase.from('classrooms').select('id, name'),
    supabase
      .from('entries')
      .select(
        'entry_date, created_at, type, data, media, classrooms(name), entry_activities(activities(title))',
      )
      .eq('student_id', studentId)
      .eq('entry_date', date)
      .order('created_at', { ascending: true }),
  ]);
  if (studentRes.error) throw studentRes.error;
  if (entriesRes.error) throw entriesRes.error;

  const student = studentRes.data as unknown as { name: string; profile_picture_url: string | null } | null;
  const classrooms = (classroomsRes.data ?? []) as unknown as ClassroomRef[];
  const rows = (entriesRes.data ?? []) as unknown as RawEntry[];

  // Lazy-load jsPDF (~1 MB) only when a report is actually requested.
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();

  // Decode the student photo + per-entry thumbnails (skips videos / failures gracefully).
  const [photo, rowImages] = await Promise.all([
    loadStudentPhoto(student?.profile_picture_url),
    loadRowThumbnails(rows),
  ]);

  const room = rows.find((r) => r.classrooms?.name)?.classrooms?.name ?? '';

  let y = heading(doc, margin, center, 'Daily Report');
  drawHeaderPhoto(doc, photo, pageW, margin);
  y = infoBlock(doc, margin, y, [
    ['Student', clean(student?.name ?? 'Student')],
    ['Date', formatDisplayDate(parseISODate(date))],
    ...(room ? ([['Classroom', clean(room)]] as [string, string][]) : []),
    ['Entries', String(rows.length)],
  ]);

  const body = rows.map((e, i) => [
    entryTimeLabel(e.data, e.created_at),
    entryLabel(e.type),
    detailCell(e, classrooms),
    photoCell(rowImages[i]),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Time', 'Type', 'Detail', 'Photo']],
    body: body.length ? body : [['', '', 'No entries logged on this day', '']],
    margin: { left: margin, right: margin },
    ...TABLE_STYLE,
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 80 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 72 },
    },
    didDrawCell: photoDrawer(doc, rowImages, 3),
  });

  const safe = (student?.name ?? 'student').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`daily-report-${safe}-${date}.pdf`);
}
