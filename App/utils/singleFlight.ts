// Collapses concurrent calls into one: a second tap while the first request is
// still running gets the same promise instead of sending another request.
export function createSingleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  let inFlight: Promise<R> | null = null
  const run = (...args: A): Promise<R> => {
    if (inFlight) return inFlight
    const current = fn(...args).finally(() => {
      inFlight = null
    })
    inFlight = current
    return current
  }
  return { run, isRunning: () => inFlight !== null }
}
