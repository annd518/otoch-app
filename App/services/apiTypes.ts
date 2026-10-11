// Shared API types. Field names follow the current server code and the
// backend proposal in docs/l1-1-api.md (not yet approved).

export const USER_ROLES = ['CHILD', 'NURSE', 'MEDICAL_ADMIN', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface Parent {
  id: string
  name: string
  age: number
  gender: string
  address: string
  diseases: string | null
  medications: string | null
  emergencyContact: string
}

export interface NewParentInput {
  name: string
  age: number
  gender: string
  address: string
  diseases?: string
  medications?: string
  emergencyContact: string
}

export type VisitType = 'BASIC' | 'FULL'

export interface Visit {
  id: string
  parentId: string
  scheduledFor: string
  visitType: VisitType
  status: string
}

export interface NewVisitInput {
  parentId: string
  scheduledFor: string
  visitType: VisitType
}

export interface SignupInput {
  name: string
  email: string
  password: string
}

// docs/l1-1-api.md §2 (proposal, not implemented on the server yet)
export interface CatalogService {
  id: string
  code: string
  name: string
  description: string
  category: string
  priceMnt: number
  durationMin: number
  requiresReferral: boolean
  redFlagQuestionnaire: string | null
  isActive: boolean
  // Backend marks fictional seed rows (work/backend-l1-1). Defaults to false.
  isFixture: boolean
}

export interface Catalog {
  // null when the catalog has no active rows (backend implementation).
  catalogVersion: string | null
  currency: 'MNT'
  containsFixtures: boolean
  services: CatalogService[]
}

// docs/l1-1-api.md §6 (proposal). The app only displays these values.
export interface QuoteLine {
  name: string
  amountMnt: number
  serviceId?: string
  code?: string
  quantity?: number
  unitPriceMnt?: number
}

export interface Quote {
  id: string
  currency: 'MNT'
  lines: QuoteLine[]
  subtotalMnt: number
  travelFeeMnt: number
  discountMnt: number
  totalMnt: number
  pricingVersion: string
  expiresAt: string
}

// ---- Orders, red flags, attachments: docs/l1-1-api.md §3-§5 (proposal, not
// implemented on the server yet). Field names follow the proposal.

export type NurseGenderPreference = 'ANY' | 'FEMALE' | 'MALE'

export interface DraftOrderItemInput {
  // The implemented server (work/backend-l1-1 d842241) resolves the service by
  // serviceCode and ignores serviceId; serviceId is kept for the original
  // proposal and for tracing.
  serviceId: string
  serviceCode: string
  quantity: number
}

export interface DraftOrderInput {
  parentId: string
  items: DraftOrderItemInput[]
  // The server answers 409 CATALOG_OUTDATED when this does not match.
  catalogVersion: string | null
  scheduledFor: string
  timeSlot: string
  address: { text: string }
  notes?: string
  nurseGenderPreference: NurseGenderPreference
}

// `notes: null` clears the note on the server.
export type DraftOrderPatch = Partial<Omit<DraftOrderInput, 'parentId' | 'notes'>> & { version: number; notes?: string | null }

export interface Order {
  id: string
  status: string
  version: number
  parentId: string
  serviceCodes: string[]
  scheduledFor: string | null
  timeSlot: string | null
  redFlagStatus: string
  requiresReferral: boolean
  // null when the server does not say (proposal shape)
  referralUploadAvailable: boolean | null
  // body fields the server did not store (data.ignoredFields)
  ignoredFields: string[]
}

export interface RedFlagQuestion {
  id: string
  code: string
  text: string
  required: boolean
  isFixture: boolean
}

export interface RedFlagQuestionnaire {
  // Questionnaire codes for this order; empty means no questionnaire is required.
  questionnaires: string[]
  // true only when the server says a medical owner approved the wording.
  approved: boolean
  containsFixtures: boolean
  orderStatus: string | null
  redFlagStatus: string | null
  questions: RedFlagQuestion[]
}

export interface RedFlagAdvice {
  text: string
  phone: string | null
  isFixture: boolean
}

export type RedFlagOutcome =
  | { status: 'CLEAR'; orderStatus: string; version: number | null }
  | {
      status: 'FLAGGED'
      orderStatus: string
      version: number | null
      triggeredCodes: string[]
      advice: RedFlagAdvice | null
    }

export interface Attachment {
  id: string
  kind: string
  mimeType: string
  sizeBytes: number
}
