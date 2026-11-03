import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, EmptyState, Field, SectionTitle, confirm } from '../../components/ui.tsx';
import { formatDate, todayISO } from '../../lib/id.ts';
import { currencySymbol, formatMoney, parseAmount } from '../../lib/money.ts';
import type { Settlement } from '../../lib/settlement.ts';
import { useTrips } from '../../store/TripsContext.tsx';
import { colors } from '../../theme.ts';
import type { Trip } from '../../types.ts';

const EVERYONE = '__everyone__';

export default function FundTab({
  trip,
  settlement,
  onGoToMembers,
}: {
  trip: Trip;
  settlement: Settlement;
  onGoToMembers: () => void;
}) {
  const { addContributions, deleteContribution, setFundHolder } = useTrips();
  const [amountText, setAmountText] = useState('');
  const [who, setWho] = useState(EVERYONE);
  const [submitted, setSubmitted] = useState(false);

  if (trip.members.length === 0) {
    return (
      <View style={styles.padded}>
        <EmptyState
          emoji="💰"
          title="Add members first"
          subtitle="Then record the advance money everyone puts into the trip fund."
        />
        <Button title="Add members" onPress={onGoToMembers} />
      </View>
    );
  }

  const fmt = (v: number) => formatMoney(v, trip.currency);
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown';
  const { fund } = settlement;
  const amount = parseAmount(amountText);
  const amountError = submitted && !amount ? 'Enter a valid amount (max 2 decimals)' : undefined;

  const add = () => {
    setSubmitted(true);
    if (!amount) return;
    const memberIds = who === EVERYONE ? trip.members.map((m) => m.id) : [who];
    addContributions(
      trip.id,
      memberIds.map((memberId) => ({ memberId, amount, date: todayISO() })),
    );
    setAmountText('');
    setSubmitted(false);
  };

  const sorted = [...trip.contributions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Collected</Text>
          <Text style={styles.summaryValue}>{fmt(fund.collected)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Spent from fund</Text>
          <Text style={styles.summaryValue}>{fmt(fund.spent)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Left</Text>
          <Text style={[styles.summaryValue, { color: fund.remaining < 0 ? colors.danger : colors.success }]}>
            {fmt(fund.remaining)}
          </Text>
        </View>
      </Card>
      {fund.remaining < 0 && fund.holderId ? (
        <Text style={styles.warning}>
          The fund is short by {fmt(-fund.remaining)}. This is counted as paid by {name(fund.holderId)}.
        </Text>
      ) : null}

      <SectionTitle>Add advance contribution</SectionTitle>
      <Card>
        <Field
          label={`Amount (${currencySymbol(trip.currency).trim()})`}
          placeholder="e.g. 2000"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          error={amountError}
        />
        <Text style={styles.label}>Contributed by</Text>
        <View style={styles.chips}>
          <Chip label="👥 Everyone" selected={who === EVERYONE} onPress={() => setWho(EVERYONE)} />
          {trip.members.map((m) => (
            <Chip key={m.id} label={m.name} selected={who === m.id} onPress={() => setWho(m.id)} />
          ))}
        </View>
        <Button
          title={
            who === EVERYONE && amount
              ? `Add ${fmt(amount)} × ${trip.members.length} = ${fmt(amount * trip.members.length)}`
              : 'Add contribution'
          }
          onPress={add}
          style={{ marginTop: 4 }}
        />
      </Card>

      {trip.contributions.length > 0 ? (
        <>
          <SectionTitle>Who holds the fund cash?</SectionTitle>
          <View style={styles.chips}>
            {trip.members.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={fund.holderId === m.id}
                onPress={() => setFundHolder(trip.id, m.id)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            Pay fund expenses by choosing “💰 Trip fund” as the payer. Any money left over is returned by the holder
            in the settlement.
          </Text>

          <SectionTitle>{trip.contributions.length} contributions</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {sorted.map((c, i) => (
              <View key={c.id} style={[styles.row, i > 0 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{name(c.memberId)}</Text>
                  <Text style={styles.meta}>{formatDate(c.date)}</Text>
                </View>
                <Text style={styles.rowAmount}>{fmt(c.amount)}</Text>
                <Pressable
                  hitSlop={10}
                  accessibilityLabel={`Delete contribution by ${name(c.memberId)}`}
                  onPress={() =>
                    confirm(
                      'Delete contribution?',
                      `${name(c.memberId)}'s ${fmt(c.amount)} contribution will be deleted.`,
                      'Delete',
                      () => deleteContribution(trip.id, c.id),
                    )
                  }
                >
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <Text style={[styles.hint, { marginTop: 16 }]}>
          Collected some money in advance? Add it here. Expenses can then be paid from the fund, and the
          settlement takes it into account.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  padded: { padding: 16 },
  content: { padding: 16, paddingBottom: 40 },
  summary: { flexDirection: 'row', paddingVertical: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  warning: { color: colors.danger, fontSize: 13, marginTop: 8, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
  remove: { color: colors.danger, fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
});
