import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  SectionHeading,
  Stat,
} from '@/components/ui';
import { ENTRY_EMOJI, entryLabel } from '@/constants/entry-actions';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { toISODate } from '@/lib/dates';
import { humanizeEntry } from '@/lib/entries';
import { supabase } from '@/lib/supabase';
import { Brand, ENTRY_TYPE_COLORS, Radius } from '@/lib/theme';

/** Shape returned by the `home_summary()` RPC (one round-trip, RLS-scoped, branch-aware). */
type HomeSummary = {
  today: string;
  branch_id: number | null;
  counts: { students: number; classrooms: number; staff: number; entries_today: number };
  attendance: { expected: number; checked_in: number; checked_out: number; present: number };
  care: { unwell: number; meals: number; naps: number };
  action: {
    pending_applications: number;
    students_missing_contact: number;
    draft_assessments: number;
    attendance_review: number;
  };
  staff_attendance: { on_shift: number; needs_review: number };
  branches: { id: number; name: string; expected: number; present: number; entries: number; staff_on_shift: number }[];
  trend_14d: { d: string; n: number }[];
  by_type_7d: Record<string, number>;
  unread: number;
};

type RecentEntry = {
  id: number;
  type: string;
  entry_date: string;
  created_at: string;
  data: Record<string, unknown> | null;
  student_id: number;
  students: { name: string } | null;
  classrooms: { name: string } | null;
};

export function Dashboard() {
  const { can, isOwner } = useAuth();
  const { branchId, branch, branches } = useBranch();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Greeting name — the caller's own profile (same source the sidebar footer uses).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc('my_profile');
      if (!active || !data || typeof data !== 'object' || Array.isArray(data)) return;
      const full = ((data as { full_name?: string }).full_name ?? '').trim();
      setFirstName(full.split(/\s+/)[0] || null);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const today = toISODate(new Date());
      try {
        // Scope the recent-activity feed to the selected branch (the summary RPC scopes itself).
        let classroomIds: number[] | null = null;
        if (branchId !== null) {
          const { data: cls, error: clsErr } = await supabase
            .from('classrooms')
            .select('id')
            .eq('branch_id', branchId);
          if (clsErr) throw clsErr;
          classroomIds = (cls ?? []).map((r) => r.id);
          if (classroomIds.length === 0) classroomIds = [-1];
        }

        const args: { p_today: string; p_branch_id?: number } = { p_today: today };
        if (branchId !== null) args.p_branch_id = branchId;

        let recentQ = supabase
          .from('entries')
          .select('id, type, entry_date, created_at, data, student_id, students(name), classrooms(name)')
          .order('created_at', { ascending: false })
          .limit(8);
        if (classroomIds) recentQ = recentQ.in('classroom_id', classroomIds);

        const [summaryRes, recentRes] = await Promise.all([
          supabase.rpc('home_summary', args),
          recentQ,
        ]);
        if (!active) return;
        if (summaryRes.error) throw summaryRes.error;
        if (recentRes.error) throw recentRes.error;
        setSummary(summaryRes.data as unknown as HomeSummary);
        setRecent((recentRes.data ?? []) as unknown as RecentEntry[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }, []);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    [],
  );
  const scopeLabel = branch ? branch.name : branches.length > 1 ? 'All branches' : null;

  // Action-needed triage cards — each gated by the capability that owns that surface, shown only
  // when there is actually something waiting.
  const attnCards = summary
    ? (
        [
          can('manage_enrollment_applications') && summary.action.pending_applications > 0
            ? {
                key: 'apps',
                tone: 'warn' as const,
                icon: '📥',
                count: summary.action.pending_applications,
                label: 'Enrollment applications waiting',
                to: '/enrollments',
              }
            : null,
          can('view_attendance') && summary.action.attendance_review > 0
            ? {
                key: 'att',
                tone: 'error' as const,
                icon: '📍',
                count: summary.action.attendance_review,
                label: 'Staff check-ins to review',
                to: '/attendance',
              }
            : null,
          summary.action.students_missing_contact > 0
            ? {
                key: 'contact',
                tone: 'warn' as const,
                icon: '👤',
                count: summary.action.students_missing_contact,
                label: 'Students missing a contact',
                to: '/students',
              }
            : null,
          can('manage_assessments') && summary.action.draft_assessments > 0
            ? {
                key: 'draft',
                tone: 'info' as const,
                icon: '📋',
                count: summary.action.draft_assessments,
                label: 'Assessments still in draft',
                to: '/assessments',
              }
            : null,
        ] as (AttnCardProps | null)[]
      ).filter((c): c is AttnCardProps => c !== null)
    : [];

  // Entries today vs the same weekday last week (index 13 = today, index 6 = 7 days earlier).
  const entriesTrend = useMemo<{ dir: 'up' | 'down'; label: string } | undefined>(() => {
    const t = summary?.trend_14d;
    if (!t || t.length < 8) return undefined;
    const diff = t[t.length - 1].n - t[t.length - 8].n;
    if (diff === 0) return undefined;
    return { dir: diff > 0 ? 'up' : 'down', label: `${Math.abs(diff)} vs last week` };
  }, [summary]);

  const typeRows = summary
    ? Object.entries(summary.by_type_7d)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, value]) => ({
          label: entryLabel(type),
          value,
          color: ENTRY_TYPE_COLORS[type] ?? Brand.primary,
        }))
    : [];

  const trendValues = summary?.trend_14d.map((p) => p.n) ?? [];
  const trendTotal = trendValues.reduce((a, b) => a + b, 0);

  const showBranches = isOwner && branchId === null && (summary?.branches.length ?? 0) > 1;

  return (
    <div>
      {/* ---- hero ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 4,
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: Brand.onSurface, letterSpacing: -0.4 }}>
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <div
            style={{
              marginTop: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              flexWrap: 'wrap',
              fontSize: 14,
              color: Brand.onSurfaceVariant,
            }}
          >
            <span>{dateLabel}</span>
            {scopeLabel ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: Brand.primaryContainer,
                  color: Brand.onPrimaryContainer,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: '50%', background: Brand.primary }}
                />
                {scopeLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {can('send_broadcast') ? (
            <Button variant="outline" onClick={() => navigate('/announcements')}>
              📣 New announcement
            </Button>
          ) : null}
          {can('manage_students') ? (
            <Button onClick={() => navigate('/students/new')}>＋ Add student</Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div style={{ marginTop: 20 }}>
          <ErrorState message={error} />
        </div>
      ) : summary ? (
        <>
          {/* ---- needs attention ---- */}
          <SectionHeading title="Needs your attention" />
          {attnCards.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 13,
              }}
            >
              {attnCards.map((c) => (
                <AttentionCard key={c.key} tone={c.tone} icon={c.icon} count={c.count} label={c.label} to={c.to} />
              ))}
            </div>
          ) : (
            <Card style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: Brand.successContainer,
                  color: Brand.onSuccessContainer,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 19,
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontWeight: 700, color: Brand.onSurface }}>All caught up</div>
                <div style={{ fontSize: 13, color: Brand.onSurfaceVariant }}>
                  Nothing needs your attention right now.
                </div>
              </div>
            </Card>
          )}

          {/* ---- today ---- */}
          <SectionHeading title="Today" />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Meter
                checkedIn={summary.attendance.checked_in}
                checkedOut={summary.attendance.checked_out}
                present={summary.attendance.present}
                expected={summary.attendance.expected}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Stat
                  label="Unwell"
                  value={summary.care.unwell}
                  icon="🌡️"
                  accent={Brand.success}
                  tone={summary.care.unwell > 0 ? 'alert' : 'default'}
                  hint={summary.care.unwell > 0 ? 'needs follow-up' : 'all well'}
                />
                <Stat label="Meals" value={summary.care.meals} icon="🍽️" accent={Brand.tertiary} hint="logged" />
                <Stat label="Naps" value={summary.care.naps} icon="😴" accent="#5C8AFF" hint="children rested" />
              </div>
            </div>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Stat
                  label="Entries today"
                  value={summary.counts.entries_today}
                  icon="📝"
                  accent={Brand.secondary}
                  trend={entriesTrend}
                />
                <Stat label="Students" value={summary.counts.students} icon="🧒" accent={Brand.primary} />
                <Stat label="Classrooms" value={summary.counts.classrooms} icon="🏫" accent={Brand.success} />
                {can('view_attendance') ? (
                  <Stat
                    label="Staff on shift"
                    value={`${summary.staff_attendance.on_shift} / ${summary.counts.staff}`}
                    icon="⏱️"
                    accent={Brand.success}
                    hint="geofenced"
                  />
                ) : can('manage_staff') ? (
                  <Stat label="Staff" value={summary.counts.staff} icon="👩‍🏫" accent={Brand.tertiary} />
                ) : null}
              </div>
            </div>
          </div>

          {/* ---- branches (multi-branch owner, all-branches view) ---- */}
          {showBranches ? (
            <>
              <SectionHeading title="Branches today" />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                {summary.branches.map((b) => (
                  <BranchCard key={b.id} branch={b} canSeeStaff={can('view_attendance')} />
                ))}
              </div>
            </>
          ) : null}

          {/* ---- recent activity + trends ---- */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4, alignItems: 'flex-start' }}>
            <div style={{ flex: '2 1 360px', minWidth: 0 }}>
              <SectionHeading
                title="Recent activity"
                action={
                  <Link
                    to="/reports"
                    style={{ fontSize: 12.5, fontWeight: 700, color: Brand.primary }}
                  >
                    View reports →
                  </Link>
                }
              />
              {recent.length === 0 ? (
                <EmptyState
                  title="No entries yet"
                  message="Journal entries logged in the app will appear here."
                  icon="📭"
                />
              ) : (
                <Card padding={6}>
                  {recent.map((e) => {
                    const { summary: line } = humanizeEntry(e.type, e.data, []);
                    const color = ENTRY_TYPE_COLORS[e.type] ?? Brand.primary;
                    return (
                      <div
                        key={e.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '11px 12px',
                          borderRadius: Radius.md,
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            background: color + '22',
                            border: `1px solid ${color}44`,
                          }}
                        >
                          {ENTRY_EMOJI[e.type] ?? '•'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: Brand.onSurface }}>
                            <Link
                              to={`/students/${e.student_id}`}
                              style={{ fontWeight: 700, color: Brand.onSurface }}
                            >
                              {e.students?.name ?? 'Student'}
                            </Link>{' '}
                            <span style={{ color: Brand.onSurfaceVariant }}>· {line}</span>
                          </div>
                          <div style={{ fontSize: 12, color: Brand.onSurfaceVariant, marginTop: 2 }}>
                            {e.classrooms?.name ? `${e.classrooms.name} · ` : ''}
                            {e.entry_date}
                          </div>
                        </div>
                        <Badge tone="neutral">{entryLabel(e.type)}</Badge>
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>

            <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ marginTop: 28 }}>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 800, color: Brand.onSurface }}>
                    Entries this fortnight
                  </div>
                  <div style={{ fontSize: 11.5, color: Brand.onSurfaceVariant, fontWeight: 600, marginBottom: 10 }}>
                    {trendTotal} entries · {(trendTotal / 14).toFixed(1)}/day · last 14 days
                  </div>
                  <Sparkline values={trendValues} />
                </Card>
              </div>
              {can('view_reports') && typeRows.length > 0 ? (
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 800, color: Brand.onSurface }}>
                    Entries by type
                  </div>
                  <div style={{ fontSize: 11.5, color: Brand.onSurfaceVariant, fontWeight: 600, marginBottom: 12 }}>
                    Past 7 days
                  </div>
                  <MiniBars rows={typeRows} />
                </Card>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- Attendance meter */

function Meter({
  checkedIn,
  checkedOut,
  present,
  expected,
}: {
  checkedIn: number;
  checkedOut: number;
  present: number;
  expected: number;
}) {
  // Denominator never dips below those already in (drop-ins on an unscheduled day) and never 0.
  const denom = Math.max(expected, checkedIn, 1);
  const notArrived = Math.max(denom - checkedIn, 0);
  const pct = Math.round((checkedIn / denom) * 100);
  const seg = (n: number) => `${(n / denom) * 100}%`;
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: Brand.onSurfaceVariant }}>
          Checked in today
        </span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            background: Brand.successContainer,
            color: Brand.onSuccessContainer,
            padding: '2px 9px',
            borderRadius: 999,
          }}
        >
          {pct}%
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: Brand.onSurface, letterSpacing: -1, lineHeight: 1.1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {checkedIn}
        <span style={{ fontSize: 17, fontWeight: 700, color: Brand.onSurfaceVariant, letterSpacing: 0 }}>
          {' '}
          / {denom}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 12,
          borderRadius: 999,
          background: Brand.surfaceContainerHigh,
          overflow: 'hidden',
          margin: '13px 0 12px',
        }}
      >
        <span style={{ width: seg(present), background: Brand.success }} />
        <span style={{ width: seg(checkedOut), background: Brand.tertiary }} />
        <span style={{ width: seg(notArrived), background: Brand.outlineVariant }} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <LegendItem color={Brand.success} label="Present" value={present} />
        <LegendItem color={Brand.tertiary} label="Checked out" value={checkedOut} />
        <LegendItem color={Brand.outlineVariant} label="Not arrived" value={notArrived} />
      </div>
    </Card>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: Brand.onSurfaceVariant }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}{' '}
      <b style={{ color: Brand.onSurface, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    </span>
  );
}

/* ------------------------------------------------------------- Attention card */

type AttnCardProps = {
  key?: string;
  tone: 'warn' | 'error' | 'info';
  icon: string;
  count: number;
  label: string;
  to: string;
};

const ATTN_TONES: Record<AttnCardProps['tone'], { stripe: string; bg: string; fg: string }> = {
  warn: { stripe: Brand.tertiary, bg: Brand.tertiaryContainer, fg: Brand.onTertiaryContainer },
  error: { stripe: Brand.secondary, bg: Brand.secondaryContainer, fg: Brand.onSecondaryContainer },
  info: { stripe: Brand.primary, bg: Brand.primaryContainer, fg: Brand.onPrimaryContainer },
};

function AttentionCard({ tone, icon, count, label, to }: AttnCardProps) {
  const t = ATTN_TONES[tone];
  return (
    <Link to={to} style={{ display: 'block' }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          padding: '15px 16px 15px 18px',
          background: Brand.white,
          border: `1px solid ${Brand.outlineVariant}`,
          borderRadius: Radius.lg,
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: t.stripe }} />
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: t.bg,
            color: t.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 19,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: Brand.onSurface, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {count}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: Brand.onSurfaceVariant, marginTop: 3 }}>
            {label}
          </div>
        </div>
        <span style={{ color: Brand.onSurfaceVariant, fontSize: 20, flexShrink: 0 }}>›</span>
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------- Branch card */

function BranchCard({
  branch,
  canSeeStaff,
}: {
  branch: { id: number; name: string; expected: number; present: number; entries: number; staff_on_shift: number };
  canSeeStaff: boolean;
}) {
  const denom = Math.max(branch.expected, branch.present, 1);
  const pct = Math.min(100, Math.round((branch.present / denom) * 100));
  return (
    <Card padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: Brand.primaryContainer,
            color: Brand.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
          }}
        >
          📍
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: Brand.onSurface }}>{branch.name}</span>
      </div>
      <BranchRow k="Present" v={`${branch.present} / ${branch.expected}`} />
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: Brand.surfaceContainerHigh,
          overflow: 'hidden',
          margin: '4px 0 8px',
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct}%`,
            background: pct >= 75 ? Brand.success : Brand.tertiary,
          }}
        />
      </div>
      {canSeeStaff ? <BranchRow k="Staff on shift" v={String(branch.staff_on_shift)} /> : null}
      <BranchRow k="Entries" v={String(branch.entries)} />
    </Card>
  );
}

function BranchRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
      <span style={{ color: Brand.onSurfaceVariant, fontWeight: 600 }}>{k}</span>
      <span style={{ fontWeight: 800, color: Brand.onSurface, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------- Mini bar chart */

function MiniBars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, width: 82, flexShrink: 0, color: Brand.onSurface }}>
            {r.label}
          </span>
          <span style={{ flex: 1, height: 9, borderRadius: 999, background: Brand.surfaceContainerHigh, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.value / max) * 100}%`, background: r.color, borderRadius: 999 }} />
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, width: 24, textAlign: 'right', color: Brand.onSurfaceVariant, fontVariantNumeric: 'tabular-nums' }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Sparkline */

function Sparkline({ values, color = Brand.primary }: { values: number[]; color?: string }) {
  const w = 300;
  const h = 68;
  const pad = 5;
  if (values.length === 0) return <div style={{ height: h }} />;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => (n <= 1 ? pad : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2 - 4);
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id="kinders-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1="0" y1={h - pad} x2={w} y2={h - pad} stroke={Brand.outlineVariant} strokeWidth={1} />
      <path d={area} fill="url(#kinders-spark)" />
      <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r={3.2} fill={color} stroke={Brand.white} strokeWidth={1.6} />
    </svg>
  );
}
