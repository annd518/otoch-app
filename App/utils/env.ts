import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { hostFromHostUri, resolveApiConfig, type ApiConfig } from './apiConfig'
import { resolveMockedEndpoints, type MockableEndpoint } from '../services/endpoints'
import { parseSupportContact, type SupportContact } from './supportContact'

// EXPO_PUBLIC_* values are inlined into the JS bundle at build time, so they
// must never contain secrets. Access them with dot notation so Expo can inline.
export const apiConfig: ApiConfig = resolveApiConfig({
  isDev: __DEV__,
  platform: Platform.OS,
  explicitUrl: process.env.EXPO_PUBLIC_API_URL,
  port: process.env.EXPO_PUBLIC_API_PORT,
  devHost: hostFromHostUri(Constants.expoConfig?.hostUri),
  requestedMode: process.env.EXPO_PUBLIC_API_MODE,
})

// Always empty in release builds.
export const mockedEndpoints: ReadonlySet<MockableEndpoint> = resolveMockedEndpoints({
  isDev: __DEV__,
  mode: apiConfig.mode,
  list: process.env.EXPO_PUBLIC_MOCK_ENDPOINTS,
})

// Public support channel set by the owner; empty values mean "not configured".
export const supportContact: SupportContact = parseSupportContact(
  process.env.EXPO_PUBLIC_SUPPORT_PHONE,
  process.env.EXPO_PUBLIC_SUPPORT_URL,
)

export const mockScenario: string = __DEV__ ? (process.env.EXPO_PUBLIC_MOCK_SCENARIO ?? '') : ''

if (__DEV__) {
  console.log(
    '[env] API:',
    apiConfig.ok ? `${apiConfig.baseUrl} (${apiConfig.source})` : apiConfig.error,
    'mocked endpoints:',
    mockedEndpoints.size > 0 ? [...mockedEndpoints].join(',') : 'none',
  )
}
