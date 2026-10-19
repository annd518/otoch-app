import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, type FetchLike } from '../services/httpClient'
import {
  checkin,
  finish,
  getRecord,
  parseRecordEnvelope,
  reject,
  reportIncident,
  saveRecord,
} from '../services/nurseVisit'
import { resolveApiConfig } from '../utils/apiConfig'
import { checkVitals, emptyVitalsText, hasAnyVital, vitalsToText } from '../utils/vitals'
import {
  allChecked,
  emptyChecks,
  missingForFinish,
  suggestedProcedures,
  telUrl,
} from '../utils/visitRecord'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

function recorder(status = 200, data: unknown = {}) {
  const seen: { url: string; method: string; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
    return { status, text: async () => JSON.stringify({ success: true, data }) }
  }
  return { seen, client: createHttpClient({ config, fetch, getToken: async () => null }) }
}

const orderData = { order: { id: 'o1', status: 'IN_PROGRESS', version: 4, parentId: 'p1', patientName: 'Д.Цэцэг', patientContact: '99112233' } }

test('check-in sends GEO position and the three confirmations', async () => {
  const { seen, client } = recorder(200, orderData)
  const res = await checkin(client, 'o1', { version: 3, lat: 47.9, lng: 106.9 })
  assert.equal(res.ok, true)
  assert.equal(seen[0].url, 'http://api.test/api/nurse/orders/o1/checkin')
  assert.deepEqual(seen[0].body, {
    version: 3,
    method: 'GEO',
    lat: 47.9,
    lng: 106.9,
    checklist: { identified: true, hygiene: true, medicationChecked: true },
  })
  if (res.ok) assert.equal(res.data.patientContact, '99112233')
})

test('finish, reject and incident hit their own endpoints', async () => {
  const { seen, client } = recorder(200, orderData)
  await finish(client, 'o1', { version: 4, signerName: 'Д.Цэцэг', signature: 'data:image/png;base64,AAA=' })
  await reject(client, 'o1', { version: 4, reason: 'MED_EXPIRED', comment: 'x' })
  await reportIncident(client, 'o1', { version: 4, description: 'Ухаан алдсан' })
  assert.deepEqual(
    seen.map((s) => s.url.replace('http://api.test/api/nurse/orders/o1', '')),
    ['/finish', '/reject', '/incident'],
  )
})

test('record: GET empty, PUT sends only the changed fields', async () => {
  const empty = recorder(200, { record: null })
  const got = await getRecord(empty.client, 'o1')
  assert.equal(got.ok, true)
  if (got.ok) assert.equal(got.data.record, null)

  const { seen, client } = recorder(200, { record: { vitals: { pulse: 70 }, procedures: ['INJ'], signed: false } })
  const saved = await saveRecord(client, 'o1', { note: 'ok' })
  assert.equal(seen[0].method, 'PUT')
  assert.deepEqual(seen[0].body, { note: 'ok' })
  assert.equal(saved.ok, true)
  if (saved.ok) assert.deepEqual(saved.data.record?.vitals, { pulse: 70 })
})

test('record parser drops junk and rejects a malformed envelope', () => {
  assert.equal(parseRecordEnvelope({}), null)
  assert.equal(parseRecordEnvelope({ record: 'x' }), null)
  const r = parseRecordEnvelope({
    record: { vitals: { pulse: 70, spo2: 'high' }, procedures: ['INJ', 3], medicationChecks: { patient: true }, signed: true },
  })
  assert.deepEqual(r?.record?.vitals, { pulse: 70 })
  assert.deepEqual(r?.record?.procedures, ['INJ'])
  assert.equal(r?.record?.medicationChecks?.patient, true)
  assert.equal(r?.record?.medicationChecks?.dose, false)
  assert.equal(r?.record?.signed, true)
})

test('vitals: ranges, integers, decimal comma, blood pressure order', () => {
  const t = { ...emptyVitalsText(), systolic: '128', diastolic: '82', pulse: '74', temperatureC: '36,6', spo2: '97' }
  const ok = checkVitals(t)
  assert.deepEqual(ok.errors, {})
  assert.deepEqual(ok.values, { systolic: 128, diastolic: 82, pulse: 74, temperatureC: 36.6, spo2: 97 })

  const bad = checkVitals({ ...emptyVitalsText(), systolic: '400', pulse: '7.5', temperatureC: '50', spo2: 'abc' })
  assert.deepEqual(Object.keys(bad.errors).sort(), ['pulse', 'spo2', 'systolic', 'temperatureC'])
  assert.deepEqual(bad.values, {})

  const order = checkVitals({ ...emptyVitalsText(), systolic: '80', diastolic: '90' })
  assert.ok(order.errors.diastolic)
  assert.equal(order.values.diastolic, undefined)

  const empty = checkVitals(emptyVitalsText())
  assert.equal(hasAnyVital(empty.values), false)
  assert.equal(vitalsToText({ pulse: 70 }).pulse, '70')
})

test('finish readiness lists exactly what is missing', () => {
  const base = {
    vitals: { pulse: 70 },
    procedures: ['INJ'],
    hasMedication: true,
    medicationChecks: emptyChecks(),
    signerName: 'Д.Цэцэг',
    hasSignature: true,
  }
  assert.deepEqual(missingForFinish(base), ['Эм, заалтыг 5 зөв дээр шалгана уу'])
  assert.deepEqual(missingForFinish({ ...base, hasMedication: false }), [])
  assert.equal(missingForFinish({ ...base, hasMedication: false, hasSignature: false, signerName: ' ', vitals: {}, procedures: [] }).length, 4)
  assert.equal(allChecked({ patient: true, medicine: true, dose: true, route: true, time: true }), true)
})

test('suggested procedures and tel links', () => {
  assert.deepEqual(suggestedProcedures(['S02', 'S01', 'S02', 'X9']), ['INJ', 'VITALS'])
  assert.equal(telUrl('+976 9911-2233'), 'tel:+97699112233')
  assert.equal(telUrl('99112233;rm'), 'tel:99112233')
})
