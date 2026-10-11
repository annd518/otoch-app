import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CatalogService, Order } from '../services/apiTypes'
import {
  INITIAL_DRAFT,
  bookingDraftReducer,
  buildDraftInput,
  isBlocked,
  nextStepAfterDetails,
  planDraftSave,
  validateDetails,
  type BookingDraftAction,
  type BookingDraftState,
} from '../services/bookingDraft'
import { DEV_FIXTURE_QUESTIONS } from '../mocks/mockBackend'
import { ORDERS_NOT_IMPLEMENTED_MESSAGE, createDraftOrder, submitRedFlagAnswers, updateDraftOrder } from '../services/orders'
import { slotStartToUlaanbaatarIso, slotStartToUtcIso } from '../utils/datetime'
import { createSingleFlight } from '../utils/singleFlight'
import { makeClient, makeMockClient } from './helpers'

const SERVICE: CatalogService = {
  id: 'cmg_demo_basic',
  code: 'HOME_BASIC_CHECK',
  name: 'Гэрийн ердийн үзлэг (тест)',
  description: '',
  category: 'HOME_VISIT',
  priceMnt: 45000,
  durationMin: 45,
  requiresReferral: false,
  redFlagQuestionnaire: 'GENERAL_V1',
  isActive: true,
  isFixture: true,
}
const NOW = new Date('2026-10-13T02:00:00Z') // 10:00 in Ulaanbaatar

function apply(...actions: BookingDraftAction[]): BookingDraftState {
  return actions.reduce(bookingDraftReducer, INITIAL_DRAFT)
}

const filled = () =>
  apply(
    { type: 'selectService', service: SERVICE, catalogVersion: '2026-10-12T06:00:00.000Z', source: 'real' },
    {
      type: 'updateDetails',
      patch: {
        parentId: 'par_1',
        parentName: 'Туршилтын Эх',
        addressText: '  Улаанбаатар, 1-р хороо, 10-р байр  ',
        date: '2026-10-20',
        timeSlot: '09:00-11:00',
      },
    },
  )

const savedOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ord_1',
  status: 'DRAFT',
  version: 1,
  parentId: 'par_1',
  serviceCodes: ['HOME_BASIC_CHECK'],
  scheduledFor: '2026-10-20T01:00:00.000Z',
  timeSlot: '09:00-11:00',
  redFlagStatus: 'NOT_ANSWERED',
  requiresReferral: false,
  referralUploadAvailable: false,
  ignoredFields: [],
  ...overrides,
})

describe('+08:00 serialization', () => {
  it('keeps the Ulaanbaatar wall time with an explicit offset', () => {
    assert.equal(slotStartToUlaanbaatarIso('2026-10-20', '09:00-11:00'), '2026-10-20T09:00:00+08:00')
  })

  it('is the same instant as the UTC form', () => {
    const offset = slotStartToUlaanbaatarIso('2026-10-20', '17:00-19:00')
    const utc = slotStartToUtcIso('2026-10-20', '17:00-19:00')
    assert.ok(offset && utc)
    assert.equal(new Date(offset).getTime(), new Date(utc).getTime())
    assert.equal(utc, '2026-10-20T09:00:00.000Z')
  })

  it('rejects impossible dates and slots', () => {
    assert.equal(slotStartToUlaanbaatarIso('2026-02-30', '09:00-11:00'), null)
    assert.equal(slotStartToUlaanbaatarIso('2026-10-20', '25:00-26:00'), null)
  })
})

describe('draft payload', () => {
  it('carries service id, code and catalog version, patient, address and +08:00 time', () => {
    assert.deepEqual(buildDraftInput(filled()), {
      parentId: 'par_1',
      items: [{ serviceId: 'cmg_demo_basic', serviceCode: 'HOME_BASIC_CHECK', quantity: 1 }],
      catalogVersion: '2026-10-12T06:00:00.000Z',
      scheduledFor: '2026-10-20T09:00:00+08:00',
      timeSlot: '09:00-11:00',
      address: { text: 'Улаанбаатар, 1-р хороо, 10-р байр' },
    })
  })

  it('includes notes only when present', () => {
    const state = bookingDraftReducer(filled(), { type: 'updateDetails', patch: { notes: ' Залгаад ирнэ үү ' } })
    assert.equal(buildDraftInput(state)?.notes, 'Залгаад ирнэ үү')
  })

  it('validates every required field and rejects past dates and past slots', () => {
    assert.deepEqual(Object.keys(validateDetails(INITIAL_DRAFT, NOW)).sort(), ['address', 'date', 'parent', 'service', 'timeSlot'])
    assert.deepEqual(validateDetails(filled(), NOW), {})
    const past = bookingDraftReducer(filled(), { type: 'updateDetails', patch: { date: '2026-10-12' } })
    assert.ok(validateDetails(past, NOW).date)
    const todayEarly = bookingDraftReducer(filled(), { type: 'updateDetails', patch: { date: '2026-10-13', timeSlot: '09:00-11:00' } })
    assert.ok(validateDetails(todayEarly, NOW).timeSlot)
  })
})

describe('draft state across screens', () => {
  it('keeps service, patient and address when going back and editing', () => {
    const state = bookingDraftReducer(filled(), { type: 'updateDetails', patch: { notes: 'x' } })
    assert.equal(state.service?.code, 'HOME_BASIC_CHECK')
    assert.equal(state.details.parentId, 'par_1')
    assert.equal(state.details.addressText.trim(), 'Улаанбаатар, 1-р хороо, 10-р байр')
  })

  it('a retry of a failed create reuses the same idempotency key', () => {
    let n = 0
    const newKey = () => `key-${++n}`
    const first = planDraftSave(filled(), newKey)
    assert.equal(first.kind, 'create')
    const started = bookingDraftReducer(filled(), {
      type: 'createStarted',
      key: first.kind === 'create' ? first.key : '',
      fingerprint: first.kind === 'create' ? first.fingerprint : '',
    })
    const retry = planDraftSave(started, newKey)
    assert.equal(retry.kind === 'create' && retry.key, 'key-1')
  })

  it('saved and unchanged -> no request; changed -> PATCH with version and without parentId', () => {
    const saved = bookingDraftReducer(filled(), { type: 'draftSaved', order: savedOrder(), source: 'real' })
    assert.equal(saved.dirty, false)
    assert.equal(planDraftSave(saved, () => 'k').kind, 'none')
    const edited = bookingDraftReducer(saved, { type: 'updateDetails', patch: { timeSlot: '13:00-15:00' } })
    const plan = planDraftSave(edited, () => 'k')
    assert.equal(plan.kind, 'update')
    if (plan.kind === 'update') {
      assert.equal(plan.patch.version, 1)
      assert.equal(plan.patch.scheduledFor, '2026-10-20T13:00:00+08:00')
      assert.equal('parentId' in plan.patch, false)
    }
  })

  it('changing the patient after saving creates a new draft', () => {
    const saved = bookingDraftReducer(filled(), { type: 'draftSaved', order: savedOrder(), source: 'real' })
    const other = bookingDraftReducer(saved, { type: 'updateDetails', patch: { parentId: 'par_2', parentName: 'Өөр' } })
    assert.equal(planDraftSave(other, () => 'k2').kind, 'create')
  })

  it('choosing another service resets red flag answers, attachments and quote', () => {
    const cleared = bookingDraftReducer(filled(), { type: 'redFlagCleared' })
    const changed = bookingDraftReducer(cleared, {
      type: 'selectService',
      service: { ...SERVICE, id: 'cmg_demo_iv', code: 'HOME_IV_THERAPY', requiresReferral: true },
      catalogVersion: 'v2',
      source: 'real',
    })
    assert.equal(changed.redFlag.status, 'not_answered')
    assert.equal(changed.quote, null)
    assert.equal(nextStepAfterDetails(changed), '/booking/red-flags')
  })
})

describe('draft API with the development mock', () => {
  it('creates a DRAFT and a retry with the same key returns the same order', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const first = await createDraftOrder(client, input, 'key-1')
    const again = await createDraftOrder(client, input, 'key-1')
    assert.equal(first.ok && first.data.status, 'DRAFT')
    assert.equal(first.ok && again.ok && first.data.id === again.data.id, true)
  })

  it('network failure then retry with the same key creates exactly one order', async () => {
    const { client } = makeMockClient('order-network-error-once')
    const input = buildDraftInput(filled())
    assert.ok(input)
    const failed = await createDraftOrder(client, input, 'key-9')
    assert.equal(failed.ok ? '' : failed.kind, 'network')
    const retried = await createDraftOrder(client, input, 'key-9')
    const third = await createDraftOrder(client, input, 'key-9')
    assert.equal(retried.ok && third.ok && retried.data.id === third.data.id, true)
  })

  it('double tap sends one request', async () => {
    const { client, fetchCount } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const save = createSingleFlight(() => createDraftOrder(client, input, 'key-tap'))
    const [a, b] = await Promise.all([save.run(), save.run()])
    assert.equal(fetchCount(), 1)
    assert.equal(a, b)
  })

  it('PATCH with an old version is a 409 conflict, the current version succeeds', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const created = await createDraftOrder(client, input, 'k')
    assert.ok(created.ok)
    if (!created.ok) return
    const ok = await updateDraftOrder(client, created.data.id, { version: 1, timeSlot: '13:00-15:00' })
    assert.equal(ok.ok && ok.data.version, 2)
    const stale = await updateDraftOrder(client, created.data.id, { version: 1, timeSlot: '15:00-17:00' })
    assert.equal(stale.ok ? '' : stale.code, 'VERSION_CONFLICT')
  })

  it('a server-side validation error is a failure with field errors, never a saved draft', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const bad = await createDraftOrder(client, { ...input, address: { text: 'x' } }, 'k-bad')
    assert.equal(bad.ok, false)
    assert.ok(!bad.ok && bad.fields && bad.fields['address.text'])
  })
})

describe('draft API against a server without the endpoint', () => {
  it('404 without a body (origin/main) is "not implemented"', async () => {
    const { client } = makeClient([{ status: 404 }], { token: 't' })
    const input = buildDraftInput(filled())
    assert.ok(input)
    const r = await createDraftOrder(client, input, 'k')
    assert.equal(r.ok ? '' : r.kind, 'not_implemented')
    assert.equal(r.ok ? '' : r.message, ORDERS_NOT_IMPLEMENTED_MESSAGE)
  })

  it('404 NOT_FOUND from the unified error contract (backend branch) is "not implemented"', async () => {
    const { client } = makeClient([{ status: 404, body: { success: false, message: 'Not found', error: { code: 'NOT_FOUND' } } }], { token: 't' })
    const r = await updateDraftOrder(client, 'ord_1', { version: 1 })
    assert.equal(r.ok ? '' : r.kind, 'not_implemented')
  })

  it('404 ORDER_NOT_FOUND is a real not-found, not "not implemented"', async () => {
    const { client } = makeClient([{ status: 404, body: { success: false, message: 'Олдсонгүй', error: { code: 'ORDER_NOT_FOUND' } } }], { token: 't' })
    const r = await updateDraftOrder(client, 'ord_x', { version: 1 })
    assert.equal(r.ok ? '' : r.kind, 'http')
  })
})

describe('blocked draft', () => {
  it('cannot be edited or continued until a brand new booking is started', () => {
    const blocked = bookingDraftReducer(filled(), { type: 'redFlagBlocked', advice: null })
    assert.equal(isBlocked(blocked), true)
    assert.equal(bookingDraftReducer(blocked, { type: 'updateDetails', patch: { date: '2026-10-21' } }), blocked)
    assert.equal(bookingDraftReducer(blocked, { type: 'redFlagCleared' }), blocked)
    assert.equal(nextStepAfterDetails(blocked), '/booking/emergency')
    assert.equal(isBlocked(bookingDraftReducer(blocked, { type: 'reset' })), false)
  })
})

describe('staying in sync with the server draft', () => {
  it('PATCH without a service change does not send items (the server would reset the red flag)', () => {
    const saved = bookingDraftReducer(filled(), { type: 'draftSaved', order: savedOrder(), source: 'real' })
    const edited = bookingDraftReducer(saved, { type: 'updateDetails', patch: { notes: 'Залгана уу' } })
    const plan = planDraftSave(edited, () => 'k')
    assert.ok(plan.kind === 'update' && plan.patch.items === undefined && plan.patch.notes === 'Залгана уу')
  })

  it('PATCH after a service change sends items and the catalog version', () => {
    const saved = bookingDraftReducer(filled(), { type: 'draftSaved', order: savedOrder(), source: 'real' })
    const changed = bookingDraftReducer(saved, {
      type: 'selectService',
      service: { ...SERVICE, id: 'cmg_demo_iv', code: 'HOME_IV_THERAPY' },
      catalogVersion: 'v2',
      source: 'real',
    })
    const plan = planDraftSave(changed, () => 'k')
    assert.ok(plan.kind === 'update')
    if (plan.kind === 'update') {
      assert.equal(plan.patch.items?.[0].serviceCode, 'HOME_IV_THERAPY')
      assert.equal(plan.patch.catalogVersion, 'v2')
    }
  })

  it('takes the red flag state from the saved order (server is the source of truth)', () => {
    const cleared = bookingDraftReducer(filled(), { type: 'redFlagCleared' })
    const reset = bookingDraftReducer(cleared, { type: 'draftSaved', order: savedOrder({ redFlagStatus: 'NOT_ANSWERED' }), source: 'real' })
    assert.equal(reset.redFlag.status, 'not_answered')
    const blocked = bookingDraftReducer(filled(), {
      type: 'draftSaved',
      order: savedOrder({ status: 'BLOCKED_RED_FLAG', redFlagStatus: 'FLAGGED' }),
      source: 'real',
    })
    assert.equal(isBlocked(blocked), true)
  })

  it('answering the questionnaire updates the local version so the next PATCH is accepted', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input)
    const created = await createDraftOrder(client, input, 'k-sync')
    assert.ok(created.ok)
    if (!created.ok) return
    let state = bookingDraftReducer(filled(), { type: 'draftSaved', order: created.data, source: 'mock' })
    const answered = await submitRedFlagAnswers(
      client,
      created.data.id,
      DEV_FIXTURE_QUESTIONS.map((q) => ({ questionId: q.id, value: false })),
    )
    assert.ok(answered.ok)
    if (!answered.ok) return
    state = bookingDraftReducer(state, { type: 'redFlagCleared', version: answered.data.version })
    state = bookingDraftReducer(state, { type: 'updateDetails', patch: { notes: 'Шинэ тэмдэглэл' } })
    const plan = planDraftSave(state, () => 'k')
    assert.ok(plan.kind === 'update')
    if (plan.kind !== 'update') return
    const patched = await updateDraftOrder(client, plan.orderId, plan.patch)
    assert.equal(patched.ok, true)
    // details-only change keeps the CLEAR answers on the server
    assert.equal(patched.ok && patched.data.redFlagStatus, 'CLEAR')
  })

  it('does not send nurseGenderPreference (not stored by the server); nothing is ignored', async () => {
    const { client } = makeMockClient()
    const input = buildDraftInput(filled())
    assert.ok(input && !('nurseGenderPreference' in input))
    const created = await createDraftOrder(client, input, 'k-ign')
    assert.ok(created.ok && created.data.ignoredFields.length === 0)
  })
})
