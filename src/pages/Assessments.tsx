import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { ManageExamsModal } from '@/components/ManageExamsModal';
import { NewAssessmentModal } from '@/components/NewAssessmentModal';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Select,
  Spinner,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { modelMeta } from '@/lib/assessments';
import { downloadAssessmentPdf } from '@/lib/assessmentPdf';
import { useAuth } from '@/lib/auth';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

const PER_PAGE = 50;

type Classroom = { id: number; name: string };

type Row = {
  id: number;
  status: string;
  assessed_on: string;
  created_at: string;
  students: { id: number; name: string; enrollments: { classrooms: Classroom | null }[] } | null;
  assessment_frameworks: { name: string; scoring_model: string } | null;
  assessment_sections: { title: string } | null;
  exams: { name: string } | null;
};

/** Page-number tokens with ellipsis for compact pagers. */
function pageTokens(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const tokens: (number | '…')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) tokens.push('…');
  for (let p = left; p <= right; p++) tokens.push(p);
  if (right < total - 1) tokens.push('…');
  tokens.push(total);
  return tokens;
}

function PagerButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34,
        height: 34,
        padding: '0 10px',
        borderRadius: Radius.md,
        border: `1px solid ${active ? Brand.primary : Brand.outlineVariant}`,
        background: active ? Brand.primaryContainer : Brand.white,
        color: active ? Brand.onPrimaryContainer : Brand.onSurface,
        fontSize: 13.5,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Assessments() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const currentYear = String(new Date().getFullYear());

  const [rows, setRows] = useState<Row[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [framework, setFramework] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [year, setYear] = useState(currentYear);
  const [classroom, setClassroom] = useState('');
  const [page, setPage] = useState(1);

  const [showNew, setShowNew] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supabase
        .from('student_assessments')
        .select(
          'id, status, assessed_on, created_at, students(id, name, enrollments(classrooms(id, name))), assessment_frameworks(name, scoring_model), assessment_sections(title), exams(name)',
        )
        .order('assessed_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      setRows((res.data ?? []) as unknown as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    supabase
      .from('classrooms')
      .select('id, name')
      .order('name')
      .then(({ data }) => setClassrooms((data ?? []) as Classroom[]));
  }, []);

  // Reset to the first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, framework, examFilter, year, classroom]);

  const handlePdf = async (id: number) => {
    setPdfBusyId(id);
    setError(null);
    try {
      await downloadAssessmentPdf(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setPdfBusyId(null);
    }
  };

  const frameworkNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.assessment_frameworks?.name).filter(Boolean))) as string[],
    [rows],
  );
  const examNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.exams?.name).filter(Boolean))) as string[],
    [rows],
  );
  const years = useMemo(() => {
    const set = new Set<string>(rows.map((r) => r.assessed_on?.slice(0, 4)).filter(Boolean) as string[]);
    set.add(currentYear);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows, currentYear]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cls = classroom ? Number(classroom) : null;
    return rows.filter((r) => {
      if (framework && r.assessment_frameworks?.name !== framework) return false;
      if (examFilter && r.exams?.name !== examFilter) return false;
      if (year && r.assessed_on?.slice(0, 4) !== year) return false;
      if (cls != null) {
        const ids = (r.students?.enrollments ?? [])
          .map((e) => e.classrooms?.id)
          .filter((id): id is number => id != null);
        if (!ids.includes(cls)) return false;
      }
      if (q && !(r.students?.name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, framework, examFilter, year, classroom]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const graded = filtered.filter((r) => r.status === 'completed').length;
    const students = new Set(filtered.map((r) => r.students?.id).filter(Boolean)).size;
    return { total, graded, pending: total - graded, students };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div>
      <PageHeader
        title="Assessments"
        subtitle="Track each child's development against the Malaysia early-childhood standards."
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {role === 'director' ? (
              <Button variant="secondary" onClick={() => setShowManage(true)}>
                Manage exams
              </Button>
            ) : null}
            <Button onClick={() => setShowNew(true)}>+ New assessment</Button>
          </div>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          message="Start one with “+ New assessment” to record a child's progress."
          icon="📝"
        />
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <StatGrid>
              <Stat label="Assessments" value={stats.total} icon="📝" accent={Brand.primary} />
              <Stat label="Graded" value={stats.graded} icon="✅" accent={Brand.success} hint="Completed" />
              <Stat label="Pending" value={stats.pending} icon="🕒" accent={Brand.tertiary} hint="Draft" />
              <Stat label="Students" value={stats.students} icon="🧒" accent={Brand.secondary} hint="Assessed" />
            </StatGrid>
          </div>

          <Toolbar>
            <Field label="Year">
              <Select
                value={year}
                onChange={setYear}
                options={[{ value: '', label: 'All years' }, ...years.map((y) => ({ value: y, label: y }))]}
              />
            </Field>
            {classrooms.length > 0 ? (
              <Field label="Classroom">
                <Select
                  value={classroom}
                  onChange={setClassroom}
                  options={[
                    { value: '', label: 'All classrooms' },
                    ...classrooms.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </Field>
            ) : null}
            <Field label="Framework">
              <Select
                value={framework}
                onChange={setFramework}
                options={[
                  { value: '', label: 'All frameworks' },
                  ...frameworkNames.map((n) => ({ value: n, label: n })),
                ]}
              />
            </Field>
            {examNames.length > 0 ? (
              <Field label="Exam">
                <Select
                  value={examFilter}
                  onChange={setExamFilter}
                  options={[
                    { value: '', label: 'All exams' },
                    ...examNames.map((n) => ({ value: n, label: n })),
                  ]}
                />
              </Field>
            ) : null}
          </Toolbar>

          <div style={{ marginBottom: 20 }}>
            <Field label="Search">
              <TextInput value={search} onChange={setSearch} placeholder="Search by student…" />
            </Field>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="No assessments match your filters." icon="🔍" />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Exam</Th>
                    <Th>Framework</Th>
                    <Th>Area / band</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th align="right">Report</Th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => {
                    const meta = r.assessment_frameworks
                      ? modelMeta(r.assessment_frameworks.scoring_model)
                      : null;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate(`/assessments/${r.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Td>
                          <span style={{ fontWeight: 700, color: Brand.onSurface }}>
                            {r.students?.name ?? 'Unknown'}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ color: Brand.onSurfaceVariant }}>{r.exams?.name ?? '—'}</span>
                        </Td>
                        <Td>
                          <span style={{ color: Brand.onSurface }}>
                            {meta ? `${meta.icon} ` : ''}
                            {r.assessment_frameworks?.name ?? '—'}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ color: Brand.onSurfaceVariant }}>
                            {r.assessment_sections?.title ?? 'All areas'}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ color: Brand.onSurfaceVariant }}>
                            {formatDisplayDate(parseISODate(r.assessed_on))}
                          </span>
                        </Td>
                        <Td>
                          <Badge tone={r.status === 'completed' ? 'success' : 'warning'}>
                            {r.status === 'completed' ? 'Completed' : 'Draft'}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                            <Button
                              variant="secondary"
                              onClick={() => handlePdf(r.id)}
                              disabled={pdfBusyId === r.id}
                            >
                              {pdfBusyId === r.id ? <Spinner size={14} /> : 'PDF'}
                            </Button>
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginTop: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 13, color: Brand.onSurfaceVariant }}>
                  Showing {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} of{' '}
                  {filtered.length}
                </div>
                {pageCount > 1 ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <PagerButton onClick={() => setPage(safePage - 1)} disabled={safePage === 1}>
                      ‹ Prev
                    </PagerButton>
                    {pageTokens(safePage, pageCount).map((t, i) =>
                      t === '…' ? (
                        <span key={`e${i}`} style={{ padding: '0 4px', color: Brand.onSurfaceVariant }}>
                          …
                        </span>
                      ) : (
                        <PagerButton key={t} active={t === safePage} onClick={() => setPage(t)}>
                          {t}
                        </PagerButton>
                      ),
                    )}
                    <PagerButton onClick={() => setPage(safePage + 1)} disabled={safePage === pageCount}>
                      Next ›
                    </PagerButton>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </>
      )}

      {showNew ? (
        <NewAssessmentModal
          onClose={() => setShowNew(false)}
          onBulkCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      ) : null}

      {showManage ? (
        <ManageExamsModal onClose={() => setShowManage(false)} onChanged={load} />
      ) : null}
    </div>
  );
}
