import { useCallback, useState } from 'react'

import { http } from '../services/http'
import { fetchProfile, setOnline, type NurseProfile } from '../services/offers'

// undefined = not loaded yet; null = the server has no profile for this nurse.
export function useProfile() {
  const [profile, setProfile] = useState<NurseProfile | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await fetchProfile(http)
    if (result.ok) {
      setProfile(result.data.profile)
      setError(null)
    } else {
      setError(result.message)
    }
  }, [])

  const toggle = useCallback(async (isActive: boolean) => {
    setBusy(true)
    setError(null)
    const result = await setOnline(http, isActive)
    if (result.ok) setProfile(result.data.profile)
    else setError(result.message)
    setBusy(false)
  }, [])

  return { profile, error, busy, load, toggle }
}
