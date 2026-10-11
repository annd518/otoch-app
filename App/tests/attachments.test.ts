import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_REFERRAL_BYTES,
  checkPickedAsset,
  permissionUiState,
  remainingSlots,
} from '../services/attachments'
import { buildDraftInput, INITIAL_DRAFT, bookingDraftReducer } from '../services/bookingDraft'
import { ATTACHMENTS_NOT_IMPLEMENTED_MESSAGE, createDraftOrder, deleteAttachment, uploadReferral } from '../services/orders'
import { makeClient, makeMockClient } from './helpers'

async function draftOn(client: ReturnType<typeof makeMockClient>['client']) {
  const state = bookingDraftReducer(
    bookingDraftReducer(INITIAL_DRAFT, {
      type: 'selectService',
      service: {
        id: 'svc_mock_iv',
        code: 'MOCK_HOME_IV',
        name: 'x',
        description: '',
        category: '',
        priceMnt: 1,
        durationMin: 30,
        requiresReferral: true,
        redFlagQuestionnaire: null,
        isActive: true,
        isFixture: false,
      },
      catalogVersion: null,
      source: 'mock',
    }),
    { type: 'updateDetails', patch: { parentId: 'p', addressText: 'Улаанбаатар 1-р хороо', date: '2026-10-20', timeSlot: '09:00-11:00' } },
  )
  const input = buildDraftInput(state)
  assert.ok(input)
  const created = await createDraftOrder(client, input, `k-${Math.random()}`)
  assert.ok(created.ok)
  return created.ok ? created.data.id : ''
}

const JPEG = { uri: 'file:///tmp/a.jpg', name: 'a.jpg', type: 'image/jpeg' }

describe('picked image checks', () => {
  it('accepts JPEG and PNG, also when only the extension is known', () => {
    assert.equal(checkPickedAsset({ uri: 'file:///x/IMG_1.JPG' }).ok, true)
    const png = checkPickedAsset({ uri: 'file:///x/b', mimeType: 'image/png', fileSize: 1000 })
    assert.deepEqual(png, { ok: true, name: 'referral.png', mimeType: 'image/png', sizeBytes: 1000 })
  })

  it('rejects HEIC that was not converted, PDF and other types with a reason', () => {
    const heic = checkPickedAsset({ uri: 'file:///x/IMG_2.HEIC', mimeType: 'image/heic' })
    assert.equal(heic.ok ? '' : heic.reason, 'heic')
    const pdf = checkPickedAsset({ uri: 'file:///x/zaalt.pdf', mimeType: 'application/pdf' })
    assert.equal(pdf.ok ? '' : pdf.reason, 'pdf')
    const gif = checkPickedAsset({ uri: 'file:///x/a.gif', mimeType: 'image/gif' })
    assert.equal(gif.ok ? '' : gif.reason, 'unsupported')
  })

  it('enforces 10 MB per file and 5 files per order', () => {
    const big = checkPickedAsset({ uri: 'file:///x/a.jpg', mimeType: 'image/jpeg', fileSize: MAX_REFERRAL_BYTES + 1 })
    assert.equal(big.ok ? '' : big.reason, 'too_large')
    assert.equal(remainingSlots(3), 2)
    assert.equal(remainingSlots(7), 0)
  })

  it('maps permission responses to granted / ask again / blocked (open settings)', () => {
    assert.equal(permissionUiState({ granted: true, canAskAgain: true }), 'granted')
    assert.equal(permissionUiState({ granted: false, canAskAgain: true }), 'ask')
    assert.equal(permissionUiState({ granted: false, canAskAgain: false }), 'blocked')
  })
})

describe('upload with the development mock (no real server storage)', () => {
  it('reports progress up to 100% and returns an attachment id', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const progress: number[] = []
    const r = await uploadReferral(client, id, JPEG, (p) => progress.push(p))
    assert.equal(r.ok, true)
    assert.equal(progress[progress.length - 1], 1)
    assert.ok(progress.every((p, i) => i === 0 || p >= progress[i - 1]))
  })

  it('a failed upload can be retried', async () => {
    const { client } = makeMockClient('upload-fail-once')
    const id = await draftOn(client)
    const first = await uploadReferral(client, id, JPEG)
    assert.equal(first.ok ? '' : first.kind, 'network')
    const second = await uploadReferral(client, id, JPEG)
    assert.equal(second.ok, true)
  })

  it('rejects non-image types and a sixth file; delete returns 204 ok', async () => {
    const { client } = makeMockClient()
    const id = await draftOn(client)
    const pdf = await uploadReferral(client, id, { uri: 'file:///x.pdf', name: 'x.pdf', type: 'application/pdf' })
    assert.equal(pdf.ok ? '' : pdf.status, 415)
    const ids: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const r = await uploadReferral(client, id, JPEG)
      if (r.ok) ids.push(r.data.id)
    }
    const sixth = await uploadReferral(client, id, JPEG)
    assert.equal(sixth.ok, false)
    const del = await deleteAttachment(client, id, ids[0])
    assert.equal(del.ok, true)
  })
})

describe('upload against a server without the endpoint', () => {
  it('is reported as not implemented, never as uploaded', async () => {
    const upload = async () => ({ status: 404, text: async () => '' })
    const { client } = makeClient([], { token: 't', upload })
    const r = await uploadReferral(client, 'ord_1', JPEG)
    assert.equal(r.ok ? '' : r.kind, 'not_implemented')
    assert.equal(r.ok ? '' : r.message, ATTACHMENTS_NOT_IMPLEMENTED_MESSAGE)
  })

  it('without an upload transport the client refuses instead of pretending', async () => {
    const { client } = makeClient([], { token: 't' })
    const r = await uploadReferral(client, 'ord_1', JPEG)
    assert.equal(r.ok ? '' : r.kind, 'config')
  })
})
