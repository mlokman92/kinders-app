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
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Teacher = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  created_at: string;
};

type Assignment = {
  id: number;
  status: string | null;
  days: string[] | null;
  classrooms: { id: number; name: string } | null;
};

export function TeacherDetail() {
  const { id } = useParams();
  const tid = Number(id);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [teacherRes, assignmentsRes] = await Promise.all([
          supabase
            .from('teachers')
            .select('id, name, email, phone, dob, gender, created_at')
            .eq('id', tid)
            .maybeSingle(),
          supabase
            .from('teacher_assignments')
            .select('id, status, days, classrooms(id, name)')
            .eq('teacher_id', tid),
        ]);
        if (!active) return;
        if (teacherRes.error) throw teacherRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        setTeacher((teacherRes.data ?? null) as unknown as Teacher | null);
        setAssignments((assignmentsRes.data ?? []) as unknown as Assignment[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load teacher.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tid]);

  const backAction = (
    <Link
      to="/teachers"
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Teachers
    </Link>
  );

  if (loading) {
    return (
      <div>
        <PageHeader title="Teacher" actions={backAction} />
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Teacher" actions={backAction} />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div>
        <PageHeader title="Teacher" actions={backAction} />
        <EmptyState title="Teacher not found" icon="🔍" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={teacher.name} actions={backAction} />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={teacher.name} size={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: Brand.onSurface }}>
              {teacher.name}
            </div>
            <div style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginTop: 2 }}>
              {teacher.email}
            </div>
            {teacher.phone ? (
              <div style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                {teacher.phone}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Assigned classrooms
      </h2>

      <Card>
        {assignments.length === 0 ? (
          <span style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>No classrooms assigned</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {assignments.map((a) =>
              a.classrooms ? (
                <Link key={a.id} to={`/classrooms/${a.classrooms.id}`}>
                  <Badge tone="primary">{a.classrooms.name}</Badge>
                </Link>
              ) : null,
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
