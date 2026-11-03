import type { CurrencyCode } from '../types.ts';

export const CURRENCIES: { code: CurrencyCode; symbol: string }[] = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'THB', symbol: '฿' },
];

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '';
}

/** Groups digits: Indian style (12,34,567) for INR, western style (1,234,567) otherwise. */
function groupDigits(digits: string, indian: boolean): string {
  if (!indian) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Formats minor units (paise/cents) as a display string, e.g. 300000 -> "₹3,000", 3334 -> "₹33.34". */
export function formatMoney(minor: number, currency: CurrencyCode): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100).toString();
  const fraction = abs % 100;
  const fractionText = fraction === 0 ? '' : `.${fraction.toString().padStart(2, '0')}`;
  return `${sign}${currencySymbol(currency)}${groupDigits(whole, currency === 'INR')}${fractionText}`;
}

/**
 * Parses user input like "1,234.50" into minor units (123450).
 * Returns null for empty, invalid, zero/negative, or more than 2 decimal places.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned) && !/^\.\d{1,2}$/.test(cleaned)) return null;
  const [wholePart, fractionPart = ''] = cleaned.split('.');
  const minor = Number(wholePart || '0') * 100 + Number(fractionPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

/** Converts minor units back to an editable string, e.g. 123450 -> "1234.5". */
export function minorToInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${fraction.toString().padStart(2, '0').replace(/0$/, '')}`;
}
