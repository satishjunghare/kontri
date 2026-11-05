import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, EmptyState, Field, confirm } from '../components/ui.tsx';
import { isValidDate, todayISO } from '../lib/id.ts';
import { computeSplit } from '../lib/split.ts';
import { currencySymbol, formatMoney, minorToInput, parseAmount } from '../lib/money.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { CATEGORY_LABELS, colors } from '../theme.ts';
import { FUND_ID } from '../types.ts';
import type { ExpenseCategory } from '../types.ts';
import { useBottomInset } from '../components/useBottomInset.ts';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

export default function ExpenseFormScreen({ navigation, route }: ScreenProps<'ExpenseForm'>) {
  const bottomInset = useBottomInset();
  const { tripId, expenseId } = route.params;
  const { getTrip, addExpense, updateExpense, deleteExpense } = useTrips();
  const trip = getTrip(tripId);
  const existing = expenseId ? trip?.expenses.find((e) => e.id === expenseId) : undefined;

  const [description, setDescription] = useState(existing?.description ?? '');
  const [amountText, setAmountText] = useState(existing ? minorToInput(existing.amount) : '');
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? (trip?.members.length === 1 ? trip.members[0].id : ''));
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'food');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  // Custom amounts typed per member (text, so the user can edit freely). Missing key = auto.
  const [fixedText, setFixedText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(existing?.fixedShares ?? {}).map(([id, v]) => [id, minorToInput(v)])),
  );
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
  const memberIds = trip.members.map((m) => m.id);
  const fixedIds = memberIds.filter((id) => id in fixedText);
  const invalidFixed = fixedIds.filter((id) => parseAmount(fixedText[id], { allowZero: true }) === null);
  const fixedShares = Object.fromEntries(
    fixedIds.map((id) => [id, parseAmount(fixedText[id], { allowZero: true }) ?? 0]),
  );
  const split = computeSplit(amount ?? 0, memberIds, fixedShares);
  const fmt = (v: number) => formatMoney(v, trip.currency);
  const splitError = invalidFixed.length
    ? 'Enter a valid amount for each custom member (0 if not included)'
    : !amount || fixedIds.length === 0
      ? undefined
      : split.error === 'over'
        ? `Custom amounts are ${fmt(split.fixedTotal)} but the expense is ${fmt(amount)}`
        : split.error === 'unassigned'
          ? `${fmt(split.remaining)} is still unassigned. Change an amount or reset a member to auto.`
          : undefined;

  const setFixed = (id: string, text: string) => setFixedText((prev) => ({ ...prev, [id]: text }));
  const resetFixed = (id: string) =>
    setFixedText((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const errors = {
    description: description.trim() ? undefined : 'What was this for?',
    amount: amount ? undefined : 'Enter a valid amount (max 2 decimals)',
    paidBy: trip.members.some((m) => m.id === paidBy) || (hasFund && paidBy === FUND_ID) ? undefined : 'Select who paid',
    date: isValidDate(date) ? undefined : 'Use format YYYY-MM-DD',
    split: splitError,
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || !amount) return;
    const input = {
      description: description.trim(),
      amount,
      paidBy,
      category,
      date,
      fixedShares: fixedIds.length ? fixedShares : undefined,
    };
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
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: 40 + bottomInset }]} keyboardShouldPersistTaps="handled">
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

      <Text style={[styles.label, { marginTop: 8 }]}>Split</Text>
      <Card style={styles.splitCard}>
        {trip.members.map((m, i) => {
          const isFixed = m.id in fixedText;
          return (
            <View key={m.id} style={[styles.splitRow, i > 0 && styles.splitBorder]}>
              <Text style={styles.splitName} numberOfLines={1}>
                {m.name}
              </Text>
              <View style={[styles.splitInputWrap, isFixed && styles.splitInputFixed]}>
                <Text style={styles.splitSymbol}>{currencySymbol(trip.currency).trim()}</Text>
                <TextInput
                  accessibilityLabel={`${m.name}'s share`}
                  style={[styles.splitInput, isFixed && { fontWeight: '700' }]}
                  value={isFixed ? fixedText[m.id] : ''}
                  placeholder={amount ? minorToInput(split.shares[m.id]) || '0' : '—'}
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(t) => setFixed(m.id, t)}
                  onBlur={() => {
                    // An emptied custom field goes back to auto.
                    if (isFixed && fixedText[m.id].trim() === '') resetFixed(m.id);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {isFixed ? (
                <Pressable
                  onPress={() => resetFixed(m.id)}
                  hitSlop={10}
                  accessibilityLabel={`Reset ${m.name} to auto`}
                  style={styles.splitTag}
                >
                  <Text style={styles.splitReset}>✕</Text>
                </Pressable>
              ) : (
                <View style={styles.splitTag}>
                  <Text style={styles.splitAuto}>auto</Text>
                </View>
              )}
            </View>
          );
        })}
      </Card>
      {splitError && (submitted || split.error === 'over') ? (
        <Text style={styles.error}>{splitError}</Text>
      ) : (
        <Text style={styles.hint}>
          {fixedIds.length === 0
            ? `Split equally among all ${trip.members.length} members. Type an amount for anyone who should pay a different share.`
            : split.autoMemberIds.length
              ? `Custom ${fmt(split.fixedTotal)} · remaining ${fmt(Math.max(split.remaining, 0))} split equally among ${split.autoMemberIds.length}.`
              : `All members have custom amounts (${fmt(split.fixedTotal)}).`}
        </Text>
      )}

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
  error: { color: colors.danger, fontSize: 13, marginTop: 8, marginBottom: 8, lineHeight: 18 },
  fundInfo: { fontSize: 13, color: colors.textMuted, marginBottom: 8, lineHeight: 18 },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 8, marginBottom: 16, lineHeight: 18 },
  splitCard: { paddingVertical: 2, paddingHorizontal: 12 },
  splitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  splitBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  splitName: { flex: 1, fontSize: 16, color: colors.text },
  splitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
  },
  splitInputFixed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  splitSymbol: { fontSize: 15, color: colors.textMuted, marginRight: 4 },
  splitInput: { flex: 1, minWidth: 0, fontSize: 16, color: colors.text, paddingVertical: 8, textAlign: 'right' },
  splitTag: { width: 36, alignItems: 'center' },
  splitAuto: { fontSize: 12, color: colors.textMuted },
  splitReset: { fontSize: 16, color: colors.danger, fontWeight: '700' },
});
