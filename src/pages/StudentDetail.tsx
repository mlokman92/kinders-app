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
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { humanizeEntry } from '@/lib/entries';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Student = {
  id: number;
  name: string;
  dob: string | null;
  gender: string | null;
  created_at: string;
};

type EnrollmentRow = {
  id: number;
  status: string | null;
  days: string[] | null;
  classrooms: { id: number; name: string } | null;
};

type GuardianRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
};

type EntryRow = {
  id: number;
  type: string;
  entry_date: string;
  created_at: string;
  data: Record<string, unknown> | null;
};

/** Whole-year age from a YYYY-MM-DD date of birth, or null if unparseable. */
function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = parseISODate(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function StudentDetail() {
  const { id } = useParams();
  const sid = Number(id);

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [studentRes, enrollRes, guardianRes, entriesRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, name, dob, gender, created_at')
            .eq('id', sid)
            .maybeSingle(),
          supabase
            .from('enrollments')
            .select('id, status, days, classrooms(id, name)')
            .eq('student_id', sid),
          supabase
            .from('guardians')
            .select('id, name, email, phone, relationship')
            .eq('student_id', sid),
          supabase
            .from('entries')
            .select('id, type, entry_date, created_at, data')
            .eq('student_id', sid)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(40),
        ]);
        if (!active) return;
        if (studentRes.error) throw studentRes.error;
        if (enrollRes.error) throw enrollRes.error;
        if (guardianRes.error) throw guardianRes.error;
        if (entriesRes.error) throw entriesRes.error;
        setStudent((studentRes.data ?? null) as unknown as Student | null);
        setEnrollments((enrollRes.data ?? []) as unknown as EnrollmentRow[]);
        setGuardians((guardianRes.data ?? []) as unknown as GuardianRow[]);
        setEntries((entriesRes.data ?? []) as unknown as EntryRow[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load student.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sid]);

  const backLink = (
    <Link
      to="/students"
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Students
    </Link>
  );

  if (loading) {
    return (
      <div>
        <PageHeader title="Student" actions={backLink} />
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Student" actions={backLink} />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!student) {
    return (
      <div>
        <PageHeader title="Student" actions={backLink} />
        <EmptyState title="Student not found" icon="🔍" />
      </div>
    );
  }

  const age = ageFromDob(student.dob);
  const classroomBadges = enrollments
    .map((en) => en.classrooms)
    .filter((c): c is { id: number; name: string } => c != null);

  // Group entries by entry_date, preserving the already-sorted (desc) order.
  const grouped: { date: string; rows: EntryRow[] }[] = [];
  for (const e of entries) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === e.entry_date) last.rows.push(e);
    else grouped.push({ date: e.entry_date, rows: [e] });
  }

  return (
    <div>
      <PageHeader title={student.name} actions={backLink} />

      <Card style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Avatar name={student.name} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: Brand.onSurface }}>{student.name}</div>
          <div style={{ fontSize: 13.5, color: Brand.onSurfaceVariant, marginTop: 3 }}>
            {[
              age != null ? `${age} ${age === 1 ? 'year' : 'years'} old` : null,
              student.gender || null,
            ]
              .filter(Boolean)
              .join(' · ') || 'No details on file'}
          </div>
          {classroomBadges.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {classroomBadges.map((c) => (
                <Link key={c.id} to={`/classrooms/${c.id}`} style={{ textDecoration: 'none' }}>
                  <Badge tone="primary">{c.name}</Badge>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Contacts
      </h2>
      <Card padding={0}>
        {guardians.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 14, color: Brand.onSurfaceVariant }}>
            No contacts
          </div>
        ) : (
          guardians.map((g, i) => (
            <div
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
              }}
            >
              <Avatar name={g.name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: Brand.onSurface }}>
                    {g.name}
                  </span>
                  {g.relationship ? <Badge tone="neutral">{g.relationship}</Badge> : null}
                </div>
                <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                  {[g.email, g.phone].filter(Boolean).join(' · ') || 'No contact details'}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: '28px 0 14px' }}>
        Recent journal
      </h2>
      {grouped.length === 0 ? (
        <EmptyState
          title="No journal entries yet"
          message="Entries logged in the app will appear here."
          icon="📭"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map((day) => (
            <Card key={day.date} padding={0}>
              <div
                style={{
                  padding: '12px 18px',
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: Brand.onSurface,
                  borderBottom: `1px solid ${Brand.outlineVariant}`,
                  background: Brand.surfaceContainerLow,
                }}
              >
                {formatDisplayDate(parseISODate(day.date))}
              </div>
              {day.rows.map((e, i) => {
                const { summary, note } = humanizeEntry(e.type, e.data, []);
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: '14px 18px',
                      borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                    }}
                  >
                    <div style={{ fontSize: 22, lineHeight: 1.1 }}>{ENTRY_EMOJI[e.type] ?? '•'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, color: Brand.onSurface }}>{summary}</div>
                      {note ? (
                        <div style={{ fontSize: 13, color: Brand.onSurfaceVariant, marginTop: 3 }}>
                          {note}
                        </div>
                      ) : null}
                    </div>
                    <Badge tone="neutral">{entryLabel(e.type)}</Badge>
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
