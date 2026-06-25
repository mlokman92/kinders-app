import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type Classroom = {
  id: number;
  name: string;
};

type ClassroomCard = Classroom & {
  students: number;
  teachers: number;
};

export function Classrooms() {
  const [rooms, setRooms] = useState<ClassroomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [classroomsRes, enrollmentsRes, assignmentsRes] = await Promise.all([
          supabase.from('classrooms').select('id, name').order('name'),
          supabase.from('enrollments').select('classroom_id'),
          supabase.from('teacher_assignments').select('classroom_id'),
        ]);
        if (!active) return;
        if (classroomsRes.error) throw classroomsRes.error;
        if (enrollmentsRes.error) throw enrollmentsRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;

        const classrooms = (classroomsRes.data ?? []) as unknown as Classroom[];
        const enrollments = (enrollmentsRes.data ?? []) as unknown as { classroom_id: number }[];
        const assignments = (assignmentsRes.data ?? []) as unknown as { classroom_id: number }[];

        const studentCounts = new Map<number, number>();
        for (const e of enrollments) {
          studentCounts.set(e.classroom_id, (studentCounts.get(e.classroom_id) ?? 0) + 1);
        }
        const teacherCounts = new Map<number, number>();
        for (const a of assignments) {
          teacherCounts.set(a.classroom_id, (teacherCounts.get(a.classroom_id) ?? 0) + 1);
        }

        setRooms(
          classrooms.map((c) => ({
            ...c,
            students: studentCounts.get(c.id) ?? 0,
            teachers: teacherCounts.get(c.id) ?? 0,
          })),
        );
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load classrooms.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader title="Classrooms" />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : rooms.length === 0 ? (
        <EmptyState title="No classrooms" icon="🏫" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {rooms.map((room) => (
            <Card key={room.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: Radius.md,
                  background: Brand.primaryContainer,
                  fontSize: 22,
                  marginBottom: 12,
                }}
              >
                🏫
              </div>
              <Link
                to={`/classrooms/${room.id}`}
                style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface }}
              >
                {room.name}
              </Link>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Badge tone="primary">🧒 {room.students} students</Badge>
                <Badge tone="success">👩‍🏫 {room.teachers} teachers</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
