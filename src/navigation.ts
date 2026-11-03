import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Trips: undefined;
  TripForm: { tripId?: string } | undefined;
  TripDetail: { tripId: string };
  ExpenseForm: { tripId: string; expenseId?: string };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
