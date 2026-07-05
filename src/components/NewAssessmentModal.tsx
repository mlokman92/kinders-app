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
import { useBranch } from '@/lib/branch';
import { getStudentPhotoUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import { Avatar, Button, Field, Modal, Select, Spinner } from './ui';

type PresetStudent = {
  id: number;
  name: string;
  dob: string | null;
  center_id: number;
  photoUrl?: string | null;
};

type StudentLite = {
  id: number;
  name: string;
  dob: string | null;
  center_id: number;
  profile_picture_url: string | null;
  classroom_ids: number[];
};

type Classroom = { id: number; name: string; center_id: number };

/**
 * Create draft assessments. From a child's profile (`presetStudent`) it makes a
 * single assessment for that child. From the Assessments page it's a class-first
 * bulk flow: pick a classroom, tick students (or "select all"), choose the
 * framework, and one draft `student_assessment` is created per selected child.
 *
 * Section selection adapts to the framework's scoring model: a Permata checklist
 * needs an age band, the KSPK rubric has a single section, and a special-needs
 * screening defaults to all developmental areas (section = null).
 */
export function NewAssessmentModal({
  presetStudent,
  onClose,
  onCreated,
  onBulkCreated,
}: {
  presetStudent?: PresetStudent;
  onClose: () => void;
  onCreated?: (assessmentId: number) => void;
  onBulkCreated?: (count: number) => void;
}) {
  const bulk = !presetStudent;
  const { branchId } = useBranch();

  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [classId, setClassId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [examId, setExamId] = useState('');
  const [frameworkId, setFrameworkId] = useState('');
  const [sectionId, setSectionId] = useState(''); // '' = all areas (screening) or unset

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [fw, exs] = await Promise.all([listFrameworks(), listExams()]);
        if (!active) return;
        setFrameworks(fw);
        setExams(exs);
        if (bulk) {
          let clsQuery = supabase.from('classrooms').select('id, name, center_id');
          if (branchId != null) clsQuery = clsQuery.eq('branch_id', branchId);
          const [classRes, studRes] = await Promise.all([
            clsQuery.order('name'),
            supabase
              .from('students')
              .select('id, name, dob, center_id, profile_picture_url, enrollments(classroom_id)')
              .order('name'),
          ]);
          if (!active) return;
          setClassrooms((classRes.data ?? []) as Classroom[]);
          const list = (studRes.data ?? []).map((s) => {
            const row = s as unknown as {
              id: number;
              name: string;
              dob: string | null;
              center_id: number;
              profile_picture_url: string | null;
              enrollments: { classroom_id: number }[];
            };
            return {
              id: row.id,
              name: row.name,
              dob: row.dob,
              center_id: row.center_id,
              profile_picture_url: row.profile_picture_url,
              classroom_ids: row.enrollments.map((e) => e.classroom_id),
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
  }, [bulk, branchId]);

  const framework = frameworks.find((f) => String(f.id) === frameworkId) ?? null;
  const model = framework ? modelMeta(framework.scoring_model) : null;
  const selectedClass = classrooms.find((c) => String(c.id) === classId) ?? null;
  const centerId = presetStudent ? presetStudent.center_id : selectedClass?.center_id ?? null;

  const studentsInClass = useMemo(
    () => (classId ? students.filter((s) => s.classroom_ids.includes(Number(classId))) : []),
    [students, classId],
  );
  const allSelected = studentsInClass.length > 0 && studentsInClass.every((s) => selectedIds.has(s.id));

  // Reset student ticks when the classroom changes.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [classId]);

  // Load sections + pick a sensible default when the framework changes.
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
        setSectionId('');
      } else {
        // checklist: best-fit age band for the (preset) child, else first
        const months = ageInMonths(presetStudent?.dob ?? null);
        const fit = presetStudent ? secs.find((s) => ageFitsSection(months, s)) : null;
        setSectionId(String((fit ?? secs[0])?.id ?? ''));
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework?.id]);

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

  const examOptions = useMemo(() => {
    const list = centerId != null ? exams.filter((e) => e.center_id === centerId) : exams;
    return [
      { value: '', label: '— None —' },
      ...list.map((e) => ({ value: String(e.id), label: e.year ? `${e.name} (${e.year})` : e.name })),
    ];
  }, [exams, centerId]);

  const toggleStudent = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelectedIds((prev) => {
      if (studentsInClass.every((s) => prev.has(s.id))) return new Set();
      return new Set(studentsInClass.map((s) => s.id));
    });

  const needsSection = framework?.scoring_model === 'checklist';
  const sectionReady = !needsSection || sectionId !== '';
  const canCreate = bulk
    ? !!selectedClass && selectedIds.size > 0 && !!framework && sectionReady && !saving
    : !!framework && sectionReady && !saving;

  const submit = async () => {
    if (!framework) return;
    setSaving(true);
    setError(null);
    const section = sectionId === '' ? null : Number(sectionId);
    const exam = examId === '' ? null : Number(examId);
    try {
      if (bulk) {
        if (!selectedClass || selectedIds.size === 0) return;
        const rows = [...selectedIds].map((sid) => ({
          center_id: selectedClass.center_id,
          student_id: sid,
          framework_id: framework.id,
          section_id: section,
          exam_id: exam,
          status: 'draft' as const,
        }));
        const { error: insErr } = await supabase.from('student_assessments').insert(rows);
        if (insErr) throw insErr;
        onBulkCreated?.(rows.length);
      } else if (presetStudent) {
        const { data, error: insErr } = await supabase
          .from('student_assessments')
          .insert({
            center_id: presetStudent.center_id,
            student_id: presetStudent.id,
            framework_id: framework.id,
            section_id: section,
            exam_id: exam,
            status: 'draft',
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        onCreated?.(data.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the assessment.');
      setSaving(false);
    }
  };

  const detailsBlock = (
    <>
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

      {examOptions.length > 1 ? (
        <Field label="Examination (optional)">
          <Select value={examId} onChange={setExamId} options={examOptions} />
        </Field>
      ) : null}
    </>
  );

  const createLabel = bulk
    ? `Create ${selectedIds.size || ''} draft${selectedIds.size === 1 ? '' : 's'}`.replace('  ', ' ').trim()
    : 'Start assessment';

  return (
    <Modal title="New assessment" onClose={saving ? () => {} : onClose} width={bulk ? 560 : 480}>
      {loading ? (
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {bulk ? (
            <>
              <Field label="Classroom">
                <Select
                  value={classId}
                  onChange={setClassId}
                  options={[
                    { value: '', label: 'Choose a classroom…' },
                    ...classrooms.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </Field>

              {classId ? (
                <Field label="Students">
                  <div
                    style={{
                      border: `1px solid ${Brand.outlineVariant}`,
                      borderRadius: Radius.md,
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {studentsInClass.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 13.5, color: Brand.onSurfaceVariant }}>
                        No students enrolled in this classroom.
                      </div>
                    ) : (
                      <>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '9px 12px',
                            borderBottom: `1px solid ${Brand.outlineVariant}`,
                            background: Brand.surfaceContainerLow,
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: Brand.onSurface,
                          }}
                        >
                          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                          Select all ({studentsInClass.length})
                        </label>
                        {studentsInClass.map((s, i) => (
                          <label
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                              cursor: 'pointer',
                              background: selectedIds.has(s.id) ? Brand.primaryContainer + '33' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(s.id)}
                              onChange={() => toggleStudent(s.id)}
                            />
                            <Avatar
                              name={s.name}
                              size={28}
                              src={s.profile_picture_url ? photos[s.profile_picture_url] : null}
                            />
                            <span style={{ fontSize: 14, color: Brand.onSurface }}>{s.name}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </Field>
              ) : null}

              {detailsBlock}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={presetStudent!.name} size={40} src={presetStudent!.photoUrl ?? null} />
                <div style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>
                  Assessing <strong style={{ color: Brand.onSurface }}>{presetStudent!.name}</strong>
                </div>
              </div>
              {detailsBlock}
            </>
          )}

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
            <Button onClick={submit} disabled={!canCreate}>
              {saving ? <Spinner size={16} /> : createLabel}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
