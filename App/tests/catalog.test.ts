import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CATALOG_NOT_IMPLEMENTED_MESSAGE, fetchCatalog } from '../services/catalog'
import { parseCatalog, parseQuote } from '../services/validators'
import { formatMnt } from '../utils/money'
import { makeClient } from './helpers'

const noDelay = async () => {}

// docs/l1-1-api.md §2 example (fabricated data from the backend proposal).
const CONTRACT_CATALOG = {
  success: true,
  message: 'Каталог',
  data: {
    catalogVersion: '2026-10-11.1',
    currency: 'MNT',
    services: [
      {
        id: 'svc_demo_basic',
        code: 'HOME_BASIC_CHECK',
        name: 'Гэрийн ердийн үзлэг',
        description: 'Даралт, сахар, судасны цохилт, хүчилтөрөгч хэмжих',
        category: 'HOME_VISIT',
        priceMnt: 45000,
        durationMin: 45,
        requiresReferral: false,
        redFlagQuestionnaire: 'GENERAL_V1',
        isActive: true,
      },
    ],
  },
}

describe('catalog in mock mode', () => {
  it('returns contract-shaped fabricated data without any network request', async () => {
    const { client, calls } = makeClient([])
    const result = await fetchCatalog({ mode: 'mock', client, mockScenario: 'ok', delay: noDelay })
    assert.equal(result.source, 'mock')
    assert.equal(result.ok, true)
    assert.equal(calls.length, 0)
    if (result.ok) {
      assert.ok(result.data.services.length >= 2)
      assert.ok(result.data.services.some((s) => s.requiresReferral))
      assert.ok(result.data.services.every((s) => s.name.startsWith('[MOCK]')))
    }
  })

  it('supports the empty and error scenarios', async () => {
    const { client } = makeClient([])
    const empty = await fetchCatalog({ mode: 'mock', client, mockScenario: 'empty', delay: noDelay })
    assert.equal(empty.ok && empty.data.services.length, 0)
    const error = await fetchCatalog({ mode: 'mock', client, mockScenario: 'error', delay: noDelay })
    assert.equal(error.ok, false)
  })
})

describe('catalog in real mode', () => {
  it('reports a 404 as "not implemented" instead of pretending it worked', async () => {
    const { client, calls } = makeClient([{ status: 404, body: { message: 'Not Found' } }], { token: 't' })
    const result = await fetchCatalog({ mode: 'real', client, mockScenario: 'ok', delay: noDelay })
    assert.equal(calls[0].url, 'http://api.test/api/catalog/services')
    assert.equal(result.ok, false)
    assert.equal(result.source, 'real')
    assert.equal(result.ok ? '' : result.message, CATALOG_NOT_IMPLEMENTED_MESSAGE)
  })

  it('parses the proposed contract response', async () => {
    const { client } = makeClient([{ status: 200, body: CONTRACT_CATALOG }], { token: 't' })
    const result = await fetchCatalog({ mode: 'real', client, mockScenario: 'ok', delay: noDelay })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.services[0].code, 'HOME_BASIC_CHECK')
      assert.equal(result.data.services[0].priceMnt, 45000)
    }
  })

  it('rejects a catalog without MNT currency or with a fractional price', () => {
    assert.equal(parseCatalog({ ...CONTRACT_CATALOG.data, currency: 'NPR' }), null)
    const fractional = {
      ...CONTRACT_CATALOG.data,
      services: [{ ...CONTRACT_CATALOG.data.services[0], priceMnt: 450.5 }],
    }
    assert.equal(parseCatalog(fractional), null)
  })
})

describe('quote and money display', () => {
  it('parses the proposed quote and keeps the server total as is', () => {
    const quote = parseQuote({
      quote: {
        id: 'quo_demo_001',
        currency: 'MNT',
        lines: [
          { serviceId: 'svc_demo_basic', name: 'Гэрийн ердийн үзлэг', quantity: 1, unitPriceMnt: 45000, amountMnt: 45000 },
          { code: 'TRAVEL_FEE', name: 'Унааны зардал', amountMnt: 5000 },
          { code: 'DISCOUNT', name: 'Хөнгөлөлт (DEMO10)', amountMnt: -4500 },
        ],
        subtotalMnt: 45000,
        travelFeeMnt: 5000,
        discountMnt: 4500,
        totalMnt: 45500,
        pricingVersion: '2026-10-11.1',
        expiresAt: '2026-10-11T03:22:00.000Z',
      },
    })
    assert.equal(quote?.totalMnt, 45500)
    assert.equal(quote?.lines.length, 3)
  })

  it('formats MNT with thousands separators and the ₮ sign', () => {
    assert.equal(formatMnt(45000), '45,000₮')
    assert.equal(formatMnt(1234567), '1,234,567₮')
    assert.equal(formatMnt(-4500), '-4,500₮')
    assert.equal(formatMnt(0), '0₮')
  })
})
