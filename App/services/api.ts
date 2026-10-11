// The app's single API entry point. Screens call apiService only; they never
// use fetch/axios directly. Logic lives in pure modules (httpClient, authFlow,
// catalog, orders) that are unit tested in tests/.
import { router } from 'expo-router'

import { API_PATHS } from '../config/api'
import { createMockBackend } from '../mocks/mockBackend'
import { apiConfig, mockScenario, mockedEndpoints } from '../utils/env'
import { storage } from '../utils/storage'
import type { ApiResult } from './apiResult'
import type {
  Attachment,
  DraftOrderInput,
  DraftOrderPatch,
  NewParentInput,
  Order,
  Quote,
  Parent,
  RedFlagOutcome,
  RedFlagQuestionnaire,
  SignupInput,
} from './apiTypes'
import { loginFlow, logoutFlow, signupFlow, type LoginOutcome, type SignupOutcome } from './authFlow'
import { fetchCatalog, type CatalogResult } from './catalog'
import { endpointForPath, pathOfUrl, type MockableEndpoint } from './endpoints'
import { createHttpClient, type FetchLike, type HttpResponseLike, type UploadFile, type UploadLike } from './httpClient'
import {
  createDraftOrder,
  deleteAttachment,
  getOrder,
  getRedFlagQuestions,
  reportRedFlagBlock,
  requestQuote,
  submitRedFlagAnswers,
  updateDraftOrder,
  uploadReferral,
  type BlockReport,
} from './orders'
import { createInvoice, getPaymentState, type Invoice, type PaymentState } from './payment'
import { parseCreatedParent, parseParentList } from './validators'

const REQUEST_TIMEOUT_MS = 15000
const UPLOAD_TIMEOUT_MS = 60000

const realFetch: FetchLike = async (url, init) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// multipart upload with progress. fetch() has no upload progress in React
// Native, XMLHttpRequest does.
const realUpload: UploadLike = (request) =>
  new Promise<HttpResponseLike>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', request.url)
    for (const [name, value] of Object.entries(request.headers)) xhr.setRequestHeader(name, value)
    xhr.timeout = UPLOAD_TIMEOUT_MS
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && request.onProgress) request.onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      const body = xhr.responseText ?? ''
      resolve({ status: xhr.status, text: async () => body })
    }
    xhr.onerror = () => reject(new TypeError('Network request failed'))
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'))
    const form = new FormData()
    for (const [name, value] of Object.entries(request.fields)) form.append(name, value)
    // React Native's FormData accepts { uri, name, type } for files; the DOM
    // typings only know Blob, hence the cast.
    form.append('file', { uri: request.file.uri, name: request.file.name, type: request.file.type } as unknown as Blob)
    xhr.send(form)
  })

const mock = mockedEndpoints.size > 0 ? createMockBackend({ scenario: mockScenario }) : null

const isMocked = (url: string): boolean => {
  const endpoint = endpointForPath(pathOfUrl(url))
  return endpoint !== null && mockedEndpoints.has(endpoint)
}

const routedFetch: FetchLike = (url, init) => (mock && isMocked(url) ? mock.fetch(url, init) : realFetch(url, init))
const routedUpload: UploadLike = (request) => (mock && isMocked(request.url) ? mock.upload(request) : realUpload(request))

// Any 401 on an authenticated request (or a locally expired token) ends the session.
async function handleUnauthorized(): Promise<void> {
  await storage.clearSession()
  router.replace({ pathname: '/auth/login', params: { expired: '1' } })
}

const client = createHttpClient({
  config: apiConfig,
  fetch: routedFetch,
  upload: routedUpload,
  getToken: () => storage.getAuthToken(),
  onUnauthorized: handleUnauthorized,
})

const sourceOf = (endpoint: MockableEndpoint) => (mockedEndpoints.has(endpoint) ? 'mock' : 'real') as 'mock' | 'real'

export const apiService = {
  config: apiConfig,
  sourceOf,

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

  getCatalog(): Promise<CatalogResult> {
    return fetchCatalog(client, sourceOf('catalog'))
  },

  createDraftOrder(input: DraftOrderInput, idempotencyKey: string): Promise<ApiResult<Order>> {
    return createDraftOrder(client, input, idempotencyKey)
  },

  updateDraftOrder(orderId: string, patch: DraftOrderPatch): Promise<ApiResult<Order>> {
    return updateDraftOrder(client, orderId, patch)
  },

  getRedFlagQuestions(orderId: string): Promise<ApiResult<RedFlagQuestionnaire>> {
    return getRedFlagQuestions(client, orderId)
  },

  submitRedFlagAnswers(
    orderId: string,
    answers: { questionId: string; value: boolean }[],
    questionnaires?: string[],
  ): Promise<ApiResult<RedFlagOutcome>> {
    return submitRedFlagAnswers(client, orderId, answers, questionnaires)
  },

  uploadReferral(
    orderId: string,
    file: UploadFile,
    onProgress?: (fraction: number) => void,
    idempotencyKey?: string,
  ): Promise<ApiResult<Attachment>> {
    return uploadReferral(client, orderId, file, onProgress, idempotencyKey)
  },

  getOrder(orderId: string): Promise<ApiResult<Order>> {
    return getOrder(client, orderId)
  },

  reportRedFlagBlock(
    orderId: string,
    answers: { questionId: string; value: boolean }[],
    questionnaires: string[],
  ): Promise<BlockReport> {
    return reportRedFlagBlock(client, orderId, answers, questionnaires)
  },

  requestQuote(orderId: string): Promise<ApiResult<Quote>> {
    return requestQuote(client, orderId)
  },

  createInvoice(orderId: string, quoteId: string, idempotencyKey: string): Promise<ApiResult<Invoice>> {
    return createInvoice(client, orderId, quoteId, idempotencyKey)
  },

  getPaymentState(orderId: string, paymentId: string): Promise<ApiResult<PaymentState>> {
    return getPaymentState(client, orderId, paymentId)
  },

  deleteAttachment(orderId: string, attachmentId: string): Promise<ApiResult<true>> {
    return deleteAttachment(client, orderId, attachmentId)
  },
}
