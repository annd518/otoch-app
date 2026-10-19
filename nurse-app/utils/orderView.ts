// Display helpers for staff orders. Pure and unit tested.
import type { StaffOrder } from '../services/staffOrders'

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Төлөгдсөн',
  ASSIGNED: 'Томилогдсон',
  EN_ROUTE: 'Замдаа',
  IN_PROGRESS: 'Явагдаж байна',
  COMPLETED: 'Дууссан',
  REFUSED: 'Татгалзсан',
  INCIDENT: 'Осол бүртгэсэн',
  CANCELLED: 'Цуцлагдсан',
  EXPIRED: 'Хугацаа дууссан',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

export function statusTone(status: string): StatusTone {
  if (status === 'ASSIGNED' || status === 'EN_ROUTE') return 'info'
  if (status === 'IN_PROGRESS') return 'warning'
  if (status === 'REFUSED' || status === 'INCIDENT') return 'danger'
  if (status === 'COMPLETED') return 'success'
  return 'neutral'
}

// Ulaanbaatar is UTC+8 all year (no daylight saving).
const UB_OFFSET_MS = 8 * 60 * 60 * 1000
const two = (n: number) => String(n).padStart(2, '0')

// "2026-10-05T06:00:00.000Z" -> "10.05 14:00"
export function formatUbDateTime(iso: string): string | null {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const d = new Date(ms + UB_OFFSET_MS)
  return `${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`
}

// "2028-05-31T15:59:59Z" -> "2028.05.31"
export function formatUbDate(iso: string): string | null {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const d = new Date(ms + UB_OFFSET_MS)
  return `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())}`
}

export function formatSchedule(order: Pick<StaffOrder, 'scheduledFor' | 'timeSlot'>): string {
  const when = order.scheduledFor ? formatUbDateTime(order.scheduledFor) : null
  if (when && order.timeSlot) return `${when} · ${order.timeSlot}`
  return when ?? order.timeSlot ?? 'Цаг товлогдоогүй'
}

export function serviceSummary(order: Pick<StaffOrder, 'items'>): string {
  if (order.items.length === 0) return 'Үйлчилгээ'
  return order.items.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join(', ')
}

const GROUP: Record<string, number> = { IN_PROGRESS: 0, EN_ROUTE: 0, ASSIGNED: 1, PAID: 1 }

// Active work first (in progress, then upcoming by time), history last (newest first).
export function sortForNurse(orders: readonly StaffOrder[]): StaffOrder[] {
  const when = (o: StaffOrder) => (o.scheduledFor ? Date.parse(o.scheduledFor) : Number.MAX_SAFE_INTEGER)
  return [...orders].sort((a, b) => {
    const ga = GROUP[a.status] ?? 2
    const gb = GROUP[b.status] ?? 2
    if (ga !== gb) return ga - gb
    return ga === 2 ? when(b) - when(a) : when(a) - when(b)
  })
}

export interface AvailableActions {
  setEta: boolean
  enRoute: boolean
  checkin: boolean
  record: boolean
  reject: boolean
  incident: boolean
}

// Mirrors the server guards in nurseOrders.ts / staffOrders.ts; the server stays the authority.
export function availableActions(status: string): AvailableActions {
  const open = status === 'ASSIGNED' || status === 'EN_ROUTE' || status === 'IN_PROGRESS'
  return {
    setEta: status === 'ASSIGNED' || status === 'EN_ROUTE',
    enRoute: status === 'ASSIGNED',
    checkin: status === 'ASSIGNED' || status === 'EN_ROUTE',
    record: status === 'IN_PROGRESS',
    reject: open,
    incident: open,
  }
}

// ETA offered to the nurse in minutes from now. The server rejects past values.
export const ETA_CHOICES_MIN = [10, 15, 30, 45, 60] as const

export function etaFromNow(minutes: number, nowMs: number): string {
  return new Date(nowMs + minutes * 60_000).toISOString()
}
