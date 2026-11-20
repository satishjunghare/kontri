import type { PlanDay, PlanStop, StopType, Trip, TravelSuggestion } from '../types.ts';
import { formatMoney } from './money.ts';

export const MINUTES_PER_DAY = 24 * 60;

// ---------------------------------------------------------------------------
// Stop types
// ---------------------------------------------------------------------------

export const STOP_TYPES: Record<
  StopType,
  { label: string; icon: string; defaultDurationMin: number; expenseCategory: 'food' | 'travel' | 'stay' | 'activity' | 'shopping' | 'other'; color: string }
> = {
  place: { label: 'Place', icon: '📍', defaultDurationMin: 90, expenseCategory: 'activity', color: '#0F766E' },
  meal: { label: 'Meal', icon: '🍽️', defaultDurationMin: 60, expenseCategory: 'food', color: '#EA580C' },
  shopping: { label: 'Shopping', icon: '🛍️', defaultDurationMin: 60, expenseCategory: 'shopping', color: '#DB2777' },
  fuel: { label: 'Fuel / rest', icon: '⛽', defaultDurationMin: 20, expenseCategory: 'travel', color: '#CA8A04' },
  stay: { label: 'Stay', icon: '🛏️', defaultDurationMin: 600, expenseCategory: 'stay', color: '#4F46E5' },
  other: { label: 'Other', icon: '📌', defaultDurationMin: 30, expenseCategory: 'other', color: '#64748B' },
};
export const STOP_TYPE_ORDER: StopType[] = ['place', 'meal', 'shopping', 'fuel', 'stay', 'other'];

/** One colour per day, used for map pins and lines. */
export const DAY_COLORS = ['#0F766E', '#2563EB', '#EA580C', '#7C3AED', '#DB2777', '#CA8A04', '#059669', '#DC2626'];
export const dayColor = (index: number) => DAY_COLORS[((index % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length];

// ---------------------------------------------------------------------------
// Time and duration text
// ---------------------------------------------------------------------------

/** 450 -> "7:30 AM". Values past midnight wrap round (1500 -> "1:00 AM"). */
export function formatTime(min: number): string {
  const m = ((Math.round(min) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${suffix}`;
}

/** "7:30 AM", "7.30pm", "730 am", "19:30", "7 PM" -> minutes after midnight; null if not a time. */
export function parseTime(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\./g, ':').replace(/\s+/g, '');
  const m = t.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = h % 12;
    if (ap.startsWith('p')) h += 12;
  } else if (h > 23) {
    return null;
  }
  return h * 60 + min;
}

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h", 0 -> "0m". */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** "1h 30m", "90", "90m", "1.5h", "1:30", "2h" -> minutes; null if not a duration. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+(?:\.\d+)?)h(?:ours?|rs?)?(?:(\d+)(?:m(?:in(?:s|utes)?)?)?)?$/);
  if (m) return Math.round(Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
  m = t.match(/^(\d+)m(?:in(?:s|utes)?)?$/);
  if (m) return Number(m[1]);
  m = t.match(/^(\d+)$/);
  if (m) return Number(m[1]);
  return null;
}

// ---------------------------------------------------------------------------
// Stops: times, travel, ordering
// ---------------------------------------------------------------------------

export function stopEndMin(stop: Pick<PlanStop, 'startMin' | 'durationMin'>): number {
  return stop.startMin + stop.durationMin;
}

/** True if the stop runs past midnight. */
export const endsNextDay = (stop: Pick<PlanStop, 'startMin' | 'durationMin'>) => stopEndMin(stop) >= MINUTES_PER_DAY;

/** "7:30 AM – 11:00 AM", with "(+1)" when the end is after midnight. */
export function formatRange(stop: Pick<PlanStop, 'startMin' | 'durationMin'>): string {
  const end = formatTime(stopEndMin(stop));
  return `${formatTime(stop.startMin)} – ${end}${endsNextDay(stop) ? ' (+1)' : ''}`;
}

/** The travel time that counts: your own estimate if you gave one, else the app's suggestion, else 0. */
export function effectiveTravelMin(stop: Pick<PlanStop, 'travelUserMin' | 'suggestion'>): number {
  return stop.travelUserMin ?? stop.suggestion?.min ?? 0;
}

/** The stops of one day, in plan order. */
export function dayStops(stops: PlanStop[], dayId: string): PlanStop[] {
  return stops.filter((s) => s.dayId === dayId);
}

/**
 * Start time for a new stop added after `prev`: when the previous stop ends plus the travel time.
 * Without a previous stop, 9:00 AM.
 */
export function defaultNextStartMin(prev: PlanStop | undefined, travelMin = 0): number {
  if (!prev) return 9 * 60;
  return Math.min(stopEndMin(prev) + travelMin, MINUTES_PER_DAY - 1);
}

export interface StopPatch {
  type?: StopType;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  startMin?: number;
  durationMin?: number;
  notes?: string;
  budget?: number;
  /** Pass null to clear your own estimate. */
  travelUserMin?: number | null;
  done?: boolean;
}

/**
 * Applies an edit to one stop. With `shift`, later stops of the same day move by however much this
 * stop's END time changed (a later start, a longer stay, or a longer trip to get there), so the
 * rest of the day stays in step. Changing the travel time also moves this stop's own start,
 * unless a new start time is given in the same edit.
 */
export function applyStopEdit(stops: PlanStop[], stopId: string, patch: StopPatch, shift: boolean): PlanStop[] {
  const target = stops.find((s) => s.id === stopId);
  if (!target) return stops;

  const { travelUserMin, ...rest } = patch;
  let startMin = patch.startMin ?? target.startMin;
  if (patch.startMin === undefined && travelUserMin !== undefined && shift) {
    const newTravel = travelUserMin ?? target.suggestion?.min ?? 0;
    startMin = clampStart(target.startMin + newTravel - effectiveTravelMin(target));
  }
  const updated: PlanStop = { ...target, ...rest, startMin };
  if (travelUserMin !== undefined) {
    if (travelUserMin === null) delete updated.travelUserMin;
    else updated.travelUserMin = travelUserMin;
  }
  const delta = stopEndMin(updated) - stopEndMin(target);

  const sameDay = stops.filter((s) => s.dayId === target.dayId);
  const later = new Set(shift && delta !== 0 ? sameDay.slice(sameDay.findIndex((s) => s.id === stopId) + 1).map((s) => s.id) : []);
  return stops.map((s) => {
    if (s.id === stopId) return updated;
    return later.has(s.id) ? { ...s, startMin: clampStart(s.startMin + delta) } : s;
  });
}

function clampStart(min: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(min)));
}

/** Moves a stop one place up or down within its day. */
export function moveStop(stops: PlanStop[], stopId: string, direction: -1 | 1): PlanStop[] {
  const target = stops.find((s) => s.id === stopId);
  if (!target) return stops;
  const sameDay = stops.filter((s) => s.dayId === target.dayId);
  const i = sameDay.findIndex((s) => s.id === stopId);
  const j = i + direction;
  if (j < 0 || j >= sameDay.length) return stops;
  const swapWith = sameDay[j];
  const a = stops.findIndex((s) => s.id === stopId);
  const b = stops.findIndex((s) => s.id === swapWith.id);
  const copy = [...stops];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}

/** Moves a stop to the end of another day. */
export function moveStopToDay(stops: PlanStop[], stopId: string, dayId: string): PlanStop[] {
  const target = stops.find((s) => s.id === stopId);
  if (!target || target.dayId === dayId) return stops;
  return [...stops.filter((s) => s.id !== stopId), { ...target, dayId }];
}

// ---------------------------------------------------------------------------
// Day summary and warnings
// ---------------------------------------------------------------------------

export interface DayStats {
  count: number;
  /** First start to last end, in minutes (0 for an empty day). */
  spanMin: number;
  /** Total of the travel distances that are known, in km. */
  km: number;
  /** Total planned budget in minor units. */
  budget: number;
}

export function computeDayStats(stops: PlanStop[]): DayStats {
  if (stops.length === 0) return { count: 0, spanMin: 0, km: 0, budget: 0 };
  const first = Math.min(...stops.map((s) => s.startMin));
  const last = Math.max(...stops.map(stopEndMin));
  // The first stop of a day has no leg before it.
  const km = stops.slice(1).reduce((sum, s) => sum + (s.suggestion?.km ?? 0), 0);
  return { count: stops.length, spanMin: last - first, km, budget: stops.reduce((sum, s) => sum + (s.budget ?? 0), 0) };
}

export type WarningKind = 'overlap' | 'tight';
export interface StopWarning {
  stopId: string;
  kind: WarningKind;
  /** Minutes: how much the previous stop overlaps (overlap) or how many minutes the travel is short by (tight). */
  minutes: number;
}

/**
 * Warns when a stop starts before the previous one ends, or when there is less time between two
 * stops than the travel needs (using your estimate if you gave one, else the app's suggestion).
 */
export function computeWarnings(stops: PlanStop[]): StopWarning[] {
  const warnings: StopWarning[] = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const cur = stops[i];
    const gap = cur.startMin - stopEndMin(prev);
    if (gap < 0) {
      warnings.push({ stopId: cur.id, kind: 'overlap', minutes: -gap });
    } else {
      const need = effectiveTravelMin(cur);
      if (need > gap) warnings.push({ stopId: cur.id, kind: 'tight', minutes: need - gap });
    }
  }
  return warnings;
}

/** Start time that fits the previous stop's end plus travel; null for the first stop of a day. */
export function fittingStartMin(stops: PlanStop[], stopId: string): number | null {
  const i = stops.findIndex((s) => s.id === stopId);
  if (i <= 0) return null;
  return clampStart(stopEndMin(stops[i - 1]) + effectiveTravelMin(stops[i]));
}

// ---------------------------------------------------------------------------
// Now / next
// ---------------------------------------------------------------------------

export interface NowNext {
  now?: PlanStop;
  next?: PlanStop;
}

/** Which stop is on now, and which comes next, for a clock time (minutes after midnight). */
export function currentAndNext(stops: PlanStop[], nowMin: number): NowNext {
  const now = stops.find((s) => s.startMin <= nowMin && nowMin < stopEndMin(s));
  const next = stops
    .filter((s) => s.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin)[0];
  return { now, next };
}

// ---------------------------------------------------------------------------
// Distances and map links
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export const hasLocation = <T extends { lat?: number; lng?: number }>(s: T): s is T & LatLng =>
  typeof s.lat === 'number' && typeof s.lng === 'number';

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Key identifying a pair of places, so a stored suggestion can be recognised as stale. */
export function legKey(a: LatLng, b: LatLng): string {
  const f = (n: number) => n.toFixed(4);
  return `${f(a.lat)},${f(a.lng)}>${f(b.lat)},${f(b.lng)}`;
}

/** Offline guess: straight-line distance x 1.35 for winding roads, at 40 km/h. */
export function estimateTravel(a: LatLng, b: LatLng): TravelSuggestion {
  const km = haversineKm(a, b) * 1.35;
  return { min: Math.max(1, Math.round((km / 40) * 60)), km: Math.round(km * 10) / 10, source: 'estimate', key: legKey(a, b) };
}

/** A suggestion is only trustworthy while it was calculated for the same two places. */
export function isSuggestionCurrent(stop: PlanStop, prev: PlanStop | undefined): boolean {
  if (!stop.suggestion || !prev || !hasLocation(stop) || !hasLocation(prev)) return false;
  return stop.suggestion.key === legKey(prev, stop);
}

/** Opens Google Maps with directions to one place (no API key needed). */
export function navigateUrl(stop: Pick<PlanStop, 'name' | 'lat' | 'lng'>): string {
  if (hasLocation(stop)) return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`;
}

/** Opens the whole day's route in Google Maps: first stop to last, the rest as waypoints (max 9). */
export function dayRouteUrl(stops: PlanStop[]): string | null {
  const located = stops.filter(hasLocation);
  if (located.length < 2) return null;
  const pt = (s: { lat: number; lng: number }) => `${s.lat},${s.lng}`;
  const waypoints = located.slice(1, -1).slice(0, 9).map(pt).join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${pt(located[0])}&destination=${pt(located[located.length - 1])}`;
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
}

// ---------------------------------------------------------------------------
// Pasted map links and coordinates
// ---------------------------------------------------------------------------

export interface ParsedPoint extends LatLng {
  name?: string;
}

const validPoint = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Pulls a location out of text a person pastes: plain "18.52, 73.85", a geo: link, or a Google Maps
 * link (place links with @lat,lng or !3d!4d, ?q=lat,lng, ?ll=, ?query=). Returns null if none is found.
 * Short links (maps.app.goo.gl) must be resolved to their full address first.
 */
export function parseMapLink(input: string): ParsedPoint | null {
  const text = input.trim();
  if (!text) return null;
  let m = text.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (m && validPoint(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };

  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // keep the raw text
  }
  let name: string | undefined;
  const placeName = decoded.match(/\/maps\/place\/([^/@?]+)/);
  if (placeName) name = placeName[1].replace(/\+/g, ' ').trim() || undefined;

  const patterns: RegExp[] = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // the exact pin of a place link
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // map centre
    /[?&](?:q|ll|query|destination|center)=(-?\d+(?:\.\d+)?)[, ]+(-?\d+(?:\.\d+)?)/,
    /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    m = decoded.match(re);
    if (m && validPoint(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]), name };
  }
  return null;
}

/** True for short Google Maps links that have to be opened to find the real address. */
export const isShortMapLink = (text: string) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(text.trim());

// ---------------------------------------------------------------------------
// Budget and sharing
// ---------------------------------------------------------------------------

export function plannedBudget(stops: PlanStop[]): number {
  return stops.reduce((sum, s) => sum + (s.budget ?? 0), 0);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-12-20" -> "Sun 20 Dec". */
export function formatDayDate(date?: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Adds days to a YYYY-MM-DD date. */
export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Plain-text plan for WhatsApp: every day with times, legs and a Google Maps route link. */
export function buildPlanShareText(trip: Trip, options: { timing?: boolean } = {}): string {
  const timing = options.timing ?? true;
  const lines: string[] = [`🗺️ *${trip.name} — Trip plan*`];
  const where = [trip.destination].filter(Boolean).join(' · ');
  if (where) lines.push(`📍 ${where}`);
  for (const day of trip.planDays) {
    const stops = dayStops(trip.planStops, day.id);
    const date = formatDayDate(day.date);
    lines.push('', `📅 *${day.label}${date ? ` · ${date}` : ''}*`);
    if (stops.length === 0) {
      lines.push('(nothing planned yet)');
      continue;
    }
    stops.forEach((s, i) => {
      if (i > 0) {
        // Without timing, only the app's own calculation is shown (your estimate is not asked for).
        const own = timing ? s.travelUserMin : undefined;
        const travel = own ?? s.suggestion?.min;
        if (travel !== undefined) {
          const km = s.suggestion?.km ? ` · ~${Math.round(s.suggestion.km)} km` : '';
          lines.push(`      🚗 ${own !== undefined ? '' : '~'}${formatDuration(travel)}${km}`);
        }
      }
      lines.push(timing ? `${formatRange(s)}  ${STOP_TYPES[s.type].icon} ${s.name}` : `${i + 1}. ${STOP_TYPES[s.type].icon} ${s.name}`);
      if (s.notes) lines.push(`      📝 ${s.notes.split('\n')[0]}`);
      if (timing && s.budget) lines.push(`      💰 ${formatMoney(s.budget, trip.currency)}`);
    });
    const url = dayRouteUrl(stops);
    if (url) lines.push(`🧭 Route: ${url}`);
  }
  const total = plannedBudget(trip.planStops);
  if (timing && total > 0) lines.push('', `💰 Planned budget: ${formatMoney(total, trip.currency)}`);
  lines.push('', 'Shared via Kontri');
  return lines.join('\n');
}

/** Label for the next day: one more than the highest number already used, so a "Day 0" is kept. */
export function nextDayLabel(days: PlanDay[]): string {
  const numbers = days.flatMap((d) => {
    const m = d.label.match(/(\d+)/);
    return m ? [Number(m[1])] : [];
  });
  return `Day ${numbers.length ? Math.max(...numbers) + 1 : 1}`;
}

/** Date for the next day: the day after the last one, or the trip's start date for the first day. */
export function nextDayDate(days: PlanDay[], tripStart?: string): string | undefined {
  const last = days[days.length - 1];
  if (last?.date) return addDaysISO(last.date, 1);
  return days.length === 0 ? tripStart : undefined;
}
