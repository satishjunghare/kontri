/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSettlement, splitEqually } from './settlement.ts';
import { FUND_ID } from '../types.ts';
import type { Contribution, Expense, Member } from '../types.ts';

const m = (id: string): Member => ({ id, name: id });
const e = (paidBy: string, amount: number): Expense => ({
  id: Math.random().toString(36),
  description: 'x',
  amount,
  paidBy,
  date: '2026-11-03',
  category: 'other',
  createdAt: 0,
});

test('Goa example: 6000 / 3000 / 0 -> Amit pays Satish 3000', () => {
  const members = [m('Satish'), m('Rahul'), m('Amit')];
  const s = computeSettlement(members, [e('Satish', 600000), e('Rahul', 300000)]);
  assert.equal(s.total, 900000);
  assert.deepEqual(
    s.balances.map((b) => [b.memberId, b.share, b.balance]),
    [
      ['Satish', 300000, 300000],
      ['Rahul', 300000, 0],
      ['Amit', 300000, -300000],
    ],
  );
  assert.deepEqual(s.transfers, [{ from: 'Amit', to: 'Satish', amount: 300000 }]);
});

test('uneven split distributes leftover paise and still sums to total', () => {
  assert.deepEqual(splitEqually(10000, 3), [3334, 3333, 3333]);
  const members = [m('A'), m('B'), m('C')];
  const s = computeSettlement(members, [e('A', 10000)]);
  assert.equal(s.balances.reduce((sum, b) => sum + b.share, 0), 10000);
  assert.equal(s.balances.reduce((sum, b) => sum + b.balance, 0), 0);
  const settledToA = s.transfers.filter((t) => t.to === 'A').reduce((sum, t) => sum + t.amount, 0);
  assert.equal(settledToA, 6666);
});

test('multiple debtors and creditors fully settle', () => {
  const members = [m('A'), m('B'), m('C'), m('D')];
  const s = computeSettlement(members, [e('A', 70000), e('B', 50000), e('C', 0), e('A', 0)]);
  // total 120000, share 30000: A +40000, B +20000, C -30000, D -30000
  const net = new Map(members.map((x) => [x.id, 0]));
  for (const t of s.transfers) {
    net.set(t.from, net.get(t.from)! + t.amount);
    net.set(t.to, net.get(t.to)! - t.amount);
  }
  for (const b of s.balances) assert.equal(b.balance + net.get(b.memberId)!, 0);
  assert.ok(s.transfers.length <= members.length - 1);
});

test('no expenses or no members', () => {
  assert.deepEqual(computeSettlement([m('A')], []).transfers, []);
  const empty = computeSettlement([], [e('A', 100)]);
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.transfers, []);
});

const c = (memberId: string, amount: number): Contribution => ({
  id: Math.random().toString(36),
  memberId,
  amount,
  date: '2026-11-03',
  createdAt: 0,
});

/** Applies transfers and checks every member ends at exactly zero. */
function assertFullySettled(s: ReturnType<typeof computeSettlement>) {
  const net = new Map(s.balances.map((b) => [b.memberId, b.balance]));
  for (const t of s.transfers) {
    net.set(t.from, net.get(t.from)! + t.amount);
    net.set(t.to, net.get(t.to)! - t.amount);
  }
  for (const [id, v] of net) assert.equal(v, 0, `${id} not settled`);
}

test('advance fund: leftover cash is returned by the holder', () => {
  // Everyone gives 2000 to Satish (holder). Fund pays food 5000. Rahul pays fuel 3000 personally.
  const members = [m('Satish'), m('Rahul'), m('Amit')];
  const s = computeSettlement(
    members,
    [e(FUND_ID, 500000), e('Rahul', 300000)],
    [c('Satish', 200000), c('Rahul', 200000), c('Amit', 200000)],
    'Satish',
  );
  assert.equal(s.total, 800000);
  assert.deepEqual(s.fund, { collected: 600000, spent: 500000, remaining: 100000, holderId: 'Satish' });
  // Shares: 266667, 266667, 266666
  const bal = Object.fromEntries(s.balances.map((b) => [b.memberId, b.balance]));
  assert.deepEqual(bal, { Satish: -166667, Rahul: 233333, Amit: -66666 });
  assert.equal(s.balances.reduce((sum, b) => sum + b.balance, 0), 0);
  assertFullySettled(s);
});

test('advance fund fully spent: equal contributions mean nobody owes anything', () => {
  const members = [m('A'), m('B'), m('C')];
  const s = computeSettlement(members, [e(FUND_ID, 300000)], [c('A', 100000), c('B', 100000), c('C', 100000)], 'A');
  assert.deepEqual(s.transfers, []);
  assert.ok(s.balances.every((b) => b.balance === 0));
});

test('unused fund is simply refunded to contributors', () => {
  const members = [m('A'), m('B')];
  const s = computeSettlement(members, [], [c('A', 50000), c('B', 50000)], 'A');
  assert.deepEqual(s.transfers, [{ from: 'A', to: 'B', amount: 50000 }]);
});

test('overspent fund: holder covered the shortfall and gets it back', () => {
  const members = [m('A'), m('B')];
  const s = computeSettlement(members, [e(FUND_ID, 120000)], [c('A', 50000), c('B', 50000)], 'A');
  assert.equal(s.fund.remaining, -20000);
  assert.deepEqual(s.transfers, [{ from: 'B', to: 'A', amount: 10000 }]);
});

test('fund holder defaults to the first contributor', () => {
  const members = [m('A'), m('B')];
  const s = computeSettlement(members, [], [c('B', 1000)]);
  assert.equal(s.fund.holderId, 'B');
});
