import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  Table,
  Td,
  Th,
  TextInput,
  Toolbar,
} from '@/components/ui';
import { modelMeta } from '@/lib/assessments';
import { downloadAssessmentPdf } from '@/lib/assessmentPdf';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Row = {
  id: number;
  status: string;
  assessed_on: string;
  created_at: string;
  students: { id: number; name: string } | null;
  assessment_frameworks: { name: string; scoring_model: string } | null;
  assessment_sections: { title: string } | null;
  exams: { name: string } | null;
};

export function Assessments() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [framework, setFramework] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supabase
        .from('student_assessments')
        .select(
          'id, status, assessed_on, created_at, students(id, name), assessment_frameworks(name, scoring_model), assessment_sections(title), exams(name)',
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
  }, []);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (framework && r.assessment_frameworks?.name !== framework) return false;
      if (examFilter && r.exams?.name !== examFilter) return false;
      if (q && !(r.students?.name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, framework, examFilter]);

  return (
    <div>
      <PageHeader
        title="Assessments"
        subtitle="Track each child's development against the Malaysia early-childhood standards."
        actions={<Button onClick={() => setShowNew(true)}>+ New assessment</Button>}
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
          <Toolbar>
            <Field label="Search">
              <TextInput value={search} onChange={setSearch} placeholder="Search by student…" />
            </Field>
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

          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="No assessments match your filters." icon="🔍" />
          ) : (
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
                {filtered.map((r) => {
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
          )}
        </>
      )}

      {showNew ? (
        <NewAssessmentModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => navigate(`/assessments/${id}`)}
        />
      ) : null}
    </div>
  );
}
