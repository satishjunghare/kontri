import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme.ts';

export const TAGLINE = 'Kontri karo, hisaab barabar';

/**
 * Full-screen splash shown right after the native splash: logo, app name, tagline.
 * Uses the same background colour as the native splash so the hand-over is seamless.
 * Fades out once `visible` becomes false, then calls `onHidden`.
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
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onHidden());
  }, [visible, opacity, onHidden]);

  return (
    <Animated.View style={[styles.screen, { opacity }]} onLayout={onLayout} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.center}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.word} accessibilityRole="header">
          Kontri
        </Text>
        <Text style={styles.tag}>{TAGLINE}</Text>
      </View>
      <Text style={styles.foot}>Split trip expenses with friends</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  center: { alignItems: 'center', marginTop: -40 },
  logo: { width: 150, height: 150 },
  word: { color: '#fff', fontSize: 54, fontWeight: '800', letterSpacing: -1.5, marginTop: 14 },
  tag: { color: colors.primarySoft, fontSize: 17, fontWeight: '500', marginTop: 6 },
  foot: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
