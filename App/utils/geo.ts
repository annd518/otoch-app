// Pure helpers for the address map picker (unit tested in tests/geo.test.ts).
// The server accepts an order only when its point lies inside the chosen
// zone's bounds (server/src/services/orders.ts), so the picker checks the same.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ZoneBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// Sükhbaatar Square, Ulaanbaatar: where the map opens with no other hint
export const ULAANBAATAR: LatLng = { lat: 47.9189, lng: 106.9176 };
const CITY_DELTA = 0.12;
const STREET_DELTA = 0.01;

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Bounds from an API zone object, or null when they are missing/invalid. */
export function zoneBounds(zone: unknown): ZoneBounds | null {
  if (typeof zone !== "object" || zone === null) return null;
  const z = zone as Record<string, unknown>;
  if (!finite(z.minLat) || !finite(z.maxLat) || !finite(z.minLng) || !finite(z.maxLng))
    return null;
  if (z.minLat >= z.maxLat || z.minLng >= z.maxLng) return null;
  return { minLat: z.minLat, maxLat: z.maxLat, minLng: z.minLng, maxLng: z.maxLng };
}

/** Same rule as the server: inclusive bounds. */
export function isInside(b: ZoneBounds, p: LatLng): boolean {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
}

/** First zone (in list order) whose bounds contain the point. */
export function zoneContaining<T extends { id: string; bounds?: ZoneBounds | null }>(
  zones: T[],
  p: LatLng,
): T | null {
  return zones.find((z) => z.bounds && isInside(z.bounds, p)) ?? null;
}

/** 6 decimals ≈ 0.1 m: enough for a door, avoids float noise in the draft. */
export function roundPoint(p: LatLng): LatLng {
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return { lat: r(p.lat), lng: r(p.lng) };
}

/** Where the map opens: the chosen point, else the chosen zone, else the city. */
export function initialRegion(point: Partial<LatLng>, zone?: ZoneBounds | null): Region {
  if (finite(point.lat) && finite(point.lng))
    return { latitude: point.lat, longitude: point.lng, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA };
  if (zone)
    return {
      latitude: (zone.minLat + zone.maxLat) / 2,
      longitude: (zone.minLng + zone.maxLng) / 2,
      latitudeDelta: Math.max((zone.maxLat - zone.minLat) * 1.2, STREET_DELTA),
      longitudeDelta: Math.max((zone.maxLng - zone.minLng) * 1.2, STREET_DELTA),
    };
  return { latitude: ULAANBAATAR.lat, longitude: ULAANBAATAR.lng, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA };
}
