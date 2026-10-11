import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { BookingDraftProvider } from '@/context/BookingDraftContext';

export default function RootLayout() {
  return (
    <BookingDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="booking/catalog" />
      </Stack>
    </BookingDraftProvider>
  );
}
