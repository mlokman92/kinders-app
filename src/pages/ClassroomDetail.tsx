import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { MultiSelectModal, type PickOption } from '@/components/MultiSelectModal';
import {
  Avatar,
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
  Stat,
  StatGrid,
  Table,
  Td,
  TextInput,
  Th,
} from '@/components/ui';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { classroomAgeLabel } from '@/lib/age';
import { useAuth } from '@/lib/auth';
import { parseISODate } from '@/lib/dates';
import { humanizeEntry } from '@/lib/entries';
import { getStudentPhotoUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type ClassroomRow = {
  id: number;
  name: string;
  center_id: number;
  branch_id: number;
  level_id: number | null;
};

type LevelRow = {
  id: number;
  center_id: number;
  name: string;
  min_age_months: number | null;
  max_age_months: number | null;
};

type EnrollmentRow = {
  id: number;
  status: string | null;
  students: { id: number; name: string; dob: string | null } | null;
};

type AssignmentRow = {
  id: number;
  teachers: { id: number; name: string; email: string } | null;
};

type EntryRow = {
  id: number;
  type: string;
  entry_date: string;
  data: Record<string, unknown> | null;
  students: { name: string } | null;
};

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const birth = parseISODate(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
  if (years < 1) {
    let months = now.getMonth() - birth.getMonth() + 12 * (now.getFullYear() - birth.getFullYear());
    if (now.getDate() < birth.getDate()) months -= 1;
    return `${Math.max(0, months)} mo`;
  }
  return `${years} yr`;
}

/** Precise age as years + months (e.g. "3 yr 4 mo"), or undefined if unknown. */
function ageYearsMonths(dob: string | null): string | undefined {
  if (!dob) return undefined;
  const birth = parseISODate(dob);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return undefined;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo`;
  if (rem === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}

function ActionLink({
  onClick,
  children,
  tone = 'primary',
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'primary' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        color: tone === 'danger' ? Brand.error : Brand.onPrimaryContainer,
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

export function ClassroomDetail() {
  const { id } = useParams();
  const cid = Number(id);
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManageRooms = can('manage_classrooms');
  const canEnroll = can('manage_enrollments');
  const canStaff = can('manage_staff');

  const [classroom, setClassroom] = useState<ClassroomRow | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [allStudents, setAllStudents] = useState<
    {
      id: number;
      name: string;
      center_id: number;
      branch_id: number;
      dob: string | null;
      profile_picture_url: string | null;
    }[]
  >([]);
  const [photoByPath, setPhotoByPath] = useState<Record<string, string>>({});
  // student id → names of the classrooms they're currently enrolled in (any room).
  const [studentClassrooms, setStudentClassrooms] = useState<Record<number, string[]>>({});
  const [allTeachers, setAllTeachers] = useState<
    { id: number; name: string; email: string; center_id: number }[]
  >([]);
  // teacher id ↔ branch membership, to keep the assign picker within this room's branch.
  const [staffBranchRows, setStaffBranchRows] = useState<
    { teacher_id: number; branch_id: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'student' | 'teacher' | null>(null);

  const [levels, setLevels] = useState<LevelRow[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLevelId, setEditLevelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const base = [
          supabase
            .from('classrooms')
            .select('id, name, center_id, branch_id, level_id')
            .eq('id', cid)
            .maybeSingle(),
          supabase
            .from('enrollments')
            .select('id, status, students(id, name, dob)')
            .eq('classroom_id', cid),
          supabase
            .from('teacher_assignments')
            .select('id, teachers(id, name, email)')
            .eq('classroom_id', cid),
          supabase
            .from('entries')
            .select('id, type, entry_date, data, students(name)')
            .eq('classroom_id', cid)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('levels')
            .select('id, center_id, name, min_age_months, max_age_months')
            .order('sort_order')
            .order('id'),
        ];
        // Staff who can enroll/assign also need the pickable rosters.
        const extra =
          canEnroll || canStaff
            ? [
                supabase
                  .from('students')
                  .select('id, name, center_id, branch_id, dob, profile_picture_url')
                  .order('name'),
                supabase.from('teachers').select('id, name, email, center_id').order('name'),
                // Every enrollment across the center, to show each student's current rooms.
                supabase.from('enrollments').select('student_id, classrooms(name)'),
                supabase.from('staff_branches').select('teacher_id, branch_id'),
              ]
            : [];
        const [
          classroomRes,
          enrollmentsRes,
          assignmentsRes,
          entriesRes,
          levelsRes,
          studentsRes,
          teachersRes,
          allEnrollmentsRes,
          staffBranchesRes,
        ] = await Promise.all([...base, ...extra]);
        if (!active) return;
        if (classroomRes.error) throw classroomRes.error;
        if (enrollmentsRes.error) throw enrollmentsRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (entriesRes.error) throw entriesRes.error;
        setClassroom((classroomRes.data ?? null) as unknown as ClassroomRow | null);
        if (levelsRes && !levelsRes.error) {
          setLevels((levelsRes.data ?? []) as unknown as LevelRow[]);
        }
        setEnrollments((enrollmentsRes.data ?? []) as unknown as EnrollmentRow[]);
        setAssignments((assignmentsRes.data ?? []) as unknown as AssignmentRow[]);
        setEntries((entriesRes.data ?? []) as unknown as EntryRow[]);
        if (studentsRes && !studentsRes.error) {
          const studentRows = (studentsRes.data ?? []) as unknown as {
            id: number;
            name: string;
            center_id: number;
            branch_id: number;
            dob: string | null;
            profile_picture_url: string | null;
          }[];
          setAllStudents(studentRows);
          const paths = studentRows
            .map((s) => s.profile_picture_url)
            .filter((p): p is string => Boolean(p));
          if (paths.length) {
            const map = await getStudentPhotoUrls(paths);
            if (active) setPhotoByPath(map);
          }
        }
        if (teachersRes && !teachersRes.error) {
          setAllTeachers(
            (teachersRes.data ?? []) as unknown as {
              id: number;
              name: string;
              email: string;
              center_id: number;
            }[],
          );
        }
        if (allEnrollmentsRes && !allEnrollmentsRes.error) {
          const map: Record<number, string[]> = {};
          for (const row of (allEnrollmentsRes.data ?? []) as unknown as {
            student_id: number;
            classrooms: { name: string } | null;
          }[]) {
            const roomName = row.classrooms?.name;
            if (!roomName) continue;
            (map[row.student_id] ??= []).push(roomName);
          }
          setStudentClassrooms(map);
        }
        if (staffBranchesRes && !staffBranchesRes.error) {
          setStaffBranchRows(
            (staffBranchesRes.data ?? []) as unknown as { teacher_id: number; branch_id: number }[],
          );
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load classroom.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cid, canEnroll, canStaff]);

  const reloadRosters = async () => {
    const [enr, asg] = await Promise.all([
      supabase.from('enrollments').select('id, status, students(id, name, dob)').eq('classroom_id', cid),
      supabase.from('teacher_assignments').select('id, teachers(id, name, email)').eq('classroom_id', cid),
    ]);
    if (enr.error || asg.error) {
      setActionError('Saved, but the list could not refresh — reload the page to see the latest.');
      return;
    }
    setActionError(null);
    setEnrollments((enr.data ?? []) as unknown as EnrollmentRow[]);
    setAssignments((asg.data ?? []) as unknown as AssignmentRow[]);
  };

  // upsert + ignoreDuplicates: good rows land even if another tab/session already
  // added one of the picks (the new unique constraints make a plain insert all-or-nothing).
  const addStudents = async (ids: number[]) => {
    const { error: insErr } = await supabase
      .from('enrollments')
      .upsert(
        ids.map((sid) => ({ student_id: sid, classroom_id: cid })),
        { onConflict: 'student_id,classroom_id', ignoreDuplicates: true },
      );
    if (insErr) throw insErr;
    await reloadRosters();
  };

  const addTeachers = async (ids: number[]) => {
    const { error: insErr } = await supabase
      .from('teacher_assignments')
      .upsert(
        ids.map((tid) => ({ teacher_id: tid, classroom_id: cid })),
        { onConflict: 'teacher_id,classroom_id', ignoreDuplicates: true },
      );
    if (insErr) throw insErr;
    await reloadRosters();
  };

  const removeEnrollment = async (enrollmentId: number) => {
    setActionError(null);
    const { error: delErr } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
    if (delErr) setActionError(delErr.message);
    else await reloadRosters();
  };

  const removeAssignment = async (assignmentId: number) => {
    setActionError(null);
    const { error: delErr } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('id', assignmentId);
    if (delErr) setActionError(delErr.message);
    else await reloadRosters();
  };

  const saveClassroom = async () => {
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Classroom name is required.');
      return;
    }
    setSaving(true);
    const { data, error: updErr } = await supabase
      .from('classrooms')
      .update({
        name: editName.trim(),
        level_id: editLevelId ? Number(editLevelId) : null,
      })
      .eq('id', cid)
      .select('id, name, center_id, branch_id, level_id')
      .maybeSingle();
    if (updErr) {
      setEditError(updErr.message);
      setSaving(false);
      return;
    }
    if (!data) {
      setEditError('You do not have permission to edit this classroom.');
      setSaving(false);
      return;
    }
    setClassroom(data as unknown as ClassroomRow);
    setSaving(false);
    setEditOpen(false);
  };

  const deleteClassroom = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      const { data, error: delErr } = await supabase
        .from('classrooms')
        .delete()
        .eq('id', cid)
        .select('id');
      if (delErr) throw delErr;
      if (!data || data.length === 0) {
        throw new Error('You do not have permission to delete this classroom.');
      }
      navigate('/classrooms', { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete classroom.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!classroom) return <EmptyState title="Classroom not found" icon="🔍" />;

  const enrolledIds = new Set(
    enrollments.map((en) => en.students?.id).filter((x): x is number => x != null),
  );
  const assignedIds = new Set(
    assignments.map((a) => a.teachers?.id).filter((x): x is number => x != null),
  );
  // Only offer students/staff from THIS classroom's center (a director may own
  // several centers; an RLS with_check would otherwise reject a cross-center pick)
  // AND this classroom's branch.
  const branchTeacherIds = new Set(
    staffBranchRows.filter((r) => r.branch_id === classroom.branch_id).map((r) => r.teacher_id),
  );
  const studentOptions: PickOption[] = allStudents
    .filter(
      (s) =>
        s.center_id === classroom.center_id &&
        s.branch_id === classroom.branch_id &&
        !enrolledIds.has(s.id),
    )
    .map((s) => {
      const age = ageYearsMonths(s.dob);
      const rooms = studentClassrooms[s.id];
      const roomText = rooms && rooms.length ? `In ${rooms.join(', ')}` : undefined;
      return {
        id: s.id,
        label: s.name,
        sublabel: [age, roomText].filter(Boolean).join(' · ') || undefined,
        imageUrl: s.profile_picture_url ? photoByPath[s.profile_picture_url] ?? null : null,
        showAvatar: true,
      };
    });
  const teacherOptions: PickOption[] = allTeachers
    .filter(
      (t) =>
        t.center_id === classroom.center_id && branchTeacherIds.has(t.id) && !assignedIds.has(t.id),
    )
    .map((t) => ({ id: t.id, label: t.name, sublabel: t.email }));

  // Levels for this room's center; the tag select only appears when levels exist.
  const centerLevels = levels.filter((l) => l.center_id === classroom.center_id);
  // The room's age now comes from its level; show the level name + its age band.
  const roomLevel =
    classroom.level_id != null ? levels.find((l) => l.id === classroom.level_id) : undefined;
  const levelSubtitle = roomLevel
    ? [roomLevel.name, classroomAgeLabel(roomLevel.min_age_months, roomLevel.max_age_months)]
        .filter(Boolean)
        .join(' · ')
    : undefined;
  const levelOptions = [
    { label: 'No level', value: '' },
    ...centerLevels.map((l) => {
      const hint = classroomAgeLabel(l.min_age_months, l.max_age_months);
      return { label: hint ? `${l.name} (${hint})` : l.name, value: String(l.id) };
    }),
  ];

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Link to="/classrooms" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
        ← Classrooms
      </Link>
      {canManageRooms ? (
        <>
          <Button
            variant="secondary"
            onClick={() => {
              setEditName(classroom.name);
              setEditLevelId(classroom.level_id != null ? String(classroom.level_id) : '');
              setEditError(null);
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            style={{ color: Brand.error, borderColor: Brand.error }}
          >
            Delete
          </Button>
        </>
      ) : null}
    </div>
  );

  return (
    <div>
      <PageHeader title={classroom.name} subtitle={levelSubtitle} actions={headerActions} />

      {actionError ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={actionError} />
        </div>
      ) : null}

      <StatGrid>
        <Stat label="Students" value={enrollments.length} icon="🧒" accent={Brand.primary} />
        <Stat label="Teachers" value={assignments.length} icon="👩‍🏫" accent={Brand.tertiary} />
      </StatGrid>

      <SectionHeader
        title="Students"
        action={
          canEnroll ? (
            <Button variant="secondary" onClick={() => setPicker('student')}>
              Add students
            </Button>
          ) : null
        }
      />
      {enrollments.length === 0 ? (
        <EmptyState title="No students enrolled" icon="🧒" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th align="right" width={100}>
                Age
              </Th>
              {canEnroll ? <Th align="right" width={150} /> : null}
            </tr>
          </thead>
          <tbody>
            {enrollments.map((en) => (
              <tr key={en.id}>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={en.students?.name ?? '·'} />
                    {en.students ? (
                      <Link
                        to={`/students/${en.students.id}`}
                        style={{ fontWeight: 700, color: Brand.onSurface }}
                      >
                        {en.students.name}
                      </Link>
                    ) : (
                      <span style={{ color: Brand.onSurfaceVariant }}>Unknown</span>
                    )}
                  </div>
                </Td>
                <Td align="right" style={{ color: Brand.onSurfaceVariant }}>
                  {ageFromDob(en.students?.dob ?? null)}
                </Td>
                {canEnroll ? (
                  <Td align="right">
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                      {en.students ? (
                        <ActionLink onClick={() => navigate(`/students/${en.students!.id}/edit`)}>
                          Edit
                        </ActionLink>
                      ) : null}
                      <ActionLink tone="danger" onClick={() => removeEnrollment(en.id)}>
                        Remove
                      </ActionLink>
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <SectionHeader
        title="Teachers"
        action={
          canStaff ? (
            <Button variant="secondary" onClick={() => setPicker('teacher')}>
              Assign teacher
            </Button>
          ) : null
        }
      />
      {assignments.length === 0 ? (
        <EmptyState title="No teachers assigned" icon="👩‍🏫" />
      ) : (
        <Card padding={0}>
          {assignments.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
              }}
            >
              <Avatar name={a.teachers?.name ?? '·'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {a.teachers ? (
                  <Link
                    to={`/staff/${a.teachers.id}`}
                    style={{ fontWeight: 700, color: Brand.onSurface, fontSize: 14.5 }}
                  >
                    {a.teachers.name}
                  </Link>
                ) : (
                  <span style={{ color: Brand.onSurfaceVariant }}>Unknown</span>
                )}
                <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                  {a.teachers?.email ?? ''}
                </div>
              </div>
              {canStaff ? (
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {a.teachers ? (
                    <ActionLink onClick={() => navigate(`/staff/${a.teachers!.id}/edit`)}>
                      Edit
                    </ActionLink>
                  ) : null}
                  <ActionLink tone="danger" onClick={() => removeAssignment(a.id)}>
                    Remove
                  </ActionLink>
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Recent activity
      </h2>
      {entries.length === 0 ? (
        <EmptyState title="No entries yet" message="Journal entries for this classroom will appear here." icon="📭" />
      ) : (
        <Card padding={0}>
          {entries.map((e, i) => {
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
                    <span style={{ fontWeight: 700 }}>{e.students?.name ?? 'Student'}</span>{' '}
                    <span style={{ color: Brand.onSurfaceVariant }}>· {summary}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                    {e.entry_date}
                  </div>
                </div>
                <Badge tone="neutral">{entryLabel(e.type)}</Badge>
              </div>
            );
          })}
        </Card>
      )}

      {picker === 'student' ? (
        <MultiSelectModal
          title={`Add students to ${classroom.name}`}
          options={studentOptions}
          confirmLabel={(n) => `Add ${n} student${n === 1 ? '' : 's'}`}
          emptyText="Every student is already enrolled in this class."
          onClose={() => setPicker(null)}
          onConfirm={addStudents}
        />
      ) : null}

      {picker === 'teacher' ? (
        <MultiSelectModal
          title={`Assign teachers to ${classroom.name}`}
          options={teacherOptions}
          confirmLabel={(n) => `Assign ${n} teacher${n === 1 ? '' : 's'}`}
          emptyText="Every teacher is already assigned to this class."
          onClose={() => setPicker(null)}
          onConfirm={addTeachers}
        />
      ) : null}

      {editOpen ? (
        <Modal title="Edit classroom" onClose={() => (saving ? null : setEditOpen(false))}>
          {editError ? (
            <div style={{ marginBottom: 14 }}>
              <ErrorState message={editError} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Classroom name">
              <TextInput value={editName} onChange={setEditName} autoFocus />
            </Field>
            {centerLevels.length > 0 ? (
              <Field label="Level">
                <Select value={editLevelId} onChange={setEditLevelId} options={levelOptions} />
              </Field>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveClassroom} disabled={saving}>
              {saving ? <Spinner size={16} /> : 'Save'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete classroom?" onClose={() => (deleting ? null : setConfirmDelete(false))}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            This permanently removes <strong>{classroom.name}</strong> along with its{' '}
            {enrollments.length} enrollment{enrollments.length === 1 ? '' : 's'},{' '}
            {assignments.length} teacher assignment{assignments.length === 1 ? '' : 's'}, its lesson
            schedule, and <strong>all journal entries logged in this room</strong>. Students,
            teachers, and their other records are not deleted. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={deleteClassroom}
              disabled={deleting}
              style={{ background: Brand.error, color: Brand.onError }}
            >
              {deleting ? <Spinner size={16} /> : 'Delete classroom'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        margin: '28px 0 14px',
      }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: 0 }}>{title}</h2>
      {action}
    </div>
  );
}
