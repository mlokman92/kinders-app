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
  Select,
  Table,
  Td,
  TextInput,
  Th,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
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
  nric: string | null;
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
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths}mo`;
  if (remMonths === 0) return `${years}y`;
  return `${years}y ${remMonths}mo`;
}

export function Students() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { branchId } = useBranch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [contactFor, setContactFor] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase
          .from('students')
          .select('id, name, dob, gender, nric, enrollments(classrooms(name)), guardians(id)')
          .order('name');
        if (branchId !== null) q = q.eq('branch_id', branchId);
        const res = await q;
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
  }, [branchId]);

  const classroomOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows)
      for (const e of r.enrollments) if (e.classrooms?.name) names.add(e.classrooms.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (classroomFilter && !r.enrollments.some((e) => e.classrooms?.name === classroomFilter))
        return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.nric ?? '').toLowerCase().includes(q);
    });
  }, [rows, query, classroomFilter]);

  const withoutContacts = useMemo(() => rows.filter((r) => r.guardians.length === 0), [rows]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={loading ? 'Your roster.' : `${rows.length} ${rows.length === 1 ? 'child' : 'children'} on your roster.`}
        actions={
          can('manage_students') ? (
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

          <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 3, minWidth: 0 }}>
              <Field label="Search">
                <TextInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search by name or NRIC…"
                  style={{ width: '100%' }}
                />
              </Field>
            </div>
            {classroomOptions.length > 0 ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Field label="Classroom">
                  <Select
                    value={classroomFilter}
                    onChange={setClassroomFilter}
                    options={[
                      { label: 'All classrooms', value: '' },
                      ...classroomOptions.map((n) => ({ label: n, value: n })),
                    ]}
                    style={{ width: '100%', minWidth: 0 }}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="No students match your search." icon="🔍" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>NRIC</Th>
                  <Th>Classrooms</Th>
                  <Th align="right" width={96}>Age</Th>
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
                      <Td style={{ color: r.nric ? Brand.onSurface : Brand.onSurfaceVariant }}>
                        {r.nric || '—'}
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
