import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  DateInput,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Spinner,
  TextInput,
  Textarea,
} from '@/components/ui';
import { downloadAssessmentPdf } from '@/lib/assessmentPdf';
import {
  formatAgeBand,
  loadCatalog,
  modelMeta,
  type ItemWithLevels,
  type ResultValue,
  type SectionCatalog,
} from '@/lib/assessments';
import { useAuth } from '@/lib/auth';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type Header = {
  id: number;
  status: string;
  assessed_on: string;
  notes: string | null;
  framework_id: number;
  section_id: number | null;
  exam_id: number | null;
  student_id: number;
  students: { name: string; dob: string | null } | null;
  assessment_frameworks: { name: string; scoring_model: string; description: string | null } | null;
  exams: { name: string; term: string | null; year: number | null } | null;
};

const EMPTY: ResultValue = { achieved: null, level: null, observed_on: null, note: null };
const isActive = (v?: ResultValue) => !!v && (v.level != null || v.achieved != null);

export function AssessmentDetail() {
  const { id } = useParams();
  const aid = Number(id);
  const { can } = useAuth();
  const canManage = can('manage_assessments');

  const [header, setHeader] = useState<Header | null>(null);
  const [catalog, setCatalog] = useState<SectionCatalog[]>([]);
  const [values, setValues] = useState<Record<number, ResultValue>>({});
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [commentDirty, setCommentDirty] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: h, error: hErr } = await supabase
          .from('student_assessments')
          .select(
            'id, status, assessed_on, notes, framework_id, section_id, exam_id, student_id, students(name, dob), assessment_frameworks(name, scoring_model, description), exams(name, term, year)',
          )
          .eq('id', aid)
          .maybeSingle();
        if (hErr) throw hErr;
        if (!h) {
          if (active) setHeader(null);
          return;
        }
        const head = h as unknown as Header;
        const [cat, resultsRes] = await Promise.all([
          loadCatalog(head.framework_id, head.section_id),
          supabase
            .from('student_assessment_results')
            .select('item_id, achieved, level, observed_on, note')
            .eq('assessment_id', aid),
        ]);
        if (!active) return;
        if (resultsRes.error) throw resultsRes.error;
        const map: Record<number, ResultValue> = {};
        for (const r of resultsRes.data ?? []) {
          map[r.item_id] = {
            achieved: r.achieved,
            level: r.level,
            observed_on: r.observed_on,
            note: r.note,
          };
        }
        setHeader(head);
        setComment(head.notes ?? '');
        setCommentDirty(false);
        setCatalog(cat);
        setValues(map);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load assessment.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [aid]);

  const allItems = useMemo(
    () => catalog.flatMap((s) => s.domains.flatMap((d) => d.items)),
    [catalog],
  );
  const answered = useMemo(
    () => allItems.filter((it) => isActive(values[it.id])).length,
    [allItems, values],
  );

  const patch = (itemId: number, p: Partial<ResultValue>) => {
    if (!canManage) return;
    setValues((prev) => ({ ...prev, [itemId]: { ...EMPTY, ...prev[itemId], ...p } }));
    setDirty((prev) => new Set(prev).add(itemId));
    setSavedNote(null);
  };

  const save = async (): Promise<boolean> => {
    if (dirty.size === 0 && !commentDirty) return true;
    setSaving(true);
    setError(null);
    try {
      const ids = [...dirty];
      const toUpsert = ids
        .filter((iid) => {
          const v = values[iid];
          return v && (v.achieved != null || v.level != null || (v.note && v.note.trim()));
        })
        .map((iid) => ({ assessment_id: aid, item_id: iid, ...values[iid] }));
      const toDelete = ids.filter((iid) => {
        const v = values[iid];
        return !v || (v.achieved == null && v.level == null && !(v.note && v.note.trim()));
      });

      if (toDelete.length) {
        const { error: dErr } = await supabase
          .from('student_assessment_results')
          .delete()
          .eq('assessment_id', aid)
          .in('item_id', toDelete);
        if (dErr) throw dErr;
      }
      if (toUpsert.length) {
        const { error: uErr } = await supabase
          .from('student_assessment_results')
          .upsert(toUpsert, { onConflict: 'assessment_id,item_id' });
        if (uErr) throw uErr;
      }
      await supabase
        .from('student_assessments')
        .update({ notes: comment.trim() ? comment : null, updated_at: new Date().toISOString() })
        .eq('id', aid);
      setDirty(new Set());
      setCommentDirty(false);
      setSavedNote('Saved');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: 'draft' | 'completed') => {
    const ok = await save();
    if (!ok) return;
    setSaving(true);
    try {
      const { error: sErr } = await supabase
        .from('student_assessments')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', aid);
      if (sErr) throw sErr;
      setHeader((h) => (h ? { ...h, status } : h));
      setSavedNote(status === 'completed' ? 'Marked complete' : 'Reopened');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update status.');
    } finally {
      setSaving(false);
    }
  };

  const backLink = (
    <Link to="/assessments" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Assessments
    </Link>
  );

  if (loading) return <div><PageHeader title="Assessment" actions={backLink} /><Loading /></div>;
  if (error && !header)
    return <div><PageHeader title="Assessment" actions={backLink} /><ErrorState message={error} /></div>;
  if (!header)
    return <div><PageHeader title="Assessment" actions={backLink} /><EmptyState title="Assessment not found" icon="🔍" /></div>;

  const meta = header.assessment_frameworks ? modelMeta(header.assessment_frameworks.scoring_model) : null;
  const completed = header.status === 'completed';
  const hasChanges = dirty.size > 0 || commentDirty;

  const downloadPdf = async () => {
    setPdfBusy(true);
    setError(null);
    try {
      await downloadAssessmentPdf(aid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const actionButtons = canManage ? (
    <>
      <Button variant="secondary" onClick={save} disabled={saving || !hasChanges}>
        {saving ? <Spinner size={16} /> : hasChanges ? (dirty.size ? `Save (${dirty.size})` : 'Save') : 'Saved'}
      </Button>
      {completed ? (
        <Button variant="outline" onClick={() => setStatus('draft')} disabled={saving}>
          Reopen
        </Button>
      ) : (
        <Button onClick={() => setStatus('completed')} disabled={saving}>
          Mark complete
        </Button>
      )}
    </>
  ) : null;

  return (
    <div>
      <PageHeader
        title={header.students?.name ?? 'Assessment'}
        subtitle={header.assessment_frameworks?.name ?? undefined}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {backLink}
            <Button variant="secondary" onClick={downloadPdf} disabled={pdfBusy}>
              {pdfBusy ? <Spinner size={16} /> : 'PDF'}
            </Button>
            {actionButtons}
          </div>
        }
      />

      <Card style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>
            {meta ? `${meta.icon} ${meta.label}` : ''} · {formatDisplayDate(parseISODate(header.assessed_on))}
            {header.exams?.name ? ` · 📋 ${header.exams.name}` : ''}
          </div>
          {header.assessment_frameworks?.description ? (
            <div style={{ fontSize: 13, color: Brand.onSurfaceVariant, marginTop: 4, lineHeight: 1.45 }}>
              {header.assessment_frameworks.description}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge tone={completed ? 'success' : 'warning'}>{completed ? 'Completed' : 'Draft'}</Badge>
          <Badge tone="primary">
            {answered} / {allItems.length} recorded
          </Badge>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: Brand.onSurface, marginBottom: 8 }}>
          Teacher's comment
        </div>
        {canManage ? (
          <Textarea
            value={comment}
            onChange={(t) => {
              setComment(t);
              setCommentDirty(true);
              setSavedNote(null);
            }}
            placeholder="Overall comment for this child's assessment…"
            rows={3}
          />
        ) : (
          <div style={{ fontSize: 14, color: Brand.onSurfaceVariant, lineHeight: 1.5 }}>
            {comment || '—'}
          </div>
        )}
      </Card>

      {error ? <div style={{ marginTop: 16 }}><ErrorState message={error} /></div> : null}
      {savedNote ? (
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: Brand.onSuccessContainer }}>
          ✓ {savedNote}
        </div>
      ) : null}

      <div style={{ marginTop: 8 }}>
        {catalog.map((sc) => (
          <section key={sc.section.id}>
            {catalog.length > 1 ? (
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: Brand.onSurface,
                  margin: '28px 0 6px',
                }}
              >
                {sc.section.title}
                {formatAgeBand(sc.section.min_age_months, sc.section.max_age_months) ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: Brand.onSurfaceVariant, marginLeft: 10 }}>
                    {formatAgeBand(sc.section.min_age_months, sc.section.max_age_months)}
                  </span>
                ) : null}
              </h2>
            ) : null}

            {sc.domains.map((d) => (
              <div key={d.id} style={{ marginTop: 20 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: Brand.onSurface,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    marginBottom: 10,
                  }}
                >
                  {d.code ? <span style={{ color: Brand.primary }}>{d.code} · </span> : null}
                  {d.title}
                </h3>
                <Card padding={0}>
                  {d.items.map((item, i) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      value={values[item.id]}
                      today={today}
                      first={i === 0}
                      onChange={(p) => patch(item.id, p)}
                    />
                  ))}
                </Card>
              </div>
            ))}
          </section>
        ))}
      </div>

      {canManage ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            marginTop: 28,
            paddingTop: 16,
            borderTop: `1px solid ${Brand.outlineVariant}`,
          }}
        >
          {actionButtons}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- one item row */

function ItemRow({
  item,
  value,
  today,
  first,
  onChange,
}: {
  item: ItemWithLevels;
  value?: ResultValue;
  today: string;
  first: boolean;
  onChange: (patch: Partial<ResultValue>) => void;
}) {
  const v = value ?? EMPTY;
  const isRubric = item.item_kind === 'standard';
  const isAlert = item.item_kind === 'alert';
  const active = isActive(v);
  const bg =
    v.level != null
      ? Brand.primaryContainer + '22'
      : v.achieved === true
        ? Brand.successContainer + '55'
        : v.achieved === false
          ? Brand.errorContainer + '44'
          : 'transparent';

  return (
    <div
      style={{
        padding: '14px 18px',
        borderTop: first ? 'none' : `1px solid ${Brand.outlineVariant}`,
        background: bg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, color: Brand.onSurface, lineHeight: 1.45 }}>
            {item.code ? <strong style={{ color: Brand.onSurface }}>{item.code} </strong> : null}
            {item.title}
          </div>
          {item.description ? (
            <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 3 }}>
              {item.description}
            </div>
          ) : null}
        </div>
        {!isRubric ? (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <ChoiceButton
              label="Ya"
              tone="yes"
              selected={v.achieved === true}
              onClick={() =>
                onChange(
                  v.achieved === true
                    ? { achieved: null, observed_on: null }
                    : { achieved: true, observed_on: isAlert ? null : v.observed_on ?? today },
                )
              }
            />
            <ChoiceButton
              label="Tidak"
              tone="no"
              selected={v.achieved === false}
              onClick={() =>
                onChange(v.achieved === false ? { achieved: null } : { achieved: false, observed_on: null })
              }
            />
          </div>
        ) : null}
      </div>

      {/* Rubric: pick a Tahap Penguasaan level */}
      {isRubric && item.levels.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {item.levels.map((lv) => {
            const selected = v.level === lv.level;
            return (
              <button
                key={lv.id}
                type="button"
                onClick={() => onChange({ level: selected ? null : lv.level })}
                style={{
                  textAlign: 'left',
                  border: `1px solid ${selected ? Brand.primary : Brand.outlineVariant}`,
                  background: selected ? Brand.primaryContainer : Brand.white,
                  borderRadius: Radius.md,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    background: selected ? Brand.primary : Brand.surfaceContainerHigh,
                    color: selected ? Brand.onPrimary : Brand.onSurfaceVariant,
                    borderRadius: Radius.sm,
                    padding: '2px 8px',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {lv.label ?? `TP${lv.level}`}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    color: selected ? Brand.onPrimaryContainer : Brand.onSurface,
                    lineHeight: 1.4,
                  }}
                >
                  {lv.descriptor}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Observed date (only when "Ya" for checklist / milestone) + free note */}
      {active ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {!isRubric && !isAlert && v.achieved === true ? (
            <DateInput
              value={v.observed_on ?? ''}
              onChange={(d) => onChange({ observed_on: d || null })}
              style={{ minWidth: 150 }}
            />
          ) : null}
          <TextInput
            value={v.note ?? ''}
            onChange={(t) => onChange({ note: t || null })}
            placeholder="Catatan / note (optional)"
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------- Ya / Tidak choice pill */

function ChoiceButton({
  label,
  tone,
  selected,
  onClick,
}: {
  label: string;
  tone: 'yes' | 'no';
  selected: boolean;
  onClick: () => void;
}) {
  const palette =
    tone === 'yes'
      ? { bg: Brand.successContainer, fg: Brand.onSuccessContainer, border: Brand.success }
      : { bg: Brand.errorContainer, fg: Brand.onErrorContainer, border: Brand.error };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 62,
        border: `1px solid ${selected ? palette.border : Brand.outlineVariant}`,
        background: selected ? palette.bg : Brand.white,
        color: selected ? palette.fg : Brand.onSurfaceVariant,
        borderRadius: Radius.full,
        padding: '7px 16px',
        fontSize: 13.5,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
