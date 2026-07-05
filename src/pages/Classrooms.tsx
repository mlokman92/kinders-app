import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Select,
  Spinner,
  TextInput,
} from '@/components/ui';
import { classroomAgeLabel } from '@/lib/age';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type Classroom = {
  id: number;
  name: string;
  branch_id: number;
  level_id: number | null;
};

type LevelInfo = {
  id: number;
  name: string;
  min_age_months: number | null;
  max_age_months: number | null;
};

type ClassroomCard = Classroom & {
  students: number;
  teachers: number;
};

export function Classrooms() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { branches, branchId } = useBranch();
  const canManage = can('manage_classrooms');
  // With "All branches" selected at a multi-branch center, label each card with its branch.
  const showBranchOnCards = branchId === null && branches.length > 1;

  const [rooms, setRooms] = useState<ClassroomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [levels, setLevels] = useState<LevelInfo[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let classroomsQuery = supabase
          .from('classrooms')
          .select('id, name, branch_id, level_id')
          .order('name');
        if (branchId !== null) classroomsQuery = classroomsQuery.eq('branch_id', branchId);
        const [classroomsRes, enrollmentsRes, assignmentsRes, levelsRes] = await Promise.all([
          classroomsQuery,
          supabase.from('enrollments').select('classroom_id'),
          supabase.from('teacher_assignments').select('classroom_id'),
          supabase
            .from('levels')
            .select('id, name, min_age_months, max_age_months')
            .order('sort_order')
            .order('id'),
        ]);
        if (!active) return;
        if (classroomsRes.error) throw classroomsRes.error;
        if (enrollmentsRes.error) throw enrollmentsRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (levelsRes && !levelsRes.error) {
          setLevels((levelsRes.data ?? []) as unknown as LevelInfo[]);
        }

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
  }, [branchId]);

  const createClassroom = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Classroom name is required.');
      return;
    }
    setCreating(true);
    try {
      // Selected branch wins; on "All branches" the form's picker chooses (single-branch
      // centers omit it and let the trigger default).
      const targetBranch =
        branchId ?? (branches.length > 1 && newBranch ? Number(newBranch) : null);
      const { data, error: rpcError } = await supabase.rpc(
        'add_classroom',
        targetBranch != null
          ? { p_name: newName.trim(), p_branch_id: targetBranch }
          : { p_name: newName.trim() },
      );
      if (rpcError) throw rpcError;
      // add_classroom only takes a name; set the optional level tag in a
      // follow-up update (directors already have RLS UPDATE rights on their classrooms).
      const patch: { level_id?: number } = {};
      if (newLevel) patch.level_id = Number(newLevel);
      if (Object.keys(patch).length > 0) {
        // Surface a failed follow-up (e.g. a min>max range) instead of silently dropping it.
        const { error: patchError } = await supabase.from('classrooms').update(patch).eq('id', data);
        if (patchError) throw patchError;
      }
      navigate(`/classrooms/${data}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create classroom.');
      setCreating(false);
    }
  };

  const groups = groupByLevel(rooms, levels);
  const hasLevelGroups = groups.some((g) => g.key !== 'unassigned');
  const branchName = (id: number) =>
    showBranchOnCards ? branches.find((b) => b.id === id)?.name : undefined;

  return (
    <div>
      <PageHeader
        title="Classrooms"
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setNewName('');
                setNewBranch(String(branches[0]?.id ?? ''));
                setNewLevel('');
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              + Add classroom
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No classrooms"
          message={canManage ? 'Create your first classroom to get started.' : undefined}
          icon="🏫"
        />
      ) : hasLevelGroups ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map((group) => (
            <div key={group.key}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: Brand.onSurfaceVariant,
                  letterSpacing: 0.2,
                  margin: '0 0 12px',
                }}
              >
                {group.label}
              </h2>
              <div style={GRID_STYLE}>
                {group.rooms.map((room) => (
                  <RoomCard key={room.id} room={room} branchName={branchName(room.branch_id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={GRID_STYLE}>
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} branchName={branchName(room.branch_id)} />
          ))}
        </div>
      )}

      {createOpen ? (
        <Modal title="Add classroom" onClose={() => (creating ? null : setCreateOpen(false))}>
          {createError ? (
            <div style={{ marginBottom: 14 }}>
              <ErrorState message={createError} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Classroom name">
              <TextInput
                value={newName}
                onChange={setNewName}
                placeholder="e.g. Sunflower Room"
                autoFocus
              />
            </Field>
            {branchId === null && branches.length > 1 ? (
              <Field label="Branch">
                <Select
                  value={newBranch}
                  onChange={setNewBranch}
                  options={branches.map((b) => ({ label: b.name, value: String(b.id) }))}
                />
              </Field>
            ) : null}
            {levels.length > 0 ? (
              <Field label="Level">
                <Select
                  value={newLevel}
                  onChange={setNewLevel}
                  options={[
                    { label: 'No level', value: '' },
                    ...levels.map((l) => {
                      const hint = classroomAgeLabel(l.min_age_months, l.max_age_months);
                      return { label: hint ? `${l.name} (${hint})` : l.name, value: String(l.id) };
                    }),
                  ]}
                />
              </Field>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createClassroom} disabled={creating}>
              {creating ? <Spinner size={16} /> : 'Create'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 16,
};

type Group = { key: string; label: string; rooms: ClassroomCard[] };

/**
 * Group rooms by their level; levels keep their configured order, and rooms with
 * no level (or an unknown level) fall into a trailing "Unassigned" group.
 */
function groupByLevel(rooms: ClassroomCard[], levels: LevelInfo[]): Group[] {
  const byLevel = new Map<number, Group>();
  for (const level of levels) {
    const hint = classroomAgeLabel(level.min_age_months, level.max_age_months);
    byLevel.set(level.id, {
      key: `level-${level.id}`,
      label: hint ? `${level.name} · ${hint}` : level.name,
      rooms: [],
    });
  }
  const unassigned: Group = { key: 'unassigned', label: 'Unassigned', rooms: [] };
  for (const room of rooms) {
    const group = room.level_id != null ? byLevel.get(room.level_id) : undefined;
    (group ?? unassigned).rooms.push(room);
  }
  const groups: Group[] = [];
  for (const level of levels) {
    const group = byLevel.get(level.id);
    if (group && group.rooms.length) groups.push(group);
  }
  if (unassigned.rooms.length) groups.push(unassigned);
  return groups;
}

function RoomCard({ room, branchName }: { room: ClassroomCard; branchName?: string }) {
  return (
    <Link to={`/classrooms/${room.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <Card style={{ cursor: 'pointer', height: '100%' }}>
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
        <div style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface }}>{room.name}</div>
        {branchName ? (
          <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
            {branchName}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Badge tone="primary">🧒 {room.students} students</Badge>
          <Badge tone="success">👩‍🏫 {room.teachers} teachers</Badge>
        </div>
      </Card>
    </Link>
  );
}
