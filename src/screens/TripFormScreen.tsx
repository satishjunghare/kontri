import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Field, confirm } from '../components/ui.tsx';
import { isValidDate } from '../lib/id.ts';
import { CURRENCIES } from '../lib/money.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { colors } from '../theme.ts';
import type { CurrencyCode } from '../types.ts';

export default function TripFormScreen({ navigation, route }: ScreenProps<'TripForm'>) {
  const tripId = route.params?.tripId;
  const { getTrip, createTrip, updateTrip, deleteTrip } = useTrips();
  const existing = tripId ? getTrip(tripId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [destination, setDestination] = useState(existing?.destination ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(existing?.currency ?? 'INR');
  const [startDate, setStartDate] = useState(existing?.startDate ?? '');
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit trip' : 'New trip' });
  }, [navigation, existing]);

  const errors = {
    name: name.trim() ? undefined : 'Please enter a trip name',
    startDate: startDate && !isValidDate(startDate) ? 'Use format YYYY-MM-DD' : undefined,
    endDate:
      endDate && !isValidDate(endDate)
        ? 'Use format YYYY-MM-DD'
        : startDate && endDate && endDate < startDate
          ? 'End date is before start date'
          : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = () => {
    setSubmitted(true);
    if (hasErrors) return;
    const input = {
      name: name.trim(),
      currency,
      destination: destination.trim() || undefined,
      description: description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    if (existing) {
      updateTrip(existing.id, input);
      navigation.goBack();
    } else {
      const trip = createTrip(input);
      // Replace the form with the new trip so "back" returns to the list.
      navigation.replace('TripDetail', { tripId: trip.id });
    }
  };

  const remove = () => {
    if (!existing) return;
    confirm('Delete trip?', `"${existing.name}" and all its expenses will be deleted.`, 'Delete', () => {
      deleteTrip(existing.id);
      navigation.popToTop();
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field
        label="Trip name"
        placeholder="e.g. Goa Trip 2026"
        value={name}
        onChangeText={setName}
        autoFocus={!existing}
        error={submitted ? errors.name : undefined}
        returnKeyType="done"
      />

      <Field
        label="Destination (optional)"
        placeholder="e.g. Pune, Goa, Manali"
        value={destination}
        onChangeText={setDestination}
        autoCapitalize="words"
      />
      <Field
        label="Description (optional)"
        placeholder="A line or two about the trip"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />

      <Text style={styles.label}>Currency</Text>
      <View style={styles.chips}>
        {CURRENCIES.map((c) => (
          <Chip key={c.code} label={`${c.symbol.trim()} ${c.code}`} selected={currency === c.code} onPress={() => setCurrency(c.code)} />
        ))}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="Start date (optional)"
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
            error={submitted ? errors.startDate : undefined}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="End date (optional)"
            placeholder="YYYY-MM-DD"
            value={endDate}
            onChangeText={setEndDate}
            error={submitted ? errors.endDate : undefined}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <Button title={existing ? 'Save changes' : 'Create trip'} onPress={save} style={{ marginTop: 8 }} />
      {existing ? <Button title="Delete trip" variant="danger" onPress={remove} style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
});
