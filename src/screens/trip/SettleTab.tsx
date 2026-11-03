import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, SectionTitle, notify } from '../../components/ui.tsx';
import { formatMoney } from '../../lib/money.ts';
import type { Settlement } from '../../lib/settlement.ts';
import { buildShareText } from '../../lib/shareText.ts';
import { expenseShares, hasCustomSplit } from '../../lib/split.ts';
import { colors } from '../../theme.ts';
import { FUND_ID } from '../../types.ts';
import type { Trip } from '../../types.ts';

export default function SettleTab({ trip, settlement }: { trip: Trip; settlement: Settlement }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (trip.members.length === 0 || (settlement.total === 0 && settlement.fund.collected === 0)) {
    return (
      <EmptyState
        emoji="⚖️"
        title="Nothing to settle yet"
        subtitle="Add members and expenses, and the final contribution of each member will appear here."
      />
    );
  }

  const fmt = (v: number) => formatMoney(v, trip.currency);
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown';
  const text = buildShareText(trip, settlement);
  const memberIds = trip.members.map((m) => m.id);

  const shareWhatsApp = async () => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      notify('WhatsApp not available', 'Use “Share…” to send the summary another way.');
    }
  };

  const shareOther = async () => {
    try {
      await Share.share({ message: text, title: `${trip.name} settlement` });
    } catch {
      // Web browsers without the Share API: copy to clipboard instead.
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(text);
        notify('Copied', 'Settlement summary copied to clipboard.');
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle>Payments to settle</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {settlement.transfers.length === 0 ? (
          <Text style={styles.settled}>Everyone is settled 🎉</Text>
        ) : (
          settlement.transfers.map((t, i) => (
            <View key={`${t.from}-${t.to}`} style={[styles.transfer, i > 0 && styles.border]}>
              <Text style={styles.transferText}>
                <Text style={styles.bold}>{name(t.from)}</Text>
                <Text style={styles.muted}> pays </Text>
                <Text style={styles.bold}>{name(t.to)}</Text>
              </Text>
              <Text style={styles.transferAmount}>{fmt(t.amount)}</Text>
            </View>
          ))
        )}
      </Card>

      {settlement.fund.collected > 0 || settlement.fund.spent > 0 ? (
        <>
          <SectionTitle>Advance fund</SectionTitle>
          <Card>
            <Text style={styles.fundLine}>
              Collected {fmt(settlement.fund.collected)} · Spent {fmt(settlement.fund.spent)}
            </Text>
            {settlement.fund.holderId ? (
              <Text style={styles.muted}>
                {settlement.fund.remaining > 0
                  ? `${name(settlement.fund.holderId)} holds the ${fmt(settlement.fund.remaining)} left over. It is returned through the payments above.`
                  : settlement.fund.remaining < 0
                    ? `${name(settlement.fund.holderId)} covered the ${fmt(-settlement.fund.remaining)} shortfall. It is paid back through the payments above.`
                    : 'The fund is fully used.'}
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle>Each member&apos;s contribution</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {settlement.balances.map((b, i) => (
          <View key={b.memberId} style={i > 0 && styles.border}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: expanded === b.memberId }}
            onPress={() => setExpanded(expanded === b.memberId ? null : b.memberId)}
            style={styles.balanceRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{name(b.memberId)}</Text>
              <Text style={styles.muted}>
                Paid {fmt(b.paid)}
                {b.contributed ? ` · Advance ${fmt(b.contributed)}` : ''} · Share {fmt(b.share)}
              </Text>
              {b.fundHeld > 0 ? <Text style={styles.muted}>Holding {fmt(b.fundHeld)} fund cash</Text> : null}
              {b.fundHeld < 0 ? <Text style={styles.muted}>Covered {fmt(-b.fundHeld)} fund shortfall</Text> : null}
            </View>
            <View
              style={[
                styles.badge,
                b.balance > 0 ? styles.badgeGet : b.balance < 0 ? styles.badgeOwe : styles.badgeEven,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: b.balance > 0 ? colors.success : b.balance < 0 ? colors.danger : colors.textMuted },
                ]}
              >
                {b.balance > 0 ? `Gets ${fmt(b.balance)}` : b.balance < 0 ? `Owes ${fmt(-b.balance)}` : 'Settled'}
              </Text>
            </View>
          </Pressable>
          {expanded === b.memberId ? (
            <View style={styles.breakdown}>
              {trip.expenses.length === 0 ? (
                <Text style={styles.muted}>No expenses yet.</Text>
              ) : (
                trip.expenses.map((e) => {
                  const part = expenseShares(e, memberIds)[b.memberId] ?? 0;
                  return (
                    <View key={e.id} style={styles.breakdownRow}>
                      <Text style={[styles.breakdownText, part === 0 && styles.breakdownZero]} numberOfLines={1}>
                        {e.description}
                        {e.paidBy === FUND_ID ? ' 💰' : ''}
                        {hasCustomSplit(e) ? ' · custom' : ''}
                      </Text>
                      <Text style={[styles.breakdownAmount, part === 0 && styles.breakdownZero]}>{fmt(part)}</Text>
                    </View>
                  );
                })
              )}
              <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                <Text style={styles.bold}>Total share</Text>
                <Text style={styles.bold}>{fmt(b.share)}</Text>
              </View>
            </View>
          ) : null}
          </View>
        ))}
      </Card>
      <Text style={[styles.muted, { marginTop: 8 }]}>Tap a member to see their share of each expense.</Text>

      <Button title="Share on WhatsApp" onPress={shareWhatsApp} style={{ marginTop: 24 }} />
      <Button title="Share…" variant="secondary" onPress={shareOther} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  settled: { paddingVertical: 14, fontSize: 16, color: colors.success, textAlign: 'center', fontWeight: '600' },
  transfer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 8 },
  transferText: { flex: 1, fontSize: 16 },
  transferAmount: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  fundLine: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  bold: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  breakdown: { paddingBottom: 12, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: colors.primarySoft, marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 },
  breakdownText: { flex: 1, fontSize: 14, color: colors.text },
  breakdownAmount: { fontSize: 14, color: colors.text, fontWeight: '600' },
  breakdownZero: { color: colors.textMuted },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeGet: { backgroundColor: colors.successSoft },
  badgeOwe: { backgroundColor: colors.dangerSoft },
  badgeEven: { backgroundColor: colors.border },
  badgeText: { fontSize: 13, fontWeight: '700' },
});
