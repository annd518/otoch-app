import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { API_PATHS } from '../config/api'
import { parseCreatedVisit, parseParentList } from '../services/validators'
import { slotStartToUtcIso, ulaanbaatarDate } from '../utils/datetime'
import { normalizeMongolianPhone } from '../utils/phone'
import { makeClient, makeJwt } from './helpers'

// Bodies copied from server/src/controllers/visitController.ts scheduleVisit.
const VISIT_INPUT = { parentId: 'p1', scheduledFor: '2026-10-20T01:00:00.000Z', visitType: 'FULL' }

function createVisit(replies: Parameters<typeof makeClient>[0]) {
  const harness = makeClient(replies, { token: 'stored-token' })
  const result = harness.client.request({
    method: 'POST',
    path: API_PATHS.visits.create,
    body: VISIT_INPUT,
    parse: parseCreatedVisit,
  })
  return { harness, result }
}

describe('booking result is never a false success', () => {
  it('HTTP 200 with only a message (validation error today) is a failure', async () => {
    const { result } = createVisit([{ status: 200, body: { message: 'Буруу өгөгдөл' } }])
    const r = await result
    assert.equal(r.ok, false)
    assert.equal(r.ok ? '' : r.kind, 'rejected')
    assert.equal(r.ok ? '' : r.message, 'Буруу өгөгдөл')
  })

  it('HTTP 200 "parent not found" is a failure', async () => {
    const { result } = createVisit([{ status: 200, body: { message: 'Эцэг/эх олдсонгүй эсвэл хандах эрхгүй' } }])
    const r = await result
    assert.equal(r.ok, false)
    assert.equal(r.ok ? '' : r.message, 'Эцэг/эх олдсонгүй эсвэл хандах эрхгүй')
  })

  it('success:true without data.visit is a contract failure', async () => {
    const r = await createVisit([{ status: 201, body: { success: true, message: 'ok', data: {} } }]).result
    assert.equal(r.ok, false)
    assert.equal(r.ok ? '' : r.kind, 'contract')
  })

  it('HTTP 400 success:false is a failure with the server message', async () => {
    const r = await createVisit([{ status: 400, body: { success: false, message: 'Үзлэг товлож чадсангүй' } }]).result
    assert.equal(r.ok, false)
    assert.equal(r.ok ? '' : r.message, 'Үзлэг товлож чадсангүй')
  })

  it('a non-JSON body is a failure, not a crash', async () => {
    const { harness, result } = createVisit([{ status: 502 }])
    const r = await result
    assert.equal(r.ok, false)
    assert.equal(harness.remaining(), 0)
  })

  it('a valid 201 response succeeds and the request carries the stored token', async () => {
    const { harness, result } = createVisit([
      {
        status: 201,
        body: {
          success: true,
          message: 'Үзлэг амжилттай товлогдлоо',
          data: {
            visit: {
              id: 'v1',
              parentId: 'p1',
              scheduledFor: '2026-10-20T01:00:00.000Z',
              visitType: 'FULL',
              status: 'PENDING',
              Parent: { name: 'Туршилтын Эх', address: 'Улаанбаатар' },
            },
          },
        },
      },
    ])
    const r = await result
    assert.equal(r.ok, true)
    assert.equal(r.ok ? r.data.id : '', 'v1')
    assert.equal(harness.calls[0].url, 'http://api.test/api/visits')
    assert.equal(harness.calls[0].init.headers.Authorization, 'Bearer stored-token')
    assert.deepEqual(JSON.parse(harness.calls[0].init.body ?? ''), VISIT_INPUT)
  })

  it('a 401 on an authenticated request ends the session', async () => {
    const { harness, result } = createVisit([{ status: 401, body: { message: 'Token хүчингүй' } }])
    const r = await result
    assert.equal(r.ok ? '' : r.kind, 'unauthorized')
    assert.equal(harness.unauthorizedCount(), 1)
  })
})

describe('parents list', () => {
  it('rejects a list that contains a malformed parent', () => {
    assert.equal(parseParentList({ parents: [{ id: 'p1', name: 'A' }] }), null)
  })

  it('accepts the server shape with nullable text fields', () => {
    const parents = parseParentList({
      parents: [
        {
          id: 'p1',
          name: 'Туршилтын Эх',
          age: 70,
          gender: 'Female',
          address: 'Улаанбаатар, 1-р хороо',
          diseases: null,
          medications: 'None',
          emergencyContact: '+97688000000',
        },
      ],
    })
    assert.equal(parents?.length, 1)
    assert.equal(parents?.[0].diseases, null)
  })
})

describe('booking time', () => {
  it('converts a date and slot in Ulaanbaatar time to UTC', () => {
    assert.equal(slotStartToUtcIso('2026-10-20', '09:00-11:00'), '2026-10-20T01:00:00.000Z')
    assert.equal(slotStartToUtcIso('2026-10-20', '17:00-19:00'), '2026-10-20T09:00:00.000Z')
  })

  it('rejects impossible dates and malformed slots', () => {
    assert.equal(slotStartToUtcIso('2026-02-30', '09:00-11:00'), null)
    assert.equal(slotStartToUtcIso('20-10-2026', '09:00-11:00'), null)
    assert.equal(slotStartToUtcIso('2026-10-20', '9-11 AM'), null)
  })

  it('computes the Ulaanbaatar calendar date regardless of the device time zone', () => {
    assert.equal(ulaanbaatarDate(new Date('2026-10-11T17:30:00Z')), '2026-10-12')
    assert.equal(ulaanbaatarDate(new Date('2026-10-11T15:59:00Z')), '2026-10-11')
  })
})

describe('phone normalisation for the current server rule (min 10 characters)', () => {
  it('adds +976 to a bare 8-digit Mongolian number', () => {
    assert.equal(normalizeMongolianPhone('88112233'), '+97688112233')
    assert.equal(normalizeMongolianPhone(' 8811 2233 '), '+97688112233')
  })

  it('keeps numbers that already have a country code', () => {
    assert.equal(normalizeMongolianPhone('+976 8811 2233'), '+976 8811 2233')
  })
})

describe('session expiry', () => {
  it('a 403 from the auth middleware with an expired stored token ends the session', async () => {
    const expired = makeJwt({ userId: 'u1', role: 'CHILD', exp: 1 })
    const harness = makeClient([{ status: 403, body: { error: 'Токен хүчингүй эсвэл хугацаа нь дууссан' } }], {
      token: expired,
    })
    const r = await harness.client.request({ method: 'GET', path: API_PATHS.parents.list, parse: parseParentList })
    assert.equal(r.ok ? '' : r.kind, 'unauthorized')
    assert.equal(harness.unauthorizedCount(), 1)
  })

  it('a 403 with a still-valid token is a normal permission error and keeps the session', async () => {
    const valid = makeJwt({ userId: 'u1', role: 'CHILD', exp: 4102444800 })
    const harness = makeClient([{ status: 403, body: { success: false, message: 'Хандах эрхгүй' } }], { token: valid })
    const r = await harness.client.request({ method: 'GET', path: API_PATHS.parents.list, parse: parseParentList })
    assert.equal(r.ok ? '' : r.kind, 'http')
    assert.equal(r.ok ? '' : r.message, 'Хандах эрхгүй')
    assert.equal(harness.unauthorizedCount(), 0)
  })
})
