import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, EmptyState, Field, confirm } from '../components/ui.tsx';
import { newId } from '../lib/id.ts';
import { isNoteEmpty } from '../lib/notes.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { colors } from '../theme.ts';
import type { ChecklistItem } from '../types.ts';

export default function NoteFormScreen({ navigation, route }: ScreenProps<'NoteForm'>) {
  const { tripId, noteId } = route.params;
  const { getTrip, addNote, updateNote, deleteNote } = useTrips();
  const trip = getTrip(tripId);
  const existing = noteId ? trip?.notes.find((n) => n.id === noteId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [text, setText] = useState(existing?.text ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(existing?.checklist ?? []);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [newItem, setNewItem] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit note' : 'New note' });
  }, [navigation, existing]);

  if (!trip) return <EmptyState emoji="🤷" title="Trip not found" />;

  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    setChecklist((prev) => [...prev, { id: newId(), text: t, done: false }]);
    setNewItem('');
  };
  const toggleItem = (id: string) =>
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const removeItem = (id: string) => setChecklist((prev) => prev.filter((i) => i.id !== id));

  const save = () => {
    // A half-typed checklist item counts too.
    const pending = newItem.trim();
    const items = pending ? [...checklist, { id: newId(), text: pending, done: false }] : checklist;
    const input = { title, text, checklist: items, pinned };
    if (isNoteEmpty(input)) {
      setSubmitted(true);
      return;
    }
    if (existing) updateNote(trip.id, existing.id, input);
    else addNote(trip.id, input);
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    confirm('Delete note?', 'This note will be deleted.', 'Delete', () => {
      deleteNote(trip.id, existing.id);
      navigation.goBack();
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field
        label="Title"
        placeholder="e.g. Hotel booking, Things to carry"
        value={title}
        onChangeText={setTitle}
        autoFocus={!existing}
        error={submitted ? 'Add a title, some text or a checklist item' : undefined}
      />
      <Field
        label="Note"
        placeholder="Details, phone numbers, booking references…"
        value={text}
        onChangeText={setText}
        multiline
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />

      <Text style={styles.label}>Checklist</Text>
      <View style={styles.checklist}>
        {checklist.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Pressable
              onPress={() => toggleItem(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={item.text}
              hitSlop={8}
              style={[styles.box, item.done && styles.boxDone]}
            >
              {item.done ? <Text style={styles.tick}>✓</Text> : null}
            </Pressable>
            <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
            <Pressable onPress={() => removeItem(item.id)} hitSlop={10} accessibilityLabel={`Remove ${item.text}`}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add an item"
            placeholderTextColor={colors.textMuted}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={addItem}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          <Button title="Add" variant="secondary" onPress={addItem} style={{ paddingHorizontal: 14, paddingVertical: 10 }} />
        </View>
      </View>

      <View style={styles.pinRow}>
        <Text style={styles.pinLabel}>📌 Pin to the top</Text>
        <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.primary }} />
      </View>

      <Button title={existing ? 'Save changes' : 'Add note'} onPress={save} />
      {existing ? <Button title="Delete note" variant="danger" onPress={remove} style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  checklist: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 15, lineHeight: 18 },
  itemText: { flex: 1, fontSize: 16, color: colors.text },
  itemDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  remove: { color: colors.danger, fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  addInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pinLabel: { fontSize: 16, color: colors.text, fontWeight: '600' },
});
