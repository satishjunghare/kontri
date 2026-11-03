import type { Expense, Member } from '../types.ts';

export interface MemberBalance {
  memberId: string;
  /** Total this member paid. */
  paid: number;
  /** This member's equal share of the total. */
  share: number;
  /** paid - share. Positive = gets money back, negative = owes money. */
  balance: number;
}

export interface Transfer {
  from: string; // Member id who pays
  to: string; // Member id who receives
  amount: number;
}

export interface Settlement {
  total: number;
  balances: MemberBalance[];
  transfers: Transfer[];
}

/**
 * Splits `total` (minor units) equally among `count` people.
 * Any leftover minor units (e.g. 100 paise / 3) are handed out one each to the
 * first members, so the shares always add up exactly to the total.
 */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Computes who paid what, each member's equal share, and the minimal-ish list of
 * payments needed to settle up (greedy: largest debtor pays largest creditor).
 * All amounts are integers in minor units (paise/cents).
 */
export function computeSettlement(members: Member[], expenses: Expense[]): Settlement {
  const paidBy = new Map<string, number>(members.map((m) => [m.id, 0]));
  let total = 0;
  for (const e of expenses) {
    if (!paidBy.has(e.paidBy)) continue; // ignore expenses of unknown members
    paidBy.set(e.paidBy, (paidBy.get(e.paidBy) ?? 0) + e.amount);
    total += e.amount;
  }

  const shares = splitEqually(total, members.length);
  const balances: MemberBalance[] = members.map((m, i) => {
    const paid = paidBy.get(m.id) ?? 0;
    return { memberId: m.id, paid, share: shares[i], balance: paid - shares[i] };
  });

  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.memberId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.memberId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].amount, debtors[di].amount);
    transfers.push({ from: debtors[di].id, to: creditors[ci].id, amount });
    creditors[ci].amount -= amount;
    debtors[di].amount -= amount;
    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }

  return { total, balances, transfers };
}
