import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Select,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  Toolbar,
  DateInput,
} from '@/components/ui';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { addDays, parseISODate, toISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { Brand, ENTRY_TYPE_COLORS, Radius } from '@/lib/theme';

type ClassroomRow = { id: number; name: string };

type EntryRow = {
  id: number;
  type: string;
  entry_date: string;
  student_id: number;
  students: { name: string } | null;
  classrooms: { name: string } | null;
};

export function Reports() {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [classroom, setClassroom] = useState('all');
  const [from, setFrom] = useState(() => toISODate(addDays(new Date(), -6)));
  const [to, setTo] = useState(() => toISODate(new Date()));

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load classrooms for the filter once.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: err } = await supabase
        .from('classrooms')
        .select('id, name')
        .order('name');
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      setClassrooms((data ?? []) as unknown as ClassroomRow[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Refetch entries whenever the filters change.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase
          .from('entries')
          .select('id, type, entry_date, student_id, students(name), classrooms(name)')
          .gte('entry_date', from)
          .lte('entry_date', to)
          .order('entry_date', { ascending: true });
        if (classroom !== 'all') q = q.eq('classroom_id', Number(classroom));
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
  }, [classroom, from, to]);

  const classroomOptions = useMemo(
    () => [
      { label: 'All classrooms', value: 'all' },
      ...classrooms.map((c) => ({ label: c.name, value: String(c.id) })),
    ],
    [classrooms],
  );

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

  return (
    <div>
      <PageHeader title="Reports" subtitle="Journal-entry analytics across your center." />

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
