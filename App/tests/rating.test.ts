import assert from 'node:assert/strict'
import { it } from 'node:test'

import { parseOrder, parseRating, rateOrder } from '../services/orders'
import { VALID_TOKEN, makeClient } from './helpers'

it('a rating is 1-5 whole stars; unknown tags are dropped', () => {
  assert.deepEqual(parseRating({ stars: 5, tags: ['ON_TIME', 'WEIRD'], comment: 'Сайн' }), {
    stars: 5,
    tags: ['ON_TIME'],
    comment: 'Сайн',
  })
  assert.equal(parseRating({ stars: 0 }), null)
  assert.equal(parseRating({ stars: 4.5 }), null)
  assert.equal(parseRating(null), null)
})

it('an order says whether it can be rated', () => {
  const o = parseOrder({ order: { id: 'o1', status: 'COMPLETED', version: 3, parentId: 'p', canRate: true, rating: null } })
  assert.equal(o?.canRate, true)
  assert.equal(o?.rating, null)
  const rated = parseOrder({ order: { id: 'o1', status: 'COMPLETED', version: 3, parentId: 'p', rating: { stars: 4, tags: [] } } })
  assert.equal(rated?.canRate, false)
  assert.equal(rated?.rating?.stars, 4)
})

it('rating sends stars, tags and a trimmed comment only when there is one', async () => {
  const order = { id: 'o1', status: 'COMPLETED', version: 3, parentId: 'p', rating: { stars: 5, tags: ['KIND'] } }
  const h = makeClient(
    [
      { status: 200, body: { success: true, message: 'ok', data: { order } } },
      { status: 200, body: { success: true, message: 'ok', data: { order } } },
    ],
    { token: VALID_TOKEN },
  )
  const r = await rateOrder(h.client, 'o1', { stars: 5, tags: ['KIND'], comment: '  ' })
  assert.ok(h.calls[0].url.endsWith('/api/orders/o1/rating'))
  assert.equal(h.calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(h.calls[0].init.body ?? '{}'), { stars: 5, tags: ['KIND'] })
  assert.equal(r.ok && r.data.rating?.stars, 5)
  await rateOrder(h.client, 'o1', { stars: 2, tags: [], comment: ' Хоцорсон ' })
  assert.deepEqual(JSON.parse(h.calls[1].init.body ?? '{}'), { stars: 2, tags: [], comment: 'Хоцорсон' })
})
