import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { http } from '../services/http'
import { getRecord, saveRecord, type MedicationChecks } from '../services/nurseVisit'
import { checkVitals, emptyVitalsText, vitalsToText, type VitalsText } from '../utils/vitals'
import { emptyChecks } from '../utils/visitRecord'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 800

// Visit record form state with debounced autosave to the server (PUT .../record).
// Only valid vitals are sent; flush() saves immediately (used before finishing).
export function useVisitRecord(orderId: string, hasMedication: boolean) {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [vitalsText, setVitalsText] = useState<VitalsText>(emptyVitalsText)
  const [procedures, setProcedures] = useState<string[]>([])
  const [checks, setChecks] = useState<MedicationChecks>(emptyChecks)
  const [note, setNote] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [edits, setEdits] = useState(0)
  const latest = useRef({ vitalsText, procedures, checks, note })
  latest.current = { vitalsText, procedures, checks, note }
  const sequence = useRef(0)

  useEffect(() => {
    let active = true
    getRecord(http, orderId).then((result) => {
      if (!active) return
      if (!result.ok) {
        setLoadError(result.message)
        return
      }
      const record = result.data.record
      if (record) {
        setVitalsText(vitalsToText(record.vitals))
        setProcedures(record.procedures)
        if (record.medicationChecks) setChecks(record.medicationChecks)
        setNote(record.note ?? '')
      }
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [orderId])

  const flush = useCallback(async (): Promise<boolean> => {
    const { vitalsText: v, procedures: p, checks: c, note: n } = latest.current
    const id = ++sequence.current
    setSaveState('saving')
    const result = await saveRecord(http, orderId, {
      vitals: checkVitals(v).values,
      procedures: p,
      ...(hasMedication && { medicationChecks: c }),
      note: n,
    })
    // A newer save started meanwhile: let that one report the state.
    if (id !== sequence.current) return result.ok
    if (result.ok) {
      setSaveState('saved')
      setSaveError(null)
    } else {
      setSaveState('error')
      setSaveError(result.message)
    }
    return result.ok
  }, [orderId, hasMedication])

  useEffect(() => {
    if (!loaded || edits === 0) return
    const timer = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [edits, loaded, flush])

  const touch = () => setEdits((n) => n + 1)
  const vitals = useMemo(() => checkVitals(vitalsText), [vitalsText])

  return {
    loaded,
    loadError,
    vitalsText,
    vitals,
    procedures,
    checks,
    note,
    saveState,
    saveError,
    flush,
    setVital: (key: keyof VitalsText, value: string) => {
      setVitalsText((t) => ({ ...t, [key]: value }))
      touch()
    },
    toggleProcedure: (code: string) => {
      setProcedures((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))
      touch()
    },
    setCheck: (key: keyof MedicationChecks, value: boolean) => {
      setChecks((c) => ({ ...c, [key]: value }))
      touch()
    },
    setNote: (value: string) => {
      setNote(value)
      touch()
    },
  }
}
