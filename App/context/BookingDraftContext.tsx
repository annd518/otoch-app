import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import type { CatalogService, Quote } from '../services/apiTypes'
import type { ApiMode } from '../utils/apiConfig'

// The service the user picked in the catalog. priceMnt is the catalog display
// price only; the payable amount will come from the server quote (quote.totalMnt).
export interface SelectedService {
  id: string
  code: string
  name: string
  priceMnt: number
  durationMin: number
  requiresReferral: boolean
  catalogVersion: string | null
  isFixture: boolean
  source: ApiMode
}

interface BookingDraftValue {
  service: SelectedService | null
  quote: Quote | null
  selectService(service: CatalogService, catalogVersion: string | null, source: ApiMode): void
  setQuote(quote: Quote | null): void
  resetDraft(): void
}

const BookingDraftContext = createContext<BookingDraftValue | null>(null)

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<SelectedService | null>(null)
  const [quote, setQuoteState] = useState<Quote | null>(null)

  const value = useMemo<BookingDraftValue>(
    () => ({
      service,
      quote,
      selectService(next, catalogVersion, source) {
        setService({
          id: next.id,
          code: next.code,
          name: next.name,
          priceMnt: next.priceMnt,
          durationMin: next.durationMin,
          requiresReferral: next.requiresReferral,
          catalogVersion,
          isFixture: next.isFixture,
          source,
        })
        // A quote belongs to a specific selection; changing it invalidates it.
        setQuoteState(null)
      },
      setQuote(next) {
        setQuoteState(next)
      },
      resetDraft() {
        setService(null)
        setQuoteState(null)
      },
    }),
    [service, quote],
  )

  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>
}

export function useBookingDraft(): BookingDraftValue {
  const value = useContext(BookingDraftContext)
  if (!value) throw new Error('useBookingDraft must be used inside BookingDraftProvider')
  return value
}
