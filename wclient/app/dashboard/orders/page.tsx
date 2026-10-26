"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api/client";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session-core";
import { ORDER_STATUS_LABELS } from "@/lib/orderLabels";
import { CancelPanel, type Cancellation } from "./CancelPanel";
import { allowed, useMyAdminAccess } from "@/lib/hooks/useAdminAccess";
type Order = {
  id: string;
  version: number;
  status: string;
  patientName?: string;
  scheduledFor: string | null;
  address: { text: string } | null;
  nurse: { name: string } | null;
  eta: string | null;
  isMock: boolean;
  bookingForm?: { referralText?: string | null } | null;
  attachments?: { id: string }[];
  timeline: { id: string; status: string; at: string }[];
  cancellation?: Cancellation;
  // the customer's rating once the visit is done (spec SCR-C16)
  rating?: { stars: number; tags: string[]; comment: string | null } | null;
};
const RATING_TAG_LABEL: Record<string, string> = { ON_TIME: "Цагтаа", KIND: "Эелдэг", PROFESSIONAL: "Мэргэжлийн" };
const labels = ORDER_STATUS_LABELS;
const date = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })
    : "Тодорхойгүй";
export default function StaffOrdersPage() {
  // useSearchParams needs a Suspense boundary for the static build
  return (
    <Suspense fallback={null}>
      <StaffOrders />
    </Suspense>
  );
}

const shortNo = (id: string) => id.slice(-6).toUpperCase();

function StaffOrders() {
  // ?q= from the admin header search: order №, patient or nurse name
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const [user, setUser] = useState<SessionUser | null>(null),
    [rows, setRows] = useState<Order[]>([]),
    [selected, setSelected] = useState<Order | null>(null),
    [nurses, setNurses] = useState<{ id: string; name: string }[]>([]),
    [nurseId, setNurseId] = useState(""),
    [eta, setEta] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [testEnv, setTestEnv] = useState(false);
  const inFlight = useRef(false);
  const access = useMyAdminAccess();
  const canManage = allowed(access, "orders.manage");
  const load = useCallback(async (cursor?: string) => {
    try {
      const r = await api.get("/staff/orders", {
        params: cursor ? { cursor } : {},
      });
      if (!r.data.success) throw new Error(r.data.message);
      setRows((old) =>
        cursor ? [...old, ...r.data.data.orders] : r.data.data.orders,
      );
      setNextCursor(r.data.data.nextCursor);
      setTestEnv(r.data.data.environment === "staging-test");
      setError("");
    } catch {
      setError(
        "Захиалгыг ачаалж чадсангүй. Дахин нэвтрэх эсвэл холболтоо шалгана уу.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    if (u && u.role === "ADMIN") {
      void load();
    } else setLoading(false);
  }, [load]);
  // the nurse list is for assigning by hand (Ops, super-admin)
  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    api
      .get("/staff/orders/nurses")
      .then((r) => alive && setNurses(r.data.data.nurses))
      .catch(() => alive && setError("Сувилагчдыг ачаалж чадсангүй"));
    return () => {
      alive = false;
    };
  }, [canManage]);
  const open = async (id: string) => {
    try {
      const r = await api.get("/staff/orders/" + encodeURIComponent(id));
      setSelected(r.data.data.order);
      setNurseId("");
      setEta("");
      setError("");
    } catch {
      setError("Дэлгэрэнгүй ачаалж чадсангүй");
    }
  };
  // /dashboard/orders?order=<id> (links from the admin dashboard) opens it
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (!id) return;
    void api
      .get("/staff/orders/" + encodeURIComponent(id))
      .then((r) => setSelected(r.data.data.order))
      .catch(() => setError("Дэлгэрэнгүй ачаалж чадсангүй"));
  }, []);
  const act = async (action: string, fields: Record<string, unknown> = {}) => {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await api.post(
        "/staff/orders/" + encodeURIComponent(selected.id) + "/" + action,
        { version: selected.version, ...fields },
      );
      if (!r.data.success) throw new Error(r.data.message);
      await open(selected.id);
      await load();
    } catch (e) {
      const v = e as {
        response?: { data?: { message?: string; error?: { code: string } } };
      };
      await open(selected.id);
      setError(
        v.response?.data?.message ??
          "Үйлдэл амжилтгүй. Давтан оролдохын өмнө дахин ачаална уу.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };
  const shown = useMemo(
    () =>
      q
        ? rows.filter((o) =>
            [o.id, shortNo(o.id), o.patientName ?? "", o.nurse?.name ?? ""].some((v) =>
              v.toLowerCase().includes(q),
            ),
          )
        : rows,
    [rows, q],
  );
  if (
    !loading &&
    (!user || user.role !== "ADMIN")
  )
    return <p className="p-6">Ажилтны эрх шаардлагатай.</p>;
  return (
    <main className="p-4 md:p-8 space-y-4">
      <h1 className="text-2xl font-bold text-[#0F2A4A]">Үйлчилгээний захиалгууд</h1>
      {q && (
        <p className="text-sm text-slate-600">
          “{q}” хайлтын үр дүн: {shown.length} (ачаалсан {rows.length} захиалгаас)
        </p>
      )}
      {testEnv && (
        <p role="status" className="p-4 bg-amber-100">
          Туршилтын орчин · бодит төлбөр биш. Зөвхөн зохиомол мэдээлэл ашиглана.
        </p>
      )}
      {error && (
        <p role="alert" className="p-4 bg-red-100">
          {error}
        </p>
      )}
      <button
        className="min-h-12 border rounded px-4"
        onClick={() => void load()}
        disabled={busy}
      >
        Дахин ачаалах
      </button>
      {loading ? (
        <p>Ачаалж байна…</p>
      ) : !shown.length ? (
        <p>{q ? "Хайлтад тохирох захиалга алга." : "Захиалга алга."}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((o) => (
            <button
              key={o.id}
              className="min-h-12 rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-[#EAF1F8]"
              onClick={() => void open(o.id)}
            >
              <span className="float-right font-mono text-xs text-slate-500">№{shortNo(o.id)}</span>
              <strong>{o.patientName}</strong>
              {o.nurse && <p className="text-sm text-slate-600">Сувилагч: {o.nurse.name}</p>}
              <p>{labels[o.status] ?? "Төлөв шинэчлэгдэж байна"}</p>
              <p>{date(o.scheduledFor)}</p>
              {o.isMock && <p>Туршилтын төлбөр · бодит QPay биш</p>}
            </button>
          ))}
        </div>
      )}
      {nextCursor && (
        <button
          className="min-h-12 border p-3"
          onClick={() => void load(nextCursor)}
        >
          Дараагийн захиалгууд
        </button>
      )}
      {selected && (
        <section
          className="bg-white border rounded-xl p-4 space-y-4"
          aria-label="Захиалгын дэлгэрэнгүй"
        >
          <h2 className="text-xl font-semibold">
            {selected.patientName} · {labels[selected.status]}
          </h2>
          {selected.isMock && <p>Туршилтын төлбөр · бодит QPay биш</p>}
          <p>Хаяг: {selected.address?.text ?? "Ороогүй"}</p>
          <p>Сувилагч: {selected.nurse?.name ?? "Томилогдоогүй"}</p>
          {selected.rating && (
            <p className={selected.rating.stars <= 2 ? "text-red-700" : undefined}>
              Үнэлгээ: {"★".repeat(selected.rating.stars)}
              {selected.rating.tags.length > 0
                ? ` · ${selected.rating.tags.map((t) => RATING_TAG_LABEL[t] ?? t).join(", ")}`
                : ""}
              {selected.rating.comment ? ` · “${selected.rating.comment}”` : ""}
            </p>
          )}
          <p>Ирэх хугацаа: {date(selected.eta)}</p>
          <p>Эмчийн заалтын зураг: {selected.attachments?.length ?? 0}</p>
          {selected.bookingForm?.referralText && (
            <div>
              <p>Эмчийн заалт (хэрэглэгч гараар бичсэн):</p>
              <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
                {selected.bookingForm.referralText}
              </p>
            </div>
          )}
          {user?.role !== "NURSE" &&
            canManage &&
            ["PAID", "ASSIGNED"].includes(selected.status) && (
              <div className="space-y-2">
                <label htmlFor="nurse">Сувилагч сонгох</label>
                <select
                  id="nurse"
                  className="block border p-3 min-h-12"
                  value={nurseId}
                  onChange={(e) => setNurseId(e.target.value)}
                >
                  <option value="">Сонгоно уу</option>
                  {nurses.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
                <button
                  className="bg-blue-700 text-white min-h-12 p-3 rounded"
                  disabled={busy || !nurseId}
                  onClick={() => void act("assign", { nurseId })}
                >
                  Томилох / дахин томилох
                </button>
              </div>
            )}
          {user?.role === "ADMIN" && (
            <CancelPanel
              order={selected}
              canCancel={canManage}
              canRefund={allowed(access, "money.manage")}
              onDone={async () => {
                await open(selected.id);
                await load();
              }}
            />
          )}
          {user?.role === "NURSE" &&
            ["ASSIGNED", "IN_PROGRESS"].includes(selected.status) && (
              <div className="space-y-2">
                <label htmlFor="eta">
                  ETA · Улаанбаатарын цаг (YYYY-MM-DD HH:mm)
                </label>
                <input
                  id="eta"
                  className="border p-3 min-h-12"
                  type="text"
                  placeholder="2026-10-20 14:30"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
                <button
                  className="min-h-12 border p-3"
                  disabled={
                    busy || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(eta)
                  }
                  onClick={() =>
                    void act("eta", {
                      eta: eta.replace(" ", "T") + ":00+08:00",
                    })
                  }
                >
                  ETA шинэчлэх
                </button>
                <button
                  className="min-h-12 border p-3"
                  disabled={busy}
                  onClick={() => void act("eta", { eta: null })}
                >
                  ETA тодорхойгүй болгох
                </button>
                <button
                  className="bg-blue-700 text-white min-h-12 p-3 rounded"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      selected.status === "ASSIGNED" ? "start" : "complete",
                    )
                  }
                >
                  {selected.status === "ASSIGNED"
                    ? "Үйлчилгээ эхлэх"
                    : "Үйлчилгээ дуусгах"}
                </button>
              </div>
            )}
          <h3 className="font-bold">Явц</h3>
          {selected.timeline.map((t) => (
            <p key={t.id}>
              {labels[t.status] ?? "Шинэчлэгдсэн"} · {date(t.at)}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
