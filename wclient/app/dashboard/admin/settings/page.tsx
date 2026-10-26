"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api/client";
import { useRoleProtection } from "@/lib/hooks/useRoleProtection";
import type { UserRole } from "@/lib/auth/session-core";
import { formatUb } from "@/lib/orderLabels";
import { allowed, useMyAdminAccess } from "@/lib/hooks/useAdminAccess";

// Business settings (spec slide 103). API: server/src/routes/adminSettings.ts.

const ROLES: UserRole[] = ["ADMIN"];

type Setting = {
  key: string;
  label: string;
  hint: string;
  unit: string;
  value: number;
  default: number;
  min: number;
  max: number;
  updatedAt: string | null;
};
type AuditRow = { entityId: string; actor: string | null; before: { value?: number } | null; after: { value?: number } | null; at: string };

const errorMessage = (e: unknown, fallback: string) => {
  const v = e as { response?: { data?: { message?: string; error?: { fields?: Record<string, string> } } } };
  const fields = v.response?.data?.error?.fields;
  return fields ? Object.values(fields).join(". ") : v.response?.data?.message || fallback;
};

export default function SettingsPage() {
  useRoleProtection(ROLES);
  const canEdit = allowed(useMyAdminAccess(), "catalog.manage");
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get("/admin/settings")
      .then((r) => {
        if (!alive) return;
        const rows: Setting[] = r.data.data.settings;
        setSettings(rows);
        setAudit(r.data.data.audit);
        setDraft(Object.fromEntries(rows.map((s) => [s.key, String(s.value)])));
        setError("");
      })
      .catch((e) => alive && setError(errorMessage(e, "Тохиргоо ачаалж чадсангүй")));
    return () => {
      alive = false;
    };
  }, [version]);

  const label = (key: string) => settings?.find((s) => s.key === key)?.label ?? key;
  const changed = (settings ?? []).filter((s) => draft[s.key] !== undefined && Number(draft[s.key]) !== s.value);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changed.length === 0) return;
    const summary = changed.map((s) => `${s.label}: ${s.value} → ${draft[s.key]} ${s.unit}`).join("\n");
    if (!window.confirm(`Дараах тохиргоог өөрчлөх үү?\n\n${summary}`)) return;
    setBusy(true);
    try {
      await api.put("/admin/settings", {
        values: Object.fromEntries(changed.map((s) => [s.key, Number(draft[s.key])])),
      });
      toast.success("Тохиргоо хадгалагдлаа");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err, "Хадгалж чадсангүй"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#0F2A4A]">Тохиргоо</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-600">
        Шимтгэл, цуцлалт, дуудлага хуваарилалтын дүрэм. Өөрчлөлт 15 секундын дотор бүх серверт хүчинтэй
        болно. Аль хэдийн бичигдсэн орлого, буцаалтад нөлөөлөхгүй. Цуцлалтын хураамжийг хуульчаар
        батлуулсны дараа өөрчилнө үү.
      </p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!settings ? (
        <p className="text-sm text-slate-500">Ачаалж байна…</p>
      ) : (
        <form onSubmit={save} className="max-w-3xl space-y-3">
          {settings.map((s) => {
            const v = draft[s.key] ?? "";
            const n = Number(v);
            const invalid = v === "" || !Number.isInteger(n) || n < s.min || n > s.max;
            return (
              <div key={s.key} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor={s.key} className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-900">{s.label}</span>
                    <span className="block text-sm text-slate-600">{s.hint}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={s.key}
                      type="number"
                      inputMode="numeric"
                      min={s.min}
                      max={s.max}
                      step={1}
                      disabled={!canEdit}
                      value={v}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                      className={`w-24 rounded-lg border px-3 py-2 text-right ${invalid ? "border-red-500" : "border-gray-300"}`}
                    />
                    <span className="w-16 text-sm text-slate-600">{s.unit}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Анхны утга: {s.default} {s.unit} · {s.min}–{s.max}
                  {s.updatedAt ? ` · Сүүлд өөрчилсөн: ${formatUb(s.updatedAt)}` : ""}
                </p>
              </div>
            );
          })}
          {canEdit && (
          <button
            type="submit"
            disabled={busy || changed.length === 0 || changed.some((s) => {
              const n = Number(draft[s.key]);
              return !Number.isInteger(n) || n < s.min || n > s.max;
            })}
            className="rounded-lg bg-[#0F2A4A] px-5 py-2.5 font-semibold text-white disabled:bg-slate-300"
          >
            {changed.length > 0 ? `${changed.length} өөрчлөлт хадгалах` : "Өөрчлөлт алга"}
          </button>
          )}
        </form>
      )}

      {audit.length > 0 && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Өөрчлөлтийн түүх</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {audit.map((a, i) => (
              <li key={i}>
                {formatUb(a.at)} · {label(a.entityId)}: {a.before?.value ?? "—"} → {a.after?.value ?? "—"}
                {a.actor ? ` · ${a.actor}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
