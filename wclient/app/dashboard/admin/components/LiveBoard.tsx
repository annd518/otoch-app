"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import api from "@/lib/api/client";
import { OrderMap, type MapPin } from "./OrderMap";

// GET /api/admin/board (server/src/routes/admin.ts): active orders and KPIs.
type Stage = "DISPATCHING" | "ASSIGNED" | "EN_ROUTE" | "IN_PROGRESS" | "INCIDENT";
type BoardOrder = {
  id: string;
  stage: Stage;
  status: string;
  scheduledFor: string | null;
  timeSlot: string | null;
  service: string | null;
  patientName: string;
  nurse: string | null;
  waitingMinutes: number | null;
  overdue: boolean;
  isMock: boolean;
  location: { lat: number; lng: number } | null;
};
type Board = {
  generatedAt: string;
  kpis: {
    active: number;
    unassignedOverdue: number;
    completedToday: number;
    avgAssignMinutes: number | null;
    assignedToday: number;
    nursesOnline: number;
  };
  orders: BoardOrder[];
};

const STAGES: { stage: Stage; label: string; chip: string; text: string }[] = [
  { stage: "DISPATCHING", label: "Сувилагч хайж байна", chip: "bg-[#FBEBC8] text-[#9A5B00]", text: "text-[#B7650B]" },
  { stage: "ASSIGNED", label: "Хүлээн авсан", chip: "bg-[#D4EFEA] text-[#0F766E]", text: "text-[#0F766E]" },
  { stage: "EN_ROUTE", label: "Замдаа", chip: "bg-[#D4EFEA] text-[#0F766E]", text: "text-[#0F766E]" },
  { stage: "IN_PROGRESS", label: "Үйлчилж байна", chip: "bg-[#D4EFEA] text-[#0F766E]", text: "text-[#0F766E]" },
  { stage: "INCIDENT", label: "Осол, зөрчил", chip: "bg-[#FBDADA] text-[#B91C1C]", text: "text-[#B91C1C]" },
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.stage, s])) as Record<Stage, (typeof STAGES)[number]>;

const REFRESH_MS = 30_000;
const shortNo = (id: string) => id.slice(-6).toUpperCase();
const ubTime = (v: string | null) =>
  v
    ? new Date(v).toLocaleTimeString("mn-MN", {
        timeZone: "Asia/Ulaanbaatar",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
const ubDay = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }) : null;

function Kpi({ value, label, alert }: { value: string | number; label: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#F5F1EA] p-4 sm:p-5">
      <p className={`text-2xl font-bold sm:text-3xl ${alert ? "text-[#B91C1C]" : "text-[#0F2A4A]"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-600 sm:text-sm">{label}</p>
    </div>
  );
}

export function LiveBoard() {
  const router = useRouter();
  const [data, setData] = useState<Board | null>(null);
  const [filter, setFilter] = useState<Stage | "ALL">("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/board");
      setData(r.data.data);
      setError("");
    } catch (e) {
      const v = e as { response?: { status?: number } };
      setError(
        v.response?.status === 403
          ? "Супер админ эрх шаардлагатай"
          : "Самбарыг ачаалж чадсангүй. Холболтоо шалгана уу.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const counts = useMemo(() => {
    const m: Partial<Record<Stage, number>> = {};
    for (const o of data?.orders ?? []) m[o.stage] = (m[o.stage] ?? 0) + 1;
    return m;
  }, [data]);
  const rows = useMemo(
    () => (data?.orders ?? []).filter((o) => filter === "ALL" || o.stage === filter),
    [data, filter],
  );
  const pins: MapPin[] = useMemo(
    () =>
      rows.flatMap((o) =>
        o.location
          ? [
              {
                id: o.id,
                lat: o.location.lat,
                lng: o.location.lng,
                tone: o.stage === "DISPATCHING" || o.stage === "INCIDENT" ? ("red" as const) : ("teal" as const),
                label: `№${shortNo(o.id)} · ${o.service ?? ""} · ${STAGE[o.stage].label}`,
              },
            ]
          : [],
      ),
    [rows],
  );
  const today = ubDay(data?.generatedAt ?? null);
  const openOrder = (id: string) => router.push(`/dashboard/orders?order=${encodeURIComponent(id)}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0F2A4A] sm:text-2xl">Захиалгын самбар — бодит цаг</h1>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {data ? `${ubTime(data.generatedAt)} · 30 сек тутам` : "Шинэчлэх"}
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 [&>*]:min-w-0">
        <Kpi value={data?.kpis.active ?? "—"} label="Идэвхтэй" />
        <Kpi
          value={data?.kpis.unassignedOverdue ?? "—"}
          label="Томилогдоогүй 5 мин+"
          alert={!!data && data.kpis.unassignedOverdue > 0}
        />
        <Kpi value={data?.kpis.completedToday ?? "—"} label="Өнөөдөр дууссан" />
        <Kpi
          value={data?.kpis.avgAssignMinutes != null ? `${data.kpis.avgAssignMinutes} мин` : "—"}
          label={`Дундаж томилолт${data ? ` (өнөөдөр ${data.kpis.assignedToday})` : ""}`}
        />
        <Kpi value={data?.kpis.nursesOnline ?? "—"} label="Сувилагч онлайн" />
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter("ALL")}
          className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold ${
            filter === "ALL" ? "bg-[#0F4C8A] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          Бүгд · {data?.orders.length ?? 0}
        </button>
        {STAGES.map((s) => (
          <button
            key={s.stage}
            onClick={() => setFilter(s.stage)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${s.chip} ${
              filter === s.stage ? "ring-2 ring-[#0F2A4A]" : ""
            }`}
          >
            {s.label} · {counts[s.stage] ?? 0}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#EEF2F6] text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">№</th>
                <th className="px-4 py-3 font-semibold">Цаг</th>
                <th className="px-4 py-3 font-semibold">Үйлчилгээ</th>
                <th className="px-4 py-3 font-semibold">Үйлчлүүлэгч</th>
                <th className="px-4 py-3 font-semibold">Сувилагч</th>
                <th className="px-4 py-3 font-semibold">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {data ? "Энэ төлөвт идэвхтэй захиалга алга" : "Ачаалж байна…"}
                  </td>
                </tr>
              )}
              {rows.map((o, i) => {
                const s = STAGE[o.stage];
                const day = ubDay(o.scheduledFor);
                return (
                  <tr
                    key={o.id}
                    onClick={() => openOrder(o.id)}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-[#EAF1F8] ${
                      i % 2 === 0 ? "bg-[#F7F3EC]" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {shortNo(o.id)}
                      {o.isMock && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">mock</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ubTime(o.scheduledFor)}
                      {day && day !== today && <span className="block text-[11px] text-slate-500">{day}</span>}
                    </td>
                    <td className="px-4 py-3">{o.service ?? "—"}</td>
                    <td className="px-4 py-3">{o.patientName}</td>
                    <td className="px-4 py-3">{o.nurse ?? "—"}</td>
                    <td className={`px-4 py-3 text-xs font-bold ${o.overdue ? "text-[#B91C1C]" : s.text}`}>
                      {s.label}
                      {o.waitingMinutes !== null && ` ${o.waitingMinutes}м`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <OrderMap pins={pins} onSelect={openOrder} />
      </section>

      <p className="rounded-2xl bg-[#FBF0D5] px-4 py-3 text-sm text-[#6B5418]">
        Мөр эсвэл газрын зураг дээрх цэг дээр дарахад захиалгын дэлгэрэнгүй нээгдэнэ: явц (timeline),
        сувилагч томилох, ирэх цаг. Цуцлах, буцаалт, И-баримт, аудит хараахан нэмэгдээгүй.
      </p>
    </div>
  );
}
