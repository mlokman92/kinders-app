import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { parseISODate } from '@/lib/dates';
import { humanizeEntry } from '@/lib/entries';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type ClassroomRow = { id: number; name: string };

type EnrollmentRow = {
  id: number;
  status: string | null;
  students: { id: number; name: string; dob: string | null } | null;
};

type AssignmentRow = {
  id: number;
  teachers: { id: number; name: string; email: string } | null;
};

type EntryRow = {
  id: number;
  type: string;
  entry_date: string;
  data: Record<string, unknown> | null;
  students: { name: string } | null;
};

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const birth = parseISODate(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
  if (years < 1) {
    let months = now.getMonth() - birth.getMonth() + 12 * (now.getFullYear() - birth.getFullYear());
    if (now.getDate() < birth.getDate()) months -= 1;
    return `${Math.max(0, months)} mo`;
  }
  return `${years} yr`;
}

export function ClassroomDetail() {
  const { id } = useParams();
  const cid = Number(id);

  const [classroom, setClassroom] = useState<ClassroomRow | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [classroomRes, enrollmentsRes, assignmentsRes, entriesRes] = await Promise.all([
          supabase.from('classrooms').select('id, name').eq('id', cid).maybeSingle(),
          supabase
            .from('enrollments')
            .select('id, status, students(id, name, dob)')
            .eq('classroom_id', cid),
          supabase
            .from('teacher_assignments')
            .select('id, teachers(id, name, email)')
            .eq('classroom_id', cid),
          supabase
            .from('entries')
            .select('id, type, entry_date, data, students(name)')
            .eq('classroom_id', cid)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);
        if (!active) return;
        if (classroomRes.error) throw classroomRes.error;
        if (enrollmentsRes.error) throw enrollmentsRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (entriesRes.error) throw entriesRes.error;
        setClassroom((classroomRes.data ?? null) as unknown as ClassroomRow | null);
        setEnrollments((enrollmentsRes.data ?? []) as unknown as EnrollmentRow[]);
        setAssignments((assignmentsRes.data ?? []) as unknown as AssignmentRow[]);
        setEntries((entriesRes.data ?? []) as unknown as EntryRow[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load classroom.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cid]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!classroom) return <EmptyState title="Classroom not found" icon="🔍" />;

  return (
    <div>
      <PageHeader
        title={classroom.name}
        actions={
          <Link
            to="/classrooms"
            style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
          >
            ← Classrooms
          </Link>
        }
      />

      <StatGrid>
        <Stat label="Students" value={enrollments.length} icon="🧒" accent={Brand.primary} />
        <Stat label="Teachers" value={assignments.length} icon="👩‍🏫" accent={Brand.tertiary} />
      </StatGrid>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Students
      </h2>
      {enrollments.length === 0 ? (
        <EmptyState title="No students enrolled" icon="🧒" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th align="right" width={120}>
                Age
              </Th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((en) => (
              <tr key={en.id}>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={en.students?.name ?? '·'} />
                    {en.students ? (
                      <Link
                        to={`/students/${en.students.id}`}
                        style={{ fontWeight: 700, color: Brand.onSurface }}
                      >
                        {en.students.name}
                      </Link>
                    ) : (
                      <span style={{ color: Brand.onSurfaceVariant }}>Unknown</span>
                    )}
                  </div>
                </Td>
                <Td align="right" style={{ color: Brand.onSurfaceVariant }}>
                  {ageFromDob(en.students?.dob ?? null)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Teachers
      </h2>
      {assignments.length === 0 ? (
        <EmptyState title="No teachers assigned" icon="👩‍🏫" />
      ) : (
        <Card padding={0}>
          {assignments.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
              }}
            >
              <Avatar name={a.teachers?.name ?? '·'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {a.teachers ? (
                  <Link
                    to={`/teachers/${a.teachers.id}`}
                    style={{ fontWeight: 700, color: Brand.onSurface, fontSize: 14.5 }}
                  >
                    {a.teachers.name}
                  </Link>
                ) : (
                  <span style={{ color: Brand.onSurfaceVariant }}>Unknown</span>
                )}
                <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                  {a.teachers?.email ?? ''}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Recent activity
      </h2>
      {entries.length === 0 ? (
        <EmptyState title="No entries yet" message="Journal entries for this classroom will appear here." icon="📭" />
      ) : (
        <Card padding={0}>
          {entries.map((e, i) => {
            const { summary } = humanizeEntry(e.type, e.data, []);
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                }}
              >
                <div style={{ fontSize: 22 }}>{ENTRY_EMOJI[e.type] ?? '•'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, color: Brand.onSurface }}>
                    <span style={{ fontWeight: 700 }}>{e.students?.name ?? 'Student'}</span>{' '}
                    <span style={{ color: Brand.onSurfaceVariant }}>· {summary}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                    {e.entry_date}
                  </div>
                </div>
                <Badge tone="neutral">{entryLabel(e.type)}</Badge>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
