import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import {
  Avatar,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  TextInput,
  Th,
  Toolbar,
} from '@/components/ui';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { formatDisplayDate, parseISODate, toISODate } from '@/lib/dates';
import { entryTimeLabel, humanizeEntry, type ClassroomRef } from '@/lib/entries';
import { downloadStudentDailyReportPdf } from '@/lib/entriesPdf';
import { supabase } from '@/lib/supabase';
import { Brand, ENTRY_TYPE_COLORS, Radius } from '@/lib/theme';

type ClassEmbed = { id: number; name: string } | null;
type StudentRow = { id: number; name: string; enrollments: { classrooms: ClassEmbed }[] };
type DayEntry = {
  id: number;
  type: string;
  created_at: string;
  data: Record<string, unknown> | null;
  media: { path: string; type: string }[] | null;
  student_id: number;
  classrooms: { name: string } | null;
  entry_activities: ({ activities: { title: string } | null } | null)[] | null;
};

/** The one-line, on-screen detail for an entry (activity entries lead with their picked titles). */
function entryMain(e: DayEntry, classrooms: ClassroomRef[]): string {
  const { summary } = humanizeEntry(e.type, e.data, classrooms);
  const activities = (e.entry_activities ?? [])
    .map((ea) => ea?.activities?.title)
    .filter((t): t is string => !!t);
  const desc = typeof e.data?.description === 'string' ? e.data.description.trim() : '';
  if (e.type === 'activity' && activities.length) {
    return [desc, activities.join(', ')].filter(Boolean).join(' — ');
  }
  return summary;
}

/** A compact link-styled button for a table row's quick actions. */
function ActionLink({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none',
        background: 'transparent',
        color: disabled ? Brand.onSurfaceVariant : Brand.onPrimaryContainer,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Reports() {
  const { can } = useAuth();
  const { branchId } = useBranch();
  const navigate = useNavigate();

  const [date, setDate] = useState(() => toISODate(new Date()));
  const [classrooms, setClassrooms] = useState<ClassroomRef[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);

  // Roster + the chosen day's entries, both scoped to the selected branch (RLS additionally
  // scopes to the caller's role — director = whole center, admin = branches, teacher = classrooms).
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let clsQ = supabase.from('classrooms').select('id, name').order('name');
        if (branchId !== null) clsQ = clsQ.eq('branch_id', branchId);
        const clsRes = await clsQ;
        if (clsRes.error) throw clsRes.error;
        const cls = (clsRes.data ?? []) as unknown as ClassroomRef[];

        // When a branch is picked, narrow the day's entries to that branch's classrooms.
        let branchClassIds: number[] | null = null;
        if (branchId !== null) {
          branchClassIds = cls.map((c) => c.id);
          if (branchClassIds.length === 0) branchClassIds = [-1];
        }

        let stuQ = supabase
          .from('students')
          .select('id, name, enrollments(classrooms(id, name))')
          .order('name');
        if (branchId !== null) stuQ = stuQ.eq('branch_id', branchId);

        let entQ = supabase
          .from('entries')
          .select(
            'id, type, created_at, data, media, student_id, classrooms(name), entry_activities(activities(title))',
          )
          .eq('entry_date', date)
          .order('created_at', { ascending: true });
        if (branchClassIds) entQ = entQ.in('classroom_id', branchClassIds);

        const [stuRes, entRes] = await Promise.all([stuQ, entQ]);
        if (!active) return;
        if (stuRes.error) throw stuRes.error;
        if (entRes.error) throw entRes.error;

        setClassrooms(cls);
        setStudents((stuRes.data ?? []) as unknown as StudentRow[]);
        setDayEntries((entRes.data ?? []) as unknown as DayEntry[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load reports.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [branchId, date]);

  const entriesByStudent = useMemo(() => {
    const m = new Map<number, DayEntry[]>();
    for (const e of dayEntries) {
      const arr = m.get(e.student_id);
      if (arr) arr.push(e);
      else m.set(e.student_id, [e]);
    }
    return m;
  }, [dayEntries]);

  const classroomOptions = useMemo(
    () => [
      { label: 'All classrooms', value: 'all' },
      ...classrooms.map((c) => ({ label: c.name, value: String(c.id) })),
    ],
    [classrooms],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (
        classroomFilter !== 'all' &&
        !s.enrollments.some((en) => en.classrooms && String(en.classrooms.id) === classroomFilter)
      ) {
        return false;
      }
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, query, classroomFilter]);

  const withReport = useMemo(
    () => filtered.filter((s) => (entriesByStudent.get(s.id)?.length ?? 0) > 0).length,
    [filtered, entriesByStudent],
  );

  const download = async (id: number) => {
    setDownloadingId(id);
    setError(null);
    try {
      await downloadStudentDailyReportPdf(id, date);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const viewStudent = viewId != null ? students.find((s) => s.id === viewId) ?? null : null;
  const isToday = date === toISODate(new Date());

  // Placed after all hooks so hook order stays stable.
  if (!can('view_reports')) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader
        title="Daily reports"
        subtitle={
          loading
            ? "Each child's report for the day."
            : `${withReport} of ${filtered.length} ${filtered.length === 1 ? 'child has' : 'children have'} a report ${isToday ? 'today' : 'this day'}.`
        }
      />

      <Toolbar>
        <Field label="Date">
          <DateInput value={date} onChange={setDate} />
        </Field>
        <div style={{ flex: 2, minWidth: 200 }}>
          <Field label="Search">
            <TextInput value={query} onChange={setQuery} placeholder="Search by child's name…" style={{ width: '100%' }} />
          </Field>
        </div>
        {classrooms.length > 0 ? (
          <Field label="Classroom">
            <Select value={classroomFilter} onChange={setClassroomFilter} options={classroomOptions} />
          </Field>
        ) : null}
      </Toolbar>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : students.length === 0 ? (
        <EmptyState title="No students yet" message="Add children to your roster to see daily reports." icon="🧒" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" message="No children match your search." icon="🔍" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Classroom</Th>
              <Th align="right" width={110}>Entries</Th>
              <Th align="right" width={190}>Report</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const rows = entriesByStudent.get(s.id) ?? [];
              const classes = s.enrollments
                .map((en) => en.classrooms?.name)
                .filter((n): n is string => !!n)
                .join(', ');
              const has = rows.length > 0;
              return (
                <tr key={s.id}>
                  <Td>
                    <Link
                      to={`/students/${s.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, color: Brand.onSurface }}
                    >
                      <Avatar name={s.name} />
                      <span style={{ fontWeight: 700 }}>{s.name}</span>
                    </Link>
                  </Td>
                  <Td style={{ color: classes ? Brand.onSurface : Brand.onSurfaceVariant }}>
                    {classes || '—'}
                  </Td>
                  <Td align="right">
                    {has ? (
                      <span style={{ fontWeight: 700 }}>{rows.length}</span>
                    ) : (
                      <span style={{ color: Brand.onSurfaceVariant }}>—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <ActionLink onClick={() => setViewId(s.id)} disabled={!has}>
                        View report
                      </ActionLink>
                      <ActionLink onClick={() => download(s.id)} disabled={!has || downloadingId === s.id}>
                        {downloadingId === s.id ? <Spinner size={14} /> : 'Download'}
                      </ActionLink>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {viewStudent ? (
        <Modal
          title={`${viewStudent.name} — ${formatDisplayDate(parseISODate(date))}`}
          onClose={() => setViewId(null)}
          width={560}
        >
          <DailyReportView
            rows={entriesByStudent.get(viewStudent.id) ?? []}
            classrooms={classrooms}
            downloading={downloadingId === viewStudent.id}
            onDownload={() => download(viewStudent.id)}
            onOpenStudent={() => {
              setViewId(null);
              navigate(`/students/${viewStudent.id}`);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

/** On-screen version of the daily sheet: the day's entries in time order, with a download button. */
function DailyReportView({
  rows,
  classrooms,
  downloading,
  onDownload,
  onOpenStudent,
}: {
  rows: DayEntry[];
  classrooms: ClassroomRef[];
  downloading: boolean;
  onDownload: () => void;
  onOpenStudent: () => void;
}) {
  return (
    <div>
      {rows.length === 0 ? (
        <div style={{ padding: '20px 0', color: Brand.onSurfaceVariant, fontSize: 14 }}>
          No entries logged on this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '4px 0 16px' }}>
          {rows.map((e, i) => {
            const color = ENTRY_TYPE_COLORS[e.type] ?? Brand.primary;
            const time = entryTimeLabel(e.data, e.created_at);
            const note = humanizeEntry(e.type, e.data, classrooms).note;
            const main = entryMain(e, classrooms);
            const mediaCount = e.media?.length ?? 0;
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '10px 4px',
                  borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    background: color + '22',
                    border: `1px solid ${color}44`,
                  }}
                >
                  {ENTRY_EMOJI[e.type] ?? '•'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: Brand.onSurface }}>
                      {entryLabel(e.type)}
                    </span>
                    {time ? (
                      <span style={{ fontSize: 12, color: Brand.onSurfaceVariant }}>{time}</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 13.5, color: Brand.onSurface, marginTop: 1 }}>{main}</div>
                  {note && note !== main ? (
                    <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>{note}</div>
                  ) : null}
                  {mediaCount > 0 ? (
                    <div style={{ fontSize: 12, color: Brand.onSurfaceVariant, marginTop: 3 }}>
                      📷 {mediaCount} {mediaCount === 1 ? 'photo/video' : 'photos/videos'}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 14,
          borderTop: `1px solid ${Brand.outlineVariant}`,
        }}
      >
        <button
          type="button"
          onClick={onOpenStudent}
          style={{
            border: 'none',
            background: 'transparent',
            color: Brand.onSurfaceVariant,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Open profile →
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading || rows.length === 0}
          style={{
            border: 'none',
            borderRadius: Radius.full,
            background: Brand.primary,
            color: Brand.onPrimary,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 700,
            cursor: downloading || rows.length === 0 ? 'default' : 'pointer',
            opacity: rows.length === 0 ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {downloading ? <Spinner size={16} /> : 'Download PDF'}
        </button>
      </div>
    </div>
  );
}
