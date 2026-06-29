import { useEffect, useState } from 'react';
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
  Spinner,
  TextInput,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
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
  const navigate = useNavigate();
  const { role } = useAuth();
  const isDirector = role === 'director';

  const [rooms, setRooms] = useState<ClassroomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const createClassroom = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Classroom name is required.');
      return;
    }
    setCreating(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('add_classroom', {
        p_name: newName.trim(),
      });
      if (rpcError) throw rpcError;
      navigate(`/classrooms/${data}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create classroom.');
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Classrooms"
        actions={
          isDirector ? (
            <Button
              onClick={() => {
                setNewName('');
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
          message={isDirector ? 'Create your first classroom to get started.' : undefined}
          icon="🏫"
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {rooms.map((room) => (
            <Link
              key={room.id}
              to={`/classrooms/${room.id}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
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
                <div style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface }}>
                  {room.name}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Badge tone="primary">🧒 {room.students} students</Badge>
                  <Badge tone="success">👩‍🏫 {room.teachers} teachers</Badge>
                </div>
              </Card>
            </Link>
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
          <Field label="Classroom name">
            <TextInput
              value={newName}
              onChange={setNewName}
              placeholder="e.g. Sunflower Room"
              autoFocus
            />
          </Field>
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
