import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Select,
  Spinner,
  Toolbar,
} from '@/components/ui';
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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Plans() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroom, setClassroom] = useState('');
  const [weekStart, setWeekStart] = useState<Date>(startOfWeekMonday(new Date()));

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load classrooms once.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingClassrooms(true);
      const { data, error: err } = await supabase
        .from('classrooms')
        .select('id, name')
        .order('name');
      if (!active) return;
      if (err) {
        setError(err.message);
      } else {
        const rows = (data ?? []) as unknown as Classroom[];
        setClassrooms(rows);
        if (rows.length > 0) setClassroom(String(rows[0].id));
      }
      setLoadingClassrooms(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load schedule for the selected classroom + week.
  useEffect(() => {
    if (!classroom) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const monday = weekStart;
      const sunday = addDays(monday, 6);
      const { data, error: err } = await supabase
        .from('schedule_items')
        .select('id, date, sort_order, activities(id, title)')
        .eq('classroom_id', Number(classroom))
        .gte('date', toISODate(monday))
        .lte('date', toISODate(sunday))
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
  }, [classroom, weekStart]);

  const monday = weekStart;
  const sunday = addDays(monday, 6);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
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
                {formatDisplayDate(monday)} – {formatDisplayDate(sunday)}
              </span>
              <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Next →
              </Button>
              <Button
                variant="secondary"
                onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
              >
                This week
              </Button>
            </div>
          </Toolbar>

          {error ? (
            <ErrorState message={error} />
          ) : (
            <div style={{ position: 'relative' }}>
              {loading ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                  }}
                >
                  <Spinner size={20} />
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
                {WEEKDAYS.map((label, offset) => {
                  const columnDate = addDays(monday, offset);
                  const iso = toISODate(columnDate);
                  const dayItems = items.filter((it) => it.date === iso);
                  return (
                    <Card
                      key={iso}
                      padding={14}
                      style={{ flex: '1 0 160px', minWidth: 160 }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{ fontSize: 13, fontWeight: 700, color: Brand.onSurfaceVariant }}
                        >
                          {label}
                        </div>
                        <div
                          style={{ fontSize: 20, fontWeight: 800, color: Brand.onSurface, lineHeight: 1.1 }}
                        >
                          {columnDate.getDate()}
                        </div>
                      </div>
                      {dayItems.length === 0 ? (
                        <div style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>—</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {dayItems.map((it) => (
                            <Link
                              key={it.id}
                              to={it.activities ? `/activities/${it.activities.id}` : '#'}
                              style={{
                                display: 'block',
                                background: Brand.primaryContainer,
                                color: Brand.onPrimaryContainer,
                                borderRadius: Radius.md,
                                padding: '8px 10px',
                                fontSize: 13,
                                fontWeight: 600,
                                lineHeight: 1.25,
                              }}
                            >
                              {it.activities?.title ?? 'Activity'}
                            </Link>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
