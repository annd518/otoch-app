// Booking draft state shared by the booking screens. Pure reducer so back /
// retry behaviour and the red flag lock can be unit tested.
import type {
  CatalogService,
  DraftOrderInput,
  DraftOrderPatch,
  NurseGenderPreference,
  Order,
  Quote,
  RedFlagAdvice,
} from './apiTypes'
import type { ApiMode } from '../utils/apiConfig'
import { isValidCalendarDate, slotStartToUlaanbaatarIso, slotStartToUtcIso, ulaanbaatarDate } from '../utils/datetime'

// priceMnt is the catalog display price only; the payable amount is the
// server quote (quote.totalMnt).
export interface SelectedService {
  id: string
  code: string
  name: string
  priceMnt: number
  durationMin: number
  requiresReferral: boolean
  catalogVersion: string | null
  isFixture: boolean
  source: ApiMode
}

export interface DraftDetails {
  parentId: string | null
  parentName: string
  addressText: string
  date: string
  timeSlot: string
  notes: string
  nurseGenderPreference: NurseGenderPreference
}

export interface ServerDraft {
  orderId: string
  version: number
  status: string
  parentId: string
  source: ApiMode
}

export type RedFlagState =
  | { status: 'not_answered' }
  | { status: 'clear' }
  | { status: 'blocked'; advice: RedFlagAdvice | null }

export type AttachmentStatus = 'selected' | 'uploading' | 'uploaded' | 'failed'

export interface LocalAttachment {
  localId: string
  uri: string
  name: string
  mimeType: 'image/jpeg' | 'image/png'
  sizeBytes: number | null
  status: AttachmentStatus
  progress: number
  serverId: string | null
  error: string | null
}

export interface BookingDraftState {
  service: SelectedService | null
  details: DraftDetails
  server: ServerDraft | null
  // true when local details differ from what the server has saved
  dirty: boolean
  // kept across retries of the same create so the server can de-duplicate
  pendingCreateKey: string | null
  redFlag: RedFlagState
  attachments: LocalAttachment[]
  quote: Quote | null
}

export const EMPTY_DETAILS: DraftDetails = {
  parentId: null,
  parentName: '',
  addressText: '',
  date: '',
  timeSlot: '',
  notes: '',
  nurseGenderPreference: 'ANY',
}

export const INITIAL_DRAFT: BookingDraftState = {
  service: null,
  details: EMPTY_DETAILS,
  server: null,
  dirty: false,
  pendingCreateKey: null,
  redFlag: { status: 'not_answered' },
  attachments: [],
  quote: null,
}

export type BookingDraftAction =
  | { type: 'selectService'; service: CatalogService; catalogVersion: string | null; source: ApiMode }
  | { type: 'updateDetails'; patch: Partial<DraftDetails> }
  | { type: 'createStarted'; key: string }
  | { type: 'draftSaved'; order: Order; source: ApiMode }
  | { type: 'redFlagCleared' }
  | { type: 'redFlagBlocked'; advice: RedFlagAdvice | null }
  | { type: 'attachmentAdded'; attachment: LocalAttachment }
  | { type: 'attachmentUpdated'; localId: string; patch: Partial<LocalAttachment> }
  | { type: 'attachmentRemoved'; localId: string }
  | { type: 'setQuote'; quote: Quote | null }
  | { type: 'reset' }

export function isBlocked(state: BookingDraftState): boolean {
  return state.redFlag.status === 'blocked'
}

export function bookingDraftReducer(state: BookingDraftState, action: BookingDraftAction): BookingDraftState {
  if (action.type === 'reset') return INITIAL_DRAFT
  // A draft stopped by a red flag cannot be edited or continued. Only an
  // explicit reset (a brand new booking) leaves this state.
  if (isBlocked(state) && action.type !== 'redFlagBlocked') return state

  switch (action.type) {
    case 'selectService': {
      const { service, catalogVersion, source } = action
      if (state.service?.id === service.id && state.service.catalogVersion === catalogVersion) return state
      return {
        ...state,
        service: {
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
        dirty: true,
        quote: null,
        // a different service can have a different questionnaire and referral rule
        redFlag: { status: 'not_answered' },
        attachments: [],
      }
    }
    case 'updateDetails': {
      const details = { ...state.details, ...action.patch }
      const changed = (Object.keys(action.patch) as (keyof DraftDetails)[]).some(
        (key) => state.details[key] !== details[key],
      )
      return changed ? { ...state, details, dirty: true, quote: null } : state
    }
    case 'createStarted':
      return { ...state, pendingCreateKey: action.key }
    case 'draftSaved':
      return {
        ...state,
        server: {
          orderId: action.order.id,
          version: action.order.version,
          status: action.order.status,
          parentId: action.order.parentId,
          source: action.source,
        },
        dirty: false,
        pendingCreateKey: null,
      }
    case 'redFlagCleared':
      return { ...state, redFlag: { status: 'clear' } }
    case 'redFlagBlocked':
      return { ...state, redFlag: { status: 'blocked', advice: action.advice } }
    case 'attachmentAdded':
      return { ...state, attachments: [...state.attachments, action.attachment] }
    case 'attachmentUpdated':
      return {
        ...state,
        attachments: state.attachments.map((a) => (a.localId === action.localId ? { ...a, ...action.patch } : a)),
      }
    case 'attachmentRemoved':
      return { ...state, attachments: state.attachments.filter((a) => a.localId !== action.localId) }
    case 'setQuote':
      return { ...state, quote: action.quote }
  }
}

export type DetailsField = 'parent' | 'service' | 'address' | 'date' | 'timeSlot' | 'notes'

export function validateDetails(state: BookingDraftState, now: Date): Partial<Record<DetailsField, string>> {
  const errors: Partial<Record<DetailsField, string>> = {}
  const { details } = state
  if (!details.parentId) errors.parent = 'Өвчтөнөө сонгоно уу'
  if (!state.service) errors.service = 'Каталогоос үйлчилгээ сонгоно уу'
  const address = details.addressText.trim()
  if (address.length < 5 || address.length > 300) errors.address = 'Хаягийг 5-300 тэмдэгтээр оруулна уу'
  const date = details.date.trim()
  if (!isValidCalendarDate(date)) errors.date = 'Огноог YYYY-MM-DD хэлбэрээр зөв оруулна уу'
  else if (date < ulaanbaatarDate(now)) errors.date = 'Ирээдүйн огноо сонгоно уу'
  if (!details.timeSlot) errors.timeSlot = 'Цагаа сонгоно уу'
  else if (!errors.date) {
    const utc = slotStartToUtcIso(date, details.timeSlot)
    if (!utc || new Date(utc).getTime() <= now.getTime()) errors.timeSlot = 'Сонгосон цаг өнгөрсөн байна'
  }
  if (details.notes.length > 500) errors.notes = 'Нэмэлт заавар 500 тэмдэгтээс ихгүй байна'
  return errors
}

// Request body for POST /api/orders (docs/l1-1-api.md §3.1). scheduledFor is
// sent with the +08:00 offset the proposal requires.
export function buildDraftInput(state: BookingDraftState): DraftOrderInput | null {
  const { service, details } = state
  const scheduledFor = slotStartToUlaanbaatarIso(details.date.trim(), details.timeSlot)
  if (!service || !details.parentId || !scheduledFor) return null
  const notes = details.notes.trim()
  return {
    parentId: details.parentId,
    items: [{ serviceId: service.id, serviceCode: service.code, quantity: 1 }],
    catalogVersion: service.catalogVersion,
    scheduledFor,
    timeSlot: details.timeSlot,
    address: { text: details.addressText.trim() },
    ...(notes ? { notes } : {}),
    nurseGenderPreference: details.nurseGenderPreference,
  }
}

export type DraftSavePlan =
  | { kind: 'create'; input: DraftOrderInput; key: string }
  | { kind: 'update'; orderId: string; patch: DraftOrderPatch }
  | { kind: 'none' }
  | { kind: 'invalid' }

export function planDraftSave(state: BookingDraftState, newKey: () => string): DraftSavePlan {
  const input = buildDraftInput(state)
  if (!input) return { kind: 'invalid' }
  // No saved draft yet, or the patient changed (a draft belongs to one patient):
  // create a new draft. A retry after a failure reuses the same key.
  if (!state.server || state.server.parentId !== input.parentId) {
    return { kind: 'create', input, key: state.pendingCreateKey ?? newKey() }
  }
  if (!state.dirty) return { kind: 'none' }
  const patch: DraftOrderPatch = {
    version: state.server.version,
    items: input.items,
    catalogVersion: input.catalogVersion,
    scheduledFor: input.scheduledFor,
    timeSlot: input.timeSlot,
    address: input.address,
    nurseGenderPreference: input.nurseGenderPreference,
    ...(input.notes ? { notes: input.notes } : {}),
  }
  return { kind: 'update', orderId: state.server.orderId, patch }
}

// Where "continue" goes once the draft is saved on the server.
export type BookingStep = '/booking/red-flags' | '/booking/referral' | '/booking/review' | '/booking/emergency'

export function nextStepAfterDetails(state: BookingDraftState, orderRequiresReferral = false): BookingStep {
  if (isBlocked(state)) return '/booking/emergency'
  if (state.redFlag.status !== 'clear') return '/booking/red-flags'
  return needsReferral(state, orderRequiresReferral) ? '/booking/referral' : '/booking/review'
}

export function needsReferral(state: BookingDraftState, orderRequiresReferral = false): boolean {
  return state.service?.requiresReferral === true || orderRequiresReferral
}

export function uploadedReferralCount(state: BookingDraftState): number {
  return state.attachments.filter((a) => a.status === 'uploaded').length
}
