import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PlanActivityModal } from '@/components/PlanActivityModal';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Toolbar,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import { addDays, formatDisplayDate, startOfWeekMonday, toISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

type Classroom = { id: number; name: string };

type ScheduleItem = {
  id: number;
  date: string;
  sort_order: number;
  activities: { id: number; title: string } | null;
};

type ViewMode = 'week' | 'month';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

/** A small transparent icon button used for reorder / remove controls on plan blocks. */
function MiniButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none',
        background: 'transparent',
        color: danger ? Brand.error : Brand.onPrimaryContainer,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1,
        padding: '2px 5px',
        borderRadius: Radius.sm,
      }}
    >
      {children}
    </button>
  );
}

export function Plans() {
  const { can } = useAuth();
  const { branchId } = useBranch();
  const canManage = can('manage_plans');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroom, setClassroom] = useState('');
  const [view, setView] = useState<ViewMode>('month');
  const [weekStart, setWeekStart] = useState<Date>(startOfWeekMonday(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(firstOfMonth(new Date()));

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [addCtx, setAddCtx] = useState<{ date: string; label: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const monthGrid = useMemo(() => {
    const gridStart = startOfWeekMonday(monthAnchor);
    const monthLast = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
    const weeks = Math.floor(daysBetween(gridStart, monthLast) / 7) + 1;
    return { gridStart, cellCount: weeks * 7 };
  }, [monthAnchor]);

  // Load classrooms (scoped to the selected branch).
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingClassrooms(true);
      let query = supabase.from('classrooms').select('id, name').order('name');
      if (branchId !== null) query = query.eq('branch_id', branchId);
      const { data, error: err } = await query;
      if (!active) return;
      if (err) {
        setError(err.message);
      } else {
        const rows = (data ?? []) as unknown as Classroom[];
        setClassrooms(rows);
        // Keep the selection when it survives the branch switch; else fall back.
        setClassroom((prev) =>
          rows.some((c) => String(c.id) === prev) ? prev : rows.length > 0 ? String(rows[0].id) : '',
        );
      }
      setLoadingClassrooms(false);
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  // Load schedule items for the selected classroom + visible range.
  useEffect(() => {
    if (!classroom) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const start = view === 'week' ? weekStart : monthGrid.gridStart;
      const end =
        view === 'week' ? addDays(weekStart, 6) : addDays(monthGrid.gridStart, monthGrid.cellCount - 1);
      const { data, error: err } = await supabase
        .from('schedule_items')
        .select('id, date, sort_order, activities(id, title)')
        .eq('classroom_id', Number(classroom))
        .gte('date', toISODate(start))
        .lte('date', toISODate(end))
        .order('date')
        .order('sort_order');
      if (!active) return;
      if (err) {
        setError(err.message);
        setItems([]);
      } else {
        setItems((data ?? []) as unknown as ScheduleItem[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [classroom, view, weekStart, monthGrid, refreshTick]);

  const reload = () => setRefreshTick((t) => t + 1);

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.date, (m.get(it.date) ?? 0) + 1);
    return m;
  }, [items]);

  /* ---------------------------------------------------------- mutations */

  const removeItem = async (itemId: number) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('schedule_items').delete().eq('id', itemId);
    if (err) setError(err.message);
    setBusy(false);
    reload();
  };

  const reorder = async (dayItems: ScheduleItem[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= dayItems.length) return;
    const ids = dayItems.map((it) => it.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('set_plan_order', { p_ids: ids });
    if (err) setError(err.message);
    setBusy(false);
    reload();
  };

  const copyLastWeek = async () => {
    setCopyOpen(false);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('copy_schedule_week', {
      p_classroom_id: Number(classroom),
      p_from_monday: toISODate(addDays(weekStart, -7)),
      p_to_monday: toISODate(weekStart),
    });
    if (err) setError(err.message);
    setBusy(false);
    reload();
  };

  /* -------------------------------------------------------- navigation */

  const goPrev = () =>
    view === 'week'
      ? setWeekStart(addDays(weekStart, -7))
      : setMonthAnchor(addMonths(monthAnchor, -1));
  const goNext = () =>
    view === 'week' ? setWeekStart(addDays(weekStart, 7)) : setMonthAnchor(addMonths(monthAnchor, 1));
  const goToday = () =>
    view === 'week'
      ? setWeekStart(startOfWeekMonday(new Date()))
      : setMonthAnchor(firstOfMonth(new Date()));

  const showMonth = () => {
    setMonthAnchor(firstOfMonth(weekStart));
    setView('month');
  };
  const drillToWeek = (d: Date) => {
    setWeekStart(startOfWeekMonday(d));
    setView('week');
  };

  const monday = weekStart;
  const sunday = addDays(monday, 6);
  const rangeLabel =
    view === 'week'
      ? `${formatDisplayDate(monday)} – ${formatDisplayDate(sunday)}`
      : monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader title="Lesson plans" />

      {loadingClassrooms ? (
        <Loading />
      ) : classrooms.length === 0 ? (
        <EmptyState title="No classrooms" icon="🏫" />
      ) : (
        <>
          <Toolbar>
            <Field label="Classroom">
              <Select
                value={classroom}
                onChange={setClassroom}
                options={classrooms.map((c) => ({ label: c.name, value: String(c.id) }))}
              />
            </Field>

            <div style={{ display: 'flex', gap: 6 }}>
              <Chip label="Week" selected={view === 'week'} onClick={() => setView('week')} />
              <Chip label="Month" selected={view === 'month'} onClick={showMonth} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={goPrev}>
                ← Prev
              </Button>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: Brand.onSurface,
                  minWidth: 200,
                  textAlign: 'center',
                }}
              >
                {rangeLabel}
              </span>
              <Button variant="outline" onClick={goNext}>
                Next →
              </Button>
              <Button variant="secondary" onClick={goToday}>
                {view === 'week' ? 'This week' : 'This month'}
              </Button>
            </div>

            {view === 'week' && canManage ? (
              <Button variant="secondary" onClick={() => setCopyOpen(true)} disabled={busy}>
                Copy last week
              </Button>
            ) : null}
          </Toolbar>

          {error ? <ErrorState message={error} /> : null}

          <div style={{ position: 'relative' }}>
            {loading || busy ? (
              <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                <Spinner size={20} />
              </div>
            ) : null}

            {view === 'week' ? (
              <div
                style={{
                  maxWidth: 560,
                  margin: '0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {WEEKDAYS.map((label, offset) => {
                  const columnDate = addDays(monday, offset);
                  const iso = toISODate(columnDate);
                  const dayItems = items.filter((it) => it.date === iso);
                  return (
                    <Card key={iso} padding={16}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: Brand.onSurfaceVariant }}>
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 800,
                            color: Brand.onSurface,
                            lineHeight: 1.1,
                          }}
                        >
                          {columnDate.getDate()}
                        </div>
                      </div>

                      {dayItems.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                          {dayItems.map((it, idx) => (
                            <div
                              key={it.id}
                              style={{
                                background: Brand.primaryContainer,
                                color: Brand.onPrimaryContainer,
                                borderRadius: Radius.md,
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Link
                                to={it.activities ? `/activities/${it.activities.id}` : '#'}
                                style={{
                                  flex: 1,
                                  color: Brand.onPrimaryContainer,
                                  fontSize: 14,
                                  fontWeight: 700,
                                  lineHeight: 1.3,
                                }}
                              >
                                {idx + 1}. {it.activities?.title ?? 'Activity'}
                              </Link>
                              {canManage ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <MiniButton
                                    title="Move up"
                                    onClick={() => reorder(dayItems, idx, -1)}
                                    disabled={idx === 0 || busy}
                                  >
                                    ▲
                                  </MiniButton>
                                  <MiniButton
                                    title="Move down"
                                    onClick={() => reorder(dayItems, idx, 1)}
                                    disabled={idx === dayItems.length - 1 || busy}
                                  >
                                    ▼
                                  </MiniButton>
                                  <div style={{ flex: 1 }} />
                                  <MiniButton
                                    title="Remove"
                                    onClick={() => removeItem(it.id)}
                                    disabled={busy}
                                    danger
                                  >
                                    ×
                                  </MiniButton>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, color: Brand.onSurfaceVariant, marginBottom: 10 }}>
                          —
                        </div>
                      )}

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAddCtx({ date: iso, label: `${label} ${formatDisplayDate(columnDate)}` })
                          }
                          style={{
                            width: '100%',
                            border: `1px dashed ${Brand.outline}`,
                            background: 'transparent',
                            color: Brand.onSurfaceVariant,
                            borderRadius: Radius.md,
                            padding: '8px 10px',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Add
                        </button>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card padding={14}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 6,
                  }}
                >
                  {WEEKDAYS.map((label) => (
                    <div
                      key={label}
                      style={{
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        color: Brand.onSurfaceVariant,
                        padding: '4px 0',
                      }}
                    >
                      {label}
                    </div>
                  ))}
                  {Array.from({ length: monthGrid.cellCount }, (_, i) => {
                    const cellDate = addDays(monthGrid.gridStart, i);
                    const iso = toISODate(cellDate);
                    const inMonth = cellDate.getMonth() === monthAnchor.getMonth();
                    const count = countByDate.get(iso) ?? 0;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => drillToWeek(cellDate)}
                        title={`Open week of ${formatDisplayDate(cellDate)}`}
                        style={{
                          aspectRatio: '1 / 1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          border: `1px solid ${Brand.outlineVariant}`,
                          borderRadius: Radius.md,
                          background: inMonth ? Brand.white : Brand.surfaceContainerLow,
                          color: inMonth ? Brand.onSurface : Brand.onSurfaceVariant,
                          opacity: inMonth ? 1 : 0.6,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{cellDate.getDate()}</span>
                        {count > 0 ? (
                          <span
                            style={{
                              background: Brand.primary,
                              color: Brand.onPrimary,
                              borderRadius: Radius.full,
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '1px 7px',
                            }}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {addCtx ? (
        <PlanActivityModal
          classroomId={Number(classroom)}
          date={addCtx.date}
          dateLabel={addCtx.label}
          onClose={() => setAddCtx(null)}
          onAdded={reload}
        />
      ) : null}

      {copyOpen ? (
        <Modal title="Copy last week?" onClose={() => setCopyOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14.5, color: Brand.onSurfaceVariant, lineHeight: 1.5 }}>
              This copies the previous week’s activities into{' '}
              <strong style={{ color: Brand.onSurface }}>{rangeLabel}</strong> and{' '}
              <strong style={{ color: Brand.onSurface }}>replaces</strong> anything already planned
              this week.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setCopyOpen(false)}>
                Cancel
              </Button>
              <Button onClick={copyLastWeek}>Copy week</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
