import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './src/navigation.ts';
import ExpenseFormScreen from './src/screens/ExpenseFormScreen.tsx';
import TripDetailScreen from './src/screens/TripDetailScreen.tsx';
import TripFormScreen from './src/screens/TripFormScreen.tsx';
import TripsListScreen from './src/screens/TripsListScreen.tsx';
import { TripsProvider } from './src/store/TripsContext.tsx';
import { colors } from './src/theme.ts';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <TripsProvider>
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
            <Stack.Screen name="Trips" component={TripsListScreen} options={{ title: 'FairShare' }} />
            <Stack.Screen name="TripForm" component={TripFormScreen} options={{ title: 'New trip' }} />
            <Stack.Screen name="TripDetail" component={TripDetailScreen} />
            <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={{ title: 'Add expense' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </TripsProvider>
    </SafeAreaProvider>
  );
}
