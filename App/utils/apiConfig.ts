// Pure API configuration resolver. utils/env.ts feeds it the runtime values.
//
// Rules:
// - EXPO_PUBLIC_API_URL is the server root (without /api). It always wins.
// - Release builds (isDev = false) MUST set it, and it MUST be https://.
//   They never fall back to LAN IP, 10.0.2.2 or localhost.
// - Mock mode is honoured only in development builds.

export type ApiMode = 'real' | 'mock'

export type ApiSource = 'explicit' | 'dev-lan' | 'dev-android-emulator' | 'dev-localhost' | 'dev-web'

export interface ApiConfigInput {
  isDev: boolean
  platform: string
  explicitUrl?: string
  port?: string
  devHost?: string | null
  requestedMode?: string
}

export type ApiConfig =
  | { ok: true; baseUrl: string; mode: ApiMode; source: ApiSource; mockRequestIgnored: boolean }
  | { ok: false; error: string; mode: 'real'; mockRequestIgnored: boolean }

const DEFAULT_PORT = '8000'

export function resolveApiConfig(input: ApiConfigInput): ApiConfig {
  const mockRequested = (input.requestedMode ?? '').trim().toLowerCase() === 'mock'
  const mockRequestIgnored = mockRequested && !input.isDev
  const mode: ApiMode = mockRequested && input.isDev ? 'mock' : 'real'

  const explicit = (input.explicitUrl ?? '').trim()
  if (explicit !== '') {
    const baseUrl = explicit.replace(/\/+$/, '').replace(/\/api$/i, '')
    if (!/^https?:\/\/[^\s/?#]+/i.test(baseUrl)) {
      return { ok: false, mode: 'real', mockRequestIgnored, error: 'EXPO_PUBLIC_API_URL буруу хэлбэртэй байна.' }
    }
    if (!input.isDev && !/^https:\/\//i.test(baseUrl)) {
      return {
        ok: false,
        mode: 'real',
        mockRequestIgnored,
        error: 'Release build-д EXPO_PUBLIC_API_URL нь https:// хаяг байх ёстой.',
      }
    }
    return { ok: true, baseUrl, mode, source: 'explicit', mockRequestIgnored }
  }

  if (!input.isDev) {
    return {
      ok: false,
      mode: 'real',
      mockRequestIgnored,
      error: 'Аппын API хаяг тохируулаагүй байна (EXPO_PUBLIC_API_URL).',
    }
  }

  const port = (input.port ?? '').trim() || DEFAULT_PORT
  if (input.platform === 'web') {
    return { ok: true, baseUrl: `http://localhost:${port}`, mode, source: 'dev-web', mockRequestIgnored }
  }
  const host = (input.devHost ?? '').trim()
  if (host !== '' && host !== 'localhost' && host !== '127.0.0.1') {
    return { ok: true, baseUrl: `http://${host}:${port}`, mode, source: 'dev-lan', mockRequestIgnored }
  }
  if (input.platform === 'android') {
    return { ok: true, baseUrl: `http://10.0.2.2:${port}`, mode, source: 'dev-android-emulator', mockRequestIgnored }
  }
  return { ok: true, baseUrl: `http://localhost:${port}`, mode, source: 'dev-localhost', mockRequestIgnored }
}

// "192.168.1.37:8081" -> "192.168.1.37"
export function hostFromHostUri(hostUri: string | undefined | null): string | null {
  if (!hostUri) return null
  const host = hostUri.split(':')[0]?.trim()
  return host ? host : null
}
