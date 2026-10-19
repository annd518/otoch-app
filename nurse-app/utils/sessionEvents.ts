// Lets the HTTP layer tell the React tree that the session ended (401 / expired
// token) without importing React.
type Listener = () => void

const listeners = new Set<Listener>()

export const sessionEvents = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  emitSignedOut(): void {
    for (const listener of [...listeners]) listener()
  },
}
