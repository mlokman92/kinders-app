import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { Brand, Radius } from '@/lib/theme';

import { Chip, Spinner } from './ui';

type Area = { id: number; code: string; area_name: string; subarea_name: string | null };
type Skill = { id: number; area_id: number; code: string; label: number; name: string };

/**
 * Grouped, collapsible multi-select over the seeded curriculum skills taxonomy.
 * Selection is a `Set<number>` of `learning_skills.id` owned by the parent.
 * Ported from the mobile `SkillPicker`.
 */
export function SkillPicker({
  value,
  onChange,
}: {
  value: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: a }, { data: s }] = await Promise.all([
        supabase
          .from('learning_areas')
          .select('id, code, area_name, subarea_name, sort')
          .order('sort'),
        supabase
          .from('learning_skills')
          .select('id, area_id, code, label, name, sort')
          .order('sort'),
      ]);
      if (!active) return;
      setAreas((a ?? []) as unknown as Area[]);
      setSkills((s ?? []) as unknown as Skill[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggleSkill = (id: number) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const toggleArea = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <Spinner size={20} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {areas.map((area) => {
        const areaSkills = skills.filter((s) => s.area_id === area.id);
        const selectedCount = areaSkills.filter((s) => value.has(s.id)).length;
        const isOpen = open.has(area.id);
        const title = area.subarea_name
          ? `${area.area_name} · ${area.subarea_name}`
          : area.area_name;
        return (
          <div
            key={area.id}
            style={{
              background: Brand.white,
              border: `1px solid ${Brand.outlineVariant}`,
              borderRadius: Radius.md,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => toggleArea(area.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: 12,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  background: Brand.primaryContainer,
                  color: Brand.onPrimaryContainer,
                  borderRadius: Radius.sm,
                  padding: '3px 7px',
                  fontSize: 11,
                  fontWeight: 800,
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {area.code}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: Brand.onSurface }}>
                {title}
              </span>
              {selectedCount > 0 ? (
                <span
                  style={{
                    background: Brand.primary,
                    color: Brand.onPrimary,
                    borderRadius: Radius.full,
                    minWidth: 20,
                    height: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {selectedCount}
                </span>
              ) : null}
              <span style={{ color: Brand.onSurfaceVariant, fontSize: 12 }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen ? (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {areaSkills.map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.label}. ${s.name}`}
                    selected={value.has(s.id)}
                    onClick={() => toggleSkill(s.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
