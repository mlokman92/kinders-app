/**
 * Assessment catalog + records data layer.
 *
 * The catalog (frameworks -> sections -> domains -> items -> levels) is a global,
 * read-only taxonomy seeded from the Malaysia early-childhood standards (PERMATA
 * developmental checklists, KSPK Prasekolah performance rubric, and the KKM
 * special-needs screening). Records (`student_assessments` + per-item
 * `student_assessment_results`) are written per center, RLS-scoped like `entries`.
 */
import type { Tables } from './database.types';
import { supabase } from './supabase';

export type ScoringModel = 'checklist' | 'rubric' | 'screening';
export type ItemKind = 'checklist' | 'standard' | 'milestone' | 'alert';

export type Framework = Tables<'assessment_frameworks'>;
export type Exam = Tables<'exams'>;
export type Section = Tables<'assessment_sections'>;
export type Domain = Tables<'assessment_domains'>;
export type Item = Tables<'assessment_items'>;
export type Level = Tables<'assessment_item_levels'>;
export type StudentAssessment = Tables<'student_assessments'>;
export type ResultRow = Tables<'student_assessment_results'>;

export type ItemWithLevels = Item & { levels: Level[] };
export type DomainWithItems = Domain & { items: ItemWithLevels[] };
export type SectionCatalog = { section: Section; domains: DomainWithItems[] };

/** A flat assessment result keyed by item, as edited on the recording screen. */
export type ResultValue = {
  achieved: boolean | null;
  level: number | null;
  observed_on: string | null;
  note: string | null;
};

/** Per scoring-model presentation (icon + accent + how a result reads). */
export const MODEL_META: Record<
  ScoringModel,
  { icon: string; label: string; verb: string }
> = {
  checklist: { icon: '📋', label: 'Developmental checklist', verb: 'Observed' },
  rubric: { icon: '🎯', label: 'Performance rubric', verb: 'Mastery level' },
  screening: { icon: '🩺', label: 'Screening', verb: 'Present' },
};

export function modelMeta(model: string) {
  return MODEL_META[(model as ScoringModel) in MODEL_META ? (model as ScoringModel) : 'checklist'];
}

/** Whole-month age from a YYYY-MM-DD date of birth, or null if unparseable. */
export function ageInMonths(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return months >= 0 ? months : null;
}

/** "0–6 mo", "1–2 yr", "6–7 yr" style band label from a month range. */
export function formatAgeBand(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const unit = (max ?? min ?? 0) >= 24 ? 'yr' : 'mo';
  const conv = (m: number | null) =>
    m == null ? '' : unit === 'yr' ? +(m / 12).toFixed(m % 12 === 0 ? 0 : 1) : m;
  if (min != null && max != null) return `${conv(min)}–${conv(max)} ${unit}`;
  if (min != null) return `${conv(min)}+ ${unit}`;
  return `≤${conv(max)} ${unit}`;
}

/** Is a month-age within a section's [min, max] band? Open-ended bounds allowed. */
export function ageFitsSection(months: number | null, s: Section): boolean {
  if (months == null) return false;
  if (s.min_age_months != null && months < s.min_age_months) return false;
  if (s.max_age_months != null && months > s.max_age_months) return false;
  return true;
}

export async function listFrameworks(): Promise<Framework[]> {
  const { data, error } = await supabase
    .from('assessment_frameworks')
    .select('*')
    .order('sort');
  if (error) throw error;
  return data ?? [];
}

/** Center examinations the signed-in staff may see (RLS scopes to their center). */
export async function listExams(centerId?: number): Promise<Exam[]> {
  let q = supabase.from('exams').select('*');
  if (centerId != null) q = q.eq('center_id', centerId);
  const { data, error } = await q
    .order('year', { ascending: false, nullsFirst: false })
    .order('starts_on', { ascending: false, nullsFirst: false })
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listSections(frameworkId: number): Promise<Section[]> {
  const { data, error } = await supabase
    .from('assessment_sections')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('sort');
  if (error) throw error;
  return data ?? [];
}

/**
 * Load the domain/item/level tree for a recording session: one section when
 * `sectionId` is given (a Permata age band or the KSPK section), or every
 * section of the framework when `sectionId` is null (a holistic screen).
 */
export async function loadCatalog(
  frameworkId: number,
  sectionId: number | null,
): Promise<SectionCatalog[]> {
  let sectionQuery = supabase.from('assessment_sections').select('*');
  sectionQuery = sectionId != null
    ? sectionQuery.eq('id', sectionId)
    : sectionQuery.eq('framework_id', frameworkId);
  const { data: sections, error: sErr } = await sectionQuery.order('sort');
  if (sErr) throw sErr;
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (sectionIds.length === 0) return [];

  const { data: domains, error: dErr } = await supabase
    .from('assessment_domains')
    .select('*')
    .in('section_id', sectionIds)
    .order('sort');
  if (dErr) throw dErr;
  const domainIds = (domains ?? []).map((d) => d.id);

  let items: Item[] = [];
  if (domainIds.length) {
    const { data, error } = await supabase
      .from('assessment_items')
      .select('*')
      .in('domain_id', domainIds)
      .order('sort');
    if (error) throw error;
    items = data ?? [];
  }

  const itemIds = items.map((i) => i.id);
  let levels: Level[] = [];
  if (itemIds.length) {
    const { data, error } = await supabase
      .from('assessment_item_levels')
      .select('*')
      .in('item_id', itemIds)
      .order('level');
    if (error) throw error;
    levels = data ?? [];
  }

  const levelsByItem = new Map<number, Level[]>();
  for (const l of levels) {
    const arr = levelsByItem.get(l.item_id) ?? [];
    arr.push(l);
    levelsByItem.set(l.item_id, arr);
  }
  const itemsByDomain = new Map<number, ItemWithLevels[]>();
  for (const it of items) {
    const arr = itemsByDomain.get(it.domain_id) ?? [];
    arr.push({ ...it, levels: levelsByItem.get(it.id) ?? [] });
    itemsByDomain.set(it.domain_id, arr);
  }
  const domainsBySection = new Map<number, DomainWithItems[]>();
  for (const d of domains ?? []) {
    const arr = domainsBySection.get(d.section_id) ?? [];
    arr.push({ ...d, items: itemsByDomain.get(d.id) ?? [] });
    domainsBySection.set(d.section_id, arr);
  }
  return (sections ?? []).map((section) => ({
    section,
    domains: domainsBySection.get(section.id) ?? [],
  }));
}
