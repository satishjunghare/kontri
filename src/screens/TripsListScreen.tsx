import { useLayoutEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState } from '../components/ui.tsx';
import { formatDate } from '../lib/id.ts';
import { formatMoney } from '../lib/money.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { colors } from '../theme.ts';

export default function TripsListScreen({ navigation }: ScreenProps<'Trips'>) {
  const { trips, loaded } = useTrips();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('TripForm')} hitSlop={10}>
          <Text style={styles.headerAction}>+ New</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={trips}
      keyExtractor={(t) => t.id}
      ListEmptyComponent={
        <View>
          <EmptyState
            emoji="🧳"
            title="No trips yet"
            subtitle="Create a trip, add your friends, record who paid for what — FairShare tells everyone what they owe."
          />
          <Button title="Create your first trip" onPress={() => navigation.navigate('TripForm')} />
        </View>
      }
      renderItem={({ item }) => {
        const total = item.expenses.reduce((sum, e) => sum + e.amount, 0);
        const dates = [formatDate(item.startDate), formatDate(item.endDate)].filter(Boolean).join(' – ');
        return (
          <Pressable onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}>
            {({ pressed }) => (
              <Card style={[styles.tripCard, pressed && { opacity: 0.85 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    {item.members.length} member{item.members.length === 1 ? '' : 's'} · {item.expenses.length}{' '}
                    expense{item.expenses.length === 1 ? '' : 's'}
                    {dates ? ` · ${dates}` : ''}
                  </Text>
                </View>
                <Text style={styles.total}>{formatMoney(total, item.currency)}</Text>
              </Card>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  headerAction: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tripCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripName: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  total: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
});
