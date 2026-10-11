import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEV_FIXTURE_QUESTIONS } from '../mocks/mockBackend'
import { buildDraftInput, INITIAL_DRAFT, bookingDraftReducer } from '../services/bookingDraft'
import {
  createDraftOrder,
  getRedFlagQuestions,
  parseRedFlagOutcome,
  parseRedFlagQuestionnaire,
  submitRedFlagAnswers,
  updateDraftOrder,
} from '../services/orders'
import {
  EMERGENCY_PHONE,
  allRequiredAnswered,
  answersPayload,
  canSubmitClear,
  hasPositiveAnswer,
  initialAnswers,
  questionnaireLabel,
} from '../services/redFlag'
import { makeClient, makeMockClient } from './helpers'

const QUESTIONNAIRE = parseRedFlagQuestionnaire({ questionnaire: 'DEV_FIXTURE_V0', questions: DEV_FIXTURE_QUESTIONS })

async function draftOn(client: ReturnType<typeof makeMockClient>['client']) {
  const state = bookingDraftReducer(
    bookingDraftReducer(INITIAL_DRAFT, {
      type: 'selectService',
      service: {
        id: 's',
        code: 'HOME_BASIC_CHECK',
        name: 'x',
        description: '',
        category: '',
        priceMnt: 1,
        durationMin: 30,
        requiresReferral: false,
        redFlagQuestionnaire: null,
        isActive: true,
        isFixture: true,
      },
      catalogVersion: null,
      source: 'mock',
    }),
    {
      type: 'updateDetails',
      patch: { parentId: 'p', parentName: 'P', addressText: 'Улаанбаатар 1-р хороо', date: '2026-10-20', timeSlot: '09:00-11:00' },
    },
  )
  const input = buildDraftInput(state)
  assert.ok(input)
  const created = await createDraftOrder(client, input, `k-${Math.random()}`)
  assert.ok(created.ok)
  return created.ok ? created.data.id : ''
}

describe('questionnaire rules', () => {
  it('has 5 dev fixture questions, all unanswered at first and marked as fixtures', () => {
    assert.ok(QUESTIONNAIRE)
    if (!QUESTIONNAIRE) return
    assert.equal(QUESTIONNAIRE.questions.length, 5)
    assert.ok(QUESTIONNAIRE.questions.every((q) => q.text.startsWith('[DEV FIXTURE]')))
    const answers = initialAnswers(QUESTIONNAIRE)
    assert.ok(Object.values(answers).every((a) => a === null))
    assert.equal(canSubmitClear(QUESTIONNAIRE, answers), false)
  })

  it('continue stays disabled until all are answered, and with any "yes"', () => {
    if (!QUESTIONNAIRE) return assert.fail('questionnaire')
    const ids = QUESTIONNAIRE.questions.map((q) => q.id)
    const fourNo = Object.fromEntries(ids.slice(0, 4).map((id) => [id, false]))
    assert.equal(allRequiredAnswered(QUESTIONNAIRE, { ...fourNo, [ids[4]]: null }), false)
    assert.equal(canSubmitClear(QUESTIONNAIRE, { ...fourNo, [ids[4]]: null }), false)
    const allNo = Object.fromEntries(ids.map((id) => [id, false]))
    assert.equal(canSubmitClear(QUESTIONNAIRE, allNo), true)
    const oneYes = { ...allNo, [ids[2]]: true }
    assert.equal(hasPositiveAnswer(oneYes), true)
    assert.equal(canSubmitClear(QUESTIONNAIRE, oneYes), false)
    assert.deepEqual(answersPayload(QUESTIONNAIRE, allNo)[0], { questionId: ids[0], value: false })
  })

  it('labels dev fixtures, unapproved and approved server wording', () => {
    if (!QUESTIONNAIRE) return assert.fail('questionnaire')
    assert.equal(questionnaireLabel(QUESTIONNAIRE, 'mock'), 'dev_fixture')
    assert.equal(questionnaireLabel(QUESTIONNAIRE, 'real'), 'unapproved')
    assert.equal(questionnaireLabel({ ...QUESTIONNAIRE, approved: true }, 'real'), 'approved')
  })

  it('rejects questionnaires it cannot render instead of skipping them', () => {
    assert.equal(parseRedFlagQuestionnaire({ questionnaire: 'X', questions: [] }), null)
    assert.equal(
      parseRedFlagQuestionnaire({ questionnaire: 'X', questions: [{ id: 'a', code: 'A', text: 'T', type: 'SCALE' }] }),
      null,
    )
  })

  it('the emergency number is 103', () => {
    assert.equal(EMERGENCY_PHONE, '103')
  })
})

describe('red flag flow with the development mock', () => {
  it('all "no" -> CLEAR', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const q = await getRedFlagQuestions(client, id)
    assert.ok(q.ok)
    if (!q.ok) return
    const r = await submitRedFlagAnswers(client, id, q.data.questions.map((x) => ({ questionId: x.id, value: false })))
    assert.equal(r.ok && r.data.status, 'CLEAR')
  })

  it('one "yes" -> FLAGGED with 103 advice; the order is blocked on the server too', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const answers = DEV_FIXTURE_QUESTIONS.map((x, i) => ({ questionId: x.id, value: i === 1 }))
    const r = await submitRedFlagAnswers(client, id, answers)
    assert.ok(r.ok && r.data.status === 'FLAGGED')
    if (r.ok && r.data.status === 'FLAGGED') {
      assert.equal(r.data.orderStatus, 'BLOCKED_RED_FLAG')
      assert.equal(r.data.advice?.phone, '103')
      assert.deepEqual(r.data.triggeredCodes, ['BREATHING'])
    }
    const edit = await updateDraftOrder(client, id, { version: 1, timeSlot: '13:00-15:00' })
    assert.equal(edit.ok ? '' : edit.code, 'ORDER_NOT_EDITABLE')
  })

  it('unanswered questions are rejected by the server', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const r = await submitRedFlagAnswers(client, id, [{ questionId: DEV_FIXTURE_QUESTIONS[0].id, value: false }])
    assert.equal(r.ok ? '' : r.code, 'VALIDATION_ERROR')
  })

  it('load and submit errors are failures (the screen must not skip the check)', async () => {
    const loadFail = makeMockClient('redflag-load-error')
    const id1 = await draftOn(loadFail.client)
    assert.equal((await getRedFlagQuestions(loadFail.client, id1)).ok, false)
    const submitFail = makeMockClient('redflag-submit-error')
    const id2 = await draftOn(submitFail.client)
    const r = await submitRedFlagAnswers(submitFail.client, id2, DEV_FIXTURE_QUESTIONS.map((x) => ({ questionId: x.id, value: false })))
    assert.equal(r.ok, false)
  })
})

describe('server decisions win', () => {
  it('a FLAGGED response is honoured even when every local answer was "no"', () => {
    const outcome = parseRedFlagOutcome({
      redFlag: { status: 'FLAGGED', triggeredCodes: ['CHEST_PAIN'] },
      orderStatus: 'BLOCKED_RED_FLAG',
      advice: { text: 'Яаралтай тусламжийн 103 дугаарт залгана уу.', phone: '103' },
    })
    assert.equal(outcome?.status, 'FLAGGED')
  })

  it('an unknown red flag status is a contract failure, not CLEAR', async () => {
    const { client } = makeClient(
      [{ status: 200, body: { success: true, data: { redFlag: { status: 'MAYBE' }, orderStatus: 'DRAFT' } } }],
      { token: 't' },
    )
    const r = await submitRedFlagAnswers(client, 'ord_1', [])
    assert.equal(r.ok ? '' : r.kind, 'contract')
  })
})
