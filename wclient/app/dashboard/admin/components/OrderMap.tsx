"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

// A small dependency-free map: OpenStreetMap tiles placed around a centre, with
// one pin per order. Enough for "where are today's calls"; not a routing map.

export type MapPin = { id: string; lat: number; lng: number; tone: "red" | "teal" | "navy"; label: string };

const TILE = 256;
const UB = { lat: 47.918, lng: 106.917 }; // Ulaanbaatar centre
const MIN_ZOOM = 10;
const MAX_ZOOM = 15;
const RADIUS = 2; // tiles around the centre tile (5 x 5)

/** Web Mercator world pixel at zoom z. */
export function project(lat: number, lng: number, z: number) {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

const TONE = { red: "#C0392B", teal: "#0F8A7E", navy: "#0F2A4A" };

function Pin({ color }: { color: string }) {
  return (
    <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden>
      <path d="M15 1C7.3 1 1 7.1 1 14.7 1 25 15 37 15 37s14-12 14-22.3C29 7.1 22.7 1 15 1z" fill="white" stroke={color} strokeWidth="2.5" />
      <circle cx="15" cy="14.5" r="5" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

export function OrderMap({ pins, onSelect }: { pins: MapPin[]; onSelect?: (id: string) => void }) {
  const [zoom, setZoom] = useState(12);
  const center = useMemo(() => {
    if (pins.length === 0) return UB;
    return {
      lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length,
      lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length,
    };
  }, [pins]);

  const c = project(center.lat, center.lng, zoom);
  const tx = Math.floor(c.x / TILE);
  const ty = Math.floor(c.y / TILE);
  const max = 2 ** zoom;
  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let dx = -RADIUS; dx <= RADIUS; dx++)
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      const x = tx + dx;
      const y = ty + dy;
      if (y < 0 || y >= max) continue;
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${((x % max) + max) % max}/${y}.png`,
        left: x * TILE - c.x,
        top: y * TILE - c.y,
      });
    }

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl bg-[#E8EDF2]">
      <div className="absolute left-1/2 top-1/2">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- map tiles
          <img
            key={t.key}
            src={t.src}
            alt=""
            width={TILE}
            height={TILE}
            draggable={false}
            className="absolute max-w-none select-none opacity-90 grayscale-[35%]"
            style={{ left: t.left, top: t.top }}
          />
        ))}
        {pins.map((p) => {
          const pt = project(p.lat, p.lng, zoom);
          return (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => onSelect?.(p.id)}
              className="absolute -translate-x-1/2 -translate-y-full drop-shadow"
              style={{ left: pt.x - c.x, top: pt.y - c.y }}
            >
              <Pin color={TONE[p.tone]} />
            </button>
          );
        })}
      </div>

      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <button
          type="button"
          aria-label="Ойртуулах"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          className="p-1.5 hover:bg-slate-50 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Холдуулах"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          className="border-t border-slate-300 p-1.5 hover:bg-slate-50 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-white/95 to-white/0 px-3 pb-2 pt-6 text-xs text-slate-600">
        <span>
          <span className="font-semibold text-[#C0392B]">●</span> томилогдоогүй{" "}
          <span className="ml-2 font-semibold text-[#0F8A7E]">●</span> сувилагчтай
          {pins.length === 0 ? " · байршилтай захиалга алга" : ""}
        </span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-slate-500 hover:underline"
        >
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}
