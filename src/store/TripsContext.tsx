import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { newId } from '../lib/id.ts';
import { cleanChecklist } from '../lib/notes.ts';
import { deletePhotoFile } from '../lib/photos.ts';
import type { ChecklistItem, Contribution, Expense, Member, Note, Photo, Trip } from '../types.ts';

// Kept from the app's old name (TripSplit) so existing saved trips are not lost.
const STORAGE_KEY = 'tripsplit:v1';

type TripInput = Pick<Trip, 'name' | 'currency' | 'startDate' | 'endDate' | 'destination' | 'description'>;
export interface NoteInput {
  title: string;
  text: string;
  checklist: ChecklistItem[];
  pinned: boolean;
}
type PhotoInput = Pick<Photo, 'file' | 'width' | 'height'>;
type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;
type ContributionInput = Omit<Contribution, 'id' | 'createdAt'>;

/** Fills in fields added after v1 so older saved trips keep working. */
function normalizeTrip(trip: Trip): Trip {
  return {
    ...trip,
    contributions: Array.isArray(trip.contributions) ? trip.contributions : [],
    notes: Array.isArray(trip.notes) ? trip.notes : [],
    photos: Array.isArray(trip.photos) ? trip.photos : [],
  };
}

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
  addContributions: (tripId: string, inputs: ContributionInput[]) => void;
  deleteContribution: (tripId: string, contributionId: string) => void;
  setFundHolder: (tripId: string, memberId: string) => void;
  addNote: (tripId: string, input: NoteInput) => Note;
  updateNote: (tripId: string, noteId: string, input: NoteInput) => void;
  deleteNote: (tripId: string, noteId: string) => void;
  toggleNotePin: (tripId: string, noteId: string) => void;
  toggleChecklistItem: (tripId: string, noteId: string, itemId: string) => void;
  addPhotos: (tripId: string, photos: PhotoInput[]) => void;
  setPhotoCaption: (tripId: string, photoId: string, caption: string) => void;
  setCoverPhoto: (tripId: string, photoId: string | undefined) => void;
  deletePhoto: (tripId: string, photoId: string) => void;
}

const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load saved trips once on start.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { trips?: Trip[] };
          if (Array.isArray(parsed.trips)) setTrips(parsed.trips.map(normalizeTrip));
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
        const trip: Trip = {
          ...input,
          id: newId(),
          members: [],
          expenses: [],
          contributions: [],
          notes: [],
          photos: [],
          createdAt: Date.now(),
        };
        setTrips((prev) => [trip, ...prev]);
        return trip;
      },
      updateTrip: (tripId, input) => updateOne(tripId, (t) => ({ ...t, ...input })),
      deleteTrip: (tripId) => {
        // Photo files live outside the saved data, so remove them along with the trip.
        trips.find((t) => t.id === tripId)?.photos.forEach((p) => deletePhotoFile(p.file));
        setTrips((prev) => prev.filter((t) => t.id !== tripId));
      },
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
          const inUse =
            t.expenses.some((e) => e.paidBy === memberId || (e.fixedShares && memberId in e.fixedShares)) ||
            t.contributions.some((c) => c.memberId === memberId);
          if (inUse) return t; // guarded in UI too
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
      addContributions: (tripId, inputs) =>
        updateOne(tripId, (t) => ({
          ...t,
          fundHolderId: t.fundHolderId ?? inputs[0]?.memberId,
          contributions: [
            ...inputs.map((input) => ({ ...input, id: newId(), createdAt: Date.now() })),
            ...t.contributions,
          ],
        })),
      deleteContribution: (tripId, contributionId) =>
        updateOne(tripId, (t) => ({
          ...t,
          contributions: t.contributions.filter((c) => c.id !== contributionId),
        })),
      setFundHolder: (tripId, memberId) => updateOne(tripId, (t) => ({ ...t, fundHolderId: memberId })),
      addNote: (tripId, input) => {
        const now = Date.now();
        const note: Note = {
          id: newId(),
          title: input.title.trim(),
          text: input.text.trim(),
          checklist: cleanChecklist(input.checklist),
          pinned: input.pinned,
          createdAt: now,
          updatedAt: now,
        };
        updateOne(tripId, (t) => ({ ...t, notes: [note, ...t.notes] }));
        return note;
      },
      updateNote: (tripId, noteId, input) =>
        updateOne(tripId, (t) => ({
          ...t,
          notes: t.notes.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  title: input.title.trim(),
                  text: input.text.trim(),
                  checklist: cleanChecklist(input.checklist),
                  pinned: input.pinned,
                  updatedAt: Date.now(),
                }
              : n,
          ),
        })),
      deleteNote: (tripId, noteId) =>
        updateOne(tripId, (t) => ({ ...t, notes: t.notes.filter((n) => n.id !== noteId) })),
      toggleNotePin: (tripId, noteId) =>
        updateOne(tripId, (t) => ({
          ...t,
          notes: t.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)),
        })),
      toggleChecklistItem: (tripId, noteId, itemId) =>
        updateOne(tripId, (t) => ({
          ...t,
          notes: t.notes.map((n) =>
            n.id === noteId
              ? { ...n, checklist: n.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
              : n,
          ),
        })),
      addPhotos: (tripId, inputs) =>
        updateOne(tripId, (t) => {
          const now = Date.now();
          const added: Photo[] = inputs.map((p, i) => ({ ...p, id: newId(), createdAt: now + i }));
          return { ...t, photos: [...added, ...t.photos] };
        }),
      setPhotoCaption: (tripId, photoId, caption) =>
        updateOne(tripId, (t) => ({
          ...t,
          photos: t.photos.map((p) => (p.id === photoId ? { ...p, caption: caption.trim() || undefined } : p)),
        })),
      setCoverPhoto: (tripId, photoId) => updateOne(tripId, (t) => ({ ...t, coverPhotoId: photoId })),
      deletePhoto: (tripId, photoId) => {
        const photo = trips.find((t) => t.id === tripId)?.photos.find((p) => p.id === photoId);
        if (photo) deletePhotoFile(photo.file);
        updateOne(tripId, (t) => ({
          ...t,
          photos: t.photos.filter((p) => p.id !== photoId),
          coverPhotoId: t.coverPhotoId === photoId ? undefined : t.coverPhotoId,
        }));
      },
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
