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
}

export interface Catalog {
  catalogVersion: string
  currency: 'MNT'
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
