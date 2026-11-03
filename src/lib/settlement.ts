import { FUND_ID } from '../types.ts';
import type { Contribution, Expense, Member } from '../types.ts';

export interface MemberBalance {
  memberId: string;
  /** Total this member paid personally for expenses. */
  paid: number;
  /** Total this member contributed in advance to the trip fund. */
  contributed: number;
  /** Fund cash this member is holding (only the fund holder; negative if the holder covered a shortfall). */
  fundHeld: number;
  /** This member's equal share of all expenses. */
  share: number;
  /** paid + contributed - fundHeld - share. Positive = gets money back, negative = owes money. */
  balance: number;
}

export interface Transfer {
  from: string; // Member id who pays
  to: string; // Member id who receives
  amount: number;
}

export interface FundSummary {
  collected: number;
  spent: number;
  /** collected - spent. Negative means the fund was overspent and the holder covered the difference. */
  remaining: number;
  /** Member holding the fund's cash, if any. */
  holderId?: string;
}

export interface Settlement {
  total: number;
  balances: MemberBalance[];
  transfers: Transfer[];
  fund: FundSummary;
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

/** The member holding the fund's cash: the chosen holder, else the first contributor, else the first member. */
export function resolveFundHolder(
  members: Member[],
  contributions: Contribution[],
  fundHolderId?: string,
): string | undefined {
  const ids = new Set(members.map((m) => m.id));
  if (fundHolderId && ids.has(fundHolderId)) return fundHolderId;
  return contributions.find((c) => ids.has(c.memberId))?.memberId ?? members[0]?.id;
}

/**
 * Computes who paid what, each member's equal share, and the list of payments
 * needed to settle up (greedy: largest debtor pays largest creditor).
 *
 * Advance fund: a contribution counts as money the member paid. Expenses paid
 * from the fund are shared equally like any other expense. Whatever is left in
 * the fund is cash the holder has, so it is subtracted from the holder's balance;
 * the settlement payments then include returning that leftover.
 *
 * All amounts are integers in minor units (paise/cents).
 */
export function computeSettlement(
  members: Member[],
  expenses: Expense[],
  contributions: Contribution[] = [],
  fundHolderId?: string,
): Settlement {
  const ids = new Set(members.map((m) => m.id));
  const paid = new Map<string, number>(members.map((m) => [m.id, 0]));
  const contributed = new Map<string, number>(members.map((m) => [m.id, 0]));
  let total = 0;
  let fundSpent = 0;
  let collected = 0;

  for (const e of expenses) {
    if (e.paidBy === FUND_ID) {
      fundSpent += e.amount;
      total += e.amount;
    } else if (ids.has(e.paidBy)) {
      paid.set(e.paidBy, paid.get(e.paidBy)! + e.amount);
      total += e.amount;
    }
  }
  for (const c of contributions) {
    if (!ids.has(c.memberId)) continue;
    contributed.set(c.memberId, contributed.get(c.memberId)! + c.amount);
    collected += c.amount;
  }

  const remaining = collected - fundSpent;
  const holderId = collected > 0 || fundSpent > 0 ? resolveFundHolder(members, contributions, fundHolderId) : undefined;

  const shares = splitEqually(total, members.length);
  const balances: MemberBalance[] = members.map((m, i) => {
    const fundHeld = m.id === holderId ? remaining : 0;
    const p = paid.get(m.id)!;
    const c = contributed.get(m.id)!;
    return {
      memberId: m.id,
      paid: p,
      contributed: c,
      fundHeld,
      share: shares[i],
      balance: p + c - fundHeld - shares[i],
    };
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

  return { total, balances, transfers, fund: { collected, spent: fundSpent, remaining, holderId } };
}
