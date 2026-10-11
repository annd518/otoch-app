import { useEffect, useState } from 'react'

// Current time that re-renders every `intervalMs`, so expiry checks stay
// pure during render.
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
