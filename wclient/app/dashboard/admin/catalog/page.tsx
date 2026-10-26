"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api/client";
import { useRoleProtection } from "@/lib/hooks/useRoleProtection";
import type { UserRole } from "@/lib/auth/session-core";
import { formatMnt, formatUb } from "@/lib/orderLabels";
import { allowed, useMyAdminAccess } from "@/lib/hooks/useAdminAccess";

// Catalog prices (spec A-08). API: server/src/routes/adminSettings.ts.
// Names and clinical content come from the approved content import, not here.

const ROLES: UserRole[] = ["ADMIN"];

type Service = {
  id: string;
  code: string;
  name: string;
  category: string;
  priceMnt: number;
  durationMin: number;
  isActive: boolean;
  isFixture: boolean;
  approved: boolean;
  sortOrder: number;
  updatedAt: string;
};
type Change = { priceMnt?: number; isActive?: boolean; sortOrder?: number };
type AuditRow = { entityId: string; actor: string | null; before: Change | null; after: Change | null; at: string };

const errorMessage = (e: unknown, fallback: string) => {
  const v = e as { response?: { data?: { message?: string } } };
  return v.response?.data?.message || fallback;
};

function describe(a: AuditRow): string {
  const parts: string[] = [];
  if (a.before?.priceMnt !== a.after?.priceMnt)
    parts.push(`үнэ ${formatMnt(a.before?.priceMnt ?? 0)} → ${formatMnt(a.after?.priceMnt ?? 0)}`);
  if (a.before?.isActive !== a.after?.isActive) parts.push(a.after?.isActive ? "идэвхжүүлсэн" : "идэвхгүй болгосон");
  if (a.before?.sortOrder !== a.after?.sortOrder) parts.push(`дараалал ${a.before?.sortOrder} → ${a.after?.sortOrder}`);
  return parts.join(", ") || "өөрчлөлтгүй";
}

export default function CatalogPage() {
  useRoleProtection(ROLES);
  const canEdit = allowed(useMyAdminAccess(), "catalog.manage");
  const [services, setServices] = useState<Service[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get("/admin/catalog")
      .then((r) => {
        if (!alive) return;
        const rows: Service[] = r.data.data.services;
        setServices(rows);
        setAudit(r.data.data.audit);
        setPrices(Object.fromEntries(rows.map((s) => [s.id, String(s.priceMnt)])));
        setError("");
      })
      .catch((e) => alive && setError(errorMessage(e, "Каталог ачаалж чадсангүй")));
    return () => {
      alive = false;
    };
  }, [version]);

  const update = async (s: Service, change: Change, question: string) => {
    if (!window.confirm(question)) return;
    setBusyId(s.id);
    try {
      await api.patch(`/admin/catalog/${s.id}`, { ...change, updatedAt: s.updatedAt });
      toast.success("Хадгалагдлаа");
    } catch (e) {
      setError(errorMessage(e, "Хадгалж чадсангүй"));
    } finally {
      setBusyId(null);
      setVersion((v) => v + 1);
    }
  };

  const name = (code: string) => services?.find((s) => s.code === code)?.name ?? code;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#0F2A4A]">Каталог, үнэ</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-600">
        Үнэ болон үйлчилгээг идэвхжүүлэх, түр хаахыг эндээс хийнэ. Шинэ үнэ дараагийн үнийн саналаас
        эхэлж хүчинтэй. Төлөгдсөн захиалгын үнэ өөрчлөгдөхгүй. Үйлчилгээний нэр, эмнэлзүйн агуулгыг
        баталгаажсан агуулгын импортоор өөрчилнө.
      </p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!services ? (
        <p className="text-sm text-slate-500">Ачаалж байна…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Код</th>
                <th className="px-3 py-2">Үйлчилгээ</th>
                <th className="px-3 py-2">Үнэ (₮)</th>
                <th className="px-3 py-2">Төлөв</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const p = prices[s.id] ?? "";
                const n = Number(p);
                const priceChanged = p !== "" && Number.isInteger(n) && n >= 0 && n !== s.priceMnt;
                return (
                  <tr key={s.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.durationMin} мин
                        {s.isFixture ? " · туршилтын өгөгдөл (production-д ашиглагдахгүй)" : s.approved ? " · батлагдсан агуулга" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={500}
                          value={p}
                          aria-label={`${s.name} үнэ`}
                          disabled={!canEdit}
                          onChange={(e) => setPrices((x) => ({ ...x, [s.id]: e.target.value }))}
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-right"
                        />
                        {canEdit && priceChanged && (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              void update(s, { priceMnt: n }, `${s.name}: ${formatMnt(s.priceMnt)} → ${formatMnt(n)} болгох уу?`)
                            }
                            className="rounded-lg bg-[#0F2A4A] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300"
                          >
                            Хадгалах
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${s.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {s.isActive ? "Идэвхтэй" : "Хаалттай"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canEdit && (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() =>
                          void update(
                            s,
                            { isActive: !s.isActive },
                            s.isActive
                              ? `${s.name}-г түр хаах уу? Шинэ захиалга авахгүй болно.`
                              : `${s.name}-г идэвхжүүлэх үү? Үйлчлүүлэгчид харагдана.`,
                          )
                        }
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                      >
                        {s.isActive ? "Түр хаах" : "Идэвхжүүлэх"}
                      </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Zones canEdit={canEdit} />

      {audit.length > 0 && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Өөрчлөлтийн түүх</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {audit.map((a, i) => (
              <li key={i}>
                {formatUb(a.at)} · {name(a.entityId)}: {describe(a)}
                {a.actor ? ` · ${a.actor}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Zone = { id: string; name: string; isActive: boolean; feeTier: number; feeMnt: number };

/** Travel fee tier per zone (spec slide 103 zone_fees); the amounts are in Тохиргоо. */
function Zones({ canEdit }: { canEdit: boolean }) {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    api
      .get("/admin/zones")
      .then((r) => {
        if (!alive) return;
        setZones(r.data.data.zones);
        setFees(r.data.data.fees);
      })
      .catch((e) => alive && setError(errorMessage(e, "Бүсүүдийг ачаалж чадсангүй")));
    return () => {
      alive = false;
    };
  }, [version]);
  const setTier = async (z: Zone, feeTier: number) => {
    if (!window.confirm(`${z.name}: ${feeTier}-р ангилал (${formatMnt(fees[feeTier] ?? 0)}) болгох уу?`)) return;
    try {
      await api.patch(`/admin/zones/${encodeURIComponent(z.id)}`, { feeTier });
      toast.success("Хадгалагдлаа");
    } catch (e) {
      setError(errorMessage(e, "Хадгалж чадсангүй"));
    } finally {
      setVersion((v) => v + 1);
    }
  };
  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Бүс, унааны зардал</h2>
      <p className="mb-3 text-sm text-slate-600">
        Бүс бүр 1–3 ангилалтай. Ангилал бүрийн дүнг «Тохиргоо» хуудаснаас өөрчилнө. 0₮ үед үнийн
        саналд унааны зардал нэмэгдэхгүй.
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!zones ? (
        <p className="text-sm text-slate-500">Ачаалж байна…</p>
      ) : zones.length === 0 ? (
        <p className="text-sm text-slate-600">Бүс бүртгэгдээгүй байна.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {zones.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{z.name}</span>
                {!z.isActive && <span className="ml-2 text-xs text-slate-500">(идэвхгүй)</span>}
              </span>
              <span className="flex items-center gap-2">
                <select
                  aria-label={`${z.name} ангилал`}
                  disabled={!canEdit}
                  value={z.feeTier}
                  onChange={(e) => void setTier(z, Number(e.target.value))}
                  className="rounded-md border border-gray-300 px-2 py-1"
                >
                  {[1, 2, 3].map((t) => (
                    <option key={t} value={t}>
                      {t}-р ангилал · {formatMnt(fees[t] ?? 0)}
                    </option>
                  ))}
                </select>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
