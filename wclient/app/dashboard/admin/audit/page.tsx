"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api/client";
import { useRoleProtection } from "@/lib/hooks/useRoleProtection";
import type { UserRole } from "@/lib/auth/session-core";
import { formatUb } from "@/lib/orderLabels";

// Audit log (spec A-11, slide 109). API: server/src/routes/adminAudit.ts.

const ROLES: UserRole[] = ["ADMIN"];

type Entry = {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  actionLabel: string;
  entity: string;
  entityLabel: string;
  entityId: string;
  before: unknown;
  after: unknown;
};

const errorMessage = (e: unknown, fallback: string) => {
  const v = e as { response?: { data?: { message?: string } } };
  return v.response?.data?.message || fallback;
};

/** {"status":"PAID"} → status: PAID */
function values(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object") return String(v);
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(", ") : x === null ? "—" : String(x)}`)
    .join(" · ");
}

export default function AuditPage() {
  useRoleProtection(ROLES);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [entities, setEntities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);

  const params = (cursor?: string) => {
    const p = new URLSearchParams();
    if (entity) p.set("entity", entity);
    if (action) p.set("action", action);
    if (query.trim().length >= 3) p.set("entityId", query.trim());
    if (cursor) p.set("cursor", cursor);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  useEffect(() => {
    let alive = true;
    api
      .get(`/admin/audit${params()}`)
      .then((r) => {
        if (!alive) return;
        setEntries(r.data.data.entries);
        setNext(r.data.data.nextCursor);
        setActions(r.data.data.actions);
        setEntities(r.data.data.entities);
        setError("");
      })
      .catch((e) => alive && setError(errorMessage(e, "Аудит лог ачаалж чадсангүй")));
    return () => {
      alive = false;
    };
    // params() reads exactly these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, action, query]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const r = await api.get(`/admin/audit${params(next)}`);
      setEntries((cur) => [...(cur ?? []), ...r.data.data.entries]);
      setNext(r.data.data.nextCursor);
    } catch (e) {
      setError(errorMessage(e, "Ачаалж чадсангүй"));
    } finally {
      setMore(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#0F2A4A]">Аудит лог</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-600">
        Админ талын үйлдэл бүр энд бичигдэнэ: хэн, хэзээ, юуг, өмнө нь ямар байсныг, дараа нь ямар
        болсныг. Сувилагчийн баримт үзсэн бүрийг мөн бичнэ. Бичлэгийг засах, устгах боломжгүй.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
        className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="Төрөл">
          <option value="">Бүх төрөл</option>
          {Object.entries(entities).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="Үйлдэл">
          <option value="">Бүх үйлдэл</option>
          {Object.entries(actions).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Бичлэгийн ID (3+ тэмдэгт)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-[#0F2A4A] px-4 py-2 text-sm font-semibold text-white">
          Хайх
        </button>
      </form>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!entries ? (
        <p className="text-sm text-slate-500">Ачаалж байна…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-slate-600">Бичлэг алга.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Огноо</th>
                <th className="px-3 py-2">Хэн</th>
                <th className="px-3 py-2">Үйлдэл</th>
                <th className="px-3 py-2">Бичлэг</th>
                <th className="px-3 py-2">Өмнө</th>
                <th className="px-3 py-2">Дараа</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatUb(e.at)}</td>
                  <td className="px-3 py-2">{e.actor ?? "—"}</td>
                  <td className="px-3 py-2">{e.actionLabel}</td>
                  <td className="px-3 py-2">
                    {e.entityLabel}
                    <span className="block break-all font-mono text-xs text-slate-500">{e.entityId}</span>
                  </td>
                  <td className="max-w-[220px] break-words px-3 py-2 text-xs text-slate-600">{values(e.before)}</td>
                  <td className="max-w-[260px] break-words px-3 py-2 text-xs text-slate-800">{values(e.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {next && (
        <button
          type="button"
          disabled={more}
          onClick={() => void loadMore()}
          className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-50"
        >
          Цааш харах
        </button>
      )}
    </div>
  );
}
