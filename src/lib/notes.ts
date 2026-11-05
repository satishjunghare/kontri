import type { ChecklistItem, Note } from '../types.ts';

/** Pinned notes first, then the most recently edited. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Trims checklist items and drops empty ones. */
export function cleanChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text.length > 0);
}

export function checklistProgress(note: Pick<Note, 'checklist'>): { done: number; total: number } {
  return { done: note.checklist.filter((i) => i.done).length, total: note.checklist.length };
}

/** A note needs a title, text or at least one checklist item to be worth saving. */
export function isNoteEmpty(note: Pick<Note, 'title' | 'text' | 'checklist'>): boolean {
  return !note.title.trim() && !note.text.trim() && cleanChecklist(note.checklist).length === 0;
}

/** Title to show for a note: its title, else the first line of its text, else its first checklist item. */
export function noteDisplayTitle(note: Pick<Note, 'title' | 'text' | 'checklist'>): string {
  const title = note.title.trim();
  if (title) return title;
  const firstLine = note.text.trim().split('\n')[0];
  if (firstLine) return firstLine;
  return cleanChecklist(note.checklist)[0]?.text ?? 'Untitled note';
}
