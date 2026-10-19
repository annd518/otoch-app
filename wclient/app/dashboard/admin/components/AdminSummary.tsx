"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api/client";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
  formatMnt,
  formatUb,
} from "@/lib/orderLabels";

// GET /api/admin/summary (server/src/routes/admin.ts)
type Money = {
  amountMnt: number;
  count: number;
  mockAmountMnt: number;
  mockCount: number;
};
type Attention =
  | {
      kind: "UNASSIGNED";
      orderId: string;
      patientName: string;
      service: string | null;
      at: string | null;
      urgent: boolean;
    }
  | {
      kind: "RECONCILIATION";
      orderId: string;
      code: string;
      amountMnt: number;
      isMock: boolean;
      at: string;
      urgent: boolean;
    };
export type Summary = {
  generatedAt: string;
  orders: {
    byStatus: Record<string, number>;
    today: number;
    unassignedPaid: number;
  };
  payments: {
    today: Money;
    month: Money;
    pending: number;
    needsReconciliation: number;
  };
  users: {
    customers: number;
    nurses: number;
    medicalAdmins: number;
    admins: number;
    deactivatedStaff: number;
    patients: number;
  };
  attention: Attention[];
  recentOrders: {
    id: string;
    status: string;
    patientName: string;
    service: string | null;
    nurse: string | null;
    scheduledFor: string | null;
    updatedAt: string;
  }[];
};

const RECONCILIATION_LABELS: Record<string, string> = {
  NEEDS_RECONCILIATION: "QPay-тэй тулгах шаардлагатай",
  PAID_AFTER_EXPIRY: "Хугацаа дууссаны дараа төлөгдсөн",
};

const REFRESH_MS = 60_000;

function Stat({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string | number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        alert ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-sm text-gray-600">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          alert ? "text-red-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function MoneyCard({ label, money }: { label: string; money: Money }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">
        {formatMnt(money.amountMnt)}
      </p>
      <p className="mt-1 text-xs text-gray-500">{money.count} төлбөр</p>
      {money.mockCount > 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Туршилтын (mock) төлбөр: {formatMnt(money.mockAmountMnt)} (
          {money.mockCount}), орлогод тооцоогүй
        </p>
      )}
    </div>
  );
}

export function AdminSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/summary");
      if (!r.data.success) throw new Error(r.data.message);
      setData(r.data.data);
      setError("");
    } catch (e) {
      const v = e as { response?: { status?: number } };
      setError(
        v.response?.status === 403
          ? "Энэ самбарыг зөвхөн админ болон эмнэлгийн админ үзнэ."
          : "Самбарыг ачаалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!data)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        {error ? (
          <p className="text-red-700">{error}</p>
        ) : (
          <p className="text-gray-600">Самбарыг ачаалж байна…</p>
        )}
      </div>
    );

  const { orders, payments, users } = data;
  const statusRows = ORDER_STATUS_ORDER.filter(
    (s) => (orders.byStatus[s] ?? 0) > 0,
  );
  const statusTotal = statusRows.reduce(
    (sum, s) => sum + (orders.byStatus[s] ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Шинэчилсэн: {formatUb(data.generatedAt)} · минут тутам автоматаар
        </p>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Ачаалж байна…" : "Шинэчлэх"}
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Өнөөдрийн үзлэг"
          value={orders.today}
          hint="Өнөөдөр товлогдсон, төлөгдсөн захиалга"
        />
        <Stat
          label="Сувилагч томилоогүй"
          value={orders.unassignedPaid}
          hint="Төлбөр төлөгдсөн, сувилагчгүй"
          alert={orders.unassignedPaid > 0}
        />
        <Stat
          label="Төлбөр хүлээгдэж буй"
          value={payments.pending}
          hint="Хугацаа нь дуусаагүй нэхэмжлэх"
        />
        <Stat
          label="Төлбөр тулгах"
          value={payments.needsReconciliation}
          hint="QPay-тэй гараар шалгах"
          alert={payments.needsReconciliation > 0}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MoneyCard label="Өнөөдрийн орлого" money={payments.today} />
        <MoneyCard label="Энэ сарын орлого" money={payments.month} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Анхаарах захиалга
          </h3>
          <Link
            href="/dashboard/orders"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Бүх захиалга →
          </Link>
        </div>
        {data.attention.length === 0 ? (
          <p className="text-sm text-gray-600">Одоогоор анхаарах зүйл алга.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.attention.map((a) => (
              <li
                key={`${a.kind}-${a.orderId}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {a.kind === "UNASSIGNED"
                      ? `Сувилагч томилоогүй · ${a.patientName}`
                      : RECONCILIATION_LABELS[a.code] ?? a.code}
                  </p>
                  <p className="text-sm text-gray-600">
                    {a.kind === "UNASSIGNED"
                      ? `${a.service ?? "Үйлчилгээ"} · ${formatUb(a.at)}`
                      : `${formatMnt(a.amountMnt)}${a.isMock ? " · туршилтын (mock)" : ""} · ${formatUb(a.at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.kind === "UNASSIGNED" && a.urgent && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      24 цагийн дотор
                    </span>
                  )}
                  <Link
                    href={`/dashboard/orders?order=${encodeURIComponent(a.orderId)}`}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Нээх
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            Захиалга төлөвөөр
          </h3>
          {statusRows.length === 0 ? (
            <p className="text-sm text-gray-600">Захиалга алга.</p>
          ) : (
            <ul className="space-y-2">
              {statusRows.map((s) => {
                const n = orders.byStatus[s] ?? 0;
                return (
                  <li key={s}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {ORDER_STATUS_LABELS[s] ?? s}
                      </span>
                      <span className="font-medium text-gray-900">{n}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{
                          width: `${Math.max(2, (n / statusTotal) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            Хэрэглэгчид
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["Захиалагч", users.customers],
                ["Өвчтөн", users.patients],
                ["Сувилагч", users.nurses],
                ["Эмнэлгийн админ", users.medicalAdmins],
                ["Админ", users.admins],
                ["Идэвхгүй ажилтан", users.deactivatedStaff],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{k}</dt>
                <dd className="text-xl font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">
          Сүүлийн захиалгууд
        </h3>
        {data.recentOrders.length === 0 ? (
          <p className="text-sm text-gray-600">Захиалга алга.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Өвчтөн</th>
                  <th className="py-2 pr-4 font-medium">Үйлчилгээ</th>
                  <th className="py-2 pr-4 font-medium">Цаг</th>
                  <th className="py-2 pr-4 font-medium">Сувилагч</th>
                  <th className="py-2 pr-4 font-medium">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/dashboard/orders?order=${encodeURIComponent(o.id)}`}
                        className="text-blue-700 hover:underline"
                      >
                        {o.patientName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {o.service ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {formatUb(o.scheduledFor)}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {o.nurse ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
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
