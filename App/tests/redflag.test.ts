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
  questionnaireShowsBlocked,
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

  it('labels dev fixtures, server fixtures, unapproved and approved wording', () => {
    if (!QUESTIONNAIRE) return assert.fail('questionnaire')
    assert.equal(questionnaireLabel(QUESTIONNAIRE, 'mock'), 'dev_fixture')
    assert.equal(questionnaireLabel(QUESTIONNAIRE, 'real'), 'server_fixture')
    const plain = { ...QUESTIONNAIRE, containsFixtures: false }
    assert.equal(questionnaireLabel(plain, 'real'), 'unapproved')
    assert.equal(questionnaireLabel({ ...plain, approved: true }, 'real'), 'approved')
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

  it('one "yes" -> FLAGGED; the order is blocked on the server too and cannot be edited or re-answered', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const answers = DEV_FIXTURE_QUESTIONS.map((x, i) => ({ questionId: x.id, value: i === 1 }))
    const r = await submitRedFlagAnswers(client, id, answers, ['DEV_FIXTURE_V0'])
    assert.ok(r.ok && r.data.status === 'FLAGGED')
    if (r.ok && r.data.status === 'FLAGGED') {
      assert.equal(r.data.orderStatus, 'BLOCKED_RED_FLAG')
      assert.equal(r.data.version, 2)
      // the implemented server sends placeholder advice without a phone; the app always offers 103
      assert.equal(r.data.advice?.isFixture, true)
    }
    const edit = await updateDraftOrder(client, id, { version: 2, timeSlot: '13:00-15:00' })
    assert.equal(edit.ok ? '' : edit.code, 'RED_FLAG_BLOCKED')
    const again = await submitRedFlagAnswers(client, id, DEV_FIXTURE_QUESTIONS.map((x) => ({ questionId: x.id, value: false })))
    assert.equal(again.ok ? '' : again.code, 'RED_FLAG_BLOCKED')
  })

  it('unanswered questions are rejected by the server (RED_FLAG_INCOMPLETE)', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const r = await submitRedFlagAnswers(client, id, [{ questionId: DEV_FIXTURE_QUESTIONS[0].id, value: false }])
    assert.equal(r.ok ? '' : r.code, 'RED_FLAG_INCOMPLETE')
  })

  it('an outdated questionnaire is a 409 the screen answers by reloading', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const r = await submitRedFlagAnswers(client, id, DEV_FIXTURE_QUESTIONS.map((x) => ({ questionId: x.id, value: false })), ['OLD_V0'])
    assert.equal(r.ok ? '' : r.code, 'QUESTIONNAIRE_OUTDATED')
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

describe('implemented server shapes (work/backend-l1-1 d842241)', () => {
  const IMPLEMENTED = {
    orderId: 'ord_1',
    orderStatus: 'DRAFT',
    redFlag: { status: 'NOT_ANSWERED' },
    questionnaires: ['GENERAL_V1'],
    containsFixtures: true,
    questions: [
      { id: 'q1', questionnaire: 'GENERAL_V1', code: 'TEST_Q1', text: 'Туршилтын асуулт 1', isFixture: true },
      { id: 'q2', questionnaire: 'GENERAL_V1', code: 'TEST_Q2', text: 'Туршилтын асуулт 2', isFixture: true },
      { id: 'q3', questionnaire: 'GENERAL_V1', code: 'TEST_Q3', text: 'Туршилтын асуулт 3', isFixture: true },
    ],
  }

  it('parses questionnaires[] and questions without a type field', () => {
    const q = parseRedFlagQuestionnaire(IMPLEMENTED)
    assert.deepEqual(q?.questionnaires, ['GENERAL_V1'])
    assert.equal(q?.questions.length, 3)
    assert.equal(q?.containsFixtures, true)
    assert.equal(q && questionnaireLabel(q, 'real'), 'server_fixture')
  })

  it('sees a questionnaire for an order the server already blocked', () => {
    const q = parseRedFlagQuestionnaire({ ...IMPLEMENTED, orderStatus: 'BLOCKED_RED_FLAG', redFlag: { status: 'FLAGGED' } })
    assert.ok(q && questionnaireShowsBlocked(q))
  })

  it('accepts "no questionnaire" only when both lists are empty', () => {
    const none = parseRedFlagQuestionnaire({ ...IMPLEMENTED, questionnaires: [], questions: [], containsFixtures: false })
    assert.equal(none?.questions.length, 0)
    assert.equal(parseRedFlagQuestionnaire({ ...IMPLEMENTED, questions: [] }), null)
    assert.equal(parseRedFlagQuestionnaire({ ...IMPLEMENTED, questionnaires: [] }), null)
  })

  it('reads version and placeholder advice from the answers response', () => {
    const clear = parseRedFlagOutcome({ redFlag: { status: 'CLEAR', answeredAt: 'x' }, orderStatus: 'DRAFT', version: 3 })
    assert.deepEqual(clear, { status: 'CLEAR', orderStatus: 'DRAFT', version: 3 })
    const flagged = parseRedFlagOutcome({
      redFlag: { status: 'FLAGGED' },
      orderStatus: 'BLOCKED_RED_FLAG',
      version: 3,
      advice: { text: 'Туршилтын мэдэгдэл', isFixture: true },
    })
    assert.ok(flagged?.status === 'FLAGGED' && flagged.advice?.isFixture === true && flagged.advice.phone === null)
  })
})
