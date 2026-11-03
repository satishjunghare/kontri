import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { colors } from '../theme.ts';

export const TAGLINE = 'Kontri karo, hisaab barabar';

const LOGO_SIZE = 150;
/** How far (dp) each slice starts from its final place. */
const FLY_DISTANCE = 220;

/** Total length of the opening animation, so the app knows when it may hide the splash. */
export const SPLASH_ANIMATION_MS = 1700;

type Slice = { source: ImageSourcePropType; dx: number; dy: number; delay: number };

// The three white slices fly in from their corners, one after another.
const WHITE_SLICES: Slice[] = [
  { source: require('../../assets/splash/slice-top-left.png'), dx: -1, dy: -1, delay: 0 },
  { source: require('../../assets/splash/slice-top-right.png'), dx: 1, dy: -1, delay: 120 },
  { source: require('../../assets/splash/slice-bottom-left.png'), dx: -1, dy: 1, delay: 240 },
];
const GOLD_SLICE: Slice = { source: require('../../assets/splash/slice-gold.png'), dx: 1, dy: 1, delay: 480 };

/**
 * "Sab milke" splash: the logo's slices fly in from the corners and join into the
 * coin (friends putting in their kontri), the gold slice lands last with a bounce,
 * then the name and tagline rise in. Fades out once `visible` becomes false.
 */
export default function AppSplash({
  visible,
  onLayout,
  onHidden,
}: {
  visible: boolean;
  onLayout?: () => void;
  onHidden: () => void;
}) {
  const [screenOpacity] = useState(() => new Animated.Value(1));
  const [slices] = useState(() => WHITE_SLICES.map(() => new Animated.Value(0)));
  const [gold] = useState(() => new Animated.Value(0));
  const [title] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [footer] = useState(() => new Animated.Value(0));

  // Play the opening animation once.
  useEffect(() => {
    const flyIn = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: 450,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    const riseIn = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: 380,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });

    Animated.parallel([
      ...slices.map((v, i) => flyIn(v, WHITE_SLICES[i].delay)),
      Animated.spring(gold, { toValue: 1, delay: GOLD_SLICE.delay, friction: 5, tension: 70, useNativeDriver: true }),
      riseIn(title, 950),
      riseIn(tagline, 1120),
      riseIn(footer, 1250),
    ]).start();
  }, [slices, gold, title, tagline, footer]);

  // Fade the whole splash out when the app is ready.
  useEffect(() => {
    if (visible) return;
    Animated.timing(screenOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onHidden());
  }, [visible, screenOpacity, onHidden]);

  const sliceStyle = (value: Animated.Value, s: Slice, startScale: number) => ({
    opacity: value.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [s.dx * FLY_DISTANCE, 0] }) },
      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [s.dy * FLY_DISTANCE, 0] }) },
      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [startScale, 1] }) },
    ],
  });
  const riseStyle = (value: Animated.Value, distance: number) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  return (
    <Animated.View
      style={[styles.screen, { opacity: screenOpacity }]}
      onLayout={onLayout}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.center}>
        <View style={styles.logo} accessible accessibilityLabel="Kontri logo">
          {WHITE_SLICES.map((s, i) => (
            <Animated.Image key={i} source={s.source} style={[styles.slice, sliceStyle(slices[i], s, 0.7)]} />
          ))}
          <Animated.Image source={GOLD_SLICE.source} style={[styles.slice, sliceStyle(gold, GOLD_SLICE, 0.5)]} />
        </View>
        <Animated.Text style={[styles.word, riseStyle(title, 18)]} accessibilityRole="header">
          Kontri
        </Animated.Text>
        <Animated.Text style={[styles.tag, riseStyle(tagline, 12)]}>{TAGLINE}</Animated.Text>
      </View>
      <Animated.Text style={[styles.foot, { opacity: footer }]}>Split trip expenses with friends</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  center: { alignItems: 'center', marginTop: -40 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  slice: { position: 'absolute', top: 0, left: 0, width: LOGO_SIZE, height: LOGO_SIZE },
  word: { color: '#fff', fontSize: 54, fontWeight: '800', letterSpacing: -1.5, marginTop: 14 },
  tag: { color: colors.primarySoft, fontSize: 17, fontWeight: '500', marginTop: 6 },
  foot: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
