import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'

import {
  INITIAL_DRAFT,
  bookingDraftReducer,
  type BookingDraftAction,
  type BookingDraftState,
} from '../services/bookingDraft'
import { fromPersistedDraft, toPersistedDraft } from '../services/draftPersistence'
import { draftStore } from '../utils/draftStore'
import { storage } from '../utils/storage'

export type { SelectedService } from '../services/bookingDraft'

// Lives above the navigator (app/_layout.tsx), so going back between booking
// screens or retrying a request never loses the service, patient or address.
// The unsaved step 1 choices also survive an app restart (see
// services/draftPersistence.ts for what is and is not kept).
interface BookingDraftValue {
  state: BookingDraftState
  dispatch: Dispatch<BookingDraftAction>
  // Called once the user is signed in (app/(tabs)/_layout.tsx).
  restore: () => Promise<void>
}

const BookingDraftContext = createContext<BookingDraftValue | null>(null)

const SAVE_DELAY_MS = 400

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bookingDraftReducer, INITIAL_DRAFT)
  // Saving starts only after the restore attempt for that user, so the empty
  // initial state never wipes a draft that is about to be restored.
  const restoredFor = useRef<string | null>(null)

  const restore = useCallback(async () => {
    const user = await storage.getUser()
    if (!user) return
    if (restoredFor.current !== user.id) {
      const draft = fromPersistedDraft(await draftStore.load(), user.id, new Date())
      if (draft) dispatch({ type: 'hydrate', state: draft })
    }
    restoredFor.current = user.id
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        const user = await storage.getUser()
        if (!user || restoredFor.current !== user.id) return
        const persisted = toPersistedDraft(state, user.id, Date.now())
        if (persisted) await draftStore.save(persisted)
        else {
          const stored = await draftStore.load()
          // Never drop another account's draft just because this one has none.
          if (stored && typeof stored === 'object' && (stored as { userId?: unknown }).userId === user.id)
            await draftStore.clear()
        }
      })()
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state])

  const value = useMemo(() => ({ state, dispatch, restore }), [state, restore])
  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>
}

export function useBookingDraft(): BookingDraftValue {
  const value = useContext(BookingDraftContext)
  if (!value) throw new Error('useBookingDraft must be used inside BookingDraftProvider')
  return value
}
