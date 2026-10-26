import { useCallback, useState } from "react";
import { useFonts } from "expo-font";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";

import { SplashOverlay } from "@/components/SplashOverlay";
import { BookingDraftProvider } from "@/context/BookingDraftContext";

// The native splash stays up until SplashOverlay has drawn its first frame
// (no white/black flash between native splash and the first screen).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Montserrat_600SemiBold: require("../assets/fonts/Montserrat_600SemiBold.ttf"),
    Montserrat_700Bold: require("../assets/fonts/Montserrat_700Bold.ttf"),
    NotoSans_400Regular: require("../assets/fonts/NotoSans_400Regular.ttf"),
    NotoSans_600SemiBold: require("../assets/fonts/NotoSans_600SemiBold.ttf"),
  });
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  // Native splash is still visible while fonts load
  if (!loaded && !error) return null;
  return (
    <View style={{ flex: 1 }}>
      <BookingDraftProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="booking/catalog" />
          <Stack.Screen name="booking/red-flags" />
          <Stack.Screen name="booking/referral" />
          <Stack.Screen name="booking/review" />
          <Stack.Screen name="booking/payment" />
          <Stack.Screen name="reschedule/[id]" />
          <Stack.Screen
            name="booking/emergency"
            options={{ gestureEnabled: false }}
          />
        </Stack>
      </BookingDraftProvider>
      {!splashDone && <SplashOverlay onDone={onSplashDone} />}
    </View>
  );
}
