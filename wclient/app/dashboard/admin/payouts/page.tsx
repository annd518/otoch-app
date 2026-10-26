"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api/client";
import { useRoleProtection } from "@/lib/hooks/useRoleProtection";
import type { UserRole } from "@/lib/auth/session-core";
import { formatMnt, formatUb } from "@/lib/orderLabels";
import { allowed, useMyAdminAccess } from "@/lib/hooks/useAdminAccess";

// Paying nurses (spec slides 83, 98). API: server/src/routes/adminPayouts.ts.
// The admin transfers the money in the bank, then records it here; nothing is
// sent to a bank from this page.

const ROLES: UserRole[] = ["ADMIN"];

type Due = {
  nurseId: string;
  name: string;
  phone: string | null;
  bank: { bankName: string; accountNo: string; accountName: string } | null;
  bankChangedAt: string | null;
  visits: number;
  grossMnt: number;
  netMnt: number;
  from: string | null;
  to: string | null;
};
type Payout = {
  id: string;
  nurseName: string | null;
  totalMnt: number;
  visits: number;
  periodFrom: string;
  periodTo: string;
  reference: string;
  note: string | null;
  paidAt: string;
};

const errorMessage = (e: unknown, fallback: string) => {
  const v = e as { response?: { data?: { message?: string } } };
  return v.response?.data?.message || fallback;
};

export default function PayoutsPage() {
  useRoleProtection(ROLES);
  const canPay = allowed(useMyAdminAccess(), "money.manage");
  const [due, setDue] = useState<Due[] | null>(null);
  const [history, setHistory] = useState<Payout[]>([]);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<Due | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get("/admin/payouts/due"), api.get("/admin/payouts")])
      .then(([d, h]) => {
        if (!alive) return;
        setDue(d.data.data.nurses);
        setHistory(h.data.data.payouts);
        setError("");
      })
      .catch((e) => alive && setError(errorMessage(e, "Мэдээлэл ачаалж чадсангүй")));
    return () => {
      alive = false;
    };
  }, [version]);

  const totalDue = (due ?? []).reduce((s, d) => s + d.netMnt, 0);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#0F2A4A]">Сувилагчийн төлбөр</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-600">
        Дууссан эргэлт бүрээс сувилагчийн хувь энд хуримтлагдана. Банкаар шилжүүлсний дараа
        «Шилжүүлсэн гэж бүртгэх» дарна. Энэ хуудас банк руу мөнгө илгээдэггүй.
      </p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Шилжүүлэх</h2>
          {due && <p className="text-sm text-slate-600">Нийт: {formatMnt(totalDue)}</p>}
        </div>
        {!due ? (
          <p className="text-sm text-slate-500">Ачаалж байна…</p>
        ) : due.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-slate-600">
            Шилжүүлэх орлого алга.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {due.map((d) => (
              <li key={d.nurseId} className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{d.name}</p>
                    <p className="text-sm text-slate-600">
                      {d.visits} эргэлт · {formatUb(d.from)} – {formatUb(d.to)}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-[#0F2A4A]">{formatMnt(d.netMnt)}</p>
                </div>
                <p className="mt-2 break-words text-sm text-slate-700">
                  {d.bank ? (
                    <>
                      {d.bank.bankName} · {d.bank.accountNo} · {d.bank.accountName}
                    </>
                  ) : (
                    <span className="text-amber-800">Данс оруулаагүй: сувилагч аппаасаа оруулна</span>
                  )}
                </p>
                {d.bankChangedAt && (
                  <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    Данс {formatUb(d.bankChangedAt)}-д өөрчлөгдсөн. Шилжүүлэхээс өмнө сувилагчтай утсаар баталгаажуулна уу.
                  </p>
                )}
                {canPay && (
                <button
                  type="button"
                  disabled={!d.bank}
                  onClick={() => setPaying(d)}
                  className="mt-3 rounded-lg bg-[#0F2A4A] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Шилжүүлсэн гэж бүртгэх
                </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {paying && (
        <PayForm
          key={paying.nurseId}
          due={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            reload();
          }}
        />
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Шилжүүлгийн түүх</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">Одоогоор шилжүүлэг бүртгэгдээгүй.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Огноо</th>
                  <th className="px-3 py-2">Сувилагч</th>
                  <th className="px-3 py-2">Эргэлт</th>
                  <th className="px-3 py-2">Дүн</th>
                  <th className="px-3 py-2">Гүйлгээ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{formatUb(p.paidAt)}</td>
                    <td className="px-3 py-2">{p.nurseName ?? "—"}</td>
                    <td className="px-3 py-2">{p.visits}</td>
                    <td className="px-3 py-2 font-medium">{formatMnt(p.totalMnt)}</td>
                    <td className="px-3 py-2">
                      {p.reference}
                      {p.note ? ` · ${p.note}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void downloadReceipt(p.id, setError)}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs"
                      >
                        Баримт (PDF)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PayForm({ due, onClose, onDone }: { due: Due; onClose: () => void; onDone: () => void }) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`${due.name}-д ${formatMnt(due.netMnt)} шилжүүлсэн гэж бүртгэх үү?`)) return;
    setBusy(true);
    try {
      await api.post("/admin/payouts", {
        nurseId: due.nurseId,
        expectedNetMnt: due.netMnt,
        expectedVisits: due.visits,
        reference,
        ...(note.trim() && { note }),
      });
      toast.success("Шилжүүлэг бүртгэгдлээ");
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Бүртгэж чадсангүй"));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mb-8 max-w-xl space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h3 className="font-semibold text-gray-900">
        {due.name} · {formatMnt(due.netMnt)} · {due.visits} эргэлт
      </h3>
      <p className="text-sm text-slate-700">
        Эхлээд банкаар {due.bank?.bankName} {due.bank?.accountNo} ({due.bank?.accountName}) руу шилжүүлнэ.
      </p>
      <label className="block text-sm">
        <span className="text-slate-700">Гүйлгээний дугаар эсвэл утга</span>
        <input
          required
          minLength={3}
          maxLength={100}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Тэмдэглэл (заавал биш)</span>
        <input
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || reference.trim().length < 3}
          className="rounded-lg bg-[#0F2A4A] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          Бүртгэх
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
          Болих
        </button>
      </div>
    </form>
  );
}

/** The payout's PDF receipt (GET /api/admin/payouts/:id/receipt.pdf). */
async function downloadReceipt(id: string, onError: (m: string) => void) {
  try {
    const r = await api.get(`/admin/payouts/${encodeURIComponent(id)}/receipt.pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otoch-payout-${id.slice(-8).toUpperCase()}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    onError("Баримтыг татаж чадсангүй");
  }
}
