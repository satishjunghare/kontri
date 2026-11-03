import type { Expense } from '../types.ts';

/**
 * Splits `total` (minor units) equally among `count` people.
 * Any leftover minor units (e.g. 100 paise / 3) are handed out one each to the
 * first people, so the shares always add up exactly to the total.
 */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type SplitError = 'over' | 'unassigned';

export interface SplitResult {
  /** Each member's share of the expense, in minor units. */
  shares: Record<string, number>;
  /** Sum of the fixed (custom) amounts. */
  fixedTotal: number;
  /** amount - fixedTotal: what is split equally among the auto members. */
  remaining: number;
  /** Members without a fixed amount, who share `remaining` equally. */
  autoMemberIds: string[];
  /** 'over': fixed amounts exceed the expense; 'unassigned': everyone is fixed but it doesn't add up. */
  error?: SplitError;
}

/**
 * Works out each member's share of one expense.
 * Members in `fixedShares` pay exactly that amount (0 = not included);
 * whatever is left is split equally among everyone else.
 * Fixed amounts for people who are not members are ignored.
 */
export function computeSplit(
  amount: number,
  memberIds: string[],
  fixedShares: Record<string, number> = {},
): SplitResult {
  const isFixed = (id: string) => Object.prototype.hasOwnProperty.call(fixedShares, id);
  const autoMemberIds = memberIds.filter((id) => !isFixed(id));
  const fixedTotal = memberIds.filter(isFixed).reduce((sum, id) => sum + fixedShares[id], 0);
  const remaining = amount - fixedTotal;

  let error: SplitError | undefined;
  if (remaining < 0) error = 'over';
  else if (autoMemberIds.length === 0 && remaining !== 0) error = 'unassigned';

  const shares: Record<string, number> = {};
  for (const id of memberIds) shares[id] = isFixed(id) ? fixedShares[id] : 0;
  const autoShares = splitEqually(Math.max(remaining, 0), autoMemberIds.length);
  autoMemberIds.forEach((id, i) => (shares[id] = autoShares[i]));

  return { shares, fixedTotal, remaining, autoMemberIds, error };
}

/** True when the expense uses a custom (non-equal) split. */
export function hasCustomSplit(expense: Pick<Expense, 'fixedShares'>): boolean {
  return !!expense.fixedShares && Object.keys(expense.fixedShares).length > 0;
}

/**
 * Shares of a saved expense. If its custom split has become invalid, it falls
 * back to an equal split so the trip's totals always balance.
 */
export function expenseShares(expense: Expense, memberIds: string[]): Record<string, number> {
  const result = computeSplit(expense.amount, memberIds, expense.fixedShares);
  return result.error ? computeSplit(expense.amount, memberIds).shares : result.shares;
}
