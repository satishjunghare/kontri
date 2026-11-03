/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BILL_WIDTH, buildShareText } from './shareText.ts';
import { computeSettlement } from './settlement.ts';
import type { Expense, Trip } from '../types.ts';

const members = [
  { id: 'santosh', name: 'Santosh Yelmar' },
  { id: 'prathmesh', name: 'Prathmesh' },
  { id: 'satish', name: 'Satish Junghare' },
  { id: 'vishal', name: 'Vishal Makhare' },
  { id: 'saleem', name: 'Saleem' },
];
let seq = 0;
const exp = (description: string, amount: number, paidBy: string, fixedShares?: Record<string, number>): Expense => ({
  id: `e${++seq}`,
  description,
  amount: amount * 100,
  paidBy,
  date: '2026-10-03',
  category: 'other',
  fixedShares,
  createdAt: seq,
});
const puneTrip = (fuelPaidBy: string): Trip => ({
  id: 't',
  name: 'Pune Trip Oct 2026',
  currency: 'INR',
  members,
  expenses: [
    exp('Hotel', 3500, 'satish'),
    exp('Fuel', 1800, fuelPaidBy),
    exp('Dinner', 1316, 'satish', { prathmesh: 11200, saleem: 11200 }),
    exp('Tea & snacks', 220, 'prathmesh'),
  ],
  contributions: members.map((m) => ({ id: m.id, memberId: m.id, amount: 50000, date: '2026-10-01', createdAt: 0 })),
  fundHolderId: 'satish',
  createdAt: 0,
});
const bill = (trip: Trip) =>
  buildShareText(trip, computeSettlement(trip.members, trip.expenses, trip.contributions, trip.fundHolderId));

const HEAD = `🧾 *Pune Trip Oct 2026 — Final bill*
\`\`\`
       PUNE TRIP OCT 2026
           FINAL BILL
--------------------------------
EXPENSES                       ₹
Hotel (Satish)             3,500`;
const MIDDLE = `Dinner* (Satish)           1,316
Tea & snacks (Prathmesh)     220
--------------------------------
TOTAL SPENT                6,836
Advance collected          2,500
  (unused, held by Satish)
Friends                        5
--------------------------------
SHARE PER PERSON               ₹
Santosh Yelmar             1,468
Prathmesh                  1,216
Satish Junghare            1,468
Vishal Makhare             1,468
Saleem                     1,216
* Dinner custom split:
  Prathmesh, Saleem 112 each
  Others 364 each
--------------------------------`;

test('bill with one receiver matches the agreed format', () => {
  assert.equal(
    bill(puneTrip('satish')),
    `${HEAD}
Fuel (Satish)              1,800
${MIDDLE}
AMOUNT DUE -> Satish Junghare
Santosh Yelmar               968
Vishal Makhare               968
Saleem                       716
Prathmesh                    496
--------------------------------
SATISH RECEIVES            3,148
--------------------------------
      Shared via TripSplit
\`\`\``,
  );
});

test('bill with two receivers is grouped by receiver', () => {
  assert.equal(
    bill(puneTrip('prathmesh')),
    `${HEAD}
Fuel (Prathmesh)           1,800
${MIDDLE}
AMOUNT DUE

Pay to SATISH JUNGHARE
  Santosh Yelmar             968
  Vishal Makhare             380
  Satish receives          1,348

Pay to PRATHMESH
  Vishal Makhare             588
  Saleem                     716
  Prathmesh receives       1,304
--------------------------------
      Shared via TripSplit
\`\`\``,
  );
});

test('every bill line fits the width; long trips use category totals', () => {
  const trip = puneTrip('satish');
  trip.name = 'A very long trip name that keeps going and going';
  trip.members = [...members, { id: 'x', name: 'Someone With An Extremely Long Name' }];
  trip.expenses = Array.from({ length: 20 }, (_, i) => ({
    ...exp(`Expense with a really long description ${i}`, 1000 + i, 'satish'),
    category: i % 2 ? 'food' : 'travel',
  }));
  const text = bill(trip);
  const body = text.split('\n').slice(2, -1);
  for (const line of body) assert.ok(line.length <= BILL_WIDTH, `too long: "${line}"`);
  assert.match(text, /EXPENSES BY CATEGORY \(20\)/);
  assert.match(text, /^Food +\d/m);
});

test('fund spent and settled trip', () => {
  const trip = puneTrip('satish');
  trip.expenses = [exp('Dinner', 2500, '__fund__')];
  const text = bill(trip);
  assert.match(text, /Dinner \(Fund\) +2,500/);
  assert.match(text, /Spent from fund +2,500/);
  assert.match(text, /Nothing to pay\. All settled!/);
});
