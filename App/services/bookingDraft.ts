// Booking draft state shared by the booking screens. Pure reducer so back /
// retry behaviour and the red flag lock can be unit tested.
import type {
  CatalogService,
  BookingForm,
  DraftOrderInput,
  DraftOrderPatch,
  NurseGenderPreference,
  Order,
  Quote,
  RedFlagAdvice,
} from "./apiTypes";
import type { ApiMode } from "../utils/apiConfig";
import {
  isValidCalendarDate,
  slotStartToUlaanbaatarIso,
  slotStartToUtcIso,
  ulaanbaatarDate,
} from "../utils/datetime";

// priceMnt is the catalog display price only; the payable amount is the
// server quote (quote.totalMnt).
export interface SelectedService {
  formConfig?: CatalogService["formConfig"];
  id: string;
  code: string;
  name: string;
  priceMnt: number;
  durationMin: number;
  requiresReferral: boolean;
  catalogVersion: string | null;
  isFixture: boolean;
  source: ApiMode;
}

export interface DraftDetails {
  zoneId?: string;
  lat?: number;
  lng?: number;
  bookingForm?: BookingForm;
  parentId: string | null;
  parentName: string;
  addressText: string;
  date: string;
  timeSlot: string;
  notes: string;
  nurseGenderPreference: NurseGenderPreference;
}

export interface ServerDraft {
  catalogVersion?: string;
  orderId: string;
  version: number;
  status: string;
  parentId: string;
  // service code the server has stored for this draft
  serviceCode: string | null;
  // body fields the server reported as not stored (e.g. nurseGenderPreference)
  ignoredFields: string[];
  referralUploadAvailable: boolean | null;
  source: ApiMode;
}

// How far the server knows about a block:
// recorded      the server stored FLAGGED / BLOCKED_RED_FLAG
// pending       not confirmed yet (network error etc.), retried
// not_supported the server rejects partial answers (GAP-13), retried later
export type BlockServerState = "recorded" | "pending" | "not_supported";

export interface PendingBlockAnswers {
  questionnaires: string[];
  answers: { questionId: string; value: boolean }[];
}

export type RedFlagState =
  | { status: "not_answered" }
  | { status: "clear" }
  | {
      status: "blocked";
      advice: RedFlagAdvice | null;
      server: BlockServerState;
      report: PendingBlockAnswers | null;
    };

export type AttachmentStatus = "selected" | "uploading" | "uploaded" | "failed";

export interface LocalAttachment {
  localId: string;
  uri: string;
  name: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number | null;
  status: AttachmentStatus;
  progress: number;
  serverId: string | null;
  error: string | null;
  storage?: string | null;
}

export interface BookingDraftState {
  service: SelectedService | null;
  details: DraftDetails;
  server: ServerDraft | null;
  // true when local details differ from what the server has saved
  dirty: boolean;
  // One logical create attempt: the key is reused for every retry of the same
  // payload (also after a timeout with unknown outcome). A different payload
  // or a reset starts a new logical create with a new key.
  pendingCreate: { key: string; fingerprint: string } | null;
  // Idempotency key of the current invoice attempt (one per quote)
  paymentKey: { quoteId: string; key: string } | null;
  redFlag: RedFlagState;
  attachments: LocalAttachment[];
  quote: Quote | null;
}

export const EMPTY_DETAILS: DraftDetails = {
  parentId: null,
  parentName: "",
  addressText: "",
  date: "",
  timeSlot: "",
  notes: "",
  nurseGenderPreference: "ANY",
};

export const INITIAL_DRAFT: BookingDraftState = {
  service: null,
  details: EMPTY_DETAILS,
  server: null,
  dirty: false,
  pendingCreate: null,
  paymentKey: null,
  redFlag: { status: "not_answered" },
  attachments: [],
  quote: null,
};

export type BookingDraftAction =
  | {
      type: "selectService";
      service: CatalogService;
      catalogVersion: string | null;
      source: ApiMode;
    }
  | { type: "updateDetails"; patch: Partial<DraftDetails> }
  | { type: "createStarted"; key: string; fingerprint: string }
  | { type: "draftSaved"; order: Order; source: ApiMode }
  | { type: "redFlagCleared"; version?: number | null }
  | {
      type: "redFlagBlocked";
      advice: RedFlagAdvice | null;
      version?: number | null;
      server?: BlockServerState;
      report?: PendingBlockAnswers | null;
    }
  | { type: "blockReported"; server: BlockServerState; version?: number | null }
  | { type: "paymentKey"; quoteId: string; key: string }
  | { type: "attachmentAdded"; attachment: LocalAttachment }
  | {
      type: "attachmentUpdated";
      localId: string;
      patch: Partial<LocalAttachment>;
    }
  | { type: "attachmentRemoved"; localId: string }
  // The server reported this order version (e.g. after an upload); it only grows
  | { type: "serverVersionSeen"; version: number }
  | { type: "setQuote"; quote: Quote | null }
  // Restores a draft kept on the device (services/draftPersistence.ts). Applies
  // only to an untouched draft, so it never overwrites what the user started.
  | { type: "hydrate"; state: BookingDraftState }
  | { type: "reset" };

// Answering the questionnaire bumps the server-side version; keep it in sync
// so the next PATCH is not rejected with VERSION_CONFLICT.
function withVersion(
  server: ServerDraft | null,
  version: number | null | undefined,
): ServerDraft | null {
  return server && typeof version === "number"
    ? { ...server, version }
    : server;
}

export function isBlocked(state: BookingDraftState): boolean {
  return state.redFlag.status === "blocked";
}

export function bookingDraftReducer(
  state: BookingDraftState,
  action: BookingDraftAction,
): BookingDraftState {
  if (action.type === "reset") return INITIAL_DRAFT;
  if (action.type === "hydrate")
    return state === INITIAL_DRAFT ? action.state : state;
  // A draft stopped by a red flag cannot be edited or continued. Only an
  // explicit reset (a brand new booking) leaves this state.
  if (
    isBlocked(state) &&
    action.type !== "redFlagBlocked" &&
    action.type !== "blockReported"
  )
    return state;

  switch (action.type) {
    case "selectService": {
      const { service, catalogVersion, source } = action;
      if (
        state.service?.id === service.id &&
        state.service.catalogVersion === catalogVersion
      )
        return state;
      return {
        ...state,
        service: {
          formConfig: service.formConfig,
          id: service.id,
          code: service.code,
          name: service.name,
          priceMnt: service.priceMnt,
          durationMin: service.durationMin,
          requiresReferral: service.requiresReferral,
          catalogVersion,
          isFixture: service.isFixture,
          source,
        },
        details: {
          ...state.details,
          ...(state.details.bookingForm && {
            bookingForm: {
              ...state.details.bookingForm,
              consent: {
                ...state.details.bookingForm.consent,
                service: false,
                sensitiveData: false,
                catalogVersion: null,
              },
            },
          }),
        },
        dirty: true,
        quote: null,
        paymentKey: null,
        // a different service can have a different questionnaire and referral rule
        redFlag: { status: "not_answered" },
        attachments: [],
      };
    }
    case "updateDetails": {
      const details = { ...state.details, ...action.patch };
      const changed = (
        Object.keys(action.patch) as (keyof DraftDetails)[]
      ).some((key) => state.details[key] !== details[key]);
      return changed
        ? { ...state, details, dirty: true, quote: null, paymentKey: null }
        : state;
    }
    case "createStarted":
      return {
        ...state,
        pendingCreate: { key: action.key, fingerprint: action.fingerprint },
      };
    case "draftSaved": {
      const { order } = action;
      // The server is the source of truth for the red flag state: changing the
      // service resets it to NOT_ANSWERED there, a flagged order stays blocked.
      const redFlag: RedFlagState =
        order.status === "BLOCKED_RED_FLAG" || order.redFlagStatus === "FLAGGED"
          ? {
              status: "blocked",
              advice: null,
              server: "recorded",
              report: null,
            }
          : order.redFlagStatus === "CLEAR"
            ? { status: "clear" }
            : { status: "not_answered" };
      return {
        ...state,
        server: {
          ...(order.catalogVersion && { catalogVersion: order.catalogVersion }),
          orderId: order.id,
          version: order.version,
          status: order.status,
          parentId: order.parentId,
          serviceCode: order.serviceCodes[0] ?? state.service?.code ?? null,
          ignoredFields: order.ignoredFields,
          referralUploadAvailable: order.referralUploadAvailable,
          source: action.source,
        },
        redFlag,
        dirty: false,
        pendingCreate: null,
      };
    }
    case "redFlagCleared":
      return {
        ...state,
        server: withVersion(state.server, action.version),
        redFlag: { status: "clear" },
        quote: null,
      };
    case "redFlagBlocked": {
      const previous =
        state.redFlag.status === "blocked" ? state.redFlag : null;
      return {
        ...state,
        server: withVersion(state.server, action.version),
        quote: null,
        paymentKey: null,
        redFlag: {
          status: "blocked",
          advice: action.advice ?? previous?.advice ?? null,
          server: action.server ?? previous?.server ?? "pending",
          report: action.report ?? previous?.report ?? null,
        },
      };
    }
    case "blockReported":
      if (state.redFlag.status !== "blocked") return state;
      return {
        ...state,
        server: withVersion(state.server, action.version),
        redFlag: {
          ...state.redFlag,
          server: action.server,
          report: action.server === "recorded" ? null : state.redFlag.report,
        },
      };
    case "paymentKey":
      return {
        ...state,
        paymentKey: { quoteId: action.quoteId, key: action.key },
      };
    case "attachmentAdded":
      return {
        ...state,
        attachments: [...state.attachments, action.attachment],
      };
    case "attachmentUpdated":
      return {
        ...state,
        attachments: state.attachments.map((a) =>
          a.localId === action.localId ? { ...a, ...action.patch } : a,
        ),
      };
    case "attachmentRemoved":
      return {
        ...state,
        attachments: state.attachments.filter(
          (a) => a.localId !== action.localId,
        ),
      };
    case "serverVersionSeen":
      return state.server && action.version > state.server.version
        ? { ...state, server: { ...state.server, version: action.version } }
        : state;
    case "setQuote":
      // a new quote needs a new invoice attempt
      return {
        ...state,
        quote: action.quote,
        paymentKey:
          action.quote?.id === state.paymentKey?.quoteId
            ? state.paymentKey
            : null,
      };
  }
}

export type DetailsField =
  "parent" | "service" | "address" | "date" | "timeSlot" | "notes";

export function validateDetails(
  state: BookingDraftState,
  now: Date,
): Partial<Record<DetailsField, string>> {
  const errors: Partial<Record<DetailsField, string>> = {};
  const { details } = state;
  if (!details.parentId) errors.parent = "Өвчтөнөө сонгоно уу";
  if (!state.service) errors.service = "Каталогоос үйлчилгээ сонгоно уу";
  const address = details.addressText.trim();
  if (address.length < 5 || address.length > 300)
    errors.address = "Хаягийг 5-300 тэмдэгтээр оруулна уу";
  const date = details.date.trim();
  if (!isValidCalendarDate(date))
    errors.date = "Огноог YYYY-MM-DD хэлбэрээр зөв оруулна уу";
  else if (date < ulaanbaatarDate(now))
    errors.date = "Ирээдүйн огноо сонгоно уу";
  if (!details.timeSlot) errors.timeSlot = "Цагаа сонгоно уу";
  else if (!errors.date) {
    const utc = slotStartToUtcIso(date, details.timeSlot);
    if (!utc || new Date(utc).getTime() <= now.getTime())
      errors.timeSlot = "Сонгосон цаг өнгөрсөн байна";
  }
  if (details.notes.length > 500)
    errors.notes = "Нэмэлт заавар 500 тэмдэгтээс ихгүй байна";
  return errors;
}

// Request body for POST /api/orders (docs/l1-1-api.md §3.1). scheduledFor is
// sent with the +08:00 offset the proposal requires.
export function buildDraftInput(
  state: BookingDraftState,
): DraftOrderInput | null {
  const { service, details } = state;
  const scheduledFor = slotStartToUlaanbaatarIso(
    details.date.trim(),
    details.timeSlot,
  );
  if (!service || !details.parentId || !scheduledFor) return null;
  const notes = details.notes.trim();
  return {
    parentId: details.parentId,
    items: [{ serviceId: service.id, serviceCode: service.code, quantity: 1 }],
    catalogVersion: service.catalogVersion,
    scheduledFor,
    timeSlot: details.timeSlot,
    address: {
      text: details.addressText.trim(),
      ...(details.lat !== undefined && { lat: details.lat }),
      ...(details.lng !== undefined && { lng: details.lng }),
    },
    ...(details.zoneId && { zoneId: details.zoneId }),
    ...(details.bookingForm && { bookingForm: details.bookingForm }),
    ...(notes ? { notes } : {}),
    // nurseGenderPreference is not sent: the server does not store it (GAP-16)
  };
}

export type DraftSavePlan =
  | { kind: "create"; input: DraftOrderInput; key: string; fingerprint: string }
  | { kind: "update"; orderId: string; patch: DraftOrderPatch }
  | { kind: "none" }
  | { kind: "invalid" };

export function planDraftSave(
  state: BookingDraftState,
  newKey: () => string,
): DraftSavePlan {
  const input = buildDraftInput(state);
  if (!input) return { kind: "invalid" };
  // No saved draft yet, or the patient changed (a draft belongs to one patient):
  // create a new draft. A retry after a failure reuses the same key.
  if (!state.server || state.server.parentId !== input.parentId) {
    const fingerprint = JSON.stringify(input);
    const reuse =
      state.pendingCreate && state.pendingCreate.fingerprint === fingerprint;
    return {
      kind: "create",
      input,
      fingerprint,
      key: reuse && state.pendingCreate ? state.pendingCreate.key : newKey(),
    };
  }
  const catalogChanged =
    !!state.server.catalogVersion &&
    state.server.catalogVersion !== state.service?.catalogVersion;
  if (!state.dirty && !catalogChanged) return { kind: "none" };
  // Items are sent only when the service changed: the server treats any
  // `items` as a change and resets the red flag answers.
  const serviceChanged =
    state.server.serviceCode !== state.service?.code || catalogChanged;
  const patch: DraftOrderPatch = {
    version: state.server.version,
    ...(serviceChanged
      ? { items: input.items, catalogVersion: input.catalogVersion }
      : {}),
    scheduledFor: input.scheduledFor,
    timeSlot: input.timeSlot,
    address: input.address,
    ...(input.zoneId && { zoneId: input.zoneId }),
    ...(input.bookingForm && { bookingForm: input.bookingForm }),
    notes: input.notes ?? null,
  };
  return { kind: "update", orderId: state.server.orderId, patch };
}

// Where "continue" goes once the draft is saved on the server.
export type BookingStep =
  | "/booking/red-flags"
  | "/booking/referral"
  | "/booking/review"
  | "/booking/emergency";

export function nextStepAfterDetails(
  state: BookingDraftState,
  orderRequiresReferral = false,
): BookingStep {
  if (isBlocked(state)) return "/booking/emergency";
  if (state.redFlag.status !== "clear") return "/booking/red-flags";
  return needsReferral(state, orderRequiresReferral)
    ? "/booking/referral"
    : "/booking/review";
}

export function needsReferral(
  state: BookingDraftState,
  orderRequiresReferral = false,
): boolean {
  return (
    state.service?.requiresReferral === true ||
    (state.service?.formConfig?.referral === "partial" &&
      state.details.bookingForm?.postoperative === true) ||
    medicationPhotoChosen(state) ||
    orderRequiresReferral
  );
}

/** Step 3 chose to give the medicine as a prescription photo: a photo is then required. */
export function medicationPhotoChosen(state: BookingDraftState): boolean {
  const form = state.details.bookingForm;
  return form?.medicationSource === "PHOTO" && !!form.medication;
}

export function uploadedReferralCount(state: BookingDraftState): number {
  return state.attachments.filter((a) => a.status === "uploaded").length;
}

// Same limits as the server: a typed prescription counts instead of a photo
// once it has at least MIN_REFERRAL_TEXT characters.
export const MIN_REFERRAL_TEXT = 10;
export const MAX_REFERRAL_TEXT = 2000;

export function referralTextOk(text: string | null | undefined): boolean {
  return (text?.trim().length ?? 0) >= MIN_REFERRAL_TEXT;
}

/**
 * A photo on the server or a long enough typed prescription; only a photo
 * when the medicine was to be given as a photo.
 */
export function hasReferralInput(state: BookingDraftState): boolean {
  if (medicationPhotoChosen(state)) return uploadedReferralCount(state) > 0;
  return (
    uploadedReferralCount(state) > 0 ||
    referralTextOk(state.details.bookingForm?.referralText)
  );
}
