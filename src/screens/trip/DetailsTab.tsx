import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionTitle, notify } from '../../components/ui.tsx';
import { formatDate } from '../../lib/id.ts';
import { checklistProgress, noteDisplayTitle, sortNotes } from '../../lib/notes.ts';
import { photoUri, savePhoto } from '../../lib/photos.ts';
import { useTrips } from '../../store/TripsContext.tsx';
import { colors } from '../../theme.ts';
import type { Trip } from '../../types.ts';

const MAX_PICK = 10;
const COLUMNS = 3;

export default function DetailsTab({
  trip,
  onEditTrip,
  onAddNote,
  onOpenNote,
  onOpenPhoto,
}: {
  trip: Trip;
  onEditTrip: () => void;
  onAddNote: () => void;
  onOpenNote: (noteId: string) => void;
  onOpenPhoto: (photoId: string) => void;
}) {
  const { addPhotos, toggleChecklistItem } = useTrips();
  const [busy, setBusy] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const dates = [formatDate(trip.startDate), formatDate(trip.endDate)].filter(Boolean).join(' – ');
  const hasInfo = !!(trip.destination || trip.description || dates);
  const notes = sortNotes(trip.notes);

  const addFromAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return;
    setBusy(true);
    try {
      const saved = [];
      for (const asset of assets) saved.push(await savePhoto(asset.uri, asset.width));
      addPhotos(trip.id, saved);
    } catch (err) {
      console.warn('Could not save photo', err);
      notify('Could not add photo', 'Something went wrong while saving the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PICK,
      quality: 1,
    });
    if (!result.canceled) await addFromAssets(result.assets);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      notify('Camera access needed', 'Allow camera access for Kontri in your phone settings to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await addFromAssets(result.assets);
  };

  // Square thumbnails that fill the row exactly.
  const gap = 6;
  const size = gridWidth ? Math.floor((gridWidth - gap * (COLUMNS - 1)) / COLUMNS) : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        {hasInfo ? (
          <View style={{ gap: 6 }}>
            {trip.destination ? <Text style={styles.destination}>📍 {trip.destination}</Text> : null}
            {dates ? <Text style={styles.meta}>🗓️ {dates}</Text> : null}
            {trip.description ? <Text style={styles.description}>{trip.description}</Text> : null}
            <Pressable onPress={onEditTrip} hitSlop={8}>
              <Text style={styles.link}>Edit trip details</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={styles.description}>Add a destination and a short description for this trip.</Text>
            <Pressable onPress={onEditTrip} hitSlop={8}>
              <Text style={styles.link}>Add trip details</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <SectionTitle>Notes ({notes.length})</SectionTitle>
      <Button title="+ Add note" onPress={onAddNote} style={{ marginBottom: 10 }} />
      {notes.length === 0 ? (
        <Text style={styles.hint}>
          Keep booking details, phone numbers or a packing list here. Notes can have checklists.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {notes.map((note) => {
            const progress = checklistProgress(note);
            const preview = note.title.trim() ? note.text.trim() : note.text.trim().split('\n').slice(1).join('\n').trim();
            return (
              <Card key={note.id} style={styles.note}>
                <Pressable onPress={() => onOpenNote(note.id)} accessibilityRole="button" accessibilityLabel={`Open note ${noteDisplayTitle(note)}`}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.pinned ? '📌 ' : ''}
                      {noteDisplayTitle(note)}
                    </Text>
                    {progress.total > 0 ? (
                      <Text style={styles.progress}>
                        {progress.done}/{progress.total}
                      </Text>
                    ) : null}
                  </View>
                  {preview ? (
                    <Text style={styles.notePreview} numberOfLines={3}>
                      {preview}
                    </Text>
                  ) : null}
                </Pressable>
                {note.checklist.slice(0, 4).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleChecklistItem(trip.id, note.id, item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done }}
                    style={styles.itemRow}
                  >
                    <View style={[styles.box, item.done && styles.boxDone]}>
                      {item.done ? <Text style={styles.tick}>✓</Text> : null}
                    </View>
                    <Text style={[styles.itemText, item.done && styles.itemDone]} numberOfLines={1}>
                      {item.text}
                    </Text>
                  </Pressable>
                ))}
                {note.checklist.length > 4 ? (
                  <Text style={styles.more}>+ {note.checklist.length - 4} more</Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      <SectionTitle>Photos ({trip.photos.length})</SectionTitle>
      <View style={styles.photoButtons}>
        {Platform.OS !== 'web' ? (
          <Button title="📷 Camera" variant="secondary" onPress={takePhoto} disabled={busy} style={{ flex: 1 }} />
        ) : null}
        <Button title="🖼️ Gallery" variant="secondary" onPress={pickFromGallery} disabled={busy} style={{ flex: 1 }} />
      </View>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Saving photos…</Text>
        </View>
      ) : null}
      {trip.photos.length === 0 && !busy ? (
        <Text style={[styles.hint, { marginTop: 10 }]}>
          Add photos from the trip. They stay on your phone, and you can pick one as the cover of the trip.
        </Text>
      ) : (
        <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {size > 0 &&
            trip.photos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => onOpenPhoto(photo.id)}
                accessibilityRole="button"
                accessibilityLabel={photo.caption ?? 'Trip photo'}
              >
                <Image source={{ uri: photoUri(photo.file) }} style={{ width: size, height: size, borderRadius: 8, backgroundColor: colors.border }} />
                {trip.coverPhotoId === photo.id ? (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverText}>★ Cover</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  destination: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted },
  description: { fontSize: 15, color: colors.text, lineHeight: 21 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14, marginTop: 2 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  note: { gap: 8 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  noteTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  progress: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  notePreview: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 12, lineHeight: 14 },
  itemText: { flex: 1, fontSize: 15, color: colors.text },
  itemDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  more: { fontSize: 13, color: colors.textMuted },
  photoButtons: { flexDirection: 'row', gap: 10 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(15,118,110,0.92)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  coverText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
