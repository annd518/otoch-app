import { useCallback, useEffect, useRef, useState } from 'react'

import { http } from '../services/http'
import { acceptOffer, declineOffer, fetchOffers, remainingSeconds, type Offer } from '../services/offers'
import type { StaffOrder } from '../services/staffOrders'

export const OFFER_POLL_MS = 8000

export type OfferOutcome = { ok: true; order?: StaffOrder } | { ok: false; message: string }

// New dispatch offers, polled while `active` (the calls tab is focused). Offers carry
// a server countdown; `secondsLeft` ticks locally and expired offers disappear.
export function useOffers(active: boolean) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    const result = await fetchOffers(http)
    if (result.ok) {
      setOffers(result.data)
      setFetchedAt(Date.now())
      setNow(Date.now())
      setError(null)
    } else {
      setError(result.message)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    void refresh()
    const poll = setInterval(() => void refresh(), OFFER_POLL_MS)
    return () => clearInterval(poll)
  }, [active, refresh])

  const hasOffers = offers.length > 0
  useEffect(() => {
    if (!active || !hasOffers) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [active, hasOffers])

  const respond = useCallback(
    async (id: string, kind: 'accept' | 'decline'): Promise<OfferOutcome> => {
      if (busy.current) return { ok: false, message: 'Түр хүлээнэ үү.' }
      busy.current = true
      setBusyId(id)
      const result = kind === 'accept' ? await acceptOffer(http, id) : await declineOffer(http, id)
      // Whatever happened, the list is stale now (taken, expired, declined).
      await refresh()
      busy.current = false
      setBusyId(null)
      if (!result.ok) return { ok: false, message: result.message }
      return kind === 'accept' ? { ok: true, order: result.data as StaffOrder } : { ok: true }
    },
    [refresh],
  )

  const live = offers
    .map((offer) => ({ offer, seconds: remainingSeconds(offer, fetchedAt, now) }))
    .filter((x) => x.seconds > 0)

  return { live, error, busyId, refresh, respond }
}
