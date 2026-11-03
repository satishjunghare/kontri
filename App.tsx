import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './src/navigation.ts';
import ExpenseFormScreen from './src/screens/ExpenseFormScreen.tsx';
import TripDetailScreen from './src/screens/TripDetailScreen.tsx';
import TripFormScreen from './src/screens/TripFormScreen.tsx';
import TripsListScreen from './src/screens/TripsListScreen.tsx';
import { TripsProvider, useTrips } from './src/store/TripsContext.tsx';
import { colors } from './src/theme.ts';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Keep Android's splash (logo on teal) up until saved trips are loaded,
// so the app opens straight onto the real trip list without an empty flash.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

/** Hides the splash screen once saved trips are loaded. */
function Root() {
  const { loaded } = useTrips();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  return <Navigator />;
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
