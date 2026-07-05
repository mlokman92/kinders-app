import { useState } from 'react';

import { Button, ErrorState, Field, Modal, Spinner, TextInput, Toggle } from '@/components/ui';
import type { Branch } from '@/lib/branch';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

/** Owner-only geofence config for a branch. Coordinates live in branch_geofences (never sent to mobile). */
export type BranchGeofence = {
  branch_id: number;
  center_id: number;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  accuracy_ceiling_m: number;
  enforce_geofence: boolean;
  geofence_enabled: boolean;
};

const RADIUS_MIN = 20;
const RADIUS_MAX = 1000;
const ACCURACY_MIN = 20;
const ACCURACY_MAX = 500;

const parseCoord = (v: string): number | null => {
  const n = Number(v.trim());
  return v.trim() === '' || Number.isNaN(n) ? null : n;
};

export function BranchGeofenceModal({
  branch,
  centerId,
  initial,
  onClose,
  onSaved,
}: {
  branch: Branch;
  centerId: number;
  initial: BranchGeofence | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : '');
  const [radius, setRadius] = useState(String(initial?.geofence_radius_m ?? 120));
  const [accuracy, setAccuracy] = useState(String(initial?.accuracy_ceiling_m ?? 120));
  const [enforce, setEnforce] = useState(initial?.enforce_geofence ?? false);
  const [enabled, setEnabled] = useState(initial?.geofence_enabled ?? false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot read your location.');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (e) => {
        setError(e.message || 'Could not read your location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const save = async () => {
    setError(null);
    const latN = parseCoord(lat);
    const lngN = parseCoord(lng);
    const radN = Number(radius);
    const accN = Number(accuracy);

    if (latN != null && (latN < -90 || latN > 90)) return setError('Latitude must be between −90 and 90.');
    if (lngN != null && (lngN < -180 || lngN > 180)) return setError('Longitude must be between −180 and 180.');
    if (Number.isNaN(radN) || radN < RADIUS_MIN || radN > RADIUS_MAX)
      return setError(`Radius must be between ${RADIUS_MIN} and ${RADIUS_MAX} metres.`);
    if (Number.isNaN(accN) || accN < ACCURACY_MIN || accN > ACCURACY_MAX)
      return setError(`Accuracy ceiling must be between ${ACCURACY_MIN} and ${ACCURACY_MAX} metres.`);
    if (enabled && (latN == null || lngN == null))
      return setError('Set both coordinates before turning attendance on.');

    setSaving(true);
    try {
      const { error: upErr } = await supabase.from('branch_geofences').upsert(
        {
          branch_id: branch.id,
          center_id: centerId,
          latitude: latN,
          longitude: lngN,
          geofence_radius_m: radN,
          accuracy_ceiling_m: accN,
          enforce_geofence: enforce,
          geofence_enabled: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id' },
      );
      if (upErr) throw upErr;
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the location.');
    } finally {
      setSaving(false);
    }
  };

  const hint = { fontSize: 12, color: Brand.onSurfaceVariant, marginTop: 4 } as const;

  return (
    <Modal title={`Location · ${branch.name}`} onClose={() => (saving ? null : onClose())}>
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <ErrorState message={error} />
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Latitude">
              <TextInput value={lat} onChange={setLat} inputMode="decimal" placeholder="3.1390" />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Longitude">
              <TextInput value={lng} onChange={setLng} inputMode="decimal" placeholder="101.6869" />
            </Field>
          </div>
        </div>
        <div>
          <Button variant="secondary" onClick={useCurrentLocation} disabled={locating}>
            {locating ? <Spinner size={16} /> : '📍 Use my current location'}
          </Button>
          <div style={hint}>Stand at the branch and tap this, or paste coordinates from Google Maps.</div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Geofence radius (m)">
              <TextInput value={radius} onChange={setRadius} inputMode="numeric" />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Accuracy ceiling (m)">
              <TextInput value={accuracy} onChange={setAccuracy} inputMode="numeric" />
            </Field>
          </div>
        </div>
        <div style={hint}>
          Indoor GPS drifts 30–100 m. Start with 120 m and adjust after testing at the branch.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>
            <div style={{ fontSize: 14, fontWeight: 600, color: Brand.onSurface }}>Attendance on</div>
            <div style={hint}>Staff can check in at this branch.</div>
          </span>
          <Toggle checked={enabled} onChange={() => setEnabled((v) => !v)} label="Attendance on" />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>
            <div style={{ fontSize: 14, fontWeight: 600, color: Brand.onSurface }}>Strict mode</div>
            <div style={hint}>Reject off-site check-ins instead of recording them for review.</div>
          </span>
          <Toggle checked={enforce} onChange={() => setEnforce((v) => !v)} label="Strict mode" />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner size={16} /> : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
