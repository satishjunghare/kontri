/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checklistProgress, cleanChecklist, isNoteEmpty, noteDisplayTitle, sortNotes } from './notes.ts';
import type { Note } from '../types.ts';

const note = (over: Partial<Note>): Note => ({
  id: 'n',
  title: '',
  text: '',
  checklist: [],
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

test('pinned notes come first, then newest edited', () => {
  const sorted = sortNotes([
    note({ id: 'old', updatedAt: 1 }),
    note({ id: 'new', updatedAt: 3 }),
    note({ id: 'pinned-old', pinned: true, updatedAt: 0 }),
    note({ id: 'pinned-new', pinned: true, updatedAt: 2 }),
  ]);
  assert.deepEqual(sorted.map((n) => n.id), ['pinned-new', 'pinned-old', 'new', 'old']);
});

test('sortNotes does not change the original array', () => {
  const list = [note({ id: 'a', updatedAt: 1 }), note({ id: 'b', updatedAt: 2 })];
  sortNotes(list);
  assert.deepEqual(list.map((n) => n.id), ['a', 'b']);
});

test('cleanChecklist trims text and drops empty items', () => {
  const cleaned = cleanChecklist([
    { id: '1', text: '  Passport ', done: true },
    { id: '2', text: '   ', done: false },
    { id: '3', text: 'Chargers', done: false },
  ]);
  assert.deepEqual(cleaned, [
    { id: '1', text: 'Passport', done: true },
    { id: '3', text: 'Chargers', done: false },
  ]);
});

test('checklist progress counts done items', () => {
  const n = note({
    checklist: [
      { id: '1', text: 'a', done: true },
      { id: '2', text: 'b', done: false },
      { id: '3', text: 'c', done: true },
    ],
  });
  assert.deepEqual(checklistProgress(n), { done: 2, total: 3 });
  assert.deepEqual(checklistProgress(note({})), { done: 0, total: 0 });
});

test('isNoteEmpty ignores whitespace and blank checklist items', () => {
  assert.equal(isNoteEmpty(note({ title: ' ', text: '\n', checklist: [{ id: '1', text: ' ', done: false }] })), true);
  assert.equal(isNoteEmpty(note({ text: 'hello' })), false);
  assert.equal(isNoteEmpty(note({ checklist: [{ id: '1', text: 'x', done: false }] })), false);
});

test('display title falls back to text, then checklist', () => {
  assert.equal(noteDisplayTitle(note({ title: 'Hotel', text: 'x' })), 'Hotel');
  assert.equal(noteDisplayTitle(note({ text: 'Cab driver Ramesh\n98xxxx' })), 'Cab driver Ramesh');
  assert.equal(noteDisplayTitle(note({ checklist: [{ id: '1', text: 'Passport', done: false }] })), 'Passport');
  assert.equal(noteDisplayTitle(note({})), 'Untitled note');
});
