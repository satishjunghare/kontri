import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, EmptyState, Field, confirm } from '../components/ui.tsx';
import { isValidDate, todayISO } from '../lib/id.ts';
import { currencySymbol, formatMoney, minorToInput, parseAmount } from '../lib/money.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { CATEGORY_LABELS, colors } from '../theme.ts';
import { FUND_ID } from '../types.ts';
import type { ExpenseCategory } from '../types.ts';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

export default function ExpenseFormScreen({ navigation, route }: ScreenProps<'ExpenseForm'>) {
  const { tripId, expenseId } = route.params;
  const { getTrip, addExpense, updateExpense, deleteExpense } = useTrips();
  const trip = getTrip(tripId);
  const existing = expenseId ? trip?.expenses.find((e) => e.id === expenseId) : undefined;

  const [description, setDescription] = useState(existing?.description ?? '');
  const [amountText, setAmountText] = useState(existing ? minorToInput(existing.amount) : '');
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? (trip?.members.length === 1 ? trip.members[0].id : ''));
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'food');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit expense' : 'Add expense' });
  }, [navigation, existing]);

  if (!trip) return <EmptyState emoji="🤷" title="Trip not found" />;

  const amount = parseAmount(amountText);
  const hasFund = trip.contributions.length > 0 || existing?.paidBy === FUND_ID;
  // Money left in the fund, not counting this expense's previous amount when editing.
  const fundLeft =
    trip.contributions.reduce((sum, c) => sum + c.amount, 0) -
    trip.expenses.filter((e) => e.paidBy === FUND_ID && e.id !== existing?.id).reduce((sum, e) => sum + e.amount, 0);
  const errors = {
    description: description.trim() ? undefined : 'What was this for?',
    amount: amount ? undefined : 'Enter a valid amount (max 2 decimals)',
    paidBy: trip.members.some((m) => m.id === paidBy) || (hasFund && paidBy === FUND_ID) ? undefined : 'Select who paid',
    date: isValidDate(date) ? undefined : 'Use format YYYY-MM-DD',
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || !amount) return;
    const input = { description: description.trim(), amount, paidBy, category, date };
    if (existing) updateExpense(trip.id, existing.id, input);
    else addExpense(trip.id, input);
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    confirm('Delete expense?', `"${existing.description}" will be deleted.`, 'Delete', () => {
      deleteExpense(trip.id, existing.id);
      navigation.goBack();
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field
        label={`Amount (${currencySymbol(trip.currency).trim()})`}
        placeholder="0"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        autoFocus={!existing}
        error={show('amount')}
        style={styles.amountInput}
      />
      <Field
        label="Description"
        placeholder="e.g. Hotel, Fuel, Dinner"
        value={description}
        onChangeText={setDescription}
        error={show('description')}
        autoCapitalize="sentences"
      />

      <Text style={styles.label}>Paid by</Text>
      <View style={styles.chips}>
        {hasFund ? (
          <Chip label="💰 Trip fund" selected={paidBy === FUND_ID} onPress={() => setPaidBy(FUND_ID)} />
        ) : null}
        {trip.members.map((m) => (
          <Chip key={m.id} label={m.name} selected={paidBy === m.id} onPress={() => setPaidBy(m.id)} />
        ))}
      </View>
      {show('paidBy') ? <Text style={styles.error}>{errors.paidBy}</Text> : null}
      {paidBy === FUND_ID ? (
        <Text style={[styles.fundInfo, amount && amount > fundLeft ? { color: colors.danger } : null]}>
          Fund has {formatMoney(fundLeft, trip.currency)} left
          {amount && amount > fundLeft
            ? `. The extra ${formatMoney(amount - Math.max(fundLeft, 0), trip.currency)} will count as paid by the fund holder.`
            : '.'}
        </Text>
      ) : null}

      <Text style={[styles.label, { marginTop: 8 }]}>Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={CATEGORY_LABELS[c]} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>

      <View style={{ marginTop: 8 }}>
        <Field
          label="Date"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
          keyboardType="numbers-and-punctuation"
          error={show('date')}
        />
      </View>

      <Text style={styles.hint}>Split equally among all {trip.members.length} members.</Text>

      <Button title={existing ? 'Save changes' : 'Add expense'} onPress={save} />
      {existing ? <Button title="Delete expense" variant="danger" onPress={remove} style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  amountInput: { fontSize: 26, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  fundInfo: { fontSize: 13, color: colors.textMuted, marginBottom: 8, lineHeight: 18 },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 16, textAlign: 'center' },
});
