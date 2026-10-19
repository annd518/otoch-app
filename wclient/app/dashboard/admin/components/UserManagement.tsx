"use client";

// Staff and customer accounts (ADMIN only): /api/admin/users, /api/admin/staff
// (server/src/routes/admin.ts). The API enforces every rule; this page only
// shows them.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import api from "@/lib/api/client";
import { getSessionUser } from "@/lib/auth/session";

type Role = "CHILD" | "NURSE" | "MEDICAL_ADMIN" | "ADMIN";
type StaffRole = Exclude<Role, "CHILD">;
type Group = "staff" | "customers" | "inactive";
type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
  active: boolean;
  deactivatedAt: string | null;
  orders: number | null;
  activeVisits: number | null;
};

const ROLE_LABELS: Record<Role, string> = {
  CHILD: "Захиалагч",
  NURSE: "Сувилагч",
  MEDICAL_ADMIN: "Эмнэлгийн админ",
  ADMIN: "Админ",
};
const STAFF_ROLES: StaffRole[] = ["NURSE", "MEDICAL_ADMIN", "ADMIN"];
const GROUPS: [Group, string][] = [
  ["staff", "Ажилтан"],
  ["customers", "Захиалагч"],
  ["inactive", "Идэвхгүй"],
];
const noSubscribe = () => () => {};
const day = (v: string) =>
  new Date(v).toLocaleDateString("mn-MN", { timeZone: "Asia/Ulaanbaatar" });

/** 14 characters without look-alikes (0/O, 1/l/I), from the browser's CSPRNG. */
export function generatePassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const apiMessage = (e: unknown, fallback: string) => {
  const v = e as {
    response?: {
      data?: { message?: string; error?: { fields?: Record<string, string> } };
    };
  };
  const fields = v.response?.data?.error?.fields;
  const detail = fields ? Object.values(fields).join(", ") : "";
  return (
    [v.response?.data?.message, detail].filter(Boolean).join(": ") || fallback
  );
};

const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

function AddStaff({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "NURSE" as StaffRole,
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/staff", {
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
        ...(form.phone.trim() && { phone: form.phone.trim() }),
      });
      setCreated({
        name: form.name,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setForm({ name: "", email: "", phone: "", role: "NURSE", password: "" });
      onDone();
    } catch (err) {
      setError(apiMessage(err, "Ажилтан нэмж чадсангүй"));
    } finally {
      setBusy(false);
    }
  };

  if (created)
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
        <p className="font-medium text-green-800">
          {created.name} нэмэгдлээ. Нэвтрэх мэдээллийг ажилтанд найдвартай
          дамжуулна уу. Энэ нууц үг дахин харагдахгүй.
        </p>
        <p className="mt-2 font-mono text-gray-900">
          {created.email} · {created.password}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(
                `${created.email}\n${created.password}`,
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5"
          >
            Хуулах
          </button>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-white"
          >
            Хаах
          </button>
        </div>
      </div>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Ажилтан нэмэх
      </button>
    );

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2"
    >
      <label className="text-sm">
        Нэр
        <input
          required
          minLength={2}
          className={input}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </label>
      <label className="text-sm">
        И-мэйл (нэвтрэх нэр)
        <input
          required
          type="email"
          className={input}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label className="text-sm">
        Утас (заавал биш)
        <input
          placeholder="+976XXXXXXXX"
          className={input}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label className="text-sm">
        Эрх
        <select
          className={input}
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as StaffRole })
          }
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm md:col-span-2">
        Анхны нууц үг (10+ тэмдэгт)
        <div className="flex gap-2">
          <input
            required
            minLength={10}
            className={`${input} font-mono`}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setForm({ ...form, password: generatePassword() })}
            className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 text-sm"
          >
            Үүсгэх
          </button>
        </div>
      </label>
      {error && (
        <p className="text-sm text-red-700 md:col-span-2">{error}</p>
      )}
      <div className="flex gap-2 md:col-span-2">
        <button
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Хадгалж байна…" : "Нэмэх"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          Болих
        </button>
      </div>
    </form>
  );
}

export function UserManagement() {
  const [group, setGroup] = useState<Group>("staff");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // the signed-in admin (their own row has no actions); browser only
  const meId = useSyncExternalStore(
    noSubscribe,
    () => getSessionUser()?.id ?? null,
    () => null,
  );

  const load = useCallback(
    async (next?: string) => {
      setLoading(true);
      try {
        const r = await api.get("/admin/users", {
          params: { group, ...(search && { q: search }), ...(next && { cursor: next }) },
        });
        setRows((old) =>
          next ? [...old, ...r.data.data.users] : r.data.data.users,
        );
        setCursor(r.data.data.nextCursor);
        setError("");
      } catch (e) {
        setError(apiMessage(e, "Хэрэглэгчдийг ачаалж чадсангүй"));
      } finally {
        setLoading(false);
      }
    },
    [group, search],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const change = async (
    row: Row,
    body: { role?: StaffRole; active?: boolean },
    question: string,
  ) => {
    if (!window.confirm(question)) return;
    setBusyId(row.id);
    setNotice("");
    try {
      await api.patch(`/admin/users/${encodeURIComponent(row.id)}`, body);
      setNotice(`${row.name}: хадгалагдлаа`);
      await load();
    } catch (e) {
      setError(apiMessage(e, "Өөрчилж чадсангүй"));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (row: Row) => {
    const password = generatePassword();
    if (
      !window.confirm(
        `${row.name}-д шинэ нууц үг үүсгэх үү? Хуучин нууц үг ажиллахаа болино.`,
      )
    )
      return;
    setBusyId(row.id);
    try {
      await api.post(`/admin/users/${encodeURIComponent(row.id)}/password`, {
        password,
      });
      setNotice(
        `${row.name}-ийн шинэ нууц үг: ${password}. Ажилтанд найдвартай дамжуулна уу (дахин харагдахгүй).`,
      );
    } catch (e) {
      setError(apiMessage(e, "Нууц үг сольж чадсангүй"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {GROUPS.map(([g, title]) => (
            <button
              key={g}
              onClick={() => {
                setGroup(g);
                setNotice("");
              }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                group === g
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {title}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
          className="flex gap-2"
        >
          <input
            placeholder="Нэр, и-мэйл, утас"
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
            Хайх
          </button>
        </form>
      </div>

      {group === "staff" && <AddStaff onDone={() => void load()} />}
      {notice && (
        <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Нэр</th>
              <th className="px-4 py-3 font-medium">И-мэйл / утас</th>
              <th className="px-4 py-3 font-medium">Эрх</th>
              <th className="px-4 py-3 font-medium">
                {group === "customers" ? "Захиалга" : "Идэвхтэй үзлэг"}
              </th>
              <th className="px-4 py-3 font-medium">Бүртгүүлсэн</th>
              <th className="px-4 py-3 font-medium">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((u) => {
              const staff = u.role !== "CHILD";
              const me = u.id === meId;
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className={u.active ? "" : "bg-gray-50"}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.name}
                    {me && (
                      <span className="ml-2 text-xs text-gray-500">(та)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{u.email}</div>
                    {u.phone && (
                      <div className="text-xs text-gray-500">{u.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {staff && u.active && !me ? (
                      <select
                        aria-label={`${u.name}-ийн эрх`}
                        disabled={busy}
                        value={u.role}
                        onChange={(e) =>
                          void change(
                            u,
                            { role: e.target.value as StaffRole },
                            `${u.name}-ийн эрхийг "${ROLE_LABELS[e.target.value as StaffRole]}" болгох уу?`,
                          )
                        }
                        className="rounded-md border border-gray-300 px-2 py-1"
                      >
                        {STAFF_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABELS[u.role]
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {u.role === "CHILD"
                      ? u.orders
                      : u.role === "NURSE"
                        ? u.activeVisits
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {day(u.createdAt)}
                    {!u.active && u.deactivatedAt && (
                      <div className="text-xs text-red-600">
                        Идэвхгүй: {day(u.deactivatedAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {staff && !me ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() =>
                            void change(
                              u,
                              { active: !u.active },
                              u.active
                                ? `${u.name}-ийг идэвхгүй болгох уу? Нэвтэрч чадахгүй болно.`
                                : `${u.name}-ийг дахин идэвхжүүлэх үү?`,
                            )
                          }
                          className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                            u.active
                              ? "border border-red-200 text-red-700 hover:bg-red-50"
                              : "border border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {u.active ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                        </button>
                        {u.active && (
                          <button
                            disabled={busy}
                            onClick={() => void resetPassword(u)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Нууц үг солих
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {staff ? "" : "Зөвхөн харах"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Хэрэглэгч олдсонгүй
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="text-sm text-gray-500">Ачаалж байна…</p>}
      {cursor && !loading && (
        <button
          onClick={() => void load(cursor)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          Цааш үзэх
        </button>
      )}
    </div>
  );
}
