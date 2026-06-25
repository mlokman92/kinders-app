import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Table,
  Td,
  TextInput,
  Th,
  Toolbar,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Row = {
  id: number;
  name: string;
  dob: string | null;
  gender: string | null;
  enrollments: { classrooms: { name: string } | null }[];
  guardians: { id: number }[];
};

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const [y, m, d] = dob.split('-').map(Number);
  if (!y || !m || !d) return '—';
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return '—';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years}y`;
}

export function Students() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await supabase
          .from('students')
          .select('id, name, dob, gender, enrollments(classrooms(name)), guardians(id)')
          .order('name');
        if (!active) return;
        if (res.error) throw res.error;
        setRows((res.data ?? []) as unknown as Row[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load students.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={loading ? 'Your roster.' : `${rows.length} ${rows.length === 1 ? 'child' : 'children'} on your roster.`}
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No students yet" icon="🧒" />
      ) : (
        <>
          <Toolbar>
            <Field label="Search">
              <TextInput value={query} onChange={setQuery} placeholder="Search by name…" />
            </Field>
          </Toolbar>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="No students match your search." icon="🔍" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Classrooms</Th>
                  <Th align="right" width={90}>Age</Th>
                  <Th align="right" width={110}>Contacts</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const classes = r.enrollments
                    .map((e) => e.classrooms?.name)
                    .filter((n): n is string => !!n)
                    .join(', ');
                  return (
                    <tr key={r.id}>
                      <Td>
                        <Link
                          to={`/students/${r.id}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, color: Brand.onSurface }}
                        >
                          <Avatar name={r.name} />
                          <span style={{ fontWeight: 700 }}>{r.name}</span>
                        </Link>
                      </Td>
                      <Td style={{ color: classes ? Brand.onSurface : Brand.onSurfaceVariant }}>
                        {classes || '—'}
                      </Td>
                      <Td align="right">{ageFromDob(r.dob)}</Td>
                      <Td align="right">{r.guardians.length}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
