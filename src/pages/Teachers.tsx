import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type TeacherRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  teacher_assignments: { classrooms: { name: string } | null }[] | null;
};

export function Teachers() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await supabase
          .from('teachers')
          .select('id, name, email, phone, teacher_assignments(classrooms(name))')
          .order('name');
        if (!active) return;
        if (res.error) throw res.error;
        setTeachers((res.data ?? []) as unknown as TeacherRow[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load teachers.');
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
      <PageHeader
        title="Teachers"
        subtitle={`${teachers.length} ${teachers.length === 1 ? 'teacher' : 'teachers'} on the roster.`}
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : teachers.length === 0 ? (
        <EmptyState title="No teachers yet" icon="👩‍🏫" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Teacher</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Classrooms</Th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => {
              const classrooms = (t.teacher_assignments ?? [])
                .map((a) => a.classrooms?.name)
                .filter((n): n is string => Boolean(n))
                .join(', ');
              return (
                <tr key={t.id}>
                  <Td>
                    <Link
                      to={`/teachers/${t.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 12,
                        color: Brand.onSurface,
                        fontWeight: 700,
                      }}
                    >
                      <Avatar name={t.name} />
                      {t.name}
                    </Link>
                  </Td>
                  <Td>{t.email}</Td>
                  <Td>{t.phone || '—'}</Td>
                  <Td>{classrooms || '—'}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
