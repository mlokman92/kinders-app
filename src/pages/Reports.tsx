import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
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
  Toolbar,
  DateInput,
} from '@/components/ui';
import { ENTRY_ACTIONS, ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { addDays, formatDisplayDate, parseISODate, toISODate } from '@/lib/dates';
import { entryTimeLabel, humanizeEntry } from '@/lib/entries';
import { downloadEntriesReportPdf } from '@/lib/entriesPdf';
import { supabase } from '@/lib/supabase';
import { Brand, ENTRY_TYPE_COLORS, Radius } from '@/lib/theme';

type ClassroomRow = { id: number; name: string };

type EntryRow = {
  id: number;
  type: string;
  entry_date: string;
  created_at: string;
  student_id: number;
  data: Record<string, unknown> | null;
  media: { path: string; type: string }[] | null;
  students: { name: string } | null;
  classrooms: { name: string } | null;
  entry_activities: ({ activities: { title: string } | null } | null)[] | null;
};

export function Reports() {
  const { can } = useAuth();
  const { branchId } = useBranch();
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [classroom, setClassroom] = useState('all');
  const [type, setType] = useState('all');
  const [from, setFrom] = useState(() => toISODate(addDays(new Date(), -6)));
  const [to, setTo] = useState(() => toISODate(new Date()));

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Load classrooms for the filter, scoped to the selected branch.
  useEffect(() => {
    let active = true;
    (async () => {
      let q = supabase.from('classrooms').select('id, name').order('name');
      if (branchId !== null) q = q.eq('branch_id', branchId);
      const { data, error: err } = await q;
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      const rows = (data ?? []) as unknown as ClassroomRow[];
      setClassrooms(rows);
      // Drop a classroom selection that fell out of the branch.
      setClassroom((prev) =>
        prev !== 'all' && !rows.some((c) => String(c.id) === prev) ? 'all' : prev,
      );
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  // Refetch entries whenever the filters change.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase
          .from('entries')
          .select(
            'id, type, entry_date, created_at, student_id, data, media, students(name), classrooms(name), entry_activities(activities(title))',
          )
          .gte('entry_date', from)
          .lte('entry_date', to)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(2000);
        if (classroom !== 'all') {
          q = q.eq('classroom_id', Number(classroom));
        } else if (branchId !== null) {
          // No classroom filter: narrow to the branch's classrooms.
          const clsRes = await supabase.from('classrooms').select('id').eq('branch_id', branchId);
          if (clsRes.error) throw clsRes.error;
          const ids = (clsRes.data ?? []).map((c) => c.id);
          q = q.in('classroom_id', ids.length > 0 ? ids : [-1]);
        }
        const { data, error: err } = await q;
        if (!active) return;
        if (err) throw err;
        setEntries((data ?? []) as unknown as EntryRow[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load reports.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [classroom, from, to, branchId]);

  const classroomOptions = useMemo(
    () => [
      { label: 'All classrooms', value: 'all' },
      ...classrooms.map((c) => ({ label: c.name, value: String(c.id) })),
    ],
    [classrooms],
  );

  const typeOptions = useMemo(
    () => [{ label: 'All types', value: 'all' }, ...ENTRY_ACTIONS.map((a) => ({ label: a.label, value: a.key }))],
    [],
  );

  // The actual reports feed: entries (optionally narrowed by type). The query already
  // returns them newest-first (descending date, created_at).
  const feedEntries = useMemo(
    () => (type === 'all' ? entries : entries.filter((e) => e.type === type)),
    [entries, type],
  );

  // Group the feed into day sections, preserving the newest-first order.
  const feedByDate = useMemo(() => {
    const groups: { date: string; rows: EntryRow[] }[] = [];
    for (const e of feedEntries) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.entry_date) last.rows.push(e);
      else groups.push({ date: e.entry_date, rows: [e] });
    }
    return groups;
  }, [feedEntries]);

  const classroomName =
    classroom === 'all'
      ? 'All classrooms'
      : classrooms.find((c) => String(c.id) === classroom)?.name ?? 'Classroom';

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadEntriesReportPdf(feedEntries, {
        from,
        to,
        classroomName,
        typeLabel: type === 'all' ? 'All types' : entryLabel(type),
        classrooms,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  // Number of calendar days in the inclusive range (used for "avg per day").
  const rangeDays = useMemo(() => {
    const a = parseISODate(from).getTime();
    const b = parseISODate(to).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
    return Math.round((b - a) / 86_400_000) + 1;
  }, [from, to]);

  const stats = useMemo(() => {
    const dates = new Set<string>();
    const students = new Set<number>();
    for (const e of entries) {
      dates.add(e.entry_date);
      students.add(e.student_id);
    }
    const total = entries.length;
    return {
      total,
      daysWithActivity: dates.size,
      avgPerDay: rangeDays > 0 ? (total / rangeDays).toFixed(1) : '0.0',
      studentsLogged: students.size,
    };
  }, [entries, rangeDays]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return [...m.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  const maxTypeCount = useMemo(
    () => byType.reduce((max, t) => Math.max(max, t.count), 0),
    [byType],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.entry_date, (m.get(e.entry_date) ?? 0) + 1);
    return [...m.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  const maxDayCount = useMemo(
    () => byDay.reduce((max, d) => Math.max(max, d.count), 0),
    [byDay],
  );

  const attendance = useMemo(() => {
    let checkIn = 0;
    let checkOut = 0;
    for (const e of entries) {
      if (e.type === 'check_in') checkIn += 1;
      else if (e.type === 'checkout') checkOut += 1;
    }
    return { checkIn, checkOut };
  }, [entries]);

  const byClassroom = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const name = e.classrooms?.name ?? 'Unassigned';
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  const topStudents = useMemo(() => {
    const m = new Map<number, { name: string; count: number }>();
    for (const e of entries) {
      const cur = m.get(e.student_id);
      if (cur) cur.count += 1;
      else m.set(e.student_id, { name: e.students?.name ?? 'Student', count: 1 });
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [entries]);

  // Placed after all hooks so hook order stays stable.
  if (!can('view_reports')) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Journal entries logged across your center."
        actions={
          <Button onClick={downloadPdf} disabled={pdfBusy || feedEntries.length === 0}>
            {pdfBusy ? <Spinner size={16} /> : 'Download PDF'}
          </Button>
        }
      />

      <Toolbar>
        <Field label="Classroom">
          <Select value={classroom} onChange={setClassroom} options={classroomOptions} />
        </Field>
        <Field label="From">
          <DateInput value={from} onChange={setFrom} />
        </Field>
        <Field label="To">
          <DateInput value={to} onChange={setTo} />
        </Field>
      </Toolbar>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : entries.length === 0 ? (
        <EmptyState title="No entries in this range" icon="📭" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* The reports feed — the actual journal entries teachers logged */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, margin: 0 }}>Entries</h2>
              <div style={{ width: 200 }}>
                <Select value={type} onChange={setType} options={typeOptions} />
              </div>
            </div>

            {feedByDate.length === 0 ? (
              <Card style={{ textAlign: 'center', color: Brand.onSurfaceVariant, fontSize: 14 }}>
                No {entryLabel(type).toLowerCase()} entries in this range.
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {feedByDate.map((day) => (
                  <Card key={day.date} padding={0}>
                    <div
                      style={{
                        padding: '12px 18px',
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: Brand.onSurface,
                        borderBottom: `1px solid ${Brand.outlineVariant}`,
                        background: Brand.surfaceContainerLow,
                      }}
                    >
                      {formatDisplayDate(parseISODate(day.date))}
                    </div>
                    {day.rows.map((e, i) => {
                      const { summary, note } = humanizeEntry(e.type, e.data, classrooms);
                      const activities = (e.entry_activities ?? [])
                        .map((ea) => ea?.activities?.title)
                        .filter((t): t is string => !!t);
                      const desc = typeof e.data?.description === 'string' ? e.data.description.trim() : '';
                      const main =
                        e.type === 'activity' && activities.length
                          ? [desc, activities.join(', ')].filter(Boolean).join(' — ')
                          : summary;
                      const mediaCount = e.media?.length ?? 0;
                      const time = entryTimeLabel(e.data, e.created_at);
                      return (
                        <div
                          key={e.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 14,
                            padding: '14px 18px',
                            borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                          }}
                        >
                          <div style={{ fontSize: 22, lineHeight: 1.1 }}>{ENTRY_EMOJI[e.type] ?? '•'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                              <Link
                                to={`/students/${e.student_id}`}
                                style={{ fontSize: 14.5, fontWeight: 700, color: Brand.onSurface }}
                              >
                                {e.students?.name ?? 'Student'}
                              </Link>
                              <span style={{ fontSize: 12.5, color: Brand.onSurfaceVariant }}>
                                {[e.classrooms?.name, time].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: Brand.onSurface, marginTop: 2 }}>{main}</div>
                            {note && note !== main ? (
                              <div style={{ fontSize: 13, color: Brand.onSurfaceVariant, marginTop: 3 }}>
                                {note}
                              </div>
                            ) : null}
                            {mediaCount > 0 ? (
                              <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 4 }}>
                                📷 {mediaCount} {mediaCount === 1 ? 'photo/video' : 'photos/videos'}
                              </div>
                            ) : null}
                          </div>
                          <Badge tone="neutral">{entryLabel(e.type)}</Badge>
                        </div>
                      );
                    })}
                  </Card>
                ))}
              </div>
            )}
          </div>

          <StatGrid>
            <Stat label="Total entries" value={stats.total} icon="📝" accent={Brand.primary} />
            <Stat
              label="Days with activity"
              value={stats.daysWithActivity}
              icon="📅"
              accent={Brand.success}
            />
            <Stat label="Avg per day" value={stats.avgPerDay} icon="📈" accent={Brand.tertiary} />
            <Stat
              label="Students logged"
              value={stats.studentsLogged}
              icon="🧒"
              accent={Brand.secondary}
            />
          </StatGrid>

          {/* Entries by type */}
          <Card>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, marginBottom: 16 }}>
              Entries by type
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {byType.map((t) => {
                const color = ENTRY_TYPE_COLORS[t.type] ?? Brand.primary;
                const pct = maxTypeCount > 0 ? (t.count / maxTypeCount) * 100 : 0;
                return (
                  <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 150,
                        flexShrink: 0,
                        fontSize: 13.5,
                        color: Brand.onSurface,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ marginRight: 6 }}>{ENTRY_EMOJI[t.type] ?? '•'}</span>
                      {entryLabel(t.type)}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 18,
                        borderRadius: Radius.full,
                        background: Brand.surfaceContainerLow,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: color,
                          borderRadius: Radius.full,
                          minWidth: t.count > 0 ? 6 : 0,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 36,
                        flexShrink: 0,
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: 700,
                        color: Brand.onSurface,
                      }}
                    >
                      {t.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Daily activity */}
          <Card>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, marginBottom: 16 }}>
              Daily activity
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 4,
              }}
            >
              {byDay.map((d) => {
                const h = maxDayCount > 0 ? Math.max((d.count / maxDayCount) * 120, 4) : 4;
                const label = parseISODate(d.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                });
                return (
                  <div
                    key={d.date}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: 44,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: Brand.onSurface }}>
                      {d.count}
                    </div>
                    <div
                      style={{
                        width: 28,
                        height: h,
                        background: Brand.primary,
                        borderRadius: Radius.base,
                        transition: 'height 0.3s',
                      }}
                    />
                    <div
                      style={{
                        fontSize: 11.5,
                        color: Brand.onSurfaceVariant,
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Attendance */}
          <Card>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, marginBottom: 16 }}>
              Attendance
            </h2>
            <StatGrid>
              <Stat
                label="Check-ins"
                value={attendance.checkIn}
                icon="👋"
                accent={ENTRY_TYPE_COLORS.check_in}
              />
              <Stat
                label="Checkouts"
                value={attendance.checkOut}
                icon="🏡"
                accent={ENTRY_TYPE_COLORS.checkout}
              />
            </StatGrid>
          </Card>

          {/* By classroom (only when viewing all classrooms) */}
          {classroom === 'all' ? (
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: Brand.onSurface,
                  marginBottom: 12,
                }}
              >
                By classroom
              </h2>
              <Table>
                <thead>
                  <tr>
                    <Th>Classroom</Th>
                    <Th align="right" width={120}>
                      Entries
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {byClassroom.map((c) => (
                    <tr key={c.name}>
                      <Td style={{ fontWeight: 600 }}>{c.name}</Td>
                      <Td align="right">{c.count}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}

          {/* Most active students */}
          <div>
            <h2
              style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, marginBottom: 12 }}
            >
              Most active students
            </h2>
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th align="right" width={120}>
                    Entries
                  </Th>
                </tr>
              </thead>
              <tbody>
                {topStudents.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link
                        to={`/students/${s.id}`}
                        style={{ fontWeight: 600, color: Brand.onSurface }}
                      >
                        {s.name}
                      </Link>
                    </Td>
                    <Td align="right">{s.count}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
