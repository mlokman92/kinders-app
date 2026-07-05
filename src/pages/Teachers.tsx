import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
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
  is_teacher: boolean;
  is_admin: boolean;
  teacher_assignments: { classrooms: { name: string } | null }[] | null;
};

type StaffRole = { id: number; name: string };
type RoleAssignmentRow = { teacher_id: number; staff_roles: StaffRole | null };
type StaffBranchRow = { teacher_id: number; branch_id: number };

export function Teachers() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { branchId, branches } = useBranch();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [roleMap, setRoleMap] = useState<Map<number, StaffRole[]>>(new Map());
  const [branchMap, setBranchMap] = useState<Map<number, number[]>>(new Map());
  const [allRoles, setAllRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const canManage = can('manage_staff');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Load the join tables and the role catalog in parallel. These are
        // RLS-scoped (assignments/roles need manage_staff), so a non-manager
        // just gets empty sets — no error, no chips, no custom-role filter.
        const [sbRes, assignRes, rolesRes] = await Promise.all([
          supabase.from('staff_branches').select('teacher_id, branch_id'),
          supabase.from('staff_role_assignments').select('teacher_id, staff_roles(id, name)'),
          supabase.from('staff_roles').select('id, name').order('name'),
        ]);

        const staffBranches = (sbRes.data ?? []) as unknown as StaffBranchRow[];
        const nextBranchMap = new Map<number, number[]>();
        for (const r of staffBranches) {
          const list = nextBranchMap.get(r.teacher_id) ?? [];
          list.push(r.branch_id);
          nextBranchMap.set(r.teacher_id, list);
        }

        const nextRoleMap = new Map<number, StaffRole[]>();
        for (const a of (assignRes.data ?? []) as unknown as RoleAssignmentRow[]) {
          if (!a.staff_roles) continue;
          const list = nextRoleMap.get(a.teacher_id) ?? [];
          list.push(a.staff_roles);
          nextRoleMap.set(a.teacher_id, list);
        }

        let teacherQuery = supabase
          .from('teachers')
          .select('id, name, email, phone, is_teacher, is_admin, teacher_assignments(classrooms(name))')
          .order('name');
        // Preserve the branch switcher scoping: restrict to staff in the branch.
        if (branchId !== null) {
          const ids = staffBranches.filter((r) => r.branch_id === branchId).map((r) => r.teacher_id);
          teacherQuery = teacherQuery.in('id', ids.length ? ids : [-1]);
        }
        const res = await teacherQuery;

        if (!active) return;
        if (res.error) throw res.error;
        setTeachers((res.data ?? []) as unknown as TeacherRow[]);
        setBranchMap(nextBranchMap);
        setRoleMap(nextRoleMap);
        setAllRoles((rolesRes.data ?? []) as unknown as StaffRole[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load staff.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  const roleOptions = useMemo(
    () => [
      { label: 'All roles', value: '' },
      { label: 'Teacher', value: 'teacher' },
      { label: 'Admin', value: 'admin' },
      ...allRoles.map((r) => ({ label: r.name, value: `role:${r.id}` })),
    ],
    [allRoles],
  );

  const branchOptions = useMemo(
    () => [
      { label: 'All branches', value: '' },
      ...branches.map((b) => ({ label: b.name, value: String(b.id) })),
    ],
    [branches],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teachers.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !(t.email ?? '').toLowerCase().includes(q))
        return false;
      if (roleFilter === 'teacher' && !t.is_teacher) return false;
      if (roleFilter === 'admin' && !t.is_admin) return false;
      if (roleFilter.startsWith('role:')) {
        const rid = Number(roleFilter.slice(5));
        if (!(roleMap.get(t.id) ?? []).some((r) => r.id === rid)) return false;
      }
      if (branchFilter && !(branchMap.get(t.id) ?? []).includes(Number(branchFilter))) return false;
      return true;
    });
  }, [teachers, query, roleFilter, branchFilter, roleMap, branchMap]);

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${teachers.length} staff on the roster.`}
        actions={
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => navigate('/staff/import')}>
                Import CSV
              </Button>
              <Button onClick={() => navigate('/staff/new')}>+ Add staff</Button>
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
          title="No staff yet"
          message={canManage ? 'Add your first staff member to get started.' : undefined}
          icon="👩‍🏫"
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 3, minWidth: 0 }}>
              <Field label="Search">
                <TextInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search by name or email…"
                  style={{ width: '100%' }}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Field label="Role">
                <Select
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleOptions}
                  style={{ width: '100%', minWidth: 0 }}
                />
              </Field>
            </div>
            {branches.length > 1 ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Field label="Branch">
                  <Select
                    value={branchFilter}
                    onChange={setBranchFilter}
                    options={branchOptions}
                    style={{ width: '100%', minWidth: 0 }}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="No staff match your filters." icon="🔍" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Roles</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Classrooms</Th>
                  {canManage ? (
                    <Th align="right" width={140}>
                      Actions
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const classrooms = (t.teacher_assignments ?? [])
                    .map((a) => a.classrooms?.name)
                    .filter((n): n is string => Boolean(n))
                    .join(', ');
                  const customRoles = roleMap.get(t.id) ?? [];
                  const noRoles = !t.is_teacher && !t.is_admin && customRoles.length === 0;
                  return (
                    <tr key={t.id}>
                      <Td>
                        <Link
                          to={`/staff/${t.id}`}
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
                      <Td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {t.is_teacher ? <Badge tone="primary">Teacher</Badge> : null}
                          {t.is_admin ? <Badge tone="warning">Admin</Badge> : null}
                          {customRoles.map((r) => (
                            <Badge key={r.id} tone="neutral">
                              {r.name}
                            </Badge>
                          ))}
                          {noRoles ? '—' : null}
                        </div>
                      </Td>
                      <Td>{t.email || '—'}</Td>
                      <Td>{t.phone || '—'}</Td>
                      <Td>{classrooms || '—'}</Td>
                      {canManage ? (
                        <Td align="right">
                          <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                            <ActionLink onClick={() => navigate(`/staff/${t.id}`)}>View</ActionLink>
                            <ActionLink onClick={() => navigate(`/staff/${t.id}/edit`)}>
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
        </>
      )}
    </div>
  );
}
