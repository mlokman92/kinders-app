import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { AddContactModal } from '@/components/AddContactModal';
import { NewAssessmentModal } from '@/components/NewAssessmentModal';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { modelMeta } from '@/lib/assessments';
import { useAuth } from '@/lib/auth';
import { formatDisplayDate, parseISODate } from '@/lib/dates';
import { entryTimeLabel, humanizeEntry } from '@/lib/entries';
import { downloadStudentDailyReportPdf, downloadStudentJournalPdf } from '@/lib/entriesPdf';
import { getEntryMediaUrls, getStudentPhotoUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type Student = {
  id: number;
  center_id: number;
  name: string;
  dob: string | null;
  gender: string | null;
  profile_picture_url: string | null;
  created_at: string;
};

type AssessmentRow = {
  id: number;
  status: string;
  assessed_on: string;
  assessment_frameworks: { name: string; scoring_model: string } | null;
  assessment_sections: { title: string } | null;
};

type EnrollmentRow = {
  id: number;
  status: string | null;
  days: string[] | null;
  classrooms: { id: number; name: string } | null;
};

type GuardianRow = {
  id: number;
  name: string | null;
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
  media: { path: string; type: 'image' | 'video' }[] | null;
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
  const navigate = useNavigate();
  const { role } = useAuth();

  const [student, setStudent] = useState<Student | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newAssessOpen, setNewAssessOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dailyBusy, setDailyBusy] = useState<string | null>(null);

  const reloadGuardians = async () => {
    const { data } = await supabase
      .from('guardians')
      .select('id, name, email, phone, relationship')
      .eq('student_id', sid);
    setGuardians((data ?? []) as unknown as GuardianRow[]);
  };

  const isStaff = role === 'director' || role === 'teacher';
  const isDirector = role === 'director';

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [studentRes, enrollRes, guardianRes, entriesRes, assessRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, center_id, name, dob, gender, profile_picture_url, created_at')
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
            .select('id, type, entry_date, created_at, data, media')
            .eq('student_id', sid)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(40),
          supabase
            .from('student_assessments')
            .select(
              'id, status, assessed_on, assessment_frameworks(name, scoring_model), assessment_sections(title)',
            )
            .eq('student_id', sid)
            .order('assessed_on', { ascending: false })
            .order('created_at', { ascending: false }),
        ]);
        if (!active) return;
        if (studentRes.error) throw studentRes.error;
        if (enrollRes.error) throw enrollRes.error;
        if (guardianRes.error) throw guardianRes.error;
        if (entriesRes.error) throw entriesRes.error;
        if (assessRes.error) throw assessRes.error;
        const loadedStudent = (studentRes.data ?? null) as unknown as Student | null;
        setStudent(loadedStudent);
        setEnrollments((enrollRes.data ?? []) as unknown as EnrollmentRow[]);
        setGuardians((guardianRes.data ?? []) as unknown as GuardianRow[]);
        const entryRows = (entriesRes.data ?? []) as unknown as EntryRow[];
        setEntries(entryRows);
        setAssessments((assessRes.data ?? []) as unknown as AssessmentRow[]);

        // Sign the entry-media paths so the journal can show the attached photos/videos.
        const mediaPaths = entryRows.flatMap((e) => (e.media ?? []).map((m) => m.path)).filter(Boolean);
        if (mediaPaths.length > 0) {
          const urls = await getEntryMediaUrls(mediaPaths);
          if (active) setMediaUrls(urls);
        }
        if (loadedStudent?.profile_picture_url) {
          const url = await getStudentPhotoUrl(loadedStudent.profile_picture_url);
          if (active) setPhotoUrl(url);
        }
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

  const deleteStudent = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      const { data, error: delError } = await supabase
        .from('students')
        .delete()
        .eq('id', sid)
        .select('id');
      if (delError) throw delError;
      if (!data || data.length === 0) {
        throw new Error('You do not have permission to delete this student.');
      }
      navigate('/students', { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete student.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const downloadJournal = async () => {
    setPdfBusy(true);
    setActionError(null);
    try {
      await downloadStudentJournalPdf(sid);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadDaily = async (date: string) => {
    setDailyBusy(date);
    setActionError(null);
    try {
      await downloadStudentDailyReportPdf(sid, date);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setDailyBusy(null);
    }
  };

  const backLink = (
    <Link
      to="/students"
      style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}
    >
      ← Students
    </Link>
  );

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {backLink}
      {isStaff ? (
        <Button variant="secondary" onClick={downloadJournal} disabled={pdfBusy}>
          {pdfBusy ? <Spinner size={16} /> : 'Journal PDF'}
        </Button>
      ) : null}
      {isStaff ? (
        <Button variant="secondary" onClick={() => navigate(`/students/${sid}/edit`)}>
          Edit
        </Button>
      ) : null}
      {isDirector ? (
        <Button
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          style={{ color: Brand.error, borderColor: Brand.error }}
        >
          Delete
        </Button>
      ) : null}
    </div>
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
      <PageHeader title={student.name} actions={headerActions} />

      {actionError ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={actionError} />
        </div>
      ) : null}

      <Card style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Avatar name={student.name} size={56} src={photoUrl} />
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          margin: '28px 0 14px',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: 0 }}>Contacts</h2>
        {isStaff ? (
          <Button variant="secondary" onClick={() => setAddContactOpen(true)}>
            Add contact
          </Button>
        ) : null}
      </div>
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
              <Avatar name={g.name || g.email || g.phone || ''} size={40} />
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
                    {g.name || g.email || g.phone || 'Contact'}
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          margin: '28px 0 14px',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 800, color: Brand.onSurface, margin: 0 }}>
          Assessments
        </h2>
        {isStaff ? (
          <Button variant="secondary" onClick={() => setNewAssessOpen(true)}>
            New assessment
          </Button>
        ) : null}
      </div>
      <Card padding={0}>
        {assessments.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 14, color: Brand.onSurfaceVariant }}>
            No assessments yet
          </div>
        ) : (
          assessments.map((a, i) => (
            <div
              key={a.id}
              onClick={() => navigate(`/assessments/${a.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: Brand.onSurface }}>
                  {a.assessment_frameworks
                    ? `${modelMeta(a.assessment_frameworks.scoring_model).icon} ${a.assessment_frameworks.name}`
                    : 'Assessment'}
                </div>
                <div style={{ fontSize: 12.5, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                  {[a.assessment_sections?.title ?? 'All areas', formatDisplayDate(parseISODate(a.assessed_on))].join(
                    ' · ',
                  )}
                </div>
              </div>
              <Badge tone={a.status === 'completed' ? 'success' : 'warning'}>
                {a.status === 'completed' ? 'Completed' : 'Draft'}
              </Badge>
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 12px 8px 18px',
                  borderBottom: `1px solid ${Brand.outlineVariant}`,
                  background: Brand.surfaceContainerLow,
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 800, color: Brand.onSurface }}>
                  {formatDisplayDate(parseISODate(day.date))}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => downloadDaily(day.date)}
                  disabled={dailyBusy !== null}
                  style={{ padding: '5px 12px', fontSize: 12.5 }}
                >
                  {dailyBusy === day.date ? <Spinner size={14} /> : 'Download'}
                </Button>
              </div>
              {day.rows.map((e, i) => {
                const { summary, note } = humanizeEntry(e.type, e.data, []);
                const time = entryTimeLabel(e.data, e.created_at);
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
                      {(e.media ?? []).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          {(e.media ?? []).map((m, idx) => {
                            const url = mediaUrls[m.path];
                            if (!url) return null;
                            const box = {
                              width: 116,
                              height: 116,
                              borderRadius: Radius.md,
                              objectFit: 'cover' as const,
                              background: Brand.surfaceContainerHigh,
                            };
                            return m.type === 'video' ? (
                              <video key={idx} src={url} controls preload="metadata" style={box} />
                            ) : (
                              <a key={idx} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" loading="lazy" style={{ ...box, display: 'block' }} />
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <Badge tone="neutral">{entryLabel(e.type)}</Badge>
                      {time ? (
                        <span style={{ fontSize: 11.5, color: Brand.onSurfaceVariant }}>{time}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      )}

      {confirmOpen ? (
        <Modal title="Delete student?" onClose={() => (deleting ? null : setConfirmOpen(false))}>
          <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 18 }}>
            This permanently removes <strong>{student.name}</strong>, their enrollments, contacts,
            and journal entries. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={deleteStudent}
              disabled={deleting}
              style={{ background: Brand.error, color: Brand.onError }}
            >
              {deleting ? <Spinner size={16} /> : 'Delete'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {addContactOpen ? (
        <AddContactModal
          studentId={sid}
          studentName={student.name}
          onClose={() => setAddContactOpen(false)}
          onAdded={reloadGuardians}
        />
      ) : null}

      {newAssessOpen ? (
        <NewAssessmentModal
          presetStudent={{
            id: student.id,
            name: student.name,
            dob: student.dob,
            center_id: student.center_id,
            photoUrl,
          }}
          onClose={() => setNewAssessOpen(false)}
          onCreated={(aid) => navigate(`/assessments/${aid}`)}
        />
      ) : null}
    </div>
  );
}
