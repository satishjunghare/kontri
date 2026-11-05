import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState } from '../../components/ui.tsx';
import { formatDate } from '../../lib/id.ts';
import { formatMoney } from '../../lib/money.ts';
import { hasCustomSplit } from '../../lib/split.ts';
import { CATEGORY_LABELS, colors } from '../../theme.ts';
import { FUND_ID } from '../../types.ts';
import type { Trip } from '../../types.ts';
import { useBottomInset } from '../../components/useBottomInset.ts';

export default function ExpensesTab({
  trip,
  onAdd,
  onEdit,
  onGoToMembers,
}: {
  trip: Trip;
  onAdd: () => void;
  onEdit: (expenseId: string) => void;
  onGoToMembers: () => void;
}) {
  const bottomInset = useBottomInset();
  if (trip.members.length === 0) {
    return (
      <View style={styles.padded}>
        <EmptyState emoji="👥" title="Add members first" subtitle="Add the friends on this trip, then record expenses." />
        <Button title="Add members" onPress={onGoToMembers} />
      </View>
    );
  }

  const memberName = (id: string) =>
    id === FUND_ID ? '💰 Trip fund' : (trip.members.find((m) => m.id === id)?.name ?? 'Unknown');
  const sorted = [...trip.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  return (
    <FlatList
      contentContainerStyle={[styles.list, { paddingBottom: 40 + bottomInset }]}
      data={sorted}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={<Button title="+ Add expense" onPress={onAdd} style={{ marginBottom: 4 }} />}
      ListEmptyComponent={
        <EmptyState emoji="🧾" title="No expenses yet" subtitle="Tap “Add expense” whenever someone pays for something." />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => onEdit(item.id)}>
          {({ pressed }) => (
            <Card style={[styles.row, pressed && { opacity: 0.85 }]}>
              <Text style={styles.category}>{CATEGORY_LABELS[item.category].split(' ')[0]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.description} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.meta}>
                  Paid by {memberName(item.paidBy)} · {formatDate(item.date)}
                </Text>
                {hasCustomSplit(item) ? <Text style={styles.custom}>Custom split</Text> : null}
              </View>
              <Text style={styles.amount}>{formatMoney(item.amount, trip.currency)}</Text>
            </Card>
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  padded: { padding: 16 },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  category: { fontSize: 24 },
  description: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  custom: {
    alignSelf: 'flex-start',
    marginTop: 5,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
});
