import { useCallback, useRef, useState } from 'react'

// Double-tap guard for screens: while the action runs, further calls return
// the same promise and `running` disables the button. The ref blocks a second
// tap that arrives before React re-renders the disabled button.
export function useSingleFlight<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const inFlight = useRef<Promise<R> | null>(null)
  const [running, setRunning] = useState(false)

  const run = useCallback(
    (...args: A): Promise<R> => {
      if (inFlight.current) return inFlight.current
      setRunning(true)
      const current = action(...args).finally(() => {
        inFlight.current = null
        setRunning(false)
      })
      inFlight.current = current
      return current
    },
    [action],
  )

  return { run, running }
}
