import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ExpenseCategory } from './types.ts';

/** Starting values for a new expense, e.g. when adding a planned stop as an expense. */
export interface ExpensePrefill {
  description?: string;
  /** In the smallest currency unit (paise). */
  amount?: number;
  category?: ExpenseCategory;
}

export type RootStackParamList = {
  Trips: undefined;
  TripForm: { tripId?: string } | undefined;
  TripDetail: { tripId: string };
  ExpenseForm: { tripId: string; expenseId?: string; prefill?: ExpensePrefill };
  StopForm: { tripId: string; dayId: string; stopId?: string };
  NoteForm: { tripId: string; noteId?: string };
  PhotoViewer: { tripId: string; photoId: string };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
