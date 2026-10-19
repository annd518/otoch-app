import { useCallback, useRef, useState } from 'react'

import { http } from '../services/http'
import { fetchStaffOrders, type StaffOrder } from '../services/staffOrders'

export type LoadState = 'loading' | 'ready' | 'error'

// Assigned orders with pull-to-refresh and cursor paging. A failed refresh keeps
// the orders already on screen and reports the error (offline state).
export function useOrders() {
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const inFlight = useRef(false)

  const refresh = useCallback(async (pull = false) => {
    if (inFlight.current) return
    inFlight.current = true
    if (pull) setRefreshing(true)
    const result = await fetchStaffOrders(http)
    if (result.ok) {
      setOrders(result.data.orders)
      setNextCursor(result.data.nextCursor)
      setError(null)
      setState('ready')
    } else {
      setError(result.message)
      setState((current) => (current === 'ready' ? 'ready' : 'error'))
    }
    setRefreshing(false)
    inFlight.current = false
  }, [])

  const loadMore = useCallback(async () => {
    if (inFlight.current || !nextCursor) return
    inFlight.current = true
    setLoadingMore(true)
    const result = await fetchStaffOrders(http, nextCursor)
    if (result.ok) {
      setOrders((current) => {
        const known = new Set(current.map((o) => o.id))
        return [...current, ...result.data.orders.filter((o) => !known.has(o.id))]
      })
      setNextCursor(result.data.nextCursor)
    } else {
      setError(result.message)
    }
    setLoadingMore(false)
    inFlight.current = false
  }, [nextCursor])

  return { orders, state, error, refreshing, loadingMore, hasMore: nextCursor !== null, refresh, loadMore }
}
