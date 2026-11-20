/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysISO,
  applyStopEdit,
  buildPlanShareText,
  computeDayStats,
  computeWarnings,
  currentAndNext,
  dayRouteUrl,
  dayStops,
  defaultNextStartMin,
  effectiveTravelMin,
  estimateTravel,
  fittingStartMin,
  formatDayDate,
  formatDuration,
  formatRange,
  formatTime,
  haversineKm,
  isShortMapLink,
  isSuggestionCurrent,
  legKey,
  moveStop,
  moveStopToDay,
  nextDayDate,
  nextDayLabel,
  navigateUrl,
  parseDuration,
  parseMapLink,
  parseTime,
} from './plan.ts';
import type { PlanStop, Trip } from '../types.ts';

let n = 0;
const stop = (over: Partial<PlanStop>): PlanStop => ({
  id: `s${++n}`,
  dayId: 'd1',
  type: 'place',
  name: 'Stop',
  startMin: 540,
  durationMin: 60,
  ...over,
});
const ids = (stops: PlanStop[], dayId = 'd1') => dayStops(stops, dayId).map((s) => s.id);

test('formatTime and parseTime', () => {
  assert.equal(formatTime(450), '7:30 AM');
  assert.equal(formatTime(0), '12:00 AM');
  assert.equal(formatTime(720), '12:00 PM');
  assert.equal(formatTime(1170), '7:30 PM');
  assert.equal(formatTime(1500), '1:00 AM'); // past midnight wraps
  for (const [text, min] of [
    ['7:30 AM', 450], ['7.30pm', 1170], ['730 am', 450], ['19:30', 1170], ['7 PM', 1140],
    ['12:00 AM', 0], ['12 pm', 720], ['1.30PM', 810], ['5.00 AM', 300],
  ] as const) assert.equal(parseTime(text), min, text);
  for (const bad of ['', 'abc', '25:00', '13 pm', '7:75', '0 am']) assert.equal(parseTime(bad), null, bad);
});

test('formatDuration and parseDuration', () => {
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(120), '2h');
  for (const [text, min] of [['1h 30m', 90], ['90', 90], ['90m', 90], ['1.5h', 90], ['1:30', 90], ['2h', 120], ['45 min', 45], ['1h30', 90], ['2hrs', 120]] as const)
    assert.equal(parseDuration(text), min, text);
  assert.equal(parseDuration('soon'), null);
});

test('formatRange marks stays that run past midnight', () => {
  assert.equal(formatRange(stop({ startMin: 450, durationMin: 210 })), '7:30 AM – 11:00 AM');
  assert.equal(formatRange(stop({ startMin: 1350, durationMin: 420 })), '10:30 PM – 5:30 AM (+1)');
});

test('your own travel estimate wins over the app suggestion, and they stay separate', () => {
  const s = stop({ suggestion: { min: 60, km: 28, source: 'road', key: 'k' } });
  assert.equal(effectiveTravelMin(s), 60); // only the suggestion
  s.travelUserMin = 90;
  assert.equal(effectiveTravelMin(s), 90); // your estimate counts
  assert.equal(s.suggestion?.min, 60); // the suggestion itself is untouched
  assert.equal(effectiveTravelMin(stop({})), 0);
});

test('a new stop starts when the previous one ends plus travel', () => {
  const prev = stop({ startMin: 450, durationMin: 210 }); // ends 11:00
  assert.equal(defaultNextStartMin(prev, 60), 720);
  assert.equal(defaultNextStartMin(undefined), 540);
  assert.equal(defaultNextStartMin(stop({ startMin: 1400, durationMin: 200 }), 60), 1439); // never past midnight
});

test('editing a stop shifts the later stops of the same day only', () => {
  const a = stop({ id: 'a', startMin: 450, durationMin: 210 });
  const b = stop({ id: 'b', startMin: 780, durationMin: 90 });
  const c = stop({ id: 'c', startMin: 900, durationMin: 120 });
  const other = stop({ id: 'x', dayId: 'd2', startMin: 600 });
  const all = [a, b, c, other];

  const longer = applyStopEdit(all, 'a', { durationMin: 240 }, true); // +30 min
  assert.deepEqual(longer.map((s) => [s.id, s.startMin]), [['a', 450], ['b', 810], ['c', 930], ['x', 600]]);

  const noShift = applyStopEdit(all, 'a', { durationMin: 240 }, false);
  assert.deepEqual(noShift.map((s) => s.startMin), [450, 780, 900, 600]);

  const later = applyStopEdit(all, 'b', { startMin: 765 }, true); // starts 15 min earlier
  assert.deepEqual(later.map((s) => [s.id, s.startMin]), [['a', 450], ['b', 765], ['c', 885], ['x', 600]]);

  const notesOnly = applyStopEdit(all, 'a', { notes: 'hi' }, true);
  assert.deepEqual(notesOnly.map((s) => s.startMin), [450, 780, 900, 600]);
});

test('changing your travel estimate moves the stop and everything after it', () => {
  const a = stop({ id: 'a', startMin: 450, durationMin: 210 }); // ends 660
  const b = stop({ id: 'b', startMin: 720, durationMin: 90, travelUserMin: 60, suggestion: { min: 45, km: 20, source: 'road', key: 'k' } });
  const c = stop({ id: 'c', startMin: 840, durationMin: 60 });
  const r = applyStopEdit([a, b, c], 'b', { travelUserMin: 90 }, true); // 30 min longer
  assert.deepEqual(r.map((s) => s.startMin), [450, 750, 870]);
  assert.equal(r[1].travelUserMin, 90);
  assert.equal(r[1].suggestion?.min, 45);
  // Clearing it falls back to the app suggestion (45 min, 45 less than 90)
  const cleared = applyStopEdit(r, 'b', { travelUserMin: null }, true);
  assert.equal(cleared[1].travelUserMin, undefined);
  assert.deepEqual(cleared.map((s) => s.startMin), [450, 705, 825]);
  // Without shifting, only the estimate changes
  const keep = applyStopEdit([a, b, c], 'b', { travelUserMin: 90 }, false);
  assert.deepEqual(keep.map((s) => s.startMin), [450, 720, 840]);
});

test('reordering', () => {
  const a = stop({ id: 'a' }), b = stop({ id: 'b' }), c = stop({ id: 'c' }), x = stop({ id: 'x', dayId: 'd2' });
  assert.deepEqual(ids(moveStop([a, x, b, c], 'c', -1)), ['a', 'c', 'b']);
  assert.deepEqual(ids(moveStop([a, b, c], 'a', -1)), ['a', 'b', 'c']); // already first
  assert.deepEqual(ids(moveStop([a, b, c], 'c', 1)), ['a', 'b', 'c']); // already last
  const moved = moveStopToDay([a, b, x], 'a', 'd2');
  assert.deepEqual(ids(moved, 'd1'), ['b']);
  assert.deepEqual(ids(moved, 'd2'), ['x', 'a']);
});

test('warnings: overlap and not enough time to travel', () => {
  const a = stop({ id: 'a', startMin: 450, durationMin: 210 }); // ends 11:00
  const overlap = stop({ id: 'b', startMin: 640 }); // starts 10:40
  assert.deepEqual(computeWarnings([a, overlap]), [{ stopId: 'b', kind: 'overlap', minutes: 20 }]);

  const tight = stop({ id: 'c', startMin: 690, travelUserMin: 60 }); // 30 min gap, needs 60
  assert.deepEqual(computeWarnings([a, tight]), [{ stopId: 'c', kind: 'tight', minutes: 30 }]);

  const usesSuggestion = stop({ id: 'd', startMin: 690, suggestion: { min: 45, km: 20, source: 'road', key: 'k' } });
  assert.deepEqual(computeWarnings([a, usesSuggestion]), [{ stopId: 'd', kind: 'tight', minutes: 15 }]);

  const fine = stop({ id: 'e', startMin: 720, travelUserMin: 60 });
  assert.deepEqual(computeWarnings([a, fine]), []);
  assert.equal(fittingStartMin([a, tight], 'c'), 720);
  assert.equal(fittingStartMin([a, tight], 'a'), null);
});

test('day stats', () => {
  const a = stop({ startMin: 450, durationMin: 210, budget: 20000 });
  const b = stop({ startMin: 720, durationMin: 90, budget: 50000, suggestion: { min: 60, km: 28.4, source: 'road', key: 'k' } });
  assert.deepEqual(computeDayStats([a, b]), { count: 2, spanMin: 360, km: 28.4, budget: 70000 });
  assert.deepEqual(computeDayStats([]), { count: 0, spanMin: 0, km: 0, budget: 0 });
});

test('now and next', () => {
  const a = stop({ id: 'a', startMin: 450, durationMin: 210 });
  const b = stop({ id: 'b', startMin: 780, durationMin: 90 });
  assert.equal(currentAndNext([a, b], 500).now?.id, 'a');
  assert.equal(currentAndNext([a, b], 500).next?.id, 'b');
  assert.equal(currentAndNext([a, b], 700).now, undefined); // travelling
  assert.equal(currentAndNext([a, b], 700).next?.id, 'b');
  assert.equal(currentAndNext([a, b], 900).next, undefined);
});

test('distance and offline travel estimate', () => {
  const pune = { lat: 18.5204, lng: 73.8567 };
  const mumbai = { lat: 19.076, lng: 72.8777 };
  assert.ok(Math.abs(haversineKm(pune, mumbai) - 120) < 5);
  const e = estimateTravel(pune, mumbai);
  assert.equal(e.source, 'estimate');
  assert.ok(e.km > 150 && e.km < 180);
  assert.equal(e.key, legKey(pune, mumbai));
  const a = stop({ lat: pune.lat, lng: pune.lng });
  const b = stop({ lat: mumbai.lat, lng: mumbai.lng, suggestion: e });
  assert.equal(isSuggestionCurrent(b, a), true);
  assert.equal(isSuggestionCurrent({ ...b, lat: 19.2 }, a), false); // the place moved, so the suggestion is stale
});

test('map links and pasted coordinates', () => {
  assert.deepEqual(parseMapLink('18.5204, 73.8567'), { lat: 18.5204, lng: 73.8567 });
  assert.deepEqual(parseMapLink('18.5204 73.8567'), { lat: 18.5204, lng: 73.8567 });
  assert.deepEqual(parseMapLink('geo:18.5,73.8'), { lat: 18.5, lng: 73.8, name: undefined });
  const place = 'https://www.google.com/maps/place/Rohida+Fort/@18.3,73.6,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d18.31234!4d73.65432';
  assert.deepEqual(parseMapLink(place), { lat: 18.31234, lng: 73.65432, name: 'Rohida Fort' }); // the exact pin beats the map centre
  assert.deepEqual(parseMapLink('https://www.google.com/maps/@18.3,73.6,15z'), { lat: 18.3, lng: 73.6, name: undefined });
  assert.deepEqual(parseMapLink('https://maps.google.com/?q=18.3,73.6'), { lat: 18.3, lng: 73.6, name: undefined });
  assert.deepEqual(parseMapLink('https://www.google.com/maps/search/?api=1&query=18.3%2C73.6'), { lat: 18.3, lng: 73.6, name: undefined });
  assert.equal(parseMapLink('Rohida Fort'), null);
  assert.equal(parseMapLink('200, 300'), null);
  assert.equal(parseMapLink(''), null);
  assert.equal(isShortMapLink('https://maps.app.goo.gl/abc123'), true);
  assert.equal(isShortMapLink('https://www.google.com/maps/place/x'), false);
});

test('Google Maps links', () => {
  const a = stop({ name: 'A', lat: 18.1, lng: 73.1 }), b = stop({ name: 'B', lat: 18.2, lng: 73.2 }), c = stop({ name: 'C', lat: 18.3, lng: 73.3 });
  assert.equal(navigateUrl(a), 'https://www.google.com/maps/dir/?api=1&destination=18.1,73.1');
  assert.equal(navigateUrl(stop({ name: 'Kenjalgad Fort' })), 'https://www.google.com/maps/search/?api=1&query=Kenjalgad%20Fort');
  assert.equal(
    dayRouteUrl([a, b, c]),
    'https://www.google.com/maps/dir/?api=1&origin=18.1,73.1&destination=18.3,73.3&waypoints=18.2%2C73.2',
  );
  assert.equal(dayRouteUrl([a, stop({ name: 'no location' })]), null);
  assert.equal(dayRouteUrl([a]), null);
});

test('dates', () => {
  assert.equal(formatDayDate('2026-12-20'), 'Sun 20 Dec');
  assert.equal(formatDayDate(undefined), '');
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysISO('2026-12-20', -1), '2026-12-19');
});

test("share text for the Maharashtra fort trip from the user's own itinerary", () => {
  const trip = {
    name: 'Fort Trip',
    currency: 'INR',
    destination: 'Pune',
    planDays: [{ id: 'd1', label: 'Day 1', date: '2026-12-20' }],
    planStops: [
      stop({ id: '1', name: 'Rohida', startMin: 450, durationMin: 210, lat: 18.3, lng: 73.6 }),
      stop({
        id: '2', name: 'Lunch @ Kenjalgad', type: 'meal', startMin: 810, durationMin: 90, lat: 18.4, lng: 73.7,
        travelUserMin: 60, suggestion: { min: 45, km: 28.4, source: 'road', key: 'k' }, notes: 'Veg thali', budget: 60000,
      }),
    ],
  } as unknown as Trip;
  const text = buildPlanShareText(trip);
  assert.match(text, /🗺️ \*Fort Trip — Trip plan\*/);
  assert.match(text, /📅 \*Day 1 · Sun 20 Dec\*/);
  assert.match(text, /7:30 AM – 11:00 AM  📍 Rohida/);
  assert.match(text, /🚗 1h · ~28 km/); // your own estimate, no "~" on the time
  assert.match(text, /1:30 PM – 3:00 PM  🍽️ Lunch @ Kenjalgad/);
  assert.match(text, /📝 Veg thali/);
  assert.match(text, /💰 ₹600/);
  assert.match(text, /🧭 Route: https:\/\/www\.google\.com\/maps\/dir\//);
  assert.match(text, /Planned budget: ₹600/);
});

test('next day label and date keep a Day 0 and follow the trip start', () => {
  const d = (label: string, date?: string) => ({ id: label, label, date });
  assert.equal(nextDayLabel([]), 'Day 1');
  assert.equal(nextDayLabel([d('Day 0')]), 'Day 1');
  assert.equal(nextDayLabel([d('Day 0'), d('Day 1')]), 'Day 2');
  assert.equal(nextDayLabel([d('Arrival')]), 'Day 1');
  assert.equal(nextDayDate([], '2026-12-20'), '2026-12-20');
  assert.equal(nextDayDate([d('Day 1', '2026-12-20')], '2026-12-20'), '2026-12-21');
  assert.equal(nextDayDate([d('Day 1')], '2026-12-20'), undefined);
});

test('share text without timing keeps the order, notes and the app calculation, but no times or budgets', () => {
  const trip = {
    name: 'Fort Trip',
    currency: 'INR',
    planDays: [{ id: 'd1', label: 'Day 1', date: '2026-12-20' }],
    planStops: [
      stop({ id: '1', name: 'Rohida', startMin: 450, durationMin: 210, lat: 18.3, lng: 73.6, budget: 30000 }),
      stop({
        id: '2', name: 'Lunch @ Kenjalgad', type: 'meal', startMin: 810, durationMin: 90, lat: 18.4, lng: 73.7,
        travelUserMin: 20, suggestion: { min: 62, km: 28.4, source: 'road', key: 'k' }, notes: 'Veg thali', budget: 60000,
      }),
    ],
  } as unknown as Trip;
  const text = buildPlanShareText(trip, { timing: false });
  assert.match(text, /1\. 📍 Rohida/);
  assert.match(text, /2\. 🍽️ Lunch @ Kenjalgad/);
  assert.match(text, /🚗 ~1h 2m · ~28 km/); // the app's number, not your hidden estimate of 20m
  assert.match(text, /📝 Veg thali/);
  assert.match(text, /Route: https:\/\/www\.google\.com\/maps\/dir\//);
  assert.doesNotMatch(text, /AM|PM|💰|budget/i);
});

test('reach time can be set and cleared on a stop without moving anything', () => {
  const a = stop({ id: 'a', startMin: 450, durationMin: 210 });
  const b = stop({ id: 'b', startMin: 780, durationMin: 90 });
  const set = applyStopEdit([a, b], 'a', { reachMin: 450 }, true);
  assert.equal(set[0].reachMin, 450);
  assert.deepEqual(set.map((s) => s.startMin), [450, 780]); // no shifting
  const cleared = applyStopEdit(set, 'a', { reachMin: null }, true);
  assert.equal('reachMin' in cleared[0], false);
  const untouched = applyStopEdit(set, 'a', { notes: 'x' }, false);
  assert.equal(untouched[0].reachMin, 450); // other edits keep it
  assert.equal(formatTime(450), '7:30 AM');
});

test('share text shows the reach time of a stop, only where one is set', () => {
  const trip = {
    name: 'Fort Trip',
    currency: 'INR',
    planDays: [{ id: 'd1', label: 'Day 1' }],
    planStops: [stop({ id: '1', name: 'Rohida', reachMin: 450 }), stop({ id: '2', name: 'Lunch', type: 'meal' })],
  } as unknown as Trip;
  const text = buildPlanShareText(trip, { timing: false });
  assert.match(text, /1\. 📍 Rohida — reach by 7:30 AM/);
  assert.match(text, /2\. 🍽️ Lunch$/m);
});
