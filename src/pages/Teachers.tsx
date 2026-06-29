import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

/** A compact link-styled button for a table row's quick actions. */
function ActionLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        color: Brand.onPrimaryContainer,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        padding: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

type TeacherRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  teacher_assignments: { classrooms: { name: string } | null }[] | null;
};

export function Teachers() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDirector = role === 'director';

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
        actions={
          isDirector ? (
            <>
              <Button variant="secondary" onClick={() => navigate('/teachers/import')}>
                Import CSV
              </Button>
              <Button onClick={() => navigate('/teachers/new')}>+ Add teacher</Button>
            </>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : teachers.length === 0 ? (
        <EmptyState
          title="No teachers yet"
          message={isDirector ? 'Add your first teacher to get started.' : undefined}
          icon="👩‍🏫"
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Teacher</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Classrooms</Th>
              {isDirector ? (
                <Th align="right" width={140}>
                  Actions
                </Th>
              ) : null}
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
                  <Td>{t.email || '—'}</Td>
                  <Td>{t.phone || '—'}</Td>
                  <Td>{classrooms || '—'}</Td>
                  {isDirector ? (
                    <Td align="right">
                      <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                        <ActionLink onClick={() => navigate(`/teachers/${t.id}`)}>View</ActionLink>
                        <ActionLink onClick={() => navigate(`/teachers/${t.id}/edit`)}>
                          Edit
                        </ActionLink>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
