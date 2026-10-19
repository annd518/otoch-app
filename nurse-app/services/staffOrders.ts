// Orders assigned to the signed-in nurse (server/src/routes/staffOrders.ts).
// Pure: takes an HttpClient, no React Native imports.
import { API_PATHS } from '../config/api'
import { isRecord, type ApiResult } from './apiResult'
import type { HttpClient } from './httpClient'

export interface StaffOrderItem {
  serviceCode: string
  name: string
  quantity: number
}

export interface StaffOrderMedication {
  name: string
  dose: string
  route: string
  expiresAt: string
  doseNumber: number | null
}

export interface StaffOrder {
  id: string
  status: string
  version: number
  parentId: string
  patientName: string
  scheduledFor: string | null
  timeSlot: string | null
  address: { text: string; lat: number | null; lng: number | null } | null
  notes: string | null
  eta: string | null
  items: StaffOrderItem[]
  medication: StaffOrderMedication | null
  familyPresent: boolean
  postoperative: boolean
  referralText: string | null
  attachments: { id: string; mimeType: string }[]
  // Phone for the call button; the server sends it only while the visit is open.
  patientContact: string | null
  timeline: { id: string; status: string; at: string }[]
  isMock: boolean
}

export interface StaffOrderPage {
  orders: StaffOrder[]
  nextCursor: string | null
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const optText = (value: unknown): string | null => (text(value) ? value : null)
const optNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function parseMedication(value: unknown): StaffOrderMedication | null {
  if (!isRecord(value)) return null
  const { name, dose, route, expiresAt, doseNumber } = value
  if (!text(name) || !text(dose) || !text(route) || !text(expiresAt)) return null
  return { name, dose, route, expiresAt, doseNumber: optNumber(doseNumber) }
}

function parseAttachments(value: unknown): StaffOrder['attachments'] {
  if (!Array.isArray(value)) return []
  const out: StaffOrder['attachments'] = []
  for (const raw of value) {
    if (isRecord(raw) && text(raw.id)) {
      out.push({ id: raw.id, mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : 'image/jpeg' })
    }
  }
  return out
}

export function parseStaffOrder(value: unknown): StaffOrder | null {
  if (!isRecord(value)) return null
  const { id, status, version, parentId } = value
  if (!text(id) || !text(status) || !Number.isInteger(version) || (version as number) < 1 || !text(parentId)) {
    return null
  }

  const items: StaffOrderItem[] = []
  if (Array.isArray(value.items)) {
    for (const raw of value.items) {
      if (!isRecord(raw) || !text(raw.serviceCode) || !text(raw.name)) return null
      items.push({
        serviceCode: raw.serviceCode,
        name: raw.name,
        quantity: typeof raw.quantity === 'number' ? raw.quantity : 1,
      })
    }
  }

  const form = isRecord(value.bookingForm) ? value.bookingForm : null
  const address =
    isRecord(value.address) && text(value.address.text)
      ? { text: value.address.text, lat: optNumber(value.address.lat), lng: optNumber(value.address.lng) }
      : null

  const timeline: StaffOrder['timeline'] = []
  if (Array.isArray(value.timeline)) {
    for (const raw of value.timeline) {
      if (isRecord(raw) && text(raw.id) && text(raw.status) && text(raw.at)) {
        timeline.push({ id: raw.id, status: raw.status, at: raw.at })
      }
    }
  }

  return {
    id,
    status,
    version: version as number,
    parentId,
    patientName: typeof value.patientName === 'string' ? value.patientName : '',
    scheduledFor: optText(value.scheduledFor),
    timeSlot: optText(value.timeSlot),
    address,
    notes: optText(value.notes),
    eta: optText(value.eta),
    items,
    medication: form ? parseMedication(form.medication) : null,
    familyPresent: form?.familyPresent === true,
    postoperative: form?.postoperative === true,
    referralText: form ? optText(form.referralText) : null,
    attachments: parseAttachments(value.attachments),
    patientContact: optText(value.patientContact),
    timeline,
    isMock: value.isMock === true,
  }
}

export function parseStaffOrderPage(data: unknown): StaffOrderPage | null {
  if (!isRecord(data) || !Array.isArray(data.orders)) return null
  const orders: StaffOrder[] = []
  for (const raw of data.orders) {
    const order = parseStaffOrder(raw)
    if (!order) return null
    orders.push(order)
  }
  return { orders, nextCursor: optText(data.nextCursor) }
}

export function parseStaffOrderEnvelope(data: unknown): StaffOrder | null {
  return isRecord(data) ? parseStaffOrder(data.order) : null
}

export function fetchStaffOrders(client: HttpClient, cursor?: string): Promise<ApiResult<StaffOrderPage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return client.request({ method: 'GET', path: `${API_PATHS.staffOrders.list}${query}`, parse: parseStaffOrderPage })
}

// Detail through the nurse router: also carries patientContact.
export function fetchNurseOrder(client: HttpClient, id: string): Promise<ApiResult<StaffOrder>> {
  return client.request({ method: 'GET', path: API_PATHS.nurseOrders.byId(id), parse: parseStaffOrderEnvelope })
}

// `version` is the optimistic lock: the server answers 409 VERSION_CONFLICT
// when the order changed since the nurse loaded it. The ETA response has no
// patient fields, so callers reload the order afterwards.
export function postEta(
  client: HttpClient,
  id: string,
  version: number,
  eta: string | null,
): Promise<ApiResult<StaffOrder>> {
  return client.request({
    method: 'POST',
    path: API_PATHS.staffOrders.eta(id),
    body: { version, eta },
    parse: parseStaffOrderEnvelope,
  })
}
