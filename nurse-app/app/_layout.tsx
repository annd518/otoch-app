import { Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat'
import { NotoSans_400Regular, NotoSans_600SemiBold } from '@expo-google-fonts/noto-sans'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { SessionProvider, useSession } from '../context/SessionContext'

void SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { user } = useSession()
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    NotoSans_400Regular,
    NotoSans_600SemiBold,
  })
  const ready = user !== undefined && (fontsLoaded || !!fontError)

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="orders/[id]/index" />
        <Stack.Screen name="orders/[id]/checkin" />
        <Stack.Screen name="orders/[id]/record" />
        <Stack.Screen name="orders/[id]/reject" />
        <Stack.Screen name="orders/[id]/incident" />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  )
}
