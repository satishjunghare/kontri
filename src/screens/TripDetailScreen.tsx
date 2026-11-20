import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { EmptyState } from '../components/ui.tsx';
import { formatMoney } from '../lib/money.ts';
import { computeSettlement } from '../lib/settlement.ts';
import { hasCustomSplit } from '../lib/split.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { STOP_TYPES } from '../lib/plan.ts';
import { colors } from '../theme.ts';
import DetailsTab from './trip/DetailsTab.tsx';
import ExpensesTab from './trip/ExpensesTab.tsx';
import FundTab from './trip/FundTab.tsx';
import MembersTab from './trip/MembersTab.tsx';
import PlanTab from './trip/PlanTab.tsx';
import SettleTab from './trip/SettleTab.tsx';

type Tab = 'plan' | 'expenses' | 'fund' | 'members' | 'settle' | 'details';
const TABS: { key: Tab; label: string }[] = [
  { key: 'plan', label: '🗺️ Plan' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'fund', label: 'Fund' },
  { key: 'members', label: 'Members' },
  { key: 'settle', label: 'Settle' },
  { key: 'details', label: 'Details' },
];

export default function TripDetailScreen({ navigation, route }: ScreenProps<'TripDetail'>) {
  const { getTrip } = useTrips();
  const trip = getTrip(route.params.tripId);
  // New trips start on Members, since you need people before expenses.
  const tabScroll = useRef<ScrollViewInstance>(null);
  const tabX = useRef<Record<string, number>>({});
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

  // Keep the chosen tab visible in the scrolling tab row.
  useEffect(() => {
    const x = tabX.current[tab];
    if (x !== undefined) tabScroll.current?.scrollTo({ x: Math.max(0, x - 48), animated: true });
  }, [tab]);

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
          <Text style={styles.summaryLabel}>
            {trip.expenses.some(hasCustomSplit) ? 'Avg / person' : 'Per person'}
          </Text>
          <Text style={styles.summaryValue}>{formatMoney(perPerson, trip.currency)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Members</Text>
          <Text style={styles.summaryValue}>{trip.members.length}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <ScrollView ref={tabScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              onPress={() => setTab(t.key)}
              onLayout={(e) => {
                tabX.current[t.key] = e.nativeEvent.layout.x;
              }}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'plan' && (
          <PlanTab
            trip={trip}
            onAddStop={(dayId) => navigation.navigate('StopForm', { tripId: trip.id, dayId })}
            onOpenStop={(stopId) => {
              const stop = trip.planStops.find((s) => s.id === stopId);
              if (stop) navigation.navigate('StopForm', { tripId: trip.id, dayId: stop.dayId, stopId });
            }}
            onAddExpense={(stop) =>
              navigation.navigate('ExpenseForm', {
                tripId: trip.id,
                prefill: { description: stop.name, category: STOP_TYPES[stop.type].expenseCategory, amount: stop.budget },
              })
            }
          />
        )}
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
        {tab === 'details' && (
          <DetailsTab
            trip={trip}
            onEditTrip={() => navigation.navigate('TripForm', { tripId: trip.id })}
            onAddNote={() => navigation.navigate('NoteForm', { tripId: trip.id })}
            onOpenNote={(noteId) => navigation.navigate('NoteForm', { tripId: trip.id, noteId })}
            onOpenPhoto={(photoId) => navigation.navigate('PhotoViewer', { tripId: trip.id, photoId })}
          />
        )}
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
  },
  tabsInner: { padding: 4, gap: 2 },
  tab: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.card },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primaryDark },
});
