import { loadCatalog, modelMeta, type ItemWithLevels } from './assessments';
import { formatDisplayDate, parseISODate } from './dates';
import { supabase } from './supabase';

type ResultRow = {
  item_id: number;
  achieved: boolean | null;
  level: number | null;
  observed_on: string | null;
  note: string | null;
};

/**
 * jsPDF ships Latin-only core fonts, so non-Latin scripts (e.g. the KSPK
 * Chinese/Tamil descriptors) won't render. We normalize common Unicode
 * punctuation to ASCII so Malay/English reports stay clean; CJK/Tamil glyphs
 * may appear blank until a Unicode font is embedded.
 */
function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');
}

function resultText(item: ItemWithLevels, v: ResultRow): string {
  if (item.item_kind === 'standard') {
    if (v.level == null) return '';
    const lvl = item.levels.find((l) => l.level === v.level);
    const label = lvl?.label ?? `TP${v.level}`;
    return clean(label + (lvl?.descriptor ? `\n${lvl.descriptor}` : ''));
  }
  if (v.achieved === true) return 'Ya / Yes';
  if (v.achieved === false) return 'Tidak / No';
  return '';
}

/** Fetch an assessment and download it as a PDF report. */
export async function downloadAssessmentPdf(assessmentId: number): Promise<void> {
  const { data: h, error } = await supabase
    .from('student_assessments')
    .select(
      'id, status, assessed_on, notes, framework_id, section_id, students(name, dob), assessment_frameworks(name, scoring_model), assessment_sections(title, min_age_months, max_age_months), exams(name, term, year), centers(name)',
    )
    .eq('id', assessmentId)
    .single();
  if (error) throw error;
  // The embedded shape is awkward to type; treat as loose here.
  const head = h as unknown as {
    status: string;
    assessed_on: string;
    notes: string | null;
    framework_id: number;
    section_id: number | null;
    students: { name: string } | null;
    assessment_frameworks: { name: string; scoring_model: string } | null;
    assessment_sections: { title: string } | null;
    exams: { name: string; term: string | null; year: number | null } | null;
    centers: { name: string } | null;
  };

  const [catalog, resultsRes] = await Promise.all([
    loadCatalog(head.framework_id, head.section_id),
    supabase
      .from('student_assessment_results')
      .select('item_id, achieved, level, observed_on, note')
      .eq('assessment_id', assessmentId),
  ]);
  const results = new Map<number, ResultRow>();
  for (const r of (resultsRes.data ?? []) as ResultRow[]) results.set(r.item_id, r);

  // Build the table of recorded items (those with a value or a note).
  const body: string[][] = [];
  let recorded = 0;
  let total = 0;
  for (const sc of catalog) {
    for (const d of sc.domains) {
      for (const item of d.items) {
        total += 1;
        const v = results.get(item.id);
        const active = !!v && (v.level != null || v.achieved != null);
        if (!v || (!active && !(v.note && v.note.trim()))) continue;
        recorded += 1;
        body.push([
          clean(d.title),
          clean((item.code ? `${item.code} ` : '') + item.title),
          resultText(item, v),
          v.observed_on ? formatDisplayDate(parseISODate(v.observed_on)) : '',
          clean(v.note),
        ]);
      }
    }
  }

  // Lazy-load jsPDF (~1 MB) only when a report is actually requested.
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(clean(head.centers?.name ?? 'Kinders'), margin, y);
  y += 20;
  doc.setFontSize(12);
  doc.text('Laporan Penilaian Murid / Student Assessment Report', margin, y);
  y += 24;

  const meta = head.assessment_frameworks ? modelMeta(head.assessment_frameworks.scoring_model) : null;
  const info: [string, string][] = [
    ['Murid / Student', clean(head.students?.name)],
    ['Penilaian / Framework', clean(head.assessment_frameworks?.name) + (meta ? ` (${meta.label})` : '')],
  ];
  if (head.exams?.name) {
    const examName = clean(head.exams.name);
    const yr = head.exams.year ? String(head.exams.year) : '';
    info.push(['Peperiksaan / Exam', yr && !examName.includes(yr) ? `${examName} ${yr}` : examName]);
  }
  info.push(['Bahagian / Section', clean(head.assessment_sections?.title) || 'Semua bidang / All areas']);
  info.push(['Tarikh / Date', formatDisplayDate(parseISODate(head.assessed_on))]);
  info.push(['Direkod / Recorded', `${recorded} / ${total}`]);
  info.push(['Status', head.status === 'completed' ? 'Selesai / Completed' : 'Draf / Draft']);

  doc.setFontSize(10);
  for (const [k, v] of info) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, margin + 150, y);
    y += 16;
  }
  y += 8;

  if (head.notes && head.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text("Komen Guru / Teacher's comment:", margin, y);
    y += 15;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(clean(head.notes), pageW - margin * 2) as string[];
    doc.text(lines, margin, y);
    y += lines.length * 13 + 10;
  }

  // Reserve room at the bottom of every page for the signature block so the
  // table never fills a page right down to the edge.
  const SIGN_RESERVE = 64;
  autoTable(doc, {
    startY: y,
    head: [['Bidang / Domain', 'Perkara / Item', 'Keputusan / Result', 'Tarikh', 'Catatan / Note']],
    body: body.length ? body : [['', 'No items recorded / Tiada item direkod', '', '', '']],
    margin: { left: margin, right: margin, bottom: SIGN_RESERVE },
    styles: { fontSize: 8, cellPadding: 3, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [0, 204, 203], textColor: [0, 50, 47], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 150 },
      2: { cellWidth: 110 },
      3: { cellWidth: 55 },
      4: { cellWidth: 'auto' },
    },
  });

  // Anchor the signatures to the bottom of the page the table ended on. The
  // reserved bottom margin guarantees the table never reaches here, so the
  // block always fits on the last page instead of spilling onto its own page.
  const sy = pageH - 44;
  const colW = (pageW - margin * 2 - 40) / 2;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.line(margin, sy, margin + colW, sy);
  doc.line(margin + colW + 40, sy, margin + colW * 2 + 40, sy);
  doc.text("Teacher's Signature", margin, sy + 16);
  doc.text('Principal Signature', margin + colW + 40, sy + 16);

  const safeName = (head.students?.name ?? 'student').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`assessment-${safeName}-${assessmentId}.pdf`);
}
