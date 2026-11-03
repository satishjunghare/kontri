/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSettlement, splitEqually } from './settlement.ts';
import type { Expense, Member } from '../types.ts';

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
  assert.deepEqual(computeSettlement([], [e('A', 100)]), { total: 0, balances: [], transfers: [] });
});
