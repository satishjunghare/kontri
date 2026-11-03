export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'THB';

export interface Member {
  id: string;
  name: string;
}

export type ExpenseCategory = 'food' | 'travel' | 'stay' | 'activity' | 'shopping' | 'other';

export interface Expense {
  id: string;
  description: string;
  /** Amount in the smallest currency unit (paise for INR) to avoid floating-point errors. */
  amount: number;
  /** Member id, or FUND_ID when paid from the trip's advance fund. */
  paidBy: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  /**
   * Custom split: members whose share of this expense is fixed (minor units, 0 = not included).
   * The rest of the amount is split equally among the other members. Missing/empty = equal split.
   */
  fixedShares?: Record<string, number>;
  createdAt: number;
}

/** Special `paidBy` value: the expense was paid from the advance fund (kitty). */
export const FUND_ID = '__fund__';

/** Money a member put into the trip's advance fund before or during the trip. */
export interface Contribution {
  id: string;
  memberId: string;
  amount: number; // minor units
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Trip {
  id: string;
  name: string;
  currency: CurrencyCode;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  members: Member[];
  expenses: Expense[];
  /** Advance contributions to the trip fund. */
  contributions: Contribution[];
  /** Member who holds the fund's cash. Defaults to the first contributor. */
  fundHolderId?: string;
  createdAt: number;
}
