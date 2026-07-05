/**
 * Capability keys for the access-key matrix. Must stay in sync with
 * private.capability_keys() / private.default_capability() in Postgres —
 * the database enforces; this file only drives UI.
 */
export const CAPABILITIES = [
  'edit_students',
  'manage_students',
  'manage_enrollments',
  'manage_guardians',
  'manage_classrooms',
  'manage_staff',
  'create_entries',
  'manage_activities',
  'manage_plans',
  'send_broadcast',
  'manage_assessments',
  'manage_exams',
  'manage_enrollment_applications',
  'view_reports',
  'record_attendance',
  'view_attendance',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  edit_students: 'Edit student profiles',
  manage_students: 'Add & remove students',
  manage_enrollments: 'Manage enrollments',
  manage_guardians: 'Manage contacts',
  manage_classrooms: 'Manage classrooms',
  manage_staff: 'Manage staff',
  create_entries: 'Journal entries',
  manage_activities: 'Manage activities',
  manage_plans: 'Lesson plans',
  send_broadcast: 'Announcements',
  manage_assessments: 'Assessments',
  manage_exams: 'Manage exams',
  manage_enrollment_applications: 'Enrollment applications',
  view_reports: 'View reports',
  record_attendance: 'Record attendance',
  view_attendance: 'View attendance reports',
};

const TEACHER_DEFAULTS: readonly Capability[] = [
  'edit_students',
  'manage_guardians',
  'create_entries',
  'manage_plans',
  'send_broadcast',
  'manage_assessments',
  'view_reports',
  'record_attendance',
];

/**
 * Mirrors private.default_capability(): what a role can do with no matrix row.
 * Admins default-allow everything EXCEPT view_attendance (employee-location monitoring
 * stays owner-only until explicitly granted per admin role).
 */
export function defaultAllowed(role: 'teacher' | 'admin', capability: Capability): boolean {
  if (role === 'admin') return capability !== 'view_attendance';
  return TEACHER_DEFAULTS.includes(capability);
}
