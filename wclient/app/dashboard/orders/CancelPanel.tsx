"use client";

import { useState } from "react";
import api from "@/lib/api/client";
import { formatMnt } from "@/lib/orderLabels";

// Admin cancellation and refunds (spec slide 25). API: server/src/routes/adminCancel.ts.

export type Cancellation = {
  at: string;
  by: "CLIENT" | "ADMIN" | "SYSTEM" | null;
  reason: string | null;
  refund: {
    id: string;
    percent: number;
    amountMnt: number;
    status: "PENDING" | "REFUNDED" | "MANUAL_REQUIRED";
  } | null;
} | null;

// The visit has not finished: an admin may still cancel it.
const ADMIN_CANCELLABLE = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "BLOCKED_RED_FLAG",
  "PAID",
  "ASSIGNED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "REFUSED",
  "INCIDENT",
];
const BY: Record<string, string> = { CLIENT: "Үйлчлүүлэгч", ADMIN: "Админ", SYSTEM: "Систем" };
const REFUND: Record<string, string> = {
  PENDING: "QPay-д илгээж байна",
  REFUNDED: "Буцаагдсан",
  MANUAL_REQUIRED: "Гараар буцаах шаардлагатай",
};

const message = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;

export function CancelPanel({
  order,
  onDone,
}: {
  order: { id: string; status: string; cancellation?: Cancellation };
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [percent, setPercent] = useState(100);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onDone();
    } catch (e) {
      setError(message(e, "Амжилтгүй боллоо"));
    } finally {
      setBusy(false);
    }
  };

  const c = order.cancellation;
  if (order.status === "CANCELLED" && c)
    return (
      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        <p className="font-semibold">
          Цуцалсан: {BY[c.by ?? ""] ?? "—"} ·{" "}
          {new Date(c.at).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}
        </p>
        {c.reason && <p>Шалтгаан: {c.reason}</p>}
        {c.refund ? (
          <p>
            Буцаалт: {formatMnt(c.refund.amountMnt)} ({c.refund.percent}%) ·{" "}
            <span className={c.refund.status === "MANUAL_REQUIRED" ? "font-semibold text-red-700" : ""}>
              {REFUND[c.refund.status]}
            </span>
          </p>
        ) : (
          <p>Буцаах мөнгө байхгүй</p>
        )}
        {c.refund?.status === "MANUAL_REQUIRED" && (
          <div className="space-y-2 border-t border-gray-200 pt-2">
            <button
              className="min-h-10 rounded border bg-white px-3"
              disabled={busy}
              onClick={() => void run(() => api.post(`/admin/refunds/${c.refund!.id}/retry`))}
            >
              QPay-ээр дахин оролдох
            </button>
            <label className="block" htmlFor="refund-note">
              Гараар буцаасан бол тэмдэглэл (банк, гүйлгээний утга)
            </label>
            <input
              id="refund-note"
              className="block w-full border p-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="min-h-10 rounded bg-green-700 px-3 text-white disabled:opacity-50"
              disabled={busy || note.trim().length < 3}
              onClick={() =>
                void run(() => api.post(`/admin/refunds/${c.refund!.id}/resolve`, { note: note.trim() }))
              }
            >
              Гараар буцаасан гэж тэмдэглэх
            </button>
          </div>
        )}
        {error && <p className="text-red-700">{error}</p>}
      </div>
    );

  if (!ADMIN_CANCELLABLE.includes(order.status)) return null;
  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm">
      <p className="font-semibold">Захиалга цуцлах</p>
      <label className="block" htmlFor="cancel-reason">
        Шалтгаан (үйлчлүүлэгчид харагдана)
      </label>
      <textarea
        id="cancel-reason"
        className="block w-full border p-2"
        rows={2}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <label className="block" htmlFor="cancel-percent">
        Төлсөн дүнгээс буцаах хувь
      </label>
      <select
        id="cancel-percent"
        className="block border p-2"
        value={percent}
        onChange={(e) => setPercent(Number(e.target.value))}
      >
        {[100, 70, 50, 0].map((p) => (
          <option key={p} value={p}>
            {p}%
          </option>
        ))}
      </select>
      <button
        className="min-h-10 rounded bg-red-700 px-3 text-white disabled:opacity-50"
        disabled={busy || reason.trim().length < 5}
        onClick={() => {
          if (!window.confirm(`Захиалгыг цуцалж, төлсөн дүнгийн ${percent}%-ийг буцаах уу?`)) return;
          void run(() => api.post(`/admin/orders/${order.id}/cancel`, { reason: reason.trim(), refundPercent: percent }));
        }}
      >
        Цуцлах
      </button>
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
