import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, EmptyState, SectionTitle, confirm, notify } from '../../components/ui.tsx';
import { formatMoney } from '../../lib/money.ts';
import type { Settlement } from '../../lib/settlement.ts';
import { useTrips } from '../../store/TripsContext.tsx';
import { colors } from '../../theme.ts';
import type { Member, Trip } from '../../types.ts';

export default function MembersTab({ trip, settlement }: { trip: Trip; settlement: Settlement }) {
  const { addMember, removeMember } = useTrips();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter a name');
    if (trip.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return setError(`${trimmed} is already in this trip`);
    }
    addMember(trip.id, trimmed);
    setName('');
    setError(undefined);
  };

  const remove = (member: Member) => {
    if (trip.expenses.some((e) => e.paidBy === member.id)) {
      notify('Cannot remove', `${member.name} has paid for expenses. Delete or reassign those expenses first.`);
      return;
    }
    if (trip.contributions.some((c) => c.memberId === member.id)) {
      notify('Cannot remove', `${member.name} has contributed to the trip fund. Delete those contributions first.`);
      return;
    }
    confirm('Remove member?', `Remove ${member.name} from this trip?`, 'Remove', () => removeMember(trip.id, member.id));
  };

  const balanceOf = (id: string) => settlement.balances.find((b) => b.memberId === id);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, error ? { borderColor: colors.danger } : null]}
          placeholder="Friend's name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(undefined);
          }}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="words"
        />
        <Button title="Add" onPress={add} style={{ paddingHorizontal: 22 }} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {trip.members.length === 0 ? (
        <EmptyState emoji="👋" title="Who's on this trip?" subtitle="Add yourself and each friend sharing the expenses." />
      ) : (
        <>
          <SectionTitle>{trip.members.length} members</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {trip.members.map((m, i) => (
              <View key={m.id} style={[styles.memberRow, i > 0 && styles.memberBorder]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.meta}>
                    Paid {formatMoney(balanceOf(m.id)?.paid ?? 0, trip.currency)}
                    {balanceOf(m.id)?.contributed
                      ? ` · Advance ${formatMoney(balanceOf(m.id)!.contributed, trip.currency)}`
                      : ''}
                  </Text>
                </View>
                <Pressable onPress={() => remove(m)} hitSlop={10} accessibilityLabel={`Remove ${m.name}`}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  addRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  memberBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryDark, fontWeight: '700', fontSize: 16 },
  memberName: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  remove: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
