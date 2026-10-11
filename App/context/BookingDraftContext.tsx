import React, { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'

import {
  INITIAL_DRAFT,
  bookingDraftReducer,
  type BookingDraftAction,
  type BookingDraftState,
} from '../services/bookingDraft'

export type { SelectedService } from '../services/bookingDraft'

// Lives above the navigator (app/_layout.tsx), so going back between booking
// screens or retrying a request never loses the service, patient or address.
interface BookingDraftValue {
  state: BookingDraftState
  dispatch: Dispatch<BookingDraftAction>
}

const BookingDraftContext = createContext<BookingDraftValue | null>(null)

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bookingDraftReducer, INITIAL_DRAFT)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>
}

export function useBookingDraft(): BookingDraftValue {
  const value = useContext(BookingDraftContext)
  if (!value) throw new Error('useBookingDraft must be used inside BookingDraftProvider')
  return value
}
