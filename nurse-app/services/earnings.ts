// The nurse's earnings and payout bank account (server/src/routes/nurseEarnings.ts).
// Pure: takes an HttpClient, no React Native imports.
import { isRecord, type ApiResult } from './apiResult'
import type { HttpClient } from './httpClient'

export const EARNINGS_PATHS = {
  earnings: (range: EarningsRangeKind, offset: number) => `/api/nurse/earnings?range=${range}&offset=${offset}`,
  bank: '/api/nurse/bank',
  receiptLink: (payoutId: string) => `/api/nurse/payouts/${encodeURIComponent(payoutId)}/receipt-link`,
} as const

export type EarningsRangeKind = 'week' | 'month'

export interface BankAccount {
  bankName: string
  accountNo: string
  accountName: string
}

export interface Earnings {
  range: EarningsRangeKind
  offset: number
  from: string
  to: string
  totals: { netMnt: number; grossMnt: number; visits: number }
  days: { date: string; netMnt: number; visits: number }[]
  entries: { orderId: string; services: string[]; earnedAt: string; netMnt: number; paidAt: string | null }[]
  unpaid: { netMnt: number; visits: number }
  payouts: { id: string; paidAt: string; totalMnt: number; visits: number; reference: string }[]
  rating: { average: number | null; count: number }
  sharePercent: number
  bank: BankAccount | null
}

/** Banks offered in the app; the same list the server accepts (routes/nurseEarnings.ts). */
export const BANKS = [
  'Хаан банк',
  'Голомт банк',
  'Худалдаа хөгжлийн банк',
  'Хас банк',
  'Төрийн банк',
  'Капитрон банк',
  'Богд банк',
  'Үндэсний хөрөнгө оруулалтын банк',
  'Ариг банк',
  'Тээвэр хөгжлийн банк',
  'Чингис хаан банк',
  'М банк',
] as const

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): v is string => typeof v === 'string' && v !== ''

function parseBank(v: unknown): BankAccount | null {
  return isRecord(v) && str(v.bankName) && str(v.accountNo) && str(v.accountName)
    ? { bankName: v.bankName, accountNo: v.accountNo, accountName: v.accountName }
    : null
}

export function parseEarnings(data: unknown): Earnings | null {
  if (!isRecord(data) || (data.range !== 'week' && data.range !== 'month') || !isRecord(data.totals) || !isRecord(data.unpaid))
    return null
  const t = data.totals
  const u = data.unpaid
  const [net, gross, visits, unpaidNet, unpaidVisits] = [num(t.netMnt), num(t.grossMnt), num(t.visits), num(u.netMnt), num(u.visits)]
  if (net === null || gross === null || visits === null || unpaidNet === null || unpaidVisits === null || !str(data.from) || !str(data.to))
    return null
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : [])
  const r = isRecord(data.rating) ? data.rating : {}
  return {
    range: data.range,
    offset: num(data.offset) ?? 0,
    from: data.from,
    to: data.to,
    totals: { netMnt: net, grossMnt: gross, visits },
    days: list(data.days).flatMap((d) =>
      str(d.date) && num(d.netMnt) !== null ? [{ date: d.date, netMnt: d.netMnt as number, visits: num(d.visits) ?? 0 }] : [],
    ),
    entries: list(data.entries).flatMap((e) =>
      str(e.orderId) && str(e.earnedAt) && num(e.netMnt) !== null
        ? [
            {
              orderId: e.orderId,
              services: Array.isArray(e.services) ? e.services.filter(str) : [],
              earnedAt: e.earnedAt,
              netMnt: e.netMnt as number,
              paidAt: str(e.paidAt) ? e.paidAt : null,
            },
          ]
        : [],
    ),
    unpaid: { netMnt: unpaidNet, visits: unpaidVisits },
    payouts: list(data.payouts).flatMap((p) =>
      str(p.id) && str(p.paidAt) && num(p.totalMnt) !== null
        ? [{ id: p.id, paidAt: p.paidAt, totalMnt: p.totalMnt as number, visits: num(p.visits) ?? 0, reference: str(p.reference) ? p.reference : '' }]
        : [],
    ),
    rating: { average: num(r.average), count: num(r.count) ?? 0 },
    sharePercent: num(data.sharePercent) ?? 70,
    bank: parseBank(data.bank),
  }
}

export function getEarnings(client: HttpClient, range: EarningsRangeKind, offset: number): Promise<ApiResult<Earnings>> {
  return client.request({ method: 'GET', path: EARNINGS_PATHS.earnings(range, offset), parse: parseEarnings })
}

export function saveBank(client: HttpClient, bank: BankAccount): Promise<ApiResult<BankAccount>> {
  return client.request({
    method: 'PUT',
    path: EARNINGS_PATHS.bank,
    body: bank,
    parse: (d) => (isRecord(d) ? parseBank(d.bank) : null),
  })
}

/** "10-р сарын 26 – 11-р сарын 1" / "2026 оны 10-р сар", from the server's range. */
export function periodLabel(e: Pick<Earnings, 'range' | 'days'>): string {
  const first = e.days[0]?.date
  const last = e.days[e.days.length - 1]?.date
  if (!first || !last) return ''
  const [y, m, d] = first.split('-').map(Number)
  if (e.range === 'month') return `${y} оны ${m}-р сар`
  const [, m2, d2] = last.split('-').map(Number)
  return m === m2 ? `${m}-р сарын ${d}–${d2}` : `${m}-р сарын ${d} – ${m2}-р сарын ${d2}`
}

/** Weekday letter for a YYYY-MM-DD (Да Мя Лх Пү Ба Бя Ня, spec SCR-N11). */
export function weekdayShort(date: string): string {
  const names = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя']
  return names[new Date(`${date}T00:00:00Z`).getUTCDay()]
}

/** A 10-minute link (server path) to a payout's PDF receipt, opened in the browser. */
export function getReceiptLink(client: HttpClient, payoutId: string): Promise<ApiResult<string>> {
  return client.request({
    method: 'GET',
    path: EARNINGS_PATHS.receiptLink(payoutId),
    parse: (d) => (isRecord(d) && typeof d.path === 'string' && d.path.startsWith('/api/receipts/') ? d.path : null),
  })
}
