/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSplit, expenseShares } from './split.ts';
import { computeSettlement } from './settlement.ts';
import { FUND_ID } from '../types.ts';
import type { Expense, Member } from '../types.ts';

const ids = ['Satish', 'Rahul', 'Amit', 'Priya'];
const members: Member[] = ids.map((id) => ({ id, name: id }));
const expense = (amount: number, paidBy: string, fixedShares?: Record<string, number>): Expense => ({
  id: Math.random().toString(36),
  description: 'Dinner',
  amount,
  paidBy,
  date: '2026-11-03',
  category: 'food',
  fixedShares,
  createdAt: 0,
});

test('no custom amounts: equal split', () => {
  assert.deepEqual(computeSplit(200000, ids).shares, { Satish: 50000, Rahul: 50000, Amit: 50000, Priya: 50000 });
});

test('one member fixed at 200: others get 600 each', () => {
  const r = computeSplit(200000, ids, { Amit: 20000 });
  assert.deepEqual(r.shares, { Satish: 60000, Rahul: 60000, Amit: 20000, Priya: 60000 });
  assert.equal(r.remaining, 180000);
  assert.equal(r.error, undefined);
});

test('two members fixed: remaining split between the other two', () => {
  const r = computeSplit(200000, ids, { Amit: 20000, Rahul: 30000 });
  assert.deepEqual(r.shares, { Satish: 75000, Rahul: 30000, Amit: 20000, Priya: 75000 });
});

test('fixed amounts stay when the total changes', () => {
  const r = computeSplit(240000, ids, { Amit: 20000, Rahul: 30000 });
  assert.deepEqual(r.shares, { Satish: 95000, Rahul: 30000, Amit: 20000, Priya: 95000 });
});

test('zero means not included', () => {
  const r = computeSplit(90000, ids, { Amit: 0 });
  assert.deepEqual(r.shares, { Satish: 30000, Rahul: 30000, Amit: 0, Priya: 30000 });
});

test('uneven remainder keeps the exact total', () => {
  const r = computeSplit(100000, ids, { Amit: 20000 });
  assert.deepEqual(r.shares, { Satish: 26667, Rahul: 26667, Amit: 20000, Priya: 26666 });
  assert.equal(Object.values(r.shares).reduce((a, b) => a + b, 0), 100000);
});

test('errors: over-assigned and unassigned', () => {
  assert.equal(computeSplit(200000, ids, { Amit: 150000, Rahul: 80000 }).error, 'over');
  const all = { Satish: 50000, Rahul: 50000, Amit: 50000, Priya: 40000 };
  assert.equal(computeSplit(200000, ids, all).error, 'unassigned');
  assert.equal(computeSplit(190000, ids, all).error, undefined);
});

test('fixed amounts for non-members are ignored; invalid saved split falls back to equal', () => {
  assert.deepEqual(computeSplit(200000, ids, { Ghost: 20000 }).shares.Satish, 50000);
  assert.deepEqual(expenseShares(expense(100000, 'Satish', { Amit: 150000 }), ids), {
    Satish: 25000,
    Rahul: 25000,
    Amit: 25000,
    Priya: 25000,
  });
});

test('settlement uses custom splits', () => {
  // Satish pays dinner 2000, Amit's part is 200 -> others 600.
  const s = computeSettlement(members, [expense(200000, 'Satish', { Amit: 20000 })]);
  const bal = Object.fromEntries(s.balances.map((b) => [b.memberId, [b.share, b.balance]]));
  assert.deepEqual(bal, {
    Satish: [60000, 140000],
    Rahul: [60000, -60000],
    Amit: [20000, -20000],
    Priya: [60000, -60000],
  });
  assert.equal(s.transfers.reduce((sum, t) => sum + t.amount, 0), 140000);
});

test('custom split on a fund expense', () => {
  const contributions = ids.map((memberId) => ({ id: memberId, memberId, amount: 50000, date: '2026-11-03', createdAt: 0 }));
  const s = computeSettlement(members, [expense(200000, FUND_ID, { Amit: 20000 })], contributions, 'Satish');
  const bal = Object.fromEntries(s.balances.map((b) => [b.memberId, b.balance]));
  // Each gave 500; Amit's share 200 -> gets 300 back; others' share 600 -> owe 100.
  assert.deepEqual(bal, { Satish: -10000, Rahul: -10000, Amit: 30000, Priya: -10000 });
});
