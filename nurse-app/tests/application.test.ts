import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detailsFromForm,
  normalizeDate,
  parseApplicationEnvelope,
  submitApplication,
  uploadDocument,
} from '../services/application'
import { otpRegisterFlow, type Session, type SessionStore } from '../services/authFlow'
import { createHttpClient, type FetchLike, type UploadRequest } from '../services/httpClient'
import { resolveApiConfig } from '../utils/apiConfig'

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

const application = (over: Record<string, unknown> = {}) => ({
  state: 'DRAFT',
  editable: true,
  name: 'Б.Сараа',
  phone: '+97699112233',
  licenseNo: null,
  licenseExpiresAt: null,
  employer: null,
  experienceYears: null,
  districts: ['Баянгол', 'Москва'],
  submittedAt: null,
  reviewNote: null,
  documents: { LICENSE: '2026-10-20T01:00:00.000Z', DIPLOMA: null, ID_CARD: null, PORTRAIT: null },
  missing: ['Зөвшөөрлийн дугаар'],
  ...over,
})

test('parses an application and rejects an unknown state', () => {
  const a = parseApplicationEnvelope({ application: application({ state: 'REJECTED', reviewNote: 'Бүдэг зураг' }) })
  assert.ok(a)
  assert.equal(a.state, 'REJECTED')
  assert.equal(a.reviewNote, 'Бүдэг зураг')
  assert.equal(a.documents.LICENSE, '2026-10-20T01:00:00.000Z')
  assert.equal(a.documents.DIPLOMA, null)
  assert.deepEqual(a.missing, ['Зөвшөөрлийн дугаар'])
  assert.deepEqual(a.districts, ['Баянгол'])
  assert.equal(parseApplicationEnvelope({ application: application({ state: 'APPROVED' }) }), null)
  assert.equal(parseApplicationEnvelope({ application: { state: 'DRAFT' } }), null)
  assert.equal(parseApplicationEnvelope(null), null)
})

test('licence dates are real calendar dates', () => {
  assert.equal(normalizeDate('2028-05-31'), '2028-05-31')
  assert.equal(normalizeDate(' 2028.5.3 '), '2028-05-03')
  assert.equal(normalizeDate('2028/12/01'), '2028-12-01')
  assert.equal(normalizeDate('2028-02-30'), null)
  assert.equal(normalizeDate('31-05-2028'), null)
  assert.equal(normalizeDate(''), null)
})

test('the form becomes a request body or field errors', () => {
  const ok = detailsFromForm({
    name: ' Б.Сараа ',
    licenseNo: ' СУ-123 ',
    licenseExpiresAt: '2028.5.31',
    employer: 'Нэгдүгээр эмнэлэг',
    experienceYears: '7',
    districts: ['Баянзүрх', 'Хан-Уул'],
  })
  assert.deepEqual(ok, {
    ok: true,
    details: {
      name: 'Б.Сараа',
      licenseNo: 'СУ-123',
      licenseExpiresAt: '2028-05-31',
      employer: 'Нэгдүгээр эмнэлэг',
      experienceYears: 7,
      districts: ['Баянзүрх', 'Хан-Уул'],
    },
  })
  const bad = detailsFromForm({ name: 'Б', licenseNo: '', licenseExpiresAt: '2028-13-01', employer: '', experienceYears: '', districts: [] })
  assert.equal(bad.ok, false)
  if (!bad.ok)
    assert.deepEqual(Object.keys(bad.errors).sort(), ['districts', 'employer', 'experienceYears', 'licenseExpiresAt', 'licenseNo', 'name'])
})

test('registration sends app=nurse, register and the name; a non-nurse answer stores nothing', async () => {
  const bodies: unknown[] = []
  let role = 'NURSE'
  const fetch: FetchLike = async (_url, init) => {
    bodies.push(JSON.parse(init.body ?? 'null'))
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            token: 'tok',
            refreshToken: 'r'.repeat(64),
            user: { id: 'u1', name: 'Б.Сараа', email: 'x@nurse.otoch.invalid', role, createdAt: '2026-10-20' },
          },
        }),
    }
  }
  const saved: Session[] = []
  const store: SessionStore = { saveSession: async (s) => void saved.push(s), clearSession: async () => {} }
  const client = createHttpClient({ config, fetch, getToken: async () => null })

  const out = await otpRegisterFlow(client, store, '+97699112233', 'ch1', '483920', '  Б.Сараа ')
  assert.equal(out.ok, true)
  assert.deepEqual(bodies[0], {
    phone: '+97699112233',
    challengeId: 'ch1',
    code: '483920',
    app: 'nurse',
    register: true,
    name: 'Б.Сараа',
  })
  assert.equal(saved.length, 1)

  role = 'CHILD'
  const refused = await otpRegisterFlow(client, store, '+97699112233', 'ch2', '483920', 'Б.Сараа')
  assert.equal(refused.ok, false)
  assert.equal(saved.length, 1)
})

test('documents upload as multipart with the kind; submit posts to /submit', async () => {
  const uploads: UploadRequest[] = []
  const urls: string[] = []
  const answer = { status: 200, text: async () => JSON.stringify({ success: true, data: { application: application() } }) }
  const client = createHttpClient({
    config,
    fetch: async (url) => {
      urls.push(url)
      return answer
    },
    upload: async (req) => {
      uploads.push(req)
      return answer
    },
    getToken: async () => 'tok',
  })
  const r = await uploadDocument(client, 'ID_CARD', { uri: 'file:///id.jpg', name: 'id.jpg', type: 'image/jpeg' })
  assert.equal(r.ok, true)
  assert.equal(uploads[0].url, 'http://api.test/api/nurse/application/documents')
  assert.deepEqual(uploads[0].fields, { kind: 'ID_CARD' })
  assert.equal(uploads[0].headers.Authorization, 'Bearer tok')

  await submitApplication(client)
  assert.equal(urls[0], 'http://api.test/api/nurse/application/submit')
})
