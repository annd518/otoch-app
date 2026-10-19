// Display helpers for staff orders. Pure and unit tested.
import type { StaffOrder } from '../services/staffOrders'

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Төлөгдсөн',
  ASSIGNED: 'Томилогдсон',
  IN_PROGRESS: 'Явагдаж байна',
  COMPLETED: 'Дууссан',
  CANCELLED: 'Цуцлагдсан',
  EXPIRED: 'Хугацаа дууссан',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export type StatusTone = 'info' | 'warning' | 'success' | 'neutral'

export function statusTone(status: string): StatusTone {
  if (status === 'ASSIGNED') return 'info'
  if (status === 'IN_PROGRESS') return 'warning'
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

export function formatSchedule(order: Pick<StaffOrder, 'scheduledFor' | 'timeSlot'>): string {
  const when = order.scheduledFor ? formatUbDateTime(order.scheduledFor) : null
  if (when && order.timeSlot) return `${when} · ${order.timeSlot}`
  return when ?? order.timeSlot ?? 'Цаг товлогдоогүй'
}

export function serviceSummary(order: Pick<StaffOrder, 'items'>): string {
  if (order.items.length === 0) return 'Үйлчилгээ'
  return order.items.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join(', ')
}

const GROUP: Record<string, number> = { IN_PROGRESS: 0, ASSIGNED: 1, PAID: 1 }

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
  start: boolean
  complete: boolean
}

// Mirrors the server guard in staffOrders.ts (eta: ASSIGNED|IN_PROGRESS,
// start: ASSIGNED, complete: IN_PROGRESS). The server stays the authority.
export function availableActions(status: string): AvailableActions {
  return {
    setEta: status === 'ASSIGNED' || status === 'IN_PROGRESS',
    start: status === 'ASSIGNED',
    complete: status === 'IN_PROGRESS',
  }
}

// ETA offered to the nurse in minutes from now. The server rejects past values.
export const ETA_CHOICES_MIN = [10, 15, 30, 45, 60] as const

export function etaFromNow(minutes: number, nowMs: number): string {
  return new Date(nowMs + minutes * 60_000).toISOString()
}
