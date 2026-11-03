import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppSplash from './src/components/AppSplash.tsx';
import type { RootStackParamList } from './src/navigation.ts';
import ExpenseFormScreen from './src/screens/ExpenseFormScreen.tsx';
import TripDetailScreen from './src/screens/TripDetailScreen.tsx';
import TripFormScreen from './src/screens/TripFormScreen.tsx';
import TripsListScreen from './src/screens/TripsListScreen.tsx';
import { TripsProvider, useTrips } from './src/store/TripsContext.tsx';
import { colors } from './src/theme.ts';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Keep the native splash up until our own splash screen has drawn, so there is no flash.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Shortest time the in-app splash stays visible, so the name and tagline can be read. */
const MIN_SPLASH_MS = 1200;

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

/** Shows the in-app splash until saved trips are loaded and the minimum time has passed. */
function Root() {
  const { loaded } = useTrips();
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS);
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
        <AppSplash visible={!(loaded && minTimeDone)} onLayout={hideNativeSplash} onHidden={onSplashHidden} />
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
