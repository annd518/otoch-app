import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { hostFromHostUri, resolveApiConfig, type ApiConfig } from './apiConfig'

// EXPO_PUBLIC_* values are inlined into the JS bundle at build time, so they
// must never contain secrets. Access them with dot notation so Expo can inline.
export const apiConfig: ApiConfig = resolveApiConfig({
  isDev: __DEV__,
  platform: Platform.OS,
  explicitUrl: process.env.EXPO_PUBLIC_API_URL,
  port: process.env.EXPO_PUBLIC_API_PORT,
  devHost: hostFromHostUri(Constants.expoConfig?.hostUri),
})
