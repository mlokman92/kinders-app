import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AddContactModal } from '@/components/AddContactModal';
import {
  Avatar,
  Button,
  Card,
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
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

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
  const navigate = useNavigate();
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [contactFor, setContactFor] = useState<{ id: number; name: string } | null>(null);

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

  const withoutContacts = useMemo(() => rows.filter((r) => r.guardians.length === 0), [rows]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={loading ? 'Your roster.' : `${rows.length} ${rows.length === 1 ? 'child' : 'children'} on your roster.`}
        actions={
          role === 'director' ? (
            <>
              <Button variant="secondary" onClick={() => navigate('/students/import')}>
                Import CSV
              </Button>
              <Button onClick={() => navigate('/students/new')}>+ Add student</Button>
            </>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No students yet" icon="🧒" />
      ) : (
        <>
          {withoutContacts.length > 0 ? (
            <Card
              style={{
                borderColor: Brand.tertiary,
                background: Brand.tertiaryContainer,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 800, color: Brand.onTertiaryContainer, marginBottom: 8 }}>
                ⚠️ {withoutContacts.length}{' '}
                {withoutContacts.length === 1 ? 'child has' : 'children have'} no contact
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {withoutContacts.slice(0, 15).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setContactFor({ id: r.id, name: r.name })}
                    title={`Add a contact for ${r.name}`}
                    style={{
                      border: 'none',
                      background: Brand.white,
                      borderRadius: Radius.full,
                      padding: '5px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: Brand.onTertiaryContainer,
                      cursor: 'pointer',
                    }}
                  >
                    {r.name} +
                  </button>
                ))}
                {withoutContacts.length > 15 ? (
                  <span style={{ fontSize: 13, color: Brand.onTertiaryContainer }}>
                    +{withoutContacts.length - 15} more
                  </span>
                ) : null}
              </div>
            </Card>
          ) : null}

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
                  <Th align="right" width={70}>Age</Th>
                  <Th align="right" width={80}>Contacts</Th>
                  <Th align="right" width={200}>Actions</Th>
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
                      <Td align="right">
                        <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                          <ActionLink onClick={() => navigate(`/students/${r.id}`)}>View</ActionLink>
                          <ActionLink onClick={() => navigate(`/students/${r.id}/edit`)}>Edit</ActionLink>
                          <ActionLink onClick={() => setContactFor({ id: r.id, name: r.name })}>
                            Add contact
                          </ActionLink>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}

      {contactFor ? (
        <AddContactModal
          studentId={contactFor.id}
          studentName={contactFor.name}
          onClose={() => setContactFor(null)}
          onAdded={() =>
            setRows((prev) =>
              prev.map((r) =>
                r.id === contactFor.id ? { ...r, guardians: [...r.guardians, { id: -1 }] } : r,
              ),
            )
          }
        />
      ) : null}
    </div>
  );
}
