import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { newId } from '../lib/id.ts';
import type { Expense, Member, Trip } from '../types.ts';

const STORAGE_KEY = 'tripsplit:v1';

type TripInput = Pick<Trip, 'name' | 'currency' | 'startDate' | 'endDate'>;
type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

interface TripsContextValue {
  loaded: boolean;
  trips: Trip[];
  getTrip: (tripId: string) => Trip | undefined;
  createTrip: (input: TripInput) => Trip;
  updateTrip: (tripId: string, input: TripInput) => void;
  deleteTrip: (tripId: string) => void;
  addMember: (tripId: string, name: string) => Member;
  renameMember: (tripId: string, memberId: string, name: string) => void;
  removeMember: (tripId: string, memberId: string) => void;
  addExpense: (tripId: string, input: ExpenseInput) => void;
  updateExpense: (tripId: string, expenseId: string, input: ExpenseInput) => void;
  deleteExpense: (tripId: string, expenseId: string) => void;
}

const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  // Load saved trips once on start.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { trips?: Trip[] };
          if (Array.isArray(parsed.trips)) setTrips(parsed.trips);
        }
      } catch (err) {
        console.warn('Could not load saved trips', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Save whenever trips change (after the initial load).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips })).catch((err) =>
      console.warn('Could not save trips', err),
    );
  }, [trips, loaded]);

  const updateOne = useCallback((tripId: string, fn: (trip: Trip) => Trip) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? fn(t) : t)));
  }, []);

  const value = useMemo<TripsContextValue>(
    () => ({
      loaded,
      trips,
      getTrip: (tripId) => trips.find((t) => t.id === tripId),
      createTrip: (input) => {
        const trip: Trip = { ...input, id: newId(), members: [], expenses: [], createdAt: Date.now() };
        setTrips((prev) => [trip, ...prev]);
        return trip;
      },
      updateTrip: (tripId, input) => updateOne(tripId, (t) => ({ ...t, ...input })),
      deleteTrip: (tripId) => setTrips((prev) => prev.filter((t) => t.id !== tripId)),
      addMember: (tripId, name) => {
        const member: Member = { id: newId(), name: name.trim() };
        updateOne(tripId, (t) => ({ ...t, members: [...t.members, member] }));
        return member;
      },
      renameMember: (tripId, memberId, name) =>
        updateOne(tripId, (t) => ({
          ...t,
          members: t.members.map((m) => (m.id === memberId ? { ...m, name: name.trim() } : m)),
        })),
      removeMember: (tripId, memberId) =>
        updateOne(tripId, (t) => {
          if (t.expenses.some((e) => e.paidBy === memberId)) return t; // guarded in UI too
          return { ...t, members: t.members.filter((m) => m.id !== memberId) };
        }),
      addExpense: (tripId, input) =>
        updateOne(tripId, (t) => ({
          ...t,
          expenses: [{ ...input, id: newId(), createdAt: Date.now() }, ...t.expenses],
        })),
      updateExpense: (tripId, expenseId, input) =>
        updateOne(tripId, (t) => ({
          ...t,
          expenses: t.expenses.map((e) => (e.id === expenseId ? { ...e, ...input } : e)),
        })),
      deleteExpense: (tripId, expenseId) =>
        updateOne(tripId, (t) => ({ ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) })),
    }),
    [loaded, trips, updateOne],
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsContextValue {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used inside TripsProvider');
  return ctx;
}
