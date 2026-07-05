import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Stat,
  StatGrid,
} from '@/components/ui';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { toISODate } from '@/lib/dates';
import { humanizeEntry } from '@/lib/entries';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type RecentEntry = {
  id: number;
  type: string;
  entry_date: string;
  created_at: string;
  data: Record<string, unknown> | null;
  student_id: number;
  students: { name: string } | null;
  classrooms: { name: string } | null;
};

type Counts = {
  students: number;
  classrooms: number;
  teachers: number;
  entriesToday: number;
};

export function Dashboard() {
  const { can } = useAuth();
  const { branchId } = useBranch();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const today = toISODate(new Date());
      try {
        // Resolve the branch's classroom + staff ids first when a branch is selected.
        let classroomIds: number[] = [];
        let teacherIds: number[] = [];
        if (branchId !== null) {
          const [clsRes, staffRes] = await Promise.all([
            supabase.from('classrooms').select('id').eq('branch_id', branchId),
            supabase.from('staff_branches').select('teacher_id').eq('branch_id', branchId),
          ]);
          if (clsRes.error) throw clsRes.error;
          if (staffRes.error) throw staffRes.error;
          classroomIds = (clsRes.data ?? []).map((r) => r.id);
          teacherIds = (staffRes.data ?? []).map((r) => r.teacher_id);
          if (classroomIds.length === 0) classroomIds = [-1];
          if (teacherIds.length === 0) teacherIds = [-1];
        }

        let studentsQ = supabase.from('students').select('id', { count: 'exact', head: true });
        let classroomsQ = supabase.from('classrooms').select('id', { count: 'exact', head: true });
        let teachersQ = supabase.from('teachers').select('id', { count: 'exact', head: true });
        let entriesTodayQ = supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('entry_date', today);
        let recentQ = supabase
          .from('entries')
          .select('id, type, entry_date, created_at, data, student_id, students(name), classrooms(name)')
          .order('created_at', { ascending: false })
          .limit(12);
        if (branchId !== null) {
          studentsQ = studentsQ.eq('branch_id', branchId);
          classroomsQ = classroomsQ.eq('branch_id', branchId);
          teachersQ = teachersQ.in('id', teacherIds);
          entriesTodayQ = entriesTodayQ.in('classroom_id', classroomIds);
          recentQ = recentQ.in('classroom_id', classroomIds);
        }

        const [students, classrooms, teachers, entriesToday, recentRes] = await Promise.all([
          studentsQ,
          classroomsQ,
          teachersQ,
          entriesTodayQ,
          recentQ,
        ]);
        if (!active) return;
        if (recentRes.error) throw recentRes.error;
        setCounts({
          students: students.count ?? 0,
          classrooms: classrooms.count ?? 0,
          teachers: teachers.count ?? 0,
          entriesToday: entriesToday.count ?? 0,
        });
        setRecent((recentRes.data ?? []) as unknown as RecentEntry[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="A snapshot of your center today."
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Students" value={counts?.students ?? 0} icon="🧒" accent={Brand.primary} />
            <Stat label="Classrooms" value={counts?.classrooms ?? 0} icon="🏫" accent={Brand.success} />
            {can('manage_staff') ? (
              <Stat label="Staff" value={counts?.teachers ?? 0} icon="👩‍🏫" accent={Brand.tertiary} />
            ) : null}
            <Stat
              label="Entries today"
              value={counts?.entriesToday ?? 0}
              icon="📝"
              accent={Brand.secondary}
            />
          </StatGrid>

          <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
            Recent activity
          </h2>

          {recent.length === 0 ? (
            <EmptyState title="No entries yet" message="Journal entries logged in the app will appear here." icon="📭" />
          ) : (
            <Card padding={0}>
              {recent.map((e, i) => {
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
                        <Link
                          to={`/students/${e.student_id}`}
                          style={{ fontWeight: 700, color: Brand.onSurface }}
                        >
                          {e.students?.name ?? 'Student'}
                        </Link>{' '}
                        <span style={{ color: Brand.onSurfaceVariant }}>· {summary}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                        {e.classrooms?.name ? `${e.classrooms.name} · ` : ''}
                        {e.entry_date}
                      </div>
                    </div>
                    <Badge tone="neutral">{entryLabel(e.type)}</Badge>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
