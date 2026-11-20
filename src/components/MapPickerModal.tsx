import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reverseGeocode } from '../lib/geo.ts';
import type { LatLng } from '../lib/plan.ts';
import { colors } from '../theme.ts';
import { Button } from './ui.tsx';
import PlanMap from './PlanMap';
import type { MapMarker } from './planMapTypes.ts';
import { useBottomInset } from './useBottomInset.ts';

export interface PickedPlace extends LatLng {
  /** Name found for the spot, if any. */
  name?: string;
  address?: string;
}

/** Full-screen map for choosing a spot: tap (or drag the pin), then confirm. */
export default function MapPickerModal({
  initial,
  others,
  onClose,
  onPick,
}: {
  initial?: LatLng;
  /** The trip's other stops, shown for context. */
  others: MapMarker[];
  onClose: () => void;
  onPick: (place: PickedPlace) => void;
}) {
  const bottomInset = useBottomInset();
  const topInset = useSafeAreaInsets().top;
  const [point, setPoint] = useState<LatLng | null>(initial ?? null);
  const [place, setPlace] = useState<{ name: string; address: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const latest = useRef<LatLng | null>(point);

  const choose = (raw: LatLng) => {
    // Six decimals is about 10 cm: plenty, and keeps links and text tidy.
    const p = { lat: Math.round(raw.lat * 1e6) / 1e6, lng: Math.round(raw.lng * 1e6) / 1e6 };
    latest.current = p;
    setPoint(p);
    setPlace(null);
    setLooking(true);
    reverseGeocode(p).then((result) => {
      // Ignore the answer if a newer spot was chosen meanwhile.
      if (latest.current !== p) return;
      setPlace(result);
      setLooking(false);
    });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" style={styles.side}>
            <Text style={styles.cancel} numberOfLines={1}>
              Cancel
            </Text>
          </Pressable>
          <Text style={styles.title}>Pick a location</Text>
          <View style={styles.side} />
        </View>
        <View style={{ flex: 1 }}>
          <PlanMap markers={others} pick={point} mode="pick" fitKey="picker" onMapTap={choose} />
          {!point ? (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintText}>Tap the map to drop a pin. Drag the pin to adjust it.</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.panel, { paddingBottom: 16 + bottomInset }]}>
          {point ? (
            <>
              <View style={styles.placeRow}>
                {looking ? <ActivityIndicator color={colors.primary} /> : null}
                <Text style={styles.place} numberOfLines={2}>
                  {looking ? 'Finding the name…' : (place?.name ?? 'Selected spot')}
                </Text>
              </View>
              <Text style={styles.coords}>
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </Text>
            </>
          ) : (
            <Text style={styles.coords}>No spot chosen yet</Text>
          )}
          <Button
            title="Use this location"
            disabled={!point}
            onPress={() => point && onPick({ ...point, name: place?.name, address: place?.address })}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 76 },
  cancel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { position: 'absolute', top: 12, left: 16, right: 16, alignItems: 'center' },
  hintText: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  panel: { backgroundColor: colors.card, padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  place: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  coords: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
});
