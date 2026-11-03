import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../components/ui.tsx';
import { formatMoney } from '../lib/money.ts';
import { computeSettlement } from '../lib/settlement.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { colors } from '../theme.ts';
import ExpensesTab from './trip/ExpensesTab.tsx';
import FundTab from './trip/FundTab.tsx';
import MembersTab from './trip/MembersTab.tsx';
import SettleTab from './trip/SettleTab.tsx';

type Tab = 'expenses' | 'fund' | 'members' | 'settle';
const TABS: { key: Tab; label: string }[] = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'fund', label: 'Fund' },
  { key: 'members', label: 'Members' },
  { key: 'settle', label: 'Settle' },
];

export default function TripDetailScreen({ navigation, route }: ScreenProps<'TripDetail'>) {
  const { getTrip } = useTrips();
  const trip = getTrip(route.params.tripId);
  // New trips start on Members, since you need people before expenses.
  const [tab, setTab] = useState<Tab>(trip && trip.members.length === 0 ? 'members' : 'expenses');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: trip?.name ?? 'Trip',
      headerRight: trip
        ? () => (
            <Pressable onPress={() => navigation.navigate('TripForm', { tripId: trip.id })} hitSlop={10}>
              <Text style={styles.headerAction}>Edit</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, trip]);

  const settlement = useMemo(
    () => (trip ? computeSettlement(trip.members, trip.expenses, trip.contributions, trip.fundHolderId) : null),
    [trip],
  );

  if (!trip || !settlement) {
    return <EmptyState emoji="🤷" title="Trip not found" subtitle="It may have been deleted." />;
  }

  const perPerson = trip.members.length ? Math.round(settlement.total / trip.members.length) : 0;

  return (
    <View style={styles.screen}>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total spent</Text>
          <Text style={styles.summaryValue}>{formatMoney(settlement.total, trip.currency)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Per person</Text>
          <Text style={styles.summaryValue}>{formatMoney(perPerson, trip.currency)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Members</Text>
          <Text style={styles.summaryValue}>{trip.members.length}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'expenses' && (
          <ExpensesTab
            trip={trip}
            onAdd={() => navigation.navigate('ExpenseForm', { tripId: trip.id })}
            onEdit={(expenseId) => navigation.navigate('ExpenseForm', { tripId: trip.id, expenseId })}
            onGoToMembers={() => setTab('members')}
          />
        )}
        {tab === 'fund' && (
          <FundTab trip={trip} settlement={settlement} onGoToMembers={() => setTab('members')} />
        )}
        {tab === 'members' && <MembersTab trip={trip} settlement={settlement} />}
        {tab === 'settle' && <SettleTab trip={trip} settlement={settlement} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerAction: { color: '#fff', fontSize: 16, fontWeight: '600' },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: colors.primarySoft, fontSize: 12, marginBottom: 2 },
  summaryValue: { color: '#fff', fontSize: 17, fontWeight: '700' },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  tabs: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.card },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primaryDark },
});
