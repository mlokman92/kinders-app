import { useEffect, useMemo, useState } from 'react';

import {
  ageFitsSection,
  ageInMonths,
  formatAgeBand,
  listExams,
  listFrameworks,
  listSections,
  modelMeta,
  type Exam,
  type Framework,
  type Section,
} from '@/lib/assessments';
import { getStudentPhotoUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import { Avatar, Button, Field, Modal, Select, Spinner, TextInput } from './ui';

type StudentLite = {
  id: number;
  name: string;
  dob: string | null;
  center_id: number;
  profile_picture_url: string | null;
  classes: { id: number; name: string }[];
};

type PresetStudent = {
  id: number;
  name: string;
  dob: string | null;
  center_id: number;
  photoUrl?: string | null;
};

const NO_CLASS = 'No classroom';

/**
 * Create a draft `student_assessment`. The student picker is grouped by
 * classroom and shows each child's photo for quick scanning. Section selection
 * adapts to the chosen framework's scoring model: a Permata checklist needs an
 * age band, the KSPK rubric has a single section, and a special-needs screening
 * defaults to all developmental areas (section = null) but can be narrowed.
 */
export function NewAssessmentModal({
  presetStudent,
  onClose,
  onCreated,
}: {
  presetStudent?: PresetStudent;
  onClose: () => void;
  onCreated: (assessmentId: number) => void;
}) {
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const [studentId, setStudentId] = useState<string>(presetStudent ? String(presetStudent.id) : '');
  const [studentSearch, setStudentSearch] = useState('');
  const [examId, setExamId] = useState<string>('');
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>(''); // '' = all areas (screening) or unset

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [fw, exs, studsRes] = await Promise.all([
          listFrameworks(),
          listExams(),
          presetStudent
            ? Promise.resolve(null)
            : supabase
                .from('students')
                .select('id, name, dob, center_id, profile_picture_url, enrollments(classrooms(id, name))')
                .order('name'),
        ]);
        if (!active) return;
        setFrameworks(fw);
        setExams(exs);
        if (studsRes && 'data' in studsRes) {
          const list = (studsRes.data ?? []).map((s) => {
            const row = s as unknown as {
              id: number;
              name: string;
              dob: string | null;
              center_id: number;
              profile_picture_url: string | null;
              enrollments: { classrooms: { id: number; name: string } | null }[];
            };
            return {
              id: row.id,
              name: row.name,
              dob: row.dob,
              center_id: row.center_id,
              profile_picture_url: row.profile_picture_url,
              classes: row.enrollments
                .map((e) => e.classrooms)
                .filter((c): c is { id: number; name: string } => !!c),
            } satisfies StudentLite;
          });
          setStudents(list);
          const paths = list.map((s) => s.profile_picture_url).filter((p): p is string => !!p);
          if (paths.length) {
            const map = await getStudentPhotoUrls(paths);
            if (active) setPhotos(map);
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [presetStudent]);

  const framework = frameworks.find((f) => String(f.id) === frameworkId) ?? null;
  const selectedStudent = students.find((s) => String(s.id) === studentId) ?? null;
  const studentDob = presetStudent ? presetStudent.dob : selectedStudent?.dob ?? null;
  const model = framework ? modelMeta(framework.scoring_model) : null;

  // Load sections for the chosen framework and pick a sensible default.
  useEffect(() => {
    let active = true;
    if (!framework) {
      setSections([]);
      setSectionId('');
      return;
    }
    (async () => {
      const secs = await listSections(framework.id);
      if (!active) return;
      setSections(secs);
      if (framework.scoring_model === 'rubric') {
        setSectionId(secs[0] ? String(secs[0].id) : '');
      } else if (framework.scoring_model === 'screening') {
        setSectionId(''); // default: all developmental areas
      } else {
        const months = ageInMonths(studentDob);
        const fit = secs.find((s) => ageFitsSection(months, s));
        setSectionId(String((fit ?? secs[0])?.id ?? ''));
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework?.id, studentId]);

  // Group filtered students by classroom (a child in several rooms shows in each).
  const grouped = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const matched = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
    const byClass = new Map<string, StudentLite[]>();
    for (const s of matched) {
      const names = s.classes.length ? s.classes.map((c) => c.name) : [NO_CLASS];
      for (const name of names) {
        const arr = byClass.get(name) ?? [];
        arr.push(s);
        byClass.set(name, arr);
      }
    }
    return [...byClass.entries()]
      .sort((a, b) => {
        if (a[0] === NO_CLASS) return 1;
        if (b[0] === NO_CLASS) return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([name, list]) => ({ name, students: list }));
  }, [students, studentSearch]);

  const sectionOptions = useMemo(() => {
    const opts = sections.map((s) => ({
      value: String(s.id),
      label: [s.title, formatAgeBand(s.min_age_months, s.max_age_months)].filter(Boolean).join(' · '),
    }));
    if (framework?.scoring_model === 'screening') {
      return [{ value: '', label: 'Semua bidang (all areas)' }, ...opts];
    }
    return opts;
  }, [sections, framework]);

  const centerId = presetStudent ? presetStudent.center_id : selectedStudent?.center_id ?? null;
  const examOptions = useMemo(() => {
    const list = centerId != null ? exams.filter((e) => e.center_id === centerId) : exams;
    return [
      { value: '', label: '— None —' },
      ...list.map((e) => ({ value: String(e.id), label: e.year ? `${e.name} (${e.year})` : e.name })),
    ];
  }, [exams, centerId]);

  const needsSection = framework?.scoring_model === 'checklist';
  const canCreate = !!studentId && !!framework && (!needsSection || sectionId !== '') && !saving;

  const create = async () => {
    if (!studentId || !framework || centerId == null) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from('student_assessments')
        .insert({
          center_id: centerId,
          student_id: Number(studentId),
          framework_id: framework.id,
          section_id: sectionId === '' ? null : Number(sectionId),
          exam_id: examId === '' ? null : Number(examId),
          status: 'draft',
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      onCreated(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the assessment.');
      setSaving(false);
    }
  };

  return (
    <Modal title="New assessment" onClose={saving ? () => {} : onClose} width={presetStudent ? 480 : 520}>
      {loading ? (
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!presetStudent ? (
            <Field label="Student">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TextInput
                  value={studentSearch}
                  onChange={setStudentSearch}
                  placeholder="Search students…"
                />
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: `1px solid ${Brand.outlineVariant}`,
                    borderRadius: Radius.md,
                  }}
                >
                  {grouped.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: 13.5, color: Brand.onSurfaceVariant }}>
                      No students found.
                    </div>
                  ) : (
                    grouped.map((g) => (
                      <div key={g.name}>
                        <div
                          style={{
                            position: 'sticky',
                            top: 0,
                            padding: '7px 12px',
                            fontSize: 11.5,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            color: Brand.onSurfaceVariant,
                            background: Brand.surfaceContainerLow,
                            borderBottom: `1px solid ${Brand.outlineVariant}`,
                          }}
                        >
                          {g.name} · {g.students.length}
                        </div>
                        {g.students.map((s) => {
                          const selected = String(s.id) === studentId;
                          return (
                            <button
                              key={`${g.name}-${s.id}`}
                              type="button"
                              onClick={() => setStudentId(String(s.id))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                width: '100%',
                                padding: '9px 12px',
                                border: 'none',
                                borderLeft: `3px solid ${selected ? Brand.primary : 'transparent'}`,
                                background: selected ? Brand.primaryContainer : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <Avatar
                                name={s.name}
                                size={32}
                                src={s.profile_picture_url ? photos[s.profile_picture_url] : null}
                              />
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 14,
                                  fontWeight: selected ? 700 : 600,
                                  color: selected ? Brand.onPrimaryContainer : Brand.onSurface,
                                }}
                              >
                                {s.name}
                              </span>
                              {selected ? (
                                <span style={{ color: Brand.onPrimaryContainer, fontWeight: 800 }}>✓</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Field>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={presetStudent.name} size={40} src={presetStudent.photoUrl ?? null} />
              <div style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>
                Assessing <strong style={{ color: Brand.onSurface }}>{presetStudent.name}</strong>
              </div>
            </div>
          )}

          {examOptions.length > 1 ? (
            <Field label="Examination (optional)">
              <Select value={examId} onChange={setExamId} options={examOptions} />
            </Field>
          ) : null}

          <Field label="Framework">
            <Select
              value={frameworkId}
              onChange={setFrameworkId}
              options={[
                { value: '', label: 'Choose a framework…' },
                ...frameworks.map((f) => ({ value: String(f.id), label: f.name })),
              ]}
            />
          </Field>

          {framework && model ? (
            <div style={{ fontSize: 13, color: Brand.onSurfaceVariant, marginTop: -6 }}>
              {model.icon} {model.label}
              {framework.description ? ` — ${framework.description}` : ''}
            </div>
          ) : null}

          {framework && framework.scoring_model !== 'rubric' && sectionOptions.length > 0 ? (
            <Field label={framework.scoring_model === 'checklist' ? 'Age band' : 'Area'}>
              <Select value={sectionId} onChange={setSectionId} options={sectionOptions} />
            </Field>
          ) : null}

          {error ? (
            <div
              style={{
                fontSize: 13,
                color: Brand.onErrorContainer,
                background: Brand.errorContainer,
                padding: '8px 12px',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!canCreate}>
              {saving ? <Spinner size={16} /> : 'Start assessment'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
