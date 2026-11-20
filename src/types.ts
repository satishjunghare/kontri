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

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** A free-form note on a trip, optionally with a checklist. */
export interface Note {
  id: string;
  title: string;
  text: string;
  checklist: ChecklistItem[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A photo on a trip. `file` is the file name inside the app's photos folder (not a full path). */
export interface Photo {
  id: string;
  file: string;
  caption?: string;
  width: number;
  height: number;
  createdAt: number;
}

export type StopType = 'place' | 'meal' | 'shopping' | 'fuel' | 'stay' | 'other';

/** One day of the trip plan. */
export interface PlanDay {
  id: string;
  label: string; // e.g. "Day 1" or "Day 0 (night travel)"
  date?: string; // YYYY-MM-DD
}

/** A place to visit, eat, shop, fuel up or stay at, on one day of the plan. */
export interface PlanStop {
  id: string;
  dayId: string;
  type: StopType;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  /**
   * The time you plan to reach this stop, in minutes after midnight. Optional: not every stop needs
   * one. Separate from the start time below, which belongs to the (currently hidden) timing details.
   */
  reachMin?: number;
  /** Start time, in minutes after midnight (0-1439). */
  startMin: number;
  /** How long you stay, in minutes. A stay can run past midnight. */
  durationMin: number;
  notes?: string;
  done?: boolean;
  /** Planned spend at this stop, in minor units (paise). */
  budget?: number;
  /** YOUR estimate of the travel time from the previous stop of the same day, in minutes. */
  travelUserMin?: number;
  /** What the app calculated for the same leg. Kept separate from your estimate. */
  suggestion?: TravelSuggestion;
}

export interface TravelSuggestion {
  min: number;
  km: number;
  /** 'road' = from a routing service; 'estimate' = straight-line guess (used when offline). */
  source: 'road' | 'estimate';
  /** Identifies the pair of places it was calculated for, so a changed place makes it stale. */
  key: string;
}

export interface Trip {
  id: string;
  name: string;
  currency: CurrencyCode;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  destination?: string;
  description?: string;
  members: Member[];
  expenses: Expense[];
  notes: Note[];
  photos: Photo[];
  planDays: PlanDay[];
  planStops: PlanStop[];
  /** Photo shown on the trips list and trip header. */
  coverPhotoId?: string;
  /** Advance contributions to the trip fund. */
  contributions: Contribution[];
  /** Member who holds the fund's cash. Defaults to the first contributor. */
  fundHolderId?: string;
  createdAt: number;
}
