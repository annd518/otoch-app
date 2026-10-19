import { useCallback, useRef, useState } from 'react'

import { http } from '../services/http'
import {
  fetchStaffOrder,
  postStaffOrderAction,
  type StaffOrder,
  type StaffOrderAction,
} from '../services/staffOrders'
import type { LoadState } from './useOrders'

export const CONFLICT_MESSAGE = 'Захиалга шинэчлэгдсэн байна. Мэдээллийг дахин ачааллаа, дахин оролдоно уу.'

export type ActionOutcome = { ok: true } | { ok: false; message: string }

export function useOrder(id: string) {
  const [order, setOrder] = useState<StaffOrder | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    const result = await fetchStaffOrder(http, id)
    if (result.ok) {
      setOrder(result.data)
      setError(null)
      setState('ready')
    } else {
      setError(result.message)
      setState((current) => (current === 'ready' ? 'ready' : 'error'))
    }
  }, [id])

  // One action at a time; the order version from the last load is the lock.
  const act = useCallback(
    async (action: StaffOrderAction, extra: { eta?: string | null } = {}): Promise<ActionOutcome> => {
      if (!order || busyRef.current) return { ok: false, message: 'Түр хүлээнэ үү.' }
      busyRef.current = true
      setBusy(true)
      const result = await postStaffOrderAction(http, order.id, action, order.version, extra)
      let outcome: ActionOutcome
      if (result.ok) {
        setOrder(result.data)
        outcome = { ok: true }
      } else if (result.code === 'VERSION_CONFLICT' || result.code === 'INVALID_STATUS') {
        await load()
        outcome = { ok: false, message: result.code === 'VERSION_CONFLICT' ? CONFLICT_MESSAGE : result.message }
      } else {
        outcome = { ok: false, message: result.message }
      }
      busyRef.current = false
      setBusy(false)
      return outcome
    },
    [order, load],
  )

  return { order, state, error, busy, load, act }
}
