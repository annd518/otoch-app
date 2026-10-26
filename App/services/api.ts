import * as FileSystem from "expo-file-system/legacy";
// The app's single API entry point. Screens call apiService only; they never
// use fetch/axios directly. Logic lives in pure modules (httpClient, authFlow,
// catalog, orders) that are unit tested in tests/.
import { connectivity } from "./connectivity";
import {
  registerPushDevice,
  unregisterPushDevice,
  type PushApp,
} from "./push";
import { otpApi } from "./otp";
import { clientV2 } from "./clientV2";
import { router } from "expo-router";

import { API_PATHS } from "../config/api";
import { createMockBackend } from "../mocks/mockBackend";
import { apiConfig, mockScenario, mockedEndpoints } from "../utils/env";
import { storage } from "../utils/storage";
import { demoPatient, demoPatientName } from "../utils/demoPersona";
import type { ApiResult } from "./apiResult";
import type {
  Attachment,
  DraftOrderInput,
  DraftOrderPatch,
  NewParentInput,
  CancelTerms,
  RatingTag,
  Order,
  Quote,
  Parent,
  RedFlagOutcome,
  RedFlagQuestionnaire,
  SignupInput,
} from "./apiTypes";
import {
  loginFlow,
  logoutFlow,
  signupFlow,
  type LoginOutcome,
  type SignupOutcome,
} from "./authFlow";
import { fetchCatalog, type CatalogResult } from "./catalog";
import { endpointForPath, pathOfUrl, type MockableEndpoint } from "./endpoints";
import {
  createHttpClient,
  type FetchLike,
  type HttpResponseLike,
  type UploadFile,
  type UploadLike,
} from "./httpClient";
import {
  cancelOrder,
  rateOrder,
  createDraftOrder,
  deleteAttachment,
  getCancelTerms,
  getOrder,
  getRedFlagQuestions,
  listOrders,
  reportRedFlagBlock,
  requestQuote,
  submitRedFlagAnswers,
  updateDraftOrder,
  uploadReferral,
  type BlockReport,
} from "./orders";
import {
  createInvoice,
  getInvoice,
  devMockPay,
  getPaymentState,
  recoverPayment,
  type Invoice,
  type PaymentRecord,
  type PaymentState,
  type RecoveryResult,
} from "./payment";
import {
  parseCreatedParent,
  parseParent,
  parseParentList,
  parseUser,
} from "./validators";

const REQUEST_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 60000;

const realFetch: FetchLike = async (url, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    if (connectivity.get() && !["GET"].includes(init.method))
      throw new TypeError("offline");
    const response = await fetch(url, { ...init, signal: controller.signal });
    connectivity.set(false);
    return response;
  } catch (error) {
    connectivity.set(true);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// multipart upload with progress. fetch() has no upload progress in React
// Native, XMLHttpRequest does.
const realUpload: UploadLike = (request) =>
  new Promise<HttpResponseLike>((resolve, reject) => {
    if (connectivity.get()) {
      reject(new TypeError("offline"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", request.url);
    for (const [name, value] of Object.entries(request.headers))
      xhr.setRequestHeader(name, value);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && request.onProgress)
        request.onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const body = xhr.responseText ?? "";
      resolve({ status: xhr.status, text: async () => body });
    };
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.ontimeout = () => reject(new TypeError("Network request timed out"));
    const form = new FormData();
    for (const [name, value] of Object.entries(request.fields))
      form.append(name, value);
    // React Native's FormData accepts { uri, name, type } for files; the DOM
    // typings only know Blob, hence the cast.
    form.append("file", {
      uri: request.file.uri,
      name: request.file.name,
      type: request.file.type,
    } as unknown as Blob);
    xhr.send(form);
  });

const mock =
  mockedEndpoints.size > 0
    ? createMockBackend({ scenario: mockScenario })
    : null;

const isMocked = (url: string): boolean => {
  const endpoint = endpointForPath(pathOfUrl(url));
  return endpoint !== null && mockedEndpoints.has(endpoint);
};

const routedFetch: FetchLike = (url, init) =>
  mock && isMocked(url) ? mock.fetch(url, init) : realFetch(url, init);
const routedUpload: UploadLike = (request) =>
  mock && isMocked(request.url) ? mock.upload(request) : realUpload(request);

// Any 401 on an authenticated request (or a locally expired token) ends the session.
async function handleUnauthorized(): Promise<void> {
  if (connectivity.get()) return;
  await storage.clearSession();
  router.replace({ pathname: "/auth/phone", params: { expired: "1" } });
}

const client = createHttpClient({
  config: apiConfig,
  fetch: routedFetch,
  upload: routedUpload,
  getToken: () => storage.getAuthToken(),
  onUnauthorized: handleUnauthorized,
});

const sourceOf = (endpoint: MockableEndpoint) =>
  (mockedEndpoints.has(endpoint) ? "mock" : "real") as "mock" | "real";

const readCache = new Map<string, unknown>();
async function cachedRead<T>(
  key: string,
  request: () => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const user = await storage.getUser();
  const scoped = `${user?.id ?? "anonymous"}:${key}`;
  if (connectivity.get() && readCache.has(scoped))
    return {
      ok: true,
      data: readCache.get(scoped) as T,
      message: "Хадгалсан мэдээлэл. Шинэчлэгдээгүй.",
    };
  const result = await request();
  if (result.ok) readCache.set(scoped, result.data);
  else if (
    (result.kind === "network" || connectivity.get()) &&
    readCache.has(scoped)
  )
    return {
      ok: true,
      data: readCache.get(scoped) as T,
      message: "Хадгалсан мэдээлэл. Шинэчлэгдээгүй.",
    };
  return result;
}
export const apiService = {
  retryConnection: async () => {
    if (!apiConfig.ok) return;
    try {
      const response = await realFetch(`${apiConfig.baseUrl}/api/health`, {
        method: "GET",
        headers: {},
      });
      connectivity.set(response.status < 200 || response.status >= 300);
    } catch {
      connectivity.set(true);
    }
  },
  ...clientV2(client),
  updateProfile: (name: string) =>
    client.request({
      method: "PUT",
      path: "/api/client/profile",
      body: { name },
      parse: (data) =>
        typeof data === "object" && data !== null && "user" in data
          ? parseUser(data.user)
          : null,
    }),
  getRecordPdf: async (id: string): Promise<ApiResult<string>> => {
    if (!apiConfig.ok || !FileSystem.cacheDirectory)
      return {
        ok: false,
        kind: "config",
        message: "PDF татах боломжгүй орчин байна.",
      };
    const token = await storage.getAuthToken();
    if (!token)
      return { ok: false, kind: "unauthorized", message: "Дахин нэвтэрнэ үү." };
    if (connectivity.get())
      return {
        ok: false,
        kind: "network",
        message: "PDF татахад интернэт холболт шаардлагатай.",
      };
    try {
      const file = await FileSystem.downloadAsync(
        `${apiConfig.baseUrl}/api/client/records/${encodeURIComponent(id)}/pdf`,
        `${FileSystem.cacheDirectory}otoch-${encodeURIComponent(id)}.pdf`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (file.status !== 200) {
        if (file.status === 401) await handleUnauthorized();
        return {
          ok: false,
          kind: "http",
          message: "Тэмдэглэлийн PDF-ийг татаж чадсангүй.",
        };
      }
      return { ok: true, data: file.uri };
    } catch {
      return {
        ok: false,
        kind: "network",
        message: "Татаж чадсангүй. Холболтоо шалгана уу.",
      };
    }
  },
  records: () =>
    cachedRead("records", async () => {
      const result = await clientV2(client).records();
      const user = await storage.getUser();
      return result.ok
        ? {
            ...result,
            data: result.data.map((record) => ({
              ...record,
              patientName: demoPatientName(user?.email, record.patientName),
            })),
          }
        : result;
    }),
  getParent: async (id: string) => {
    const result = await client.request({
      method: "GET",
      path: `/api/parents/${encodeURIComponent(id)}`,
      parse: (data) =>
        typeof data === "object" && data !== null && "parent" in data
          ? parseParent(data.parent)
          : null,
    });
    const user = await storage.getUser();
    return result.ok
      ? { ...result, data: demoPatient(user?.email, result.data) }
      : result;
  },
  updateParent: (id: string, body: NewParentInput) =>
    client.request({
      method: "PUT",
      path: `/api/parents/${encodeURIComponent(id)}`,
      body,
      parse: () => true,
    }),
  ...otpApi(client),
  config: apiConfig,
  sourceOf,

  login(email: string, password: string): Promise<LoginOutcome> {
    return loginFlow(client, storage, email, password);
  },

  signup(input: SignupInput): Promise<SignupOutcome> {
    return signupFlow(client, storage, input);
  },

  registerPush(device: {
    token: string;
    app: PushApp;
    platform: "ios" | "android";
  }): Promise<ApiResult<true>> {
    return registerPushDevice(client, device);
  },

  unregisterPush(token: string): Promise<ApiResult<true>> {
    return unregisterPushDevice(client, token);
  },

  logout(): Promise<void> {
    readCache.clear();
    return logoutFlow(storage);
  },

  async getParents(): Promise<ApiResult<Parent[]>> {
    const result = await client.request({
      method: "GET",
      path: API_PATHS.parents.list,
      parse: parseParentList,
    });
    const user = await storage.getUser();
    return result.ok
      ? {
          ...result,
          data: result.data.map((patient) => demoPatient(user?.email, patient)),
        }
      : result;
  },

  createParent(input: NewParentInput): Promise<ApiResult<Parent>> {
    return client.request({
      method: "POST",
      path: API_PATHS.parents.list,
      body: input,
      parse: parseCreatedParent,
    });
  },

  async getCatalog(): Promise<CatalogResult> {
    const source = sourceOf("catalog");
    const result = await cachedRead("catalog", () =>
      fetchCatalog(client, source),
    );
    return { ...result, source };
  },

  createDraftOrder(
    input: DraftOrderInput,
    idempotencyKey: string,
  ): Promise<ApiResult<Order>> {
    return createDraftOrder(client, input, idempotencyKey);
  },

  updateDraftOrder(
    orderId: string,
    patch: DraftOrderPatch,
  ): Promise<ApiResult<Order>> {
    return updateDraftOrder(client, orderId, patch);
  },

  getRedFlagQuestions(
    orderId: string,
  ): Promise<ApiResult<RedFlagQuestionnaire>> {
    return getRedFlagQuestions(client, orderId);
  },

  submitRedFlagAnswers(
    orderId: string,
    answers: { questionId: string; value: boolean }[],
    questionnaires?: string[],
  ): Promise<ApiResult<RedFlagOutcome>> {
    return submitRedFlagAnswers(client, orderId, answers, questionnaires);
  },

  uploadReferral(
    orderId: string,
    file: UploadFile,
    onProgress?: (fraction: number) => void,
    idempotencyKey?: string,
  ): Promise<ApiResult<Attachment>> {
    return uploadReferral(client, orderId, file, onProgress, idempotencyKey);
  },

  getOrder(orderId: string): Promise<ApiResult<Order>> {
    return getOrder(client, orderId);
  },

  getCancelTerms(orderId: string): Promise<ApiResult<CancelTerms>> {
    return getCancelTerms(client, orderId);
  },

  cancelOrder(orderId: string, refundPercent: number): Promise<ApiResult<Order>> {
    readCache.clear();
    return cancelOrder(client, orderId, refundPercent);
  },

  rateOrder(
    orderId: string,
    rating: { stars: number; tags: RatingTag[]; comment?: string },
  ): Promise<ApiResult<Order>> {
    readCache.clear();
    return rateOrder(client, orderId, rating);
  },

  reportRedFlagBlock(
    orderId: string,
    answers: { questionId: string; value: boolean }[],
    questionnaires: string[],
  ): Promise<BlockReport> {
    return reportRedFlagBlock(client, orderId, answers, questionnaires);
  },

  requestQuote(
    orderId: string,
    orderVersion: number,
  ): Promise<ApiResult<Quote>> {
    return requestQuote(client, orderId, orderVersion);
  },

  createInvoice(
    orderId: string,
    quoteId: string,
    idempotencyKey: string,
  ): Promise<ApiResult<Invoice>> {
    return createInvoice(client, orderId, quoteId, idempotencyKey);
  },

  getPaymentState(
    orderId: string,
    paymentId: string,
  ): Promise<ApiResult<PaymentState>> {
    return getPaymentState(client, orderId, paymentId);
  },

  getInvoice(orderId: string, paymentId: string): Promise<ApiResult<Invoice>> {
    return getInvoice(client, orderId, paymentId);
  },

  devMockPay(orderId: string, paymentId: string): Promise<ApiResult<true>> {
    return devMockPay(client, orderId, paymentId);
  },

  recoverPayment(
    record: PaymentRecord,
  ): Promise<{ result: RecoveryResult; paymentId: string | null }> {
    return recoverPayment(client, record, Date.now());
  },

  listOrders(status = ""): Promise<ApiResult<Order[]>> {
    return cachedRead(`orders:${status}`, () => listOrders(client, status));
  },

  deleteAttachment(
    orderId: string,
    attachmentId: string,
  ): Promise<ApiResult<true>> {
    return deleteAttachment(client, orderId, attachmentId);
  },
};
