import { formatDate } from './id.ts';
import { currencySymbol, formatNumber } from './money.ts';
import type { Settlement, Transfer } from './settlement.ts';
import { expenseShares, hasCustomSplit } from './split.ts';
import { FUND_ID } from '../types.ts';
import type { Expense, ExpenseCategory, Trip } from '../types.ts';

/** Width of the bill in characters; fits most phone screens in WhatsApp's monospace block. */
export const BILL_WIDTH = 32;
/** Above this many expenses, the bill shows category totals instead of every expense. */
export const MAX_ITEMISED_EXPENSES = 15;

const CATEGORY_NAMES: Record<ExpenseCategory, string> = {
  food: 'Food',
  travel: 'Travel',
  stay: 'Stay',
  activity: 'Activity',
  shopping: 'Shopping',
  other: 'Other',
};

const LINE = '-'.repeat(BILL_WIDTH);

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return max <= 1 ? text.slice(0, max) : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Left text and right-aligned value on one line; the left text is shortened if needed. */
function row(left: string, right: string): string {
  const l = truncate(left, BILL_WIDTH - right.length - 1);
  return l + ' '.repeat(BILL_WIDTH - l.length - right.length) + right;
}

function center(text: string): string {
  const t = truncate(text, BILL_WIDTH);
  return (' '.repeat(Math.floor((BILL_WIDTH - t.length) / 2)) + t).trimEnd();
}

/** Word-wraps text to the bill width, indenting continuation lines. */
function wrap(text: string, indent = '  '): string[] {
  const lines: string[] = [];
  const lead = text.match(/^ */)![0];
  let current = lead;
  for (const word of text.slice(lead.length).split(' ')) {
    const candidate = current.trim() ? `${current} ${word}` : current + word;
    if (candidate.length > BILL_WIDTH && current.trim()) {
      lines.push(current);
      current = indent + word;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Plain-text settlement in a bill / receipt style for WhatsApp: a bold title,
 * then the bill inside a ``` block so the columns line up in a monospace font.
 */
export function buildShareText(trip: Trip, settlement: Settlement): string {
  const num = (v: number) => formatNumber(v, trip.currency);
  const symbol = currencySymbol(trip.currency).trim();
  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown';
  const payerLabel = (e: Expense) => (e.paidBy === FUND_ID ? 'Fund' : firstName(memberName(e.paidBy)));
  const memberIds = trip.members.map((m) => m.id);
  const lines: string[] = [];

  // Header
  lines.push(center(trip.name.toUpperCase()), center('FINAL BILL'));
  const dates = [formatDate(trip.startDate), formatDate(trip.endDate)].filter(Boolean).join(' - ');
  if (dates) lines.push(center(dates));
  lines.push(LINE);

  // Expenses
  const expenses = [...trip.expenses]
    .filter((e) => e.paidBy === FUND_ID || memberIds.includes(e.paidBy))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const customExpenses = expenses.filter(hasCustomSplit);
  const marker = (e: Expense) => {
    const i = customExpenses.indexOf(e);
    if (i < 0) return '';
    return customExpenses.length === 1 ? '*' : `*${i + 1}`;
  };

  if (expenses.length === 0) {
    lines.push('No expenses');
  } else if (expenses.length <= MAX_ITEMISED_EXPENSES) {
    lines.push(row('EXPENSES', symbol));
    for (const e of expenses) {
      const amount = num(e.amount);
      const suffix = `${marker(e)} (${payerLabel(e)})`;
      const room = BILL_WIDTH - amount.length - 1 - suffix.length;
      lines.push(row(truncate(e.description, Math.max(room, 4)) + suffix, amount));
    }
  } else {
    lines.push(row(`EXPENSES BY CATEGORY (${expenses.length})`, symbol));
    const byCategory = new Map<ExpenseCategory, number>();
    for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amount]) => lines.push(row(CATEGORY_NAMES[cat], num(amount))));
  }
  lines.push(LINE);

  // Totals and fund
  const { fund } = settlement;
  lines.push(row('TOTAL SPENT', num(settlement.total)));
  if (fund.collected > 0 || fund.spent > 0) {
    const holder = fund.holderId ? firstName(memberName(fund.holderId)) : '';
    if (fund.collected > 0) lines.push(row('Advance collected', num(fund.collected)));
    if (fund.spent === 0) {
      if (holder) lines.push(...wrap(`  (unused, held by ${holder})`));
    } else {
      lines.push(row('Spent from fund', num(fund.spent)));
      if (fund.remaining > 0) lines.push(row(`Left in fund (${holder})`, num(fund.remaining)));
      if (fund.remaining < 0) lines.push(row(`Fund short (${holder} paid)`, num(-fund.remaining)));
    }
  }
  lines.push(row('Friends', String(trip.members.length)), LINE);

  // Shares
  lines.push(row('SHARE PER PERSON', symbol));
  for (const b of settlement.balances) lines.push(row(memberName(b.memberId), num(b.share)));
  if (expenses.length <= MAX_ITEMISED_EXPENSES) {
    for (const e of customExpenses) {
      lines.push(...wrap(`${marker(e)} ${e.description} custom split:`));
      const shares = expenseShares(e, memberIds);
      const fixedIds = memberIds.filter((id) => e.fixedShares && id in e.fixedShares);
      const autoIds = memberIds.filter((id) => !fixedIds.includes(id));
      const groups = new Map<number, string[]>();
      for (const id of fixedIds) groups.set(shares[id], [...(groups.get(shares[id]) ?? []), firstName(memberName(id))]);
      for (const [amount, names] of groups) {
        lines.push(...wrap(`  ${names.join(', ')} ${num(amount)}${names.length > 1 ? ' each' : ''}`, '    '));
      }
      if (autoIds.length) {
        const autoAmounts = [...new Set(autoIds.map((id) => shares[id]))];
        const approx = autoAmounts.length > 1 ? '~' : '';
        lines.push(`  Others ${approx}${num(Math.max(...autoAmounts))}${autoIds.length > 1 ? ' each' : ''}`);
      }
    }
  } else if (customExpenses.length) {
    lines.push(`* Custom split in ${customExpenses.length} expense${customExpenses.length > 1 ? 's' : ''}`);
  }
  lines.push(LINE);

  // Amount due, grouped by receiver
  const byReceiver = new Map<string, Transfer[]>();
  for (const t of settlement.transfers) byReceiver.set(t.to, [...(byReceiver.get(t.to) ?? []), t]);
  const receivers = [...byReceiver.entries()]
    .map(([to, transfers]) => ({ to, transfers, total: transfers.reduce((sum, t) => sum + t.amount, 0) }))
    .sort((a, b) => b.total - a.total);

  if (receivers.length === 0) {
    lines.push('AMOUNT DUE', 'Nothing to pay. All settled!');
  } else if (receivers.length === 1) {
    const r = receivers[0];
    lines.push(truncate(`AMOUNT DUE -> ${memberName(r.to)}`, BILL_WIDTH));
    for (const t of r.transfers) lines.push(row(memberName(t.from), num(t.amount)));
    lines.push(LINE, row(`${firstName(memberName(r.to)).toUpperCase()} RECEIVES`, num(r.total)));
  } else {
    lines.push('AMOUNT DUE');
    for (const r of receivers) {
      lines.push('', truncate(`Pay to ${memberName(r.to).toUpperCase()}`, BILL_WIDTH));
      for (const t of r.transfers) lines.push(row(`  ${memberName(t.from)}`, num(t.amount)));
      lines.push(row(`  ${firstName(memberName(r.to))} receives`, num(r.total)));
    }
  }
  lines.push(LINE, center('Shared via Kontri'));

  return [`🧾 *${trip.name} — Final bill*`, '```', ...lines, '```'].join('\n');
}
