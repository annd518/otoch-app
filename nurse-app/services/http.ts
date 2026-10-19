import { apiConfig } from '../utils/env'
import { sessionEvents } from '../utils/sessionEvents'
import { storage } from '../utils/storage'
import { createHttpClient, type FetchLike } from './httpClient'

const REQUEST_TIMEOUT_MS = 15000

const timedFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

// Single client used by every screen.
export const http = createHttpClient({
  config: apiConfig,
  fetch: timedFetch,
  getToken: storage.getAuthToken,
  onUnauthorized: async () => {
    await storage.clearSession()
    sessionEvents.emitSignedOut()
  },
})
