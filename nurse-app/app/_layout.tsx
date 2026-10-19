import { Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat'
import { NotoSans_400Regular, NotoSans_600SemiBold } from '@expo-google-fonts/noto-sans'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { useCallback, useState } from 'react'

import { SplashOverlay } from '../components/SplashOverlay'
import { SessionProvider, useSession } from '../context/SessionContext'

SplashScreen.preventAutoHideAsync().catch(() => {})

function RootNavigator() {
  const { user } = useSession()
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    NotoSans_400Regular,
    NotoSans_600SemiBold,
  })
  const [splashDone, setSplashDone] = useState(false)
  const onSplashDone = useCallback(() => setSplashDone(true), [])
  const ready = user !== undefined && (fontsLoaded || !!fontError)

  // The native splash stays up until the session and fonts are ready; SplashOverlay
  // then draws the same frame, hides the native splash and animates into the app
  // (same artwork and animation as the family app).
  if (!ready) return null

  return (
    <View style={{ flex: 1 }}>
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
      {!splashDone && <SplashOverlay onDone={onSplashDone} />}
    </View>
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
