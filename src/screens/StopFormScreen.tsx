import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import MapPickerModal from '../components/MapPickerModal.tsx';
import TimeField from '../components/TimeField.tsx';
import { Button, Card, Chip, EmptyState, Field, confirm } from '../components/ui.tsx';
import { useBottomInset } from '../components/useBottomInset.ts';
import type { MapMarker } from '../components/planMapTypes.ts';
import { useTravelSuggestion } from '../hooks/useTravelSuggestion.ts';
import { resolveMapText, searchPlaces } from '../lib/geo.ts';
import type { PlaceResult } from '../lib/geo.ts';
import { currencySymbol, minorToInput, parseAmount } from '../lib/money.ts';
import {
  STOP_TYPES,
  STOP_TYPE_ORDER,
  dayColor,
  dayStops,
  defaultNextStartMin,
  effectiveTravelMin,
  formatDuration,
  formatTime,
  hasLocation,
  legKey,
  navigateUrl,
  parseDuration,
  stopEndMin,
} from '../lib/plan.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { colors } from '../theme.ts';
import type { StopType } from '../types.ts';

const DURATION_CHIPS = [15, 30, 60, 90, 120, 180, 600];

export default function StopFormScreen({ navigation, route }: ScreenProps<'StopForm'>) {
  const { tripId, stopId } = route.params;
  const { getTrip, addStop, updateStop, deleteStop, moveStopToDay, setStopSuggestion } = useTrips();
  const bottomInset = useBottomInset();
  const trip = getTrip(tripId);
  const existing = stopId ? trip?.planStops.find((s) => s.id === stopId) : undefined;

  const [type, setType] = useState<StopType>(existing?.type ?? 'place');
  const [name, setName] = useState(existing?.name ?? '');
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(
    existing && hasLocation(existing) ? { lat: existing.lat, lng: existing.lng, address: existing.address } : null,
  );
  const [dayId, setDayId] = useState(existing?.dayId ?? route.params.dayId);
  const [startState, setStartState] = useState(existing?.startMin ?? 9 * 60);
  // A new stop's start follows the previous stop's end plus travel, until you pick a time yourself.
  const [startTouched, setStartTouched] = useState(!!existing);
  const [durationText, setDurationText] = useState(formatDuration(existing?.durationMin ?? STOP_TYPES.place.defaultDurationMin));
  const [durationTouched, setDurationTouched] = useState(!!existing);
  const [travelText, setTravelText] = useState(existing?.travelUserMin !== undefined ? formatDuration(existing.travelUserMin) : '');
  const [budgetText, setBudgetText] = useState(existing?.budget ? minorToInput(existing.budget) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [shift, setShift] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Location tools
  const [tool, setTool] = useState<'none' | 'search' | 'paste'>('none');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; items: PlaceResult[] } | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string>();
  const [showPicker, setShowPicker] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit stop' : 'Add stop' });
  }, [navigation, existing]);

  // Stops of the chosen day (without this one), and the stop that comes before this one.
  const planStops = trip?.planStops ?? [];
  const dayList = dayStops(planStops, dayId);
  const others = dayList.filter((s) => s.id !== stopId);
  const sameDayEdit = !!existing && existing.dayId === dayId;
  const index = sameDayEdit ? dayList.findIndex((s) => s.id === stopId) : -1;
  // Editing in place: the stop before this one. Adding, or moving to another day: the last stop of that day.
  const prev = sameDayEdit ? dayList[index - 1] : others[others.length - 1];
  const laterCount = sameDayEdit ? dayList.length - 1 - index : 0;

  const prevPoint = prev && hasLocation(prev) ? { lat: prev.lat, lng: prev.lng } : null;
  const fresh = useTravelSuggestion(prevPoint, location);
  const storedSuggestion =
    existing?.suggestion && prevPoint && location && existing.suggestion.key === legKey(prevPoint, location) ? existing.suggestion : undefined;
  const suggestion = fresh.suggestion ?? storedSuggestion ?? null;

  // Search the place names (after a short pause in typing). Results are tied to the text they answer.
  const anyLocated = planStops.find(hasLocation);
  const nearPoint = location ?? prevPoint ?? (anyLocated ? { lat: anyLocated.lat, lng: anyLocated.lng } : undefined);
  const nearLat = nearPoint?.lat;
  const nearLng = nearPoint?.lng;
  useEffect(() => {
    if (tool !== 'search' || query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlaces(query, nearLat !== undefined && nearLng !== undefined ? { lat: nearLat, lng: nearLng } : undefined).then((items) => {
        if (!cancelled) setFound({ query, items });
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tool, query, nearLat, nearLng]);
  const searching = tool === 'search' && query.trim().length >= 2 && found?.query !== query;

  if (!trip) return <EmptyState emoji="🤷" title="Trip not found" />;

  // Times
  const durationMin = parseDuration(durationText);
  const travelTrim = travelText.trim();
  const travelUserMin = travelTrim ? parseDuration(travelTrim) : undefined;
  const travelInvalid = travelTrim !== '' && travelUserMin === null;
  const ownTravel = travelUserMin ?? undefined; // null (not understood) counts as none
  const travelForTiming = ownTravel ?? suggestion?.min ?? 0;
  const autoStart = defaultNextStartMin(prev, travelForTiming);
  const startMin = startTouched ? startState : autoStart;
  const endsPastMidnight = durationMin !== null && startMin + durationMin >= 24 * 60;

  // Is there enough time between the previous stop and this one?
  const gap = prev ? startMin - stopEndMin(prev) : null;
  const needed = effectiveTravelMin({ travelUserMin: ownTravel, suggestion: suggestion ?? undefined });
  const tight = prev && gap !== null && needed > 0 && gap < needed;
  const fitStart = prev ? Math.min(stopEndMin(prev) + needed, 24 * 60 - 1) : null;

  const budget = budgetText.trim() ? parseAmount(budgetText, { allowZero: true }) : undefined;
  const errors = {
    name: name.trim() ? undefined : 'What is this stop called?',
    duration: durationMin !== null && durationMin > 0 ? undefined : 'Enter how long you will stay, like 1h 30m',
    travel: travelInvalid ? 'Enter a time like 1h 15m or 45' : undefined,
    budget: budget === null ? 'Enter a valid amount' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  const changeType = (t: StopType) => {
    setType(t);
    if (!durationTouched) setDurationText(formatDuration(STOP_TYPES[t].defaultDurationMin));
  };

  const pickResult = (r: PlaceResult) => {
    setLocation({ lat: r.lat, lng: r.lng, address: r.detail ? `${r.name}, ${r.detail}` : r.name });
    if (!name.trim()) setName(r.name);
    setTool('none');
  };

  const findFromLink = async () => {
    setPasteBusy(true);
    setPasteError(undefined);
    const point = await resolveMapText(pasteText);
    setPasteBusy(false);
    if (!point) {
      setPasteError("Couldn't find a location in that. Paste a Google Maps link, or coordinates like 18.52, 73.85.");
      return;
    }
    setLocation({ lat: point.lat, lng: point.lng, address: point.name });
    if (!name.trim() && point.name) setName(point.name);
    setTool('none');
    setPasteText('');
  };

  const save = () => {
    setSubmitted(true);
    if (hasErrors || durationMin === null) return;
    const common = {
      type,
      name: name.trim(),
      address: location?.address,
      lat: location?.lat,
      lng: location?.lng,
      startMin,
      durationMin,
      notes: notes.trim() || undefined,
      budget: budget ?? undefined,
    };
    if (existing) {
      if (dayId !== existing.dayId) moveStopToDay(trip.id, existing.id, dayId);
      updateStop(trip.id, existing.id, { ...common, travelUserMin: travelUserMin ?? null }, shift && laterCount > 0 && dayId === existing.dayId);
      if (suggestion) setStopSuggestion(trip.id, existing.id, suggestion);
    } else {
      addStop(trip.id, { ...common, dayId, travelUserMin: travelUserMin ?? undefined, suggestion: suggestion ?? undefined });
    }
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    confirm('Delete stop?', `"${existing.name}" will be removed from the plan.`, 'Delete', () => {
      deleteStop(trip.id, existing.id);
      navigation.goBack();
    });
  };

  const addAsExpense = () => {
    if (!existing) return;
    navigation.navigate('ExpenseForm', {
      tripId: trip.id,
      prefill: { description: existing.name, category: STOP_TYPES[existing.type].expenseCategory, amount: existing.budget },
    });
  };

  // Other located stops, shown on the map picker for context.
  const contextMarkers: MapMarker[] = trip.planDays.flatMap((d, di) =>
    dayStops(planStops, d.id)
      .filter((s) => s.id !== stopId)
      .flatMap((s, i) => (hasLocation(s) ? [{ id: s.id, lat: s.lat, lng: s.lng, label: String(i + 1), sub: formatTime(s.startMin), color: dayColor(di) }] : [])),
  );

  const kmText = suggestion ? ` · ${suggestion.km.toFixed(suggestion.km < 10 ? 1 : 0)} km` : '';

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: 40 + bottomInset }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Type</Text>
        <View style={styles.chips}>
          {STOP_TYPE_ORDER.map((t) => (
            <Chip key={t} label={`${STOP_TYPES[t].icon} ${STOP_TYPES[t].label}`} selected={type === t} onPress={() => changeType(t)} />
          ))}
        </View>

        <Field
          label="Name"
          placeholder={type === 'meal' ? 'e.g. Lunch at Kenjalgad' : type === 'stay' ? 'e.g. Night stay at Paratwadi' : 'e.g. Rohida Fort'}
          value={name}
          onChangeText={setName}
          autoFocus={!existing}
          autoCapitalize="words"
          error={show('name')}
        />

        {/* Location */}
        <Text style={styles.label}>Location</Text>
        <Card style={{ gap: 10, marginBottom: 16 }}>
          {location && tool === 'none' ? (
            <>
              <Text style={styles.locName}>📍 {location.address ?? 'Pinned location'}</Text>
              <Text style={styles.muted}>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </Text>
              <View style={styles.row}>
                <Button title="Change" variant="secondary" onPress={() => setTool('search')} style={styles.small} />
                <Button title="Remove" variant="danger" onPress={() => setLocation(null)} style={styles.small} />
                <Button title="Open in Maps" variant="secondary" onPress={() => Linking.openURL(navigateUrl({ name, lat: location.lat, lng: location.lng }))} style={styles.small} />
              </View>
            </>
          ) : (
            <>
              {tool === 'none' ? (
                <>
                  <Text style={styles.muted}>Add where it is to see it on the map and get a travel-time suggestion. It is optional.</Text>
                  <View style={styles.row}>
                    <Button
                      title="🔍 Search"
                      variant="secondary"
                      onPress={() => {
                        setQuery(name);
                        setTool('search');
                      }}
                      style={styles.small}
                    />
                    <Button title="📌 Pick on map" variant="secondary" onPress={() => setShowPicker(true)} style={styles.small} />
                    <Button title="🔗 Paste link" variant="secondary" onPress={() => setTool('paste')} style={styles.small} />
                  </View>
                </>
              ) : null}

              {tool === 'search' ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Search for a place"
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    returnKeyType="search"
                  />
                  {searching ? (
                    <View style={styles.row}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={styles.muted}>Searching…</Text>
                    </View>
                  ) : null}
                  {found?.query === query && found.items.length === 0 ? (
                    <Text style={styles.muted}>
                      No results. Small places are sometimes missing from the map data. Try “Pick on map” or paste a Google Maps link.
                    </Text>
                  ) : null}
                  {found?.query === query
                    ? found.items.map((r, i) => (
                        <Pressable key={`${r.lat},${r.lng},${i}`} onPress={() => pickResult(r)} style={styles.result} accessibilityRole="button" accessibilityLabel={`Use ${r.name}`}>
                          <Text style={styles.resultName}>{r.name}</Text>
                          {r.detail ? <Text style={styles.muted}>{r.detail}</Text> : null}
                        </Pressable>
                      ))
                    : null}
                  <View style={styles.row}>
                    <Button title="📌 Pick on map" variant="secondary" onPress={() => setShowPicker(true)} style={styles.small} />
                    <Button title="🔗 Paste link" variant="secondary" onPress={() => setTool('paste')} style={styles.small} />
                    <Button title="Close" variant="secondary" onPress={() => setTool('none')} style={styles.small} />
                  </View>
                </>
              ) : null}

              {tool === 'paste' ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Paste a Google Maps link or coordinates"
                    placeholderTextColor={colors.textMuted}
                    value={pasteText}
                    onChangeText={(t) => {
                      setPasteText(t);
                      setPasteError(undefined);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  <Text style={styles.muted}>In Google Maps, open the place, tap Share, then Copy link, and paste it here.</Text>
                  {pasteError ? <Text style={styles.error}>{pasteError}</Text> : null}
                  <View style={styles.row}>
                    <Button title={pasteBusy ? 'Finding…' : 'Find location'} onPress={findFromLink} disabled={pasteBusy || !pasteText.trim()} style={styles.small} />
                    <Button title="Close" variant="secondary" onPress={() => setTool('none')} style={styles.small} />
                  </View>
                </>
              ) : null}
            </>
          )}
        </Card>

        {/* Day */}
        {trip.planDays.length > 1 ? (
          <>
            <Text style={styles.label}>Day</Text>
            <View style={styles.chips}>
              {trip.planDays.map((d) => (
                <Chip key={d.id} label={d.label} selected={dayId === d.id} onPress={() => setDayId(d.id)} />
              ))}
            </View>
          </>
        ) : null}

        {/* Travel from the previous stop: your estimate and the app's calculation, side by side but separate */}
        {prev ? (
          <>
            <Text style={styles.label}>Travel from “{prev.name}”</Text>
            <Card style={{ gap: 12, marginBottom: 16 }}>
              <View>
                <Text style={styles.subLabel}>Your estimate</Text>
                <TextInput
                  accessibilityLabel="Your travel time estimate"
                  style={[styles.input, errors.travel && submitted ? { borderColor: colors.danger } : null]}
                  placeholder="e.g. 1h 15m"
                  placeholderTextColor={colors.textMuted}
                  value={travelText}
                  onChangeText={setTravelText}
                  autoCapitalize="none"
                />
                {show('travel') ? <Text style={styles.error}>{errors.travel}</Text> : null}
              </View>
              <View style={styles.suggestBox}>
                <Text style={styles.subLabel}>App’s calculation</Text>
                {suggestion ? (
                  <View style={styles.suggestRow}>
                    <Text style={styles.suggestText}>
                      {suggestion.source === 'estimate' ? '~' : ''}
                      {formatDuration(suggestion.min)}
                      {kmText}
                    </Text>
                    <Button title="Use this" variant="secondary" onPress={() => setTravelText(formatDuration(suggestion.min))} style={styles.useButton} />
                  </View>
                ) : fresh.calculating ? (
                  <View style={styles.row}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.muted}>Calculating…</Text>
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    {prevPoint ? 'Add this stop’s location to get a calculation.' : `Add a location to “${prev.name}” and to this stop to get a calculation.`}
                  </Text>
                )}
                {suggestion?.source === 'estimate' ? (
                  <Text style={styles.muted}>Rough straight-line guess (no internet). It improves when you are online.</Text>
                ) : null}
              </View>
              {travelUserMin === undefined && suggestion ? <Text style={styles.muted}>No estimate from you yet, so the app’s time is used for the timeline.</Text> : null}
            </Card>
          </>
        ) : null}

        {/* Times */}
        <View style={styles.row2}>
          <TimeField
            label="Start"
            valueMin={startMin}
            onChange={(m) => {
              setStartState(m);
              setStartTouched(true);
            }}
          />
          <View style={{ flex: 1 }}>
            <Field
              label="Stay for"
              placeholder="e.g. 1h 30m"
              value={durationText}
              onChangeText={(t) => {
                setDurationText(t);
                setDurationTouched(true);
              }}
              autoCapitalize="none"
              error={show('duration')}
            />
          </View>
        </View>
        <View style={[styles.chips, { marginBottom: 6 }]}>
          {DURATION_CHIPS.map((m) => (
            <Chip
              key={m}
              label={formatDuration(m)}
              selected={durationMin === m}
              onPress={() => {
                setDurationText(formatDuration(m));
                setDurationTouched(true);
              }}
            />
          ))}
        </View>
        {durationMin !== null && durationMin > 0 ? (
          <Text style={styles.muted}>
            Ends at {formatTime(startMin + durationMin)}
            {endsPastMidnight ? ' (next day)' : ''}
          </Text>
        ) : null}
        {!startTouched && prev ? <Text style={[styles.muted, { marginTop: 2 }]}>Start time follows the previous stop plus travel until you pick a time.</Text> : null}

        {tight && fitStart !== null ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠️ Not enough time to get here: travel needs {formatDuration(needed)} but there are only {formatDuration(Math.max(gap ?? 0, 0))} after “{prev?.name}”.
            </Text>
            <Button
              title={`Start at ${formatTime(fitStart)}`}
              variant="secondary"
              onPress={() => {
                setStartState(fitStart);
                setStartTouched(true);
              }}
              style={styles.small}
            />
          </View>
        ) : null}

        <View style={{ height: 16 }} />
        <Field
          label={`Planned budget (${currencySymbol(trip.currency).trim()}, optional)`}
          placeholder="e.g. 600"
          value={budgetText}
          onChangeText={setBudgetText}
          keyboardType="decimal-pad"
          error={show('budget')}
        />
        <Field
          label="Notes (optional)"
          placeholder="Tickets, booking details, things to remember…"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        {existing && laterCount > 0 && dayId === existing.dayId ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Move later stops too</Text>
              <Text style={styles.muted}>
                If this stop starts later, runs longer or takes longer to reach, the {laterCount} stop{laterCount === 1 ? '' : 's'} after it move by the same amount.
              </Text>
            </View>
            <Switch value={shift} onValueChange={setShift} trackColor={{ true: colors.primary }} />
          </View>
        ) : null}

        <Button title={existing ? 'Save changes' : 'Add stop'} onPress={save} />
        {existing ? (
          <>
            <Button title="💰 Add as expense" variant="secondary" onPress={addAsExpense} style={{ marginTop: 12 }} />
            <Button title="Delete stop" variant="danger" onPress={remove} style={{ marginTop: 12 }} />
          </>
        ) : null}
      </ScrollView>

      {showPicker ? (
        <MapPickerModal
          initial={location ?? undefined}
          others={contextMarkers}
          onClose={() => setShowPicker(false)}
          onPick={(p) => {
            setLocation({ lat: p.lat, lng: p.lng, address: p.address ?? p.name });
            if (!name.trim() && p.name) setName(p.name);
            setShowPicker(false);
            setTool('none');
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  subLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  small: { paddingVertical: 9, paddingHorizontal: 12 },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, marginTop: 4, lineHeight: 18 },
  locName: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
  },
  result: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  resultName: { fontSize: 16, fontWeight: '600', color: colors.text },
  suggestBox: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, gap: 6 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  suggestText: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  useButton: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#fff' },
  warning: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, gap: 8, marginTop: 10, alignItems: 'flex-start' },
  warningText: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  switchLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
});
