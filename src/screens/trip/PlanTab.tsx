import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import PlanMap from '../../components/PlanMap';
import type { MapLeg, MapLine, MapMarker } from '../../components/planMapTypes.ts';
import { Button, Card, Chip, EmptyState, confirm, notify } from '../../components/ui.tsx';
import { useBottomInset } from '../../components/useBottomInset.ts';
import { calculateTravel } from '../../lib/geo.ts';
import { todayISO } from '../../lib/id.ts';
import { formatMoney } from '../../lib/money.ts';
import {
  STOP_TYPES,
  addDaysISO,
  buildPlanShareText,
  computeDayStats,
  computeWarnings,
  currentAndNext,
  dayColor,
  dayRouteUrl,
  dayStops,
  fittingStartMin,
  formatDayDate,
  formatDuration,
  formatRange,
  formatTime,
  hasLocation,
  isSuggestionCurrent,
  legKey,
  navigateUrl,
  nextDayDate,
  nextDayLabel,
  parseDuration,
  plannedBudget,
  stopEndMin,
} from '../../lib/plan.ts';
import type { StopWarning } from '../../lib/plan.ts';
import { useTrips } from '../../store/TripsContext.tsx';
import { colors } from '../../theme.ts';
import type { PlanStop, Trip } from '../../types.ts';

export default function PlanTab({
  trip,
  onAddStop,
  onOpenStop,
  onAddExpense,
}: {
  trip: Trip;
  onAddStop: (dayId: string) => void;
  onOpenStop: (stopId: string) => void;
  onAddExpense: (stop: PlanStop) => void;
}) {
  const { addDay, updateDay, deleteDay, updateStop, moveStop, setStopSuggestion } = useTrips();
  const bottomInset = useBottomInset();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [mapDay, setMapDay] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [dayLabel, setDayLabel] = useState('');
  const [dayDate, setDayDate] = useState('');
  const [editingLeg, setEditingLeg] = useState<string | null>(null);
  const [legText, setLegText] = useState('');
  const [now, setNow] = useState(() => new Date());

  // Keep "now / next" current while the tab is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Fill in the app's own travel calculation for every leg whose two places are known.
  // It is stored next to (never instead of) your own estimate.
  const attempted = useRef(new Set<string>());
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    (async () => {
      for (const day of trip.planDays) {
        const stops = dayStops(trip.planStops, day.id);
        for (let i = 1; i < stops.length; i++) {
          const from = stops[i - 1];
          const to = stops[i];
          if (!hasLocation(from) || !hasLocation(to)) continue;
          const key = `${to.id}|${legKey(from, to)}`;
          // A rough offline guess is tried again once per visit to this tab, in case we are online now.
          const current = isSuggestionCurrent(to, from);
          if (current && (to.suggestion?.source === 'road' || attempted.current.has(key))) continue;
          if (inFlight.current.has(key)) continue;
          inFlight.current.add(key);
          attempted.current.add(key);
          const suggestion = await calculateTravel(from, to);
          inFlight.current.delete(key);
          setStopSuggestion(trip.id, to.id, suggestion);
        }
      }
    })();
  }, [trip.id, trip.planDays, trip.planStops, setStopSuggestion]);

  const days = trip.planDays;
  const planned = plannedBudget(trip.planStops);
  const spent = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const fmt = (v: number) => formatMoney(v, trip.currency);

  // ---- days ----
  const startDay = (label: string, date: string | undefined) => {
    const day = addDay(trip.id, { label, date });
    onAddStop(day.id);
  };
  const addNextDay = () => addDay(trip.id, { label: nextDayLabel(days), date: nextDayDate(days, trip.startDate) });
  const beginEditDay = (id: string) => {
    const d = days.find((x) => x.id === id);
    if (!d) return;
    setEditingDay(id);
    setDayLabel(d.label);
    setDayDate(d.date ?? '');
  };
  const saveDay = () => {
    if (editingDay) updateDay(trip.id, editingDay, { label: dayLabel, date: /^\d{4}-\d{2}-\d{2}$/.test(dayDate.trim()) ? dayDate.trim() : undefined });
    setEditingDay(null);
  };
  const removeDay = (id: string) => {
    const d = days.find((x) => x.id === id);
    const n = dayStops(trip.planStops, id).length;
    confirm('Delete day?', `"${d?.label}"${n ? ` and its ${n} stop${n === 1 ? '' : 's'}` : ''} will be removed from the plan.`, 'Delete', () => {
      deleteDay(trip.id, id);
      setEditingDay(null);
    });
  };

  // ---- sharing ----
  const sharePlan = async () => {
    const text = buildPlanShareText(trip);
    try {
      await Share.share({ message: text, title: `${trip.name} plan` });
    } catch {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(text);
        notify('Copied', 'The trip plan was copied to the clipboard.');
      }
    }
  };

  // ---- travel estimate typed on a leg ----
  const saveLeg = (stop: PlanStop) => {
    const text = legText.trim();
    const minutes = text ? parseDuration(text) : null;
    if (text && minutes === null) {
      notify('Not a time', 'Enter a time like 1h 15m or 45.');
      return;
    }
    // Only records your estimate; no times move. Any resulting clash shows as a warning you can fix.
    updateStop(trip.id, stop.id, { travelUserMin: minutes }, false);
    setEditingLeg(null);
  };

  // ---- now / next ----
  const today = todayISO();
  const todayDay = days.find((d) => d.date === today);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowNext = todayDay ? currentAndNext(dayStops(trip.planStops, todayDay.id), nowMin) : null;
  const todayStops = todayDay ? dayStops(trip.planStops, todayDay.id) : [];
  const dayFinished = !!todayDay && todayStops.length > 0 && !nowNext?.now && !nowNext?.next && nowMin >= stopEndMin(todayStops[todayStops.length - 1]);

  // ---- map data ----
  const shownDays = days.map((d, i) => ({ day: d, color: dayColor(i) })).filter((x) => mapDay === 'all' || x.day.id === mapDay);
  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  const legs: MapLeg[] = [];
  let unlocated = 0;
  for (const { day, color } of shownDays) {
    const stops = dayStops(trip.planStops, day.id);
    stops.forEach((s, i) => {
      if (!hasLocation(s)) {
        unlocated++;
        return;
      }
      markers.push({ id: s.id, lat: s.lat, lng: s.lng, label: String(i + 1), sub: formatTime(s.startMin), color });
      const before = stops[i - 1];
      if (before && hasLocation(before)) {
        lines.push({ coords: [[before.lat, before.lng], [s.lat, s.lng]], color });
        const own = s.travelUserMin;
        const sug = s.suggestion && isSuggestionCurrent(s, before) ? s.suggestion : undefined;
        const text = own !== undefined ? formatDuration(own) : sug ? `${sug.source === 'estimate' ? '~' : ''}${formatDuration(sug.min)}` : '';
        if (text) legs.push({ lat: (before.lat + s.lat) / 2, lng: (before.lng + s.lng) / 2, text: `🚗 ${text}`, color });
      }
    });
  }
  const selected = selectedId ? trip.planStops.find((s) => s.id === selectedId) : undefined;
  const fitKey = `${mapDay}|${markers.map((m) => m.id).join(',')}`;

  if (days.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + bottomInset }]}>
        <EmptyState
          emoji="🗺️"
          title="Plan your trip"
          subtitle="Add the places you will visit, with times, plus meals, shopping and stays. See them on a map with travel times."
        />
        <Button title="Start with Day 1" onPress={() => startDay('Day 1', trip.startDate)} />
        <Button
          title="Add a Day 0 (night travel)"
          variant="secondary"
          onPress={() => startDay('Day 0', trip.startDate ? addDaysISO(trip.startDate, -1) : undefined)}
          style={{ marginTop: 10 }}
        />
        <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>Use Day 0 when you travel the night before, like leaving at 8 PM.</Text>
      </ScrollView>
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      <View style={styles.segment}>
        {(['list', 'map'] as const).map((v) => (
          <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }} style={[styles.segButton, view === v && styles.segActive]}>
            <Text style={[styles.segText, view === v && styles.segTextActive]}>{v === 'list' ? '☰ List' : '🗺️ Map'}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={sharePlan} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share plan">
        <Text style={styles.shareText}>📤 Share</Text>
      </Pressable>
    </View>
  );

  // ================= MAP VIEW =================
  if (view === 'map') {
    return (
      <View style={{ flex: 1 }}>
        {toolbar}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayChips} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <Chip label="All days" selected={mapDay === 'all'} onPress={() => { setMapDay('all'); setSelectedId(null); }} />
          {days.map((d, i) => (
            <Pressable
              key={d.id}
              onPress={() => { setMapDay(d.id); setSelectedId(null); }}
              style={[styles.dayChip, mapDay === d.id && { backgroundColor: dayColor(i), borderColor: dayColor(i) }]}
              accessibilityRole="button"
              accessibilityState={{ selected: mapDay === d.id }}
            >
              <View style={[styles.dot, { backgroundColor: mapDay === d.id ? '#fff' : dayColor(i) }]} />
              <Text style={[styles.dayChipText, mapDay === d.id && { color: '#fff', fontWeight: '700' }]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flex: 1 }}>
          {markers.length > 0 ? (
            <PlanMap markers={markers} lines={lines} legs={legs} selectedId={selectedId} fitKey={fitKey} onMarkerPress={setSelectedId} />
          ) : (
            <View style={styles.noMap}>
              <Text style={styles.noMapEmoji}>📍</Text>
              <Text style={styles.noMapTitle}>No stops on the map yet</Text>
              <Text style={styles.muted}>Open a stop and add its location (search, pick on map, or paste a link). It will appear here.</Text>
            </View>
          )}
          {unlocated > 0 && markers.length > 0 ? (
            <View style={styles.mapNote} pointerEvents="none">
              <Text style={styles.mapNoteText}>
                {unlocated} stop{unlocated === 1 ? ' has' : 's have'} no location yet
              </Text>
            </View>
          ) : null}
        </View>
        {selected ? (
          <View style={[styles.sheet, { paddingBottom: 14 + bottomInset }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {STOP_TYPES[selected.type].icon} {selected.name}
              </Text>
              <Pressable onPress={() => setSelectedId(null)} hitSlop={10} accessibilityLabel="Close">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetTime}>🕐 {formatRange(selected)}</Text>
            {selected.address ? <Text style={styles.muted} numberOfLines={2}>{selected.address}</Text> : null}
            {selected.travelUserMin !== undefined || selected.suggestion ? (
              <Text style={styles.muted}>
                🚗 To get here: {selected.travelUserMin !== undefined ? `your estimate ${formatDuration(selected.travelUserMin)}` : 'no estimate from you'}
                {selected.suggestion ? ` · app ${selected.suggestion.source === 'estimate' ? '~' : ''}${formatDuration(selected.suggestion.min)} (${selected.suggestion.km.toFixed(0)} km)` : ''}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Button title="Edit" variant="secondary" onPress={() => onOpenStop(selected.id)} style={styles.smallBtn} />
              <Button title="🧭 Navigate" variant="secondary" onPress={() => Linking.openURL(navigateUrl(selected))} style={styles.smallBtn} />
              <Button title="💰 Expense" variant="secondary" onPress={() => onAddExpense(selected)} style={styles.smallBtn} />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // ================= LIST VIEW =================
  return (
    <View style={{ flex: 1 }}>
      {toolbar}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + bottomInset }]} keyboardShouldPersistTaps="handled">
        {nowNext && (nowNext.now || nowNext.next || dayFinished) ? (
          <View style={styles.nowCard}>
            {nowNext.now ? (
              <Text style={styles.nowText}>
                🟢 Now: {STOP_TYPES[nowNext.now.type].icon} <Text style={styles.bold}>{nowNext.now.name}</Text> until {formatTime(stopEndMin(nowNext.now))}
              </Text>
            ) : null}
            {nowNext.next ? (
              <Text style={styles.nowText}>
                ⏭️ Next: {STOP_TYPES[nowNext.next.type].icon} <Text style={styles.bold}>{nowNext.next.name}</Text> at {formatTime(nowNext.next.startMin)} (in {formatDuration(nowNext.next.startMin - nowMin)})
              </Text>
            ) : null}
            {dayFinished ? <Text style={styles.nowText}>✅ Today’s plan is done.</Text> : null}
          </View>
        ) : null}

        {planned > 0 ? (
          <Card style={styles.budget}>
            <View style={{ flex: 1 }}>
              <Text style={styles.budgetLabel}>Planned budget</Text>
              <Text style={styles.budgetValue}>{fmt(planned)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.budgetLabel}>Spent so far</Text>
              <Text style={[styles.budgetValue, spent > planned && { color: colors.danger }]}>{fmt(spent)}</Text>
            </View>
          </Card>
        ) : null}

        {days.map((day, di) => {
          const stops = dayStops(trip.planStops, day.id);
          const stats = computeDayStats(stops);
          const warnings = computeWarnings(stops);
          const routeUrl = dayRouteUrl(stops);
          const color = dayColor(di);
          const date = formatDayDate(day.date);
          return (
            <View key={day.id} style={styles.day}>
              <View style={[styles.dayHeader, { borderLeftColor: color }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle}>
                    {day.label}
                    {date ? <Text style={styles.dayDate}>  ·  {date}</Text> : null}
                  </Text>
                  {stats.count > 0 ? (
                    <Text style={styles.muted}>
                      {stats.count} stop{stats.count === 1 ? '' : 's'} · {formatDuration(stats.spanMin)}
                      {stats.km > 0 ? ` · ~${Math.round(stats.km)} km` : ''}
                      {stats.budget > 0 ? ` · ${fmt(stats.budget)}` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.muted}>Nothing planned yet</Text>
                  )}
                </View>
                <Pressable onPress={() => (editingDay === day.id ? setEditingDay(null) : beginEditDay(day.id))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Edit ${day.label}`}>
                  <Text style={styles.link}>Edit</Text>
                </Pressable>
              </View>

              {editingDay === day.id ? (
                <Card style={{ gap: 10, marginBottom: 10 }}>
                  <TextInput style={styles.input} value={dayLabel} onChangeText={setDayLabel} placeholder="Day name" placeholderTextColor={colors.textMuted} accessibilityLabel="Day name" />
                  <TextInput style={styles.input} value={dayDate} onChangeText={setDayDate} placeholder="Date, YYYY-MM-DD (optional)" placeholderTextColor={colors.textMuted} accessibilityLabel="Day date" />
                  <View style={styles.row}>
                    <Button title="Save" onPress={saveDay} style={styles.smallBtn} />
                    <Button title="Cancel" variant="secondary" onPress={() => setEditingDay(null)} style={styles.smallBtn} />
                    <Button title="Delete day" variant="danger" onPress={() => removeDay(day.id)} style={styles.smallBtn} />
                  </View>
                </Card>
              ) : null}

              {stops.map((stop, i) => {
                const prev = stops[i - 1];
                const warning = warnings.find((w) => w.stopId === stop.id);
                return (
                  <View key={stop.id}>
                    {prev ? (
                      <TravelLeg
                        stop={stop}
                        prev={prev}
                        editing={editingLeg === stop.id}
                        text={legText}
                        onText={setLegText}
                        onEdit={() => {
                          setEditingLeg(stop.id);
                          setLegText(stop.travelUserMin !== undefined ? formatDuration(stop.travelUserMin) : '');
                        }}
                        onSave={() => saveLeg(stop)}
                        onCancel={() => setEditingLeg(null)}
                        onUseSuggestion={(min) => updateStop(trip.id, stop.id, { travelUserMin: min }, false)}
                      />
                    ) : null}
                    <StopCard
                      stop={stop}
                      color={color}
                      number={i + 1}
                      isFirst={i === 0}
                      isLast={i === stops.length - 1}
                      currency={trip.currency}
                      onOpen={() => onOpenStop(stop.id)}
                      onToggleDone={() => updateStop(trip.id, stop.id, { done: !stop.done }, false)}
                      onMove={(dir) => moveStop(trip.id, stop.id, dir)}
                    />
                    {warning ? (
                      <WarningRow
                        warning={warning}
                        onFix={() => {
                          const start = fittingStartMin(stops, stop.id);
                          if (start !== null) updateStop(trip.id, stop.id, { startMin: start }, true);
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}

              <View style={styles.row}>
                <Button title="+ Add stop" variant="secondary" onPress={() => onAddStop(day.id)} style={[styles.smallBtn, { flex: 1 }]} />
                {routeUrl ? <Button title="🧭 Day route" variant="secondary" onPress={() => Linking.openURL(routeUrl)} style={styles.smallBtn} /> : null}
              </View>
            </View>
          );
        })}

        <Button title="+ Add another day" onPress={addNextDay} style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

function StopCard({
  stop,
  color,
  number,
  isFirst,
  isLast,
  currency,
  onOpen,
  onToggleDone,
  onMove,
}: {
  stop: PlanStop;
  color: string;
  number: number;
  isFirst: boolean;
  isLast: boolean;
  currency: Trip['currency'];
  onOpen: () => void;
  onToggleDone: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = STOP_TYPES[stop.type];
  const located = hasLocation(stop);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open stop ${stop.name}`}>
      {({ pressed }) => (
        <Card style={[styles.stop, { borderLeftColor: color }, stop.done && styles.stopDone, pressed && { opacity: 0.85 }]}>
          <View style={styles.stopTop}>
            <View style={[styles.num, { backgroundColor: color }]}>
              <Text style={styles.numText}>{number}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopTime}>{formatRange(stop)}</Text>
              <Text style={[styles.stopName, stop.done && styles.strike]} numberOfLines={2}>
                {meta.icon} {stop.name}
              </Text>
            </View>
            <Pressable
              onPress={onToggleDone}
              hitSlop={10}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!stop.done }}
              aria-checked={!!stop.done}
              accessibilityLabel={`Mark ${stop.name} as done`}
              style={[styles.check, stop.done && styles.checkDone]}
            >
              {stop.done ? <Text style={styles.tick}>✓</Text> : null}
            </Pressable>
          </View>
          <Text style={styles.stopMeta} numberOfLines={2}>
            {formatDuration(stop.durationMin)}
            {located ? ' · 📍 on map' : ' · no location'}
            {stop.budget ? ` · 💰 ${formatMoney(stop.budget, currency)}` : ''}
          </Text>
          {stop.notes ? (
            <Text style={styles.stopNotes} numberOfLines={2}>
              📝 {stop.notes}
            </Text>
          ) : null}
          <View style={styles.stopActions}>
            <Pressable onPress={() => onMove(-1)} disabled={isFirst} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Move ${stop.name} up`}>
              <Text style={[styles.action, isFirst && styles.actionOff]}>↑ Up</Text>
            </Pressable>
            <Pressable onPress={() => onMove(1)} disabled={isLast} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Move ${stop.name} down`}>
              <Text style={[styles.action, isLast && styles.actionOff]}>↓ Down</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(navigateUrl(stop))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Navigate to ${stop.name}`}>
              <Text style={styles.action}>🧭 Navigate</Text>
            </Pressable>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

/** The travel between two stops: YOUR estimate and the APP's calculation, shown separately. */
function TravelLeg({
  stop,
  prev,
  editing,
  text,
  onText,
  onEdit,
  onSave,
  onCancel,
  onUseSuggestion,
}: {
  stop: PlanStop;
  prev: PlanStop;
  editing: boolean;
  text: string;
  onText: (t: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUseSuggestion: (min: number) => void;
}) {
  const suggestion = stop.suggestion && isSuggestionCurrent(stop, prev) ? stop.suggestion : undefined;
  const both = hasLocation(prev) && hasLocation(stop);
  const same = suggestion && stop.travelUserMin === suggestion.min;
  return (
    <View style={styles.leg}>
      <View style={styles.legLine} />
      <View style={styles.legBody}>
        <View style={styles.legRow}>
          <Text style={styles.legLabel}>🚗 Your estimate</Text>
          {editing ? (
            <View style={styles.legEdit}>
              <TextInput
                accessibilityLabel={`Your travel estimate to ${stop.name}`}
                style={styles.legInput}
                value={text}
                onChangeText={onText}
                placeholder="e.g. 1h 15m"
                placeholderTextColor={colors.textMuted}
                autoFocus
                autoCapitalize="none"
                onSubmitEditing={onSave}
                returnKeyType="done"
              />
              <Pressable onPress={onSave} hitSlop={8} accessibilityRole="button" accessibilityLabel="Save estimate">
                <Text style={styles.link}>Save</Text>
              </Pressable>
              <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.muted}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit your travel estimate to ${stop.name}`}>
              <Text style={stop.travelUserMin !== undefined ? styles.legValue : styles.link}>
                {stop.travelUserMin !== undefined ? `${formatDuration(stop.travelUserMin)}  ✎` : 'Add'}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.legRow}>
          <Text style={styles.legLabel}>🧮 App’s calculation</Text>
          {suggestion ? (
            <View style={styles.legEdit}>
              <Text style={styles.legSuggest}>
                {suggestion.source === 'estimate' ? '~' : ''}
                {formatDuration(suggestion.min)} · {suggestion.km.toFixed(suggestion.km < 10 ? 1 : 0)} km
              </Text>
              {!same ? (
                <Pressable onPress={() => onUseSuggestion(suggestion.min)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Use the app's calculation as my estimate">
                  <Text style={styles.link}>Use</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={styles.muted}>{both ? 'calculating…' : 'needs both locations'}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function WarningRow({ warning, onFix }: { warning: StopWarning; onFix: () => void }) {
  return (
    <View style={styles.warning}>
      <Text style={styles.warningText}>
        {warning.kind === 'overlap'
          ? `⚠️ Starts ${formatDuration(warning.minutes)} before the previous stop ends.`
          : `⚠️ Not enough time to get here: ${formatDuration(warning.minutes)} short for the travel.`}
      </Text>
      <Pressable onPress={onFix} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fix timing">
        <Text style={styles.link}>Fix timing</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bold: { fontWeight: '700' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  smallBtn: { paddingVertical: 9, paddingHorizontal: 12 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 10, padding: 3 },
  segButton: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 },
  segActive: { backgroundColor: colors.card },
  segText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segTextActive: { color: colors.primaryDark },
  shareText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  nowCard: { backgroundColor: colors.successSoft, borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  nowText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  budget: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  budgetLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  budgetValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  day: { marginBottom: 20 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, paddingLeft: 10, marginBottom: 10 },
  dayTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  dayDate: { fontSize: 15, fontWeight: '500', color: colors.textMuted },
  stop: { borderLeftWidth: 5, gap: 6 },
  stopDone: { opacity: 0.6 },
  stopTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stopTime: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  stopName: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 1 },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },
  check: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 16 },
  stopMeta: { fontSize: 13, color: colors.textMuted },
  stopNotes: { fontSize: 13, color: colors.text, lineHeight: 18 },
  stopActions: { flexDirection: 'row', gap: 18, marginTop: 2 },
  action: { fontSize: 13, fontWeight: '600', color: colors.primary },
  actionOff: { color: colors.border },
  leg: { flexDirection: 'row', paddingLeft: 13 },
  legLine: { width: 2, backgroundColor: colors.border, marginRight: 14, marginVertical: 2 },
  legBody: { flex: 1, paddingVertical: 8, gap: 6 },
  legRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  legLabel: { fontSize: 13, color: colors.textMuted },
  legValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  legSuggest: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  legEdit: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  legInput: {
    minWidth: 96,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.text,
  },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginTop: 6 },
  warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  dayChips: { flexGrow: 0, paddingBottom: 8 },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  dayChipText: { color: colors.text, fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  noMap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  noMapEmoji: { fontSize: 40 },
  noMapTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  mapNote: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  mapNoteText: { backgroundColor: 'rgba(15,23,42,0.85)', color: '#fff', fontSize: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 6, borderTopWidth: 1, borderColor: colors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  sheetTime: { fontSize: 15, fontWeight: '700', color: colors.primaryDark },
  close: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },
});
