import { useCallback, useRef, useState } from 'react'

import type { ApiResult } from '../services/apiResult'
import { http } from '../services/http'
import { fetchNurseOrder, type StaffOrder } from '../services/staffOrders'
import type { LoadState } from './useOrders'

export const CONFLICT_MESSAGE = 'Захиалга шинэчлэгдсэн байна. Мэдээллийг дахин ачааллаа, дахин оролдоно уу.'

export type ActionOutcome = { ok: true; order: StaffOrder } | { ok: false; message: string; code?: string }

// One order for the nurse. `run` executes a state-changing call with the current
// order; a stale version or status reloads the order instead of failing silently.
export function useOrder(id: string) {
  const [order, setOrder] = useState<StaffOrder | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const orderRef = useRef<StaffOrder | null>(null)

  const apply = useCallback((next: StaffOrder) => {
    orderRef.current = next
    setOrder(next)
  }, [])

  const load = useCallback(async () => {
    const result = await fetchNurseOrder(http, id)
    if (result.ok) {
      apply(result.data)
      setError(null)
      setState('ready')
    } else {
      setError(result.message)
      setState((current) => (current === 'ready' ? 'ready' : 'error'))
    }
  }, [id, apply])

  const run = useCallback(
    async (
      call: (order: StaffOrder) => Promise<ApiResult<StaffOrder>>,
      options: { reload?: boolean } = {},
    ): Promise<ActionOutcome> => {
      const current = orderRef.current
      if (!current || busyRef.current) return { ok: false, message: 'Түр хүлээнэ үү.' }
      busyRef.current = true
      setBusy(true)
      let outcome: ActionOutcome
      const result = await call(current)
      if (result.ok) {
        if (options.reload) await load()
        else apply(result.data)
        outcome = { ok: true, order: orderRef.current ?? result.data }
      } else if (result.code === 'VERSION_CONFLICT' || result.code === 'INVALID_STATUS') {
        await load()
        outcome = {
          ok: false,
          code: result.code,
          message: result.code === 'VERSION_CONFLICT' ? CONFLICT_MESSAGE : result.message,
        }
      } else {
        outcome = { ok: false, code: result.code, message: result.message }
      }
      busyRef.current = false
      setBusy(false)
      return outcome
    },
    [load, apply],
  )

  return { order, state, error, busy, load, run }
}
