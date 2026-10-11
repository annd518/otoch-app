// The app's single API entry point. Screens call apiService only; they never
// use fetch/axios directly. Logic lives in pure modules (httpClient, authFlow,
// catalog) that are unit tested in tests/.
import { router } from 'expo-router'

import { API_PATHS } from '../config/api'
import { apiConfig, catalogMockScenario } from '../utils/env'
import { storage } from '../utils/storage'
import type { ApiResult } from './apiResult'
import type { NewParentInput, NewVisitInput, Parent, SignupInput, Visit } from './apiTypes'
import { loginFlow, logoutFlow, signupFlow, type LoginOutcome, type SignupOutcome } from './authFlow'
import { fetchCatalog, type CatalogResult } from './catalog'
import { createHttpClient, type FetchLike } from './httpClient'
import { parseCreatedParent, parseCreatedVisit, parseParentList } from './validators'

const REQUEST_TIMEOUT_MS = 15000

const fetchWithTimeout: FetchLike = async (url, init) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Any 401 on an authenticated request ends the session.
async function handleUnauthorized(): Promise<void> {
  await storage.clearSession()
  router.replace('/auth/login')
}

const client = createHttpClient({
  config: apiConfig,
  fetch: fetchWithTimeout,
  getToken: () => storage.getAuthToken(),
  onUnauthorized: handleUnauthorized,
})

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const apiService = {
  config: apiConfig,

  login(email: string, password: string): Promise<LoginOutcome> {
    return loginFlow(client, storage, email, password)
  },

  signup(input: SignupInput): Promise<SignupOutcome> {
    return signupFlow(client, storage, input)
  },

  logout(): Promise<void> {
    return logoutFlow(storage)
  },

  getParents(): Promise<ApiResult<Parent[]>> {
    return client.request({ method: 'GET', path: API_PATHS.parents.list, parse: parseParentList })
  },

  createParent(input: NewParentInput): Promise<ApiResult<Parent>> {
    return client.request({ method: 'POST', path: API_PATHS.parents.list, body: input, parse: parseCreatedParent })
  },

  // Legacy endpoint. It accepts only parentId, scheduledFor and visitType.
  createVisit(input: NewVisitInput): Promise<ApiResult<Visit>> {
    return client.request({ method: 'POST', path: API_PATHS.visits.create, body: input, parse: parseCreatedVisit })
  },

  getCatalog(): Promise<CatalogResult> {
    return fetchCatalog({ mode: apiConfig.mode, client, mockScenario: catalogMockScenario, delay })
  },
}
