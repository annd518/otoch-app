import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ULAANBAATAR, initialRegion, isInside, roundPoint, zoneBounds, zoneContaining } from '../utils/geo'

const bounds = { minLat: 47.85, maxLat: 47.95, minLng: 106.8, maxLng: 107.0 }

describe('address map picker geometry', () => {
  it('reads zone bounds from the API object and rejects missing/invalid ones', () => {
    assert.deepEqual(zoneBounds({ id: 'Z', name: 'A', ...bounds }), bounds)
    assert.equal(zoneBounds({ id: 'Z', name: 'A' }), null)
    assert.equal(zoneBounds({ ...bounds, minLat: 'x' }), null)
    assert.equal(zoneBounds({ ...bounds, minLat: 48 }), null) // min >= max
    assert.equal(zoneBounds(null), null)
  })

  it('inside check matches the server rule (inclusive edges)', () => {
    assert.equal(isInside(bounds, { lat: 47.9, lng: 106.9 }), true)
    assert.equal(isInside(bounds, { lat: 47.85, lng: 107.0 }), true)
    assert.equal(isInside(bounds, { lat: 47.96, lng: 106.9 }), false)
    assert.equal(isInside(bounds, { lat: 47.9, lng: 107.01 }), false)
  })

  it('finds the zone that contains a point; zones without bounds are skipped', () => {
    const zones = [
      { id: 'NO_BOUNDS', bounds: null },
      { id: 'EAST', bounds: { minLat: 47.85, maxLat: 47.95, minLng: 106.95, maxLng: 107.1 } },
      { id: 'WEST', bounds: { minLat: 47.85, maxLat: 47.95, minLng: 106.7, maxLng: 106.95 } },
    ]
    assert.equal(zoneContaining(zones, { lat: 47.9, lng: 106.8 })?.id, 'WEST')
    assert.equal(zoneContaining(zones, { lat: 47.9, lng: 107.0 })?.id, 'EAST')
    assert.equal(zoneContaining(zones, { lat: 48.5, lng: 106.9 }), null)
  })

  it('rounds to 6 decimals', () => {
    assert.deepEqual(roundPoint({ lat: 47.918912345, lng: 106.917649999 }), { lat: 47.918912, lng: 106.91765 })
  })

  it('opens on the chosen point, else the zone, else Ulaanbaatar', () => {
    const p = initialRegion({ lat: 47.91, lng: 106.92 }, bounds)
    assert.equal(p.latitude, 47.91)
    assert.ok(p.latitudeDelta < 0.05)
    const z = initialRegion({}, bounds)
    assert.ok(Math.abs(z.latitude - 47.9) < 1e-9 && Math.abs(z.longitude - 106.9) < 1e-9)
    assert.ok(z.latitudeDelta >= 0.1)
    const c = initialRegion({ lat: undefined, lng: 106.9 })
    assert.equal(c.latitude, ULAANBAATAR.lat)
  })
})
