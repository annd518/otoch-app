import { apiConfig } from '../utils/env'
import { sessionEvents } from '../utils/sessionEvents'
import { storage } from '../utils/storage'
import { createHttpClient, type FetchLike, type HttpResponseLike, type UploadLike } from './httpClient'

const REQUEST_TIMEOUT_MS = 15000
const UPLOAD_TIMEOUT_MS = 60000

const timedFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

// multipart upload with progress. fetch() has no upload progress in React
// Native, XMLHttpRequest does.
const formFor = (request: Parameters<UploadLike>[0]) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(request.fields)) form.append(name, value)
  // React Native's FormData accepts { uri, name, type } for files; the DOM
  // typings only know Blob, hence the cast.
  form.append('file', { uri: request.file.uri, name: request.file.name, type: request.file.type } as unknown as Blob)
  return form
}

const xhrUpload: UploadLike = (request) =>
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
    xhr.send(formFor(request))
  })

// When XMLHttpRequest fails before any answer (some devices reject a picked
// file URI there), try once more with fetch(): no progress, same request.
const uploadWithFallback: UploadLike = async (request) => {
  try {
    return await xhrUpload(request)
  } catch {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: formFor(request),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })
    return { status: response.status, text: () => response.text() }
  }
}

// Single client used by every screen.
export const http = createHttpClient({
  config: apiConfig,
  fetch: timedFetch,
  upload: uploadWithFallback,
  getToken: storage.getAuthToken,
  onUnauthorized: async () => {
    await storage.clearSession()
    sessionEvents.emitSignedOut()
  },
})
