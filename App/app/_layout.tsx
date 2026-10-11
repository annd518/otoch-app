import { useFonts } from "expo-font";
import { View } from "react-native";
import { StateView } from "@/components/ui";
import { Stack } from "expo-router";
import "react-native-reanimated";

import { BookingDraftProvider } from "@/context/BookingDraftContext";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Montserrat_600SemiBold: require("../assets/fonts/Montserrat_600SemiBold.ttf"),
    Montserrat_700Bold: require("../assets/fonts/Montserrat_700Bold.ttf"),
    NotoSans_400Regular: require("../assets/fonts/NotoSans_400Regular.ttf"),
    NotoSans_600SemiBold: require("../assets/fonts/NotoSans_600SemiBold.ttf"),
  });
  if (!loaded && !error)
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <StateView title="OTOCH ачаалж байна" loading />
      </View>
    );
  return (
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
        <Stack.Screen
          name="booking/emergency"
          options={{ gestureEnabled: false }}
        />
      </Stack>
    </BookingDraftProvider>
  );
}
