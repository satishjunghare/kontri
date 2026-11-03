import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppSplash, { SPLASH_ANIMATION_MS } from './src/components/AppSplash.tsx';
import type { RootStackParamList } from './src/navigation.ts';
import ExpenseFormScreen from './src/screens/ExpenseFormScreen.tsx';
import TripDetailScreen from './src/screens/TripDetailScreen.tsx';
import TripFormScreen from './src/screens/TripFormScreen.tsx';
import TripsListScreen from './src/screens/TripsListScreen.tsx';
import { TripsProvider, useTrips } from './src/store/TripsContext.tsx';
import { colors } from './src/theme.ts';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Android's own splash is a plain teal screen (no logo). Keep it up until our
// animated splash has drawn on the same teal, so the hand-over is invisible.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Time the animated splash stays after its animation finishes, before fading out. */
const SPLASH_HOLD_MS = 300;

function Navigator() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Trips" component={TripsListScreen} options={{ title: 'Kontri' }} />
        <Stack.Screen name="TripForm" component={TripFormScreen} options={{ title: 'New trip' }} />
        <Stack.Screen name="TripDetail" component={TripDetailScreen} />
        <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={{ title: 'Add expense' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** Shows the animated splash until it has played and saved trips are loaded. */
function Root() {
  const { loaded } = useTrips();
  const [animationDone, setAnimationDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimationDone(true), SPLASH_ANIMATION_MS + SPLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const onSplashHidden = useCallback(() => setSplashGone(true), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <Navigator />
      {splashGone ? null : (
        <AppSplash visible={!(loaded && animationDone)} onLayout={hideNativeSplash} onHidden={onSplashHidden} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TripsProvider>
        <Root />
      </TripsProvider>
    </SafeAreaProvider>
  );
}
