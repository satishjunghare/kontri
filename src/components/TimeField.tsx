import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatTime, parseTime } from '../lib/plan.ts';
import { colors } from '../theme.ts';

/** Opens the Android time picker. Calls `onPicked` only if a time is confirmed (not if cancelled). */
export function pickTimeAndroid(initialMin: number, onPicked: (min: number) => void) {
  const value = new Date();
  value.setHours(Math.floor(initialMin / 60), initialMin % 60, 0, 0);
  DateTimePickerAndroid.open({
    value,
    mode: 'time',
    is24Hour: false,
    onChange: (event, date) => {
      if (event.type === 'set' && date) onPicked(date.getHours() * 60 + date.getMinutes());
    },
  });
}

/**
 * A time of day, in minutes after midnight. On Android, tapping it opens the phone's time picker.
 * Elsewhere (the browser preview) it is a text box that understands "7:30 AM", "19:30" and so on.
 */
export default function TimeField({
  label,
  valueMin,
  onChange,
}: {
  label: string;
  valueMin: number;
  onChange: (min: number) => void;
}) {
  // Text typed in the browser fallback, applied when the box loses focus or Enter is pressed.
  const typed = useRef<string | null>(null);
  const commitTyped = () => {
    if (typed.current === null) return;
    const parsed = parseTime(typed.current);
    typed.current = null;
    if (parsed !== null && parsed !== valueMin) onChange(parsed);
  };

  const openPicker = () => pickTimeAndroid(valueMin, onChange);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'android' ? (
        <Pressable onPress={openPicker} accessibilityRole="button" accessibilityLabel={`${label}: ${formatTime(valueMin)}. Tap to change`} style={styles.box}>
          <Text style={styles.value}>🕐 {formatTime(valueMin)}</Text>
        </Pressable>
      ) : (
        <TextInput
          // Re-created when the time changes from outside, so it always shows the current value.
          key={valueMin}
          accessibilityLabel={label}
          defaultValue={formatTime(valueMin)}
          onChangeText={(t) => {
            typed.current = t;
          }}
          onBlur={commitTyped}
          onSubmitEditing={commitTyped}
          style={[styles.box, styles.value]}
          placeholder="7:30 AM"
          placeholderTextColor={colors.textMuted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  box: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 46,
    justifyContent: 'center',
  },
  value: { fontSize: 16, color: colors.text },
});
