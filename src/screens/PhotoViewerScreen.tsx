import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, EmptyState, confirm } from '../components/ui.tsx';
import { useBottomInset } from '../components/useBottomInset.ts';
import { photoUri } from '../lib/photos.ts';
import type { ScreenProps } from '../navigation.ts';
import { useTrips } from '../store/TripsContext.tsx';
import { colors } from '../theme.ts';

export default function PhotoViewerScreen({ navigation, route }: ScreenProps<'PhotoViewer'>) {
  const bottomInset = useBottomInset();
  const { tripId } = route.params;
  const { getTrip, setPhotoCaption, setCoverPhoto, deletePhoto } = useTrips();
  const trip = getTrip(tripId);
  const [photoId, setPhotoId] = useState(route.params.photoId);

  const photos = trip?.photos ?? [];
  const index = Math.max(
    0,
    photos.findIndex((p) => p.id === photoId),
  );
  const photo = photos[index];
  // Captions being typed, per photo. Anything not edited shows the saved caption.
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    navigation.setOptions({ title: photos.length ? `${index + 1} of ${photos.length}` : 'Photo' });
  }, [navigation, index, photos.length]);

  if (!trip || !photo) {
    return (
      <View style={styles.empty}>
        <EmptyState emoji="🖼️" title="Photo not found" />
      </View>
    );
  }

  const isCover = trip.coverPhotoId === photo.id;
  const caption = edits[photo.id] ?? photo.caption ?? '';
  const go = (delta: number) => {
    saveCaption();
    setPhotoId(photos[(index + delta + photos.length) % photos.length].id);
  };
  const saveCaption = () => {
    if (caption.trim() !== (photo.caption ?? '')) setPhotoCaption(trip.id, photo.id, caption);
  };
  const setCaption = (text: string) => setEdits((prev) => ({ ...prev, [photo.id]: text }));

  const remove = () =>
    confirm('Delete photo?', 'This photo will be removed from your phone.', 'Delete', () => {
      const next = photos[index + 1] ?? photos[index - 1];
      deletePhoto(trip.id, photo.id);
      if (next) setPhotoId(next.id);
      else navigation.goBack();
    });

  return (
    <View style={styles.screen}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: photoUri(photo.file) }} style={styles.image} resizeMode="contain" accessibilityLabel={photo.caption ?? 'Trip photo'} />
        {photos.length > 1 ? (
          <>
            <Pressable onPress={() => go(-1)} style={[styles.arrow, { left: 8 }]} accessibilityLabel="Previous photo">
              <Text style={styles.arrowText}>‹</Text>
            </Pressable>
            <Pressable onPress={() => go(1)} style={[styles.arrow, { right: 8 }]} accessibilityLabel="Next photo">
              <Text style={styles.arrowText}>›</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: 16 + bottomInset }]}>
        <TextInput
          style={styles.caption}
          placeholder="Add a caption"
          placeholderTextColor="#94A3B8"
          value={caption}
          onChangeText={setCaption}
          onBlur={saveCaption}
          onSubmitEditing={saveCaption}
          returnKeyType="done"
        />
        <View style={styles.actions}>
          <Button
            title={isCover ? '★ Cover photo' : '☆ Set as cover'}
            variant="secondary"
            onPress={() => setCoverPhoto(trip.id, isCover ? undefined : photo.id)}
            style={{ flex: 1 }}
          />
          <Button title="Delete" variant="danger" onPress={remove} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, backgroundColor: colors.background },
  imageWrap: { flex: 1, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  arrow: {
    position: 'absolute',
    top: '45%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: '#fff', fontSize: 30, lineHeight: 34 },
  panel: { backgroundColor: '#0F172A', padding: 16, gap: 12 },
  caption: {
    backgroundColor: '#1E293B',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
});
