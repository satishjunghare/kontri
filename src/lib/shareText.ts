import { formatMoney } from './money.ts';
import type { Settlement } from './settlement.ts';
import type { Trip } from '../types.ts';

/** Plain-text settlement summary, suitable for WhatsApp. */
export function buildShareText(trip: Trip, settlement: Settlement): string {
  const fmt = (v: number) => formatMoney(v, trip.currency);
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown';
  const share = trip.members.length ? fmt(Math.round(settlement.total / trip.members.length)) : fmt(0);

  const lines = [
    `🧳 *${trip.name}* — Expense settlement`,
    `Total spent: ${fmt(settlement.total)}`,
    `Members: ${trip.members.length} · Share each: ~${share}`,
    '',
    '*Who paid what*',
    ...settlement.balances.map((b) => {
      const status =
        b.balance > 0 ? `gets back ${fmt(b.balance)}` : b.balance < 0 ? `owes ${fmt(-b.balance)}` : 'settled';
      return `• ${name(b.memberId)}: paid ${fmt(b.paid)} → ${status}`;
    }),
    '',
    '*Payments to settle*',
    ...(settlement.transfers.length
      ? settlement.transfers.map((t) => `• ${name(t.from)} pays ${name(t.to)} ${fmt(t.amount)}`)
      : ['• Everyone is settled 🎉']),
    '',
    'Shared via TripSplit',
  ];
  return lines.join('\n');
}
