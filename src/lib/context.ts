import type {
  ObservationContext, ObservationLocation, EquipmentSet, EquipmentItem
} from '../types';

// ===== Global Observation Context =====
type ContextKey = keyof ObservationContext;
type Listener = () => void;

const listeners = new Set<Listener>();

const defaultLocation: ObservationLocation = {
  id: 'default',
  name: 'Locating...',
  lat: 39.9,
  lon: 116.4,
  bortle: 5,
  isCurrentGPS: false
};

const defaultEquipment: EquipmentSet = {
  items: [{ id: 'naked', type: 'naked_eye', label: 'Naked eye' }],
  primary: 'naked'
};

export const ctx: ObservationContext = {
  location: { ...defaultLocation },
  date: new Date(),
  startTime: '22:00',
  planningMode: 'single',
  activeTarget: 'all',
  equipment: { ...defaultEquipment }
};

export function updateContext(partial: Partial<ObservationContext>) {
  Object.assign(ctx, partial);
  listeners.forEach(fn => fn());
}

export function onContextChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ===== Persistence =====
const KEYS = {
  location: 'ds_location',
  equipment: 'ds_equipment',
  date: 'ds_date',
  time: 'ds_time'
};

export function persistContext() {
  try {
    localStorage.setItem(KEYS.location, JSON.stringify(ctx.location));
    localStorage.setItem(KEYS.equipment, JSON.stringify(ctx.equipment));
    localStorage.setItem(KEYS.date, ctx.date.toISOString());
    localStorage.setItem(KEYS.time, ctx.startTime);
  } catch { /* ignore */ }
}

export function restoreContext() {
  try {
    const loc = localStorage.getItem(KEYS.location);
    if (loc) ctx.location = JSON.parse(loc);
    const eq = localStorage.getItem(KEYS.equipment);
    if (eq) ctx.equipment = JSON.parse(eq);
    const d = localStorage.getItem(KEYS.date);
    if (d) ctx.date = new Date(d);
    const t = localStorage.getItem(KEYS.time);
    if (t) ctx.startTime = t;
  } catch { /* ignore */ }
}

// ===== Helpers =====
export function isTonight(): boolean {
  const now = new Date();
  const d = ctx.date;
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export function formatDateShort(): string {
  if (isTonight()) return 'Tonight';
  return ctx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function equipmentSummary(): string {
  return ctx.equipment.items.map(e => e.label).slice(0, 2).join(' + ') || 'Naked eye';
}
