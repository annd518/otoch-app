// Runtime checks for server data. A parser returns null when the payload does
// not match, which the client reports as a contract failure instead of
// pretending the request succeeded.
import { isRecord } from './apiResult'
import {
  USER_ROLES,
  type AppUser,
  type Catalog,
  type CatalogService,
  type Parent,
  type Quote,
  type QuoteLine,
  type UserRole,
  type Visit,
} from './apiTypes'

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : undefined
}

export function parseUser(value: unknown): AppUser | null {
  if (!isRecord(value)) return null
  const { id, name, email, role } = value
  if (!nonEmptyString(id) || typeof name !== 'string' || !nonEmptyString(email) || !isUserRole(role)) return null
  return { id, name, email, role }
}

export function parseUserEnvelope(data: unknown): AppUser | null {
  return isRecord(data) ? parseUser(data.user) : null
}

export interface LoginData {
  token: string
  user: unknown
}

export function parseLoginData(data: unknown): LoginData | null {
  if (!isRecord(data) || !nonEmptyString(data.token)) return null
  return { token: data.token, user: data.user }
}

export interface SignupData {
  user: AppUser
  token: string | null
}

export function parseSignupData(data: unknown): SignupData | null {
  if (!isRecord(data)) return null
  const user = parseUser(data.user)
  if (!user) return null
  return { user, token: nonEmptyString(data.token) ? data.token : null }
}

export function parseParent(value: unknown): Parent | null {
  if (!isRecord(value)) return null
  const { id, name, age, gender, address, emergencyContact } = value
  const diseases = optionalText(value.diseases)
  const medications = optionalText(value.medications)
  if (
    !nonEmptyString(id) ||
    typeof name !== 'string' ||
    !isInteger(age) ||
    typeof gender !== 'string' ||
    typeof address !== 'string' ||
    typeof emergencyContact !== 'string' ||
    diseases === undefined ||
    medications === undefined
  ) {
    return null
  }
  return { id, name, age, gender, address, diseases, medications, emergencyContact }
}

export function parseParentList(data: unknown): Parent[] | null {
  if (!isRecord(data) || !Array.isArray(data.parents)) return null
  const parents: Parent[] = []
  for (const item of data.parents) {
    const parent = parseParent(item)
    if (!parent) return null
    parents.push(parent)
  }
  return parents
}

export function parseCreatedParent(data: unknown): Parent | null {
  return isRecord(data) ? parseParent(data.parent) : null
}

export function parseCreatedVisit(data: unknown): Visit | null {
  if (!isRecord(data) || !isRecord(data.visit)) return null
  const { id, parentId, scheduledFor, visitType, status } = data.visit
  if (
    !nonEmptyString(id) ||
    !nonEmptyString(parentId) ||
    !nonEmptyString(scheduledFor) ||
    (visitType !== 'BASIC' && visitType !== 'FULL') ||
    !nonEmptyString(status)
  ) {
    return null
  }
  return { id, parentId, scheduledFor, visitType, status }
}

function parseCatalogService(value: unknown): CatalogService | null {
  if (!isRecord(value)) return null
  const { id, code, name, priceMnt, durationMin, requiresReferral, isActive } = value
  const redFlag = value.redFlagQuestionnaire
  if (
    !nonEmptyString(id) ||
    !nonEmptyString(code) ||
    !nonEmptyString(name) ||
    !isInteger(priceMnt) ||
    priceMnt < 0 ||
    !isInteger(durationMin) ||
    durationMin <= 0 ||
    typeof requiresReferral !== 'boolean' ||
    typeof isActive !== 'boolean' ||
    (redFlag !== undefined && redFlag !== null && typeof redFlag !== 'string')
  ) {
    return null
  }
  return {
    id,
    code,
    name,
    description: typeof value.description === 'string' ? value.description : '',
    category: typeof value.category === 'string' ? value.category : '',
    priceMnt,
    durationMin,
    requiresReferral,
    redFlagQuestionnaire: typeof redFlag === 'string' ? redFlag : null,
    isActive,
    isFixture: value.isFixture === true,
  }
}

export function parseCatalog(data: unknown): Catalog | null {
  if (!isRecord(data) || data.currency !== 'MNT' || !Array.isArray(data.services)) return null
  const { catalogVersion } = data
  if (catalogVersion !== null && catalogVersion !== undefined && !nonEmptyString(catalogVersion)) return null
  const services: CatalogService[] = []
  for (const item of data.services) {
    const service = parseCatalogService(item)
    if (!service) return null
    services.push(service)
  }
  return {
    catalogVersion: typeof catalogVersion === 'string' ? catalogVersion : null,
    currency: 'MNT',
    containsFixtures: data.containsFixtures === true || services.some((s) => s.isFixture),
    services,
  }
}

function parseQuoteLine(value: unknown): QuoteLine | null {
  if (!isRecord(value) || !nonEmptyString(value.name) || !isInteger(value.amountMnt)) return null
  const line: QuoteLine = { name: value.name, amountMnt: value.amountMnt }
  if (typeof value.serviceId === 'string') line.serviceId = value.serviceId
  if (typeof value.code === 'string') line.code = value.code
  if (isInteger(value.quantity)) line.quantity = value.quantity
  if (typeof value.serviceCode === 'string' && !line.code) line.code = value.serviceCode
  if (isInteger(value.unitPriceMnt)) line.unitPriceMnt = value.unitPriceMnt
  return line
}

export function parseQuote(data: unknown): Quote | null {
  if (!isRecord(data) || !isRecord(data.quote)) return null
  const q = data.quote
  if (
    !nonEmptyString(q.id) ||
    q.currency !== 'MNT' ||
    !Array.isArray(q.lines) ||
    !isInteger(q.subtotalMnt) ||
    !isInteger(q.totalMnt) ||
    !nonEmptyString(q.pricingVersion) ||
    !nonEmptyString(q.expiresAt) ||
    // a quote is never a payment
    q.isPayment === true
  ) {
    return null
  }
  const lines: QuoteLine[] = []
  for (const item of q.lines) {
    const line = parseQuoteLine(item)
    if (!line) return null
    lines.push(line)
  }
  return {
    id: q.id,
    currency: 'MNT',
    lines,
    subtotalMnt: q.subtotalMnt,
    travelFeeMnt: isInteger(q.travelFeeMnt) ? q.travelFeeMnt : null,
    discountMnt: isInteger(q.discountMnt) ? q.discountMnt : null,
    totalMnt: q.totalMnt,
    pricingVersion: q.pricingVersion,
    expiresAt: q.expiresAt,
    isFixture: q.isFixture === true,
    orderVersion: isInteger(q.orderVersion) ? q.orderVersion : null,
    excludes: Array.isArray(q.excludes) ? q.excludes.filter((e): e is string => typeof e === 'string') : [],
  }
}
