import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { http } from '../services/http'
import { loginFlow, logoutFlow, otpLoginFlow, otpRegisterFlow, type LoginOutcome } from '../services/authFlow'
import type { AppUser } from '../services/validators'
import { sessionEvents } from '../utils/sessionEvents'
import { storage } from '../utils/storage'

interface SessionValue {
  // undefined while the stored session is being read.
  user: AppUser | null | undefined
  signIn(email: string, password: string): Promise<LoginOutcome>
  signInWithOtp(phone: string, challengeId: string, code: string): Promise<LoginOutcome>
  registerWithOtp(phone: string, challengeId: string, code: string, name: string): Promise<LoginOutcome>
  signOut(): Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    storage
      .getValidSession()
      .then((session) => {
        if (active) setUser(session?.user ?? null)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    const unsubscribe = sessionEvents.subscribe(() => setUser(null))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const outcome = await loginFlow(http, storage, email.trim(), password)
    if (outcome.ok) setUser(outcome.user)
    return outcome
  }, [])

  const signInWithOtp = useCallback(async (phone: string, challengeId: string, code: string) => {
    const outcome = await otpLoginFlow(http, storage, phone, challengeId, code)
    if (outcome.ok) setUser(outcome.user)
    return outcome
  }, [])

  const registerWithOtp = useCallback(async (phone: string, challengeId: string, code: string, name: string) => {
    const outcome = await otpRegisterFlow(http, storage, phone, challengeId, code, name)
    if (outcome.ok) setUser(outcome.user)
    return outcome
  }, [])

  const signOut = useCallback(async () => {
    await logoutFlow(storage)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, signIn, signInWithOtp, registerWithOtp, signOut }),
    [user, signIn, signInWithOtp, registerWithOtp, signOut],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
