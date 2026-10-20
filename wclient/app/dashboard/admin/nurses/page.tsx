"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api/client";
import { useRoleProtection } from "@/lib/hooks/useRoleProtection";
import type { UserRole } from "@/lib/auth/session-core";
import { formatUb } from "@/lib/orderLabels";

// Nurse verification queue (spec A-01). API: server/src/routes/adminNurses.ts.
// The nurse sends the application from the OTOCH Nurse app.

type State = "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "SUSPENDED";
const KINDS = ["LICENSE", "DIPLOMA", "ID_CARD", "PORTRAIT"] as const;
type Kind = (typeof KINDS)[number];
type Nurse = {
  id: string;
  state: State;
  name: string;
  phone: string | null;
  email: string;
  accountActive: boolean;
  licenseNo: string | null;
  licenseExpiresAt: string | null;
  licenseExpired: boolean;
  employer: string | null;
  experienceYears: number | null;
  experienceBelowRecommended: boolean;
  skillTags: string[];
  isActive: boolean;
  submittedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  documents: Record<Kind, string | null>;
  missing: string[];
};
type HistoryItem = { action: string; note: string | null; actor: string | null; at: string };

const TABS: { state: State; title: string }[] = [
  { state: "SUBMITTED", title: "Хүлээгдэж буй" },
  { state: "VERIFIED", title: "Баталгаажсан" },
  { state: "REJECTED", title: "Татгалзсан" },
  { state: "SUSPENDED", title: "Түдгэлзүүлсэн" },
  { state: "DRAFT", title: "Бөглөж байгаа" },
];
const STATE_LABEL: Record<State, string> = {
  DRAFT: "Илгээгээгүй",
  SUBMITTED: "Шалгуулахаар илгээсэн",
  VERIFIED: "Баталгаажсан",
  REJECTED: "Татгалзсан",
  SUSPENDED: "Түдгэлзүүлсэн",
};
const DOC_LABEL: Record<Kind, string> = {
  LICENSE: "Мэргэжлийн зөвшөөрөл",
  DIPLOMA: "Диплом",
  ID_CARD: "Иргэний үнэмлэх",
  PORTRAIT: "Цээж зураг",
};
const ACTION_LABEL: Record<string, string> = {
  SUBMITTED: "Өргөдөл илгээсэн",
  APPROVED: "Баталгаажуулсан",
  REJECTED: "Татгалзсан",
  SUSPENDED: "Түдгэлзүүлсэн",
};
// same codes as the server (services/nurseProvision.ts SKILL_TAGS)
const SKILLS = [
  { code: "INJ", label: "Тарилга" },
  { code: "IV", label: "Судсаар дусал" },
  { code: "WOUND", label: "Шархны арчилгаа, боолт" },
  { code: "CATH", label: "Давсагны гуурс" },
  { code: "NG", label: "Ходоодны зонд" },
  { code: "CARE", label: "Асаргаа, сувилгаа" },
];
const ROLES: UserRole[] = ["ADMIN"];

const errorMessage = (e: unknown, fallback: string) => {
  const v = e as { response?: { data?: { message?: string } } };
  return v.response?.data?.message || fallback;
};

export default function NurseVerificationPage() {
  useRoleProtection(ROLES);
  const [tab, setTab] = useState<State>("SUBMITTED");
  const [rows, setRows] = useState<Nurse[]>([]);
  const [counts, setCounts] = useState<Partial<Record<State, number>>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (state: State) => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/nurses?status=${state}`);
      setRows(r.data.data.nurses);
      setCounts(r.data.data.counts);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Жагсаалт ачаалж чадсангүй"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const onChanged = () => void load(tab);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-bold text-gray-800 sm:text-3xl">
        Сувилагчийн баталгаажуулалт
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Сувилагч OTOCH Nurse аппаас бүртгүүлж, зөвшөөрөл, диплом, иргэний
        үнэмлэх, цээж зургаа илгээнэ. Баталгаажсан сувилагчид л дуудлага ирнэ.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.state}
            onClick={() => {
              setTab(t.state);
              setSelectedId(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t.state
                ? "bg-blue-600 text-white"
                : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            }`}
          >
            {t.title}
            {counts[t.state] !== undefined ? ` · ${counts[t.state]}` : ""}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="space-y-2">
          {loading && rows.length === 0 && (
            <li className="text-sm text-gray-500">Ачаалж байна…</li>
          )}
          {!loading && rows.length === 0 && (
            <li className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              Энэ төлөвт сувилагч алга
            </li>
          )}
          {rows.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setSelectedId(n.id)}
                className={`w-full rounded-xl border p-4 text-left ${
                  selectedId === n.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <p className="font-semibold text-gray-900">{n.name}</p>
                <p className="text-sm text-gray-600">
                  {n.phone ?? n.email}
                  {n.licenseNo ? ` · №${n.licenseNo}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {n.submittedAt ? `Илгээсэн: ${formatUb(n.submittedAt)}` : "Илгээгээгүй"}
                  {n.missing.length > 0 ? ` · Дутуу ${n.missing.length}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {selectedId ? (
          <NurseDetail key={selectedId} id={selectedId} onChanged={onChanged} />
        ) : (
          <div className="hidden rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 lg:block">
            Жагсаалтаас сувилагч сонгоно уу
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentImage({ nurseId, kind, uploadedAt }: { nurseId: string; kind: Kind; uploadedAt: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uploadedAt) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    // Authorised read (Bearer token); the image never has a public URL.
    api
      .get(`/admin/nurses/${nurseId}/documents/${kind}`, { responseType: "blob" })
      .then((r) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(r.data as Blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [nurseId, kind, uploadedAt]);

  return (
    <figure className="rounded-xl border border-gray-200 bg-white p-2">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {!uploadedAt ? (
          <span className="text-xs text-red-600">Оруулаагүй</span>
        ) : failed ? (
          <span className="text-xs text-red-600">Ачаалж чадсангүй</span>
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
            <img src={url} alt={DOC_LABEL[kind]} className="h-full w-full object-contain" />
          </a>
        ) : (
          <span className="text-xs text-gray-500">Ачаалж байна…</span>
        )}
      </div>
      <figcaption className="mt-1 text-xs text-gray-700">{DOC_LABEL[kind]}</figcaption>
    </figure>
  );
}

function NurseDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [nurse, setNurse] = useState<Nurse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // approve form
  const [licenseNo, setLicenseNo] = useState("");
  const [expires, setExpires] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  // reject / suspend
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/admin/nurses/${id}`);
      const n: Nurse = r.data.data.nurse;
      setNurse(n);
      setHistory(r.data.data.history);
      setLicenseNo(n.licenseNo ?? "");
      setExpires(n.licenseExpiresAt ?? "");
      setSkills(n.skillTags);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Мэдээлэл ачаалж чадсангүй"));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (path: string, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await api.post(`/admin/nurses/${id}/${path}`, body);
      toast.success(done);
      setReason("");
      setChecked(false);
      await load();
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e, "Хадгалж чадсангүй"));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>;
  if (!nurse) return <p className="text-sm text-gray-500">Ачаалж байна…</p>;

  const canApprove = nurse.state === "SUBMITTED" || nurse.state === "SUSPENDED";
  const docsComplete = KINDS.every((k) => nurse.documents[k]);

  return (
    <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{nurse.name}</h2>
          <p className="text-sm text-gray-600">
            {nurse.phone ?? "Утасгүй"} · {nurse.email}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
          {STATE_LABEL[nurse.state]}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Зөвшөөрлийн дугаар</dt>
          <dd className="font-medium text-gray-900">{nurse.licenseNo ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Зөвшөөрөл дуусах</dt>
          <dd className={`font-medium ${nurse.licenseExpired ? "text-red-700" : "text-gray-900"}`}>
            {nurse.licenseExpiresAt ?? "—"}
            {nurse.licenseExpired ? " (дууссан)" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Ажлын газар</dt>
          <dd className="font-medium text-gray-900">{nurse.employer ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Ажилласан жил</dt>
          <dd className="font-medium text-gray-900">
            {nurse.experienceYears ?? "—"}
            {nurse.experienceBelowRecommended && (
              <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                Шаардлага: 3-аас дээш жил
              </span>
            )}
          </dd>
        </div>
      </dl>

      {nurse.missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Дутуу: {nurse.missing.join(", ")}
        </p>
      )}
      {nurse.reviewNote && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">
          Шалтгаан: {nurse.reviewNote}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {KINDS.map((k) => (
          <DocumentImage key={k} nurseId={nurse.id} kind={k} uploadedAt={nurse.documents[k]} />
        ))}
      </div>

      {canApprove && (
        <form
          className="space-y-3 rounded-xl border border-green-200 bg-green-50/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              "approve",
              { licenseNo: licenseNo.trim(), licenseExpiresAt: expires, skillTags: skills },
              "Сувилагч баталгаажлаа",
            );
          }}
        >
          <h3 className="font-semibold text-gray-900">Батлах</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-gray-700">Зөвшөөрлийн дугаар</span>
              <input
                value={licenseNo}
                onChange={(e) => setLicenseNo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-700">Дуусах огноо</span>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm text-gray-700">Гүйцэтгэх ажилбар (ур чадвар)</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <label
                  key={s.code}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={skills.includes(s.code)}
                    onChange={(e) =>
                      setSkills((v) =>
                        e.target.checked ? [...v, s.code] : v.filter((x) => x !== s.code),
                      )
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            Зөвшөөрлийн дугаар, хугацааг эрүүл мэндийн мэргэжилтний бүртгэлтэй
            тулгаж, баримтын зургийг шалгасан
          </label>
          <button
            type="submit"
            disabled={busy || !checked || !docsComplete || skills.length === 0}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {nurse.state === "SUSPENDED" ? "Дахин идэвхжүүлэх" : "Батлах"}
          </button>
        </form>
      )}

      {(nurse.state === "SUBMITTED" || nurse.state === "VERIFIED") && (
        <form
          className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nurse.state === "SUBMITTED")
              void act("reject", { reason: reason.trim() }, "Өргөдөл татгалзлаа");
            else void act("suspend", { reason: reason.trim() }, "Түдгэлзүүллээ");
          }}
        >
          <h3 className="font-semibold text-gray-900">
            {nurse.state === "SUBMITTED" ? "Татгалзах" : "Түдгэлзүүлэх"}
          </h3>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              nurse.state === "SUBMITTED"
                ? "Шалтгаан (сувилагчид харагдана). Жишээ: зөвшөөрлийн зураг бүдэг байна"
                : "Шалтгаан (сувилагчид харагдана)"
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || reason.trim().length < 5}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {nurse.state === "SUBMITTED" ? "Татгалзах" : "Түдгэлзүүлэх"}
          </button>
        </form>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-gray-900">Түүх</h3>
          <ol className="space-y-1 text-sm text-gray-700">
            {history.map((h, i) => (
              <li key={i}>
                {formatUb(h.at)} · {ACTION_LABEL[h.action] ?? h.action}
                {h.actor ? ` · ${h.actor}` : ""}
                {h.note ? ` · “${h.note}”` : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
