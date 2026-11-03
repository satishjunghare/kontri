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
  paidBy: string; // Member id
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
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
  createdAt: number;
}
