import { after, afterEach, before, it } from "node:test";
import assert from "node:assert/strict";
import { api, createUser, loginAs, prisma, startServer, type TestServer } from "./helpers";

// Nurse registers in the nurse app (phone + OTP), sends the application with
// documents, an admin approves or rejects it in the admin web (spec N-01, A-01).
let srv: TestServer;
let admin: string;
const saved = { ...process.env };
before(async () => {
  srv = await startServer();
  admin = await loginAs(srv.baseUrl, (await createUser("ADMIN", "nv-admin")).email);
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
afterEach(() => {
  if (saved.OTP_TEST_ACCOUNTS === undefined) delete process.env.OTP_TEST_ACCOUNTS;
  else process.env.OTP_TEST_ACCOUNTS = saved.OTP_TEST_ACCOUNTS;
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0]);
const KINDS = ["LICENSE", "DIPLOMA", "ID_CARD", "PORTRAIT"];
const inDays = (days: number) =>
  new Date(Date.now() + 8 * 3600000 + days * 86400000).toISOString().slice(0, 10);

async function otp(phone: string, code: string, body: Record<string, unknown>) {
  process.env.OTP_TEST_ACCOUNTS = `${phone}:${code}`;
  // the resend and per-IP limits are tested elsewhere; files run one at a time
  await prisma.otpChallenge.deleteMany({});
  const r = await api(srv.baseUrl, "POST", "/api/auth/otp/request", { body: { phone } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
    body: { phone, challengeId: r.json.data.challengeId, code, app: "nurse", ...body },
  });
}

const register = async (phone: string, code: string, name = "Бат Сувилагч") => {
  const v = await otp(phone, code, { register: true, name });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  return { token: v.json.data.token as string, id: v.json.data.user.id as string };
};

const app = (token: string, method: string, path = "", body?: unknown) =>
  api(srv.baseUrl, method, `/api/nurse/application${path}`, { token, body });

function upload(token: string, kind: string, bytes: Buffer = JPEG) {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "doc.jpg");
  return fetch(`${srv.baseUrl}/api/nurse/application/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
}

const adminApi = (method: string, path: string, body?: unknown, token = admin) =>
  api(srv.baseUrl, method, `/api/admin/nurses${path}`, { token, body });

async function completeAndSubmit(token: string) {
  const put = await app(token, "PUT", "", {
    licenseNo: "СУ-12345",
    licenseExpiresAt: inDays(400),
    employer: "Улсын нэгдүгээр төв эмнэлэг",
    experienceYears: 5,
  });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  for (const kind of KINDS) assert.equal((await upload(token, kind)).status, 201);
  const s = await app(token, "POST", "/submit");
  assert.equal(s.status, 200, JSON.stringify(s.json));
  return s.json.data.application;
}

it("a new phone registers as a nurse with an unsent application; no orders until verified", async () => {
  const { token, id } = await register("+97699700001", "483920");
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: { nurseProfile: true } });
  assert.equal(user.role, "NURSE");
  assert.equal(user.name, "Бат Сувилагч");
  assert.equal(user.nurseProfile?.status, "PENDING");
  assert.equal(user.nurseProfile?.submittedAt, null);

  const g = await app(token, "GET");
  assert.equal(g.status, 200);
  assert.equal(g.json.data.application.state, "DRAFT");
  assert.equal(g.json.data.application.editable, true);
  assert.ok(g.json.data.application.missing.includes("Мэргэжлийн зөвшөөрөл"));

  const online = await api(srv.baseUrl, "PUT", "/api/nurse/me", { token, body: { isActive: true } });
  assert.equal(online.status, 409);
  assert.equal(online.json.error.code, "NOT_ELIGIBLE");

  // signing in again (with or without register) reaches the same account
  const again = await otp("+97699700001", "715306", { register: true, name: "Өөр нэр" });
  assert.equal(again.json.data.user.id, id);
  const plain = await otp("+97699700001", "483921", {});
  assert.equal(plain.json.data.user.id, id);
  assert.equal(await prisma.user.count({ where: { phone: "+97699700001" } }), 1);
});

it("registration needs a name, and a customer phone cannot become a nurse", async () => {
  process.env.OTP_TEST_ACCOUNTS = "+97699700002:483920";
  const r = await api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
    body: { phone: "+97699700002", challengeId: "x", code: "483920", app: "nurse", register: true },
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "VALIDATION_ERROR");

  await prisma.user.update({
    where: { id: (await createUser("CHILD", "nv-child")).id },
    data: { phone: "+97699700003" },
  });
  const v = await otp("+97699700003", "483920", { register: true, name: "Хэрэглэгч" });
  assert.equal(v.status, 409);
  assert.equal(v.json.error.code, "PHONE_TAKEN");
  const u = await prisma.user.findUniqueOrThrow({ where: { phone: "+97699700003" } });
  assert.equal(u.role, "CHILD");

  // without register an unknown phone still gets the generic answer
  const unknown = await otp("+97699700004", "483920", {});
  assert.equal(unknown.json.error.code, "OTP_INVALID");
  assert.equal(await prisma.user.count({ where: { phone: "+97699700004" } }), 0);
});

it("an application is sent only when complete and is locked while the admin decides", async () => {
  const { token } = await register("+97699700005", "483920");
  const early = await app(token, "POST", "/submit");
  assert.equal(early.status, 409);
  assert.equal(early.json.error.code, "APPLICATION_INCOMPLETE");

  // a licence ending within 30 days is not enough
  await app(token, "PUT", "", { licenseExpiresAt: inDays(10) });
  const soon = await app(token, "GET");
  assert.ok(soon.json.data.application.missing.some((m: string) => m.includes("30")));

  assert.equal((await app(token, "PUT", "", { licenseExpiresAt: "2026-02-30" })).status, 400);
  assert.equal((await app(token, "PUT", "", { status: "VERIFIED" })).status, 400);
  const notImage = await upload(token, "LICENSE", Buffer.from("%PDF-1.4 not an image"));
  assert.equal(notImage.status, 415);
  assert.equal((await upload(token, "SELFIE")).status, 400);

  const sent = await completeAndSubmit(token);
  assert.equal(sent.state, "SUBMITTED");
  assert.equal(sent.editable, false);
  assert.deepEqual(sent.missing, []);

  const locked = await app(token, "PUT", "", { employer: "Өөр газар" });
  assert.equal(locked.status, 409);
  assert.equal(locked.json.error.code, "APPLICATION_LOCKED");
  assert.equal((await upload(token, "LICENSE")).status, 409);

  // the nurse can see their own image
  const img = await fetch(`${srv.baseUrl}/api/nurse/application/documents/LICENSE`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.equal(img.headers.get("cache-control"), "private, no-store");
});

it("a replaced document leaves the old image to the cleanup job", async () => {
  const { token, id } = await register("+97699700006", "483920");
  await upload(token, "PORTRAIT");
  const first = await prisma.nurseDocument.findFirstOrThrow({ where: { nurseId: id, kind: "PORTRAIT" } });
  await upload(token, "PORTRAIT");
  const docs = await prisma.nurseDocument.findMany({ where: { nurseId: id, kind: "PORTRAIT" } });
  assert.equal(docs.length, 1);
  assert.notEqual(docs[0].storageKey, first.storageKey);
  const job = await prisma.blobCleanupJob.findUnique({ where: { storageKey: first.storageKey } });
  assert.ok(job);
  assert.equal(job.completedAt, null);
});

it("only an admin reviews applications", async () => {
  const { token, id } = await register("+97699700007", "483920");
  await completeAndSubmit(token);
  assert.equal((await adminApi("GET", "", undefined, token)).status, 403);
  assert.equal((await adminApi("POST", `/${id}/approve`, {}, token)).status, 403);
  const other = await register("+97699700008", "483920");
  const img = await fetch(`${srv.baseUrl}/api/admin/nurses/${id}/documents/LICENSE`, {
    headers: { Authorization: `Bearer ${other.token}` },
  });
  assert.equal(img.status, 403);
});

it("admin rejects with a reason, the nurse fixes it, then admin approves and the nurse can go online", async () => {
  const { token, id } = await register("+97699700009", "483920", "Сараа Сувилагч");
  await completeAndSubmit(token);

  const queue = await adminApi("GET", "?status=SUBMITTED");
  assert.equal(queue.status, 200);
  const row = queue.json.data.nurses.find((n: { id: string }) => n.id === id);
  assert.ok(row);
  assert.equal(row.name, "Сараа Сувилагч");
  assert.equal(row.licenseNo, "СУ-12345");
  assert.ok(row.documents.LICENSE);
  assert.ok(queue.json.data.counts.SUBMITTED >= 1);
  assert.equal((await adminApi("GET", "?status=NOPE")).status, 400);

  const summary = await api(srv.baseUrl, "GET", "/api/admin/summary", { token: admin });
  assert.ok(summary.json.data.nurseApplications >= 1);

  const img = await fetch(`${srv.baseUrl}/api/admin/nurses/${id}/documents/ID_CARD`, {
    headers: { Authorization: `Bearer ${admin}` },
  });
  assert.equal(img.status, 200);
  assert.equal((await adminApi("GET", `/${id}/documents/OTHER`)).status, 404);

  assert.equal((await adminApi("POST", `/${id}/reject`, { reason: "муу" })).status, 400);
  const rej = await adminApi("POST", `/${id}/reject`, { reason: "Зөвшөөрлийн зураг бүдэг байна" });
  assert.equal(rej.status, 200, JSON.stringify(rej.json));
  assert.equal(rej.json.data.nurse.state, "REJECTED");

  const seen = await app(token, "GET");
  assert.equal(seen.json.data.application.state, "REJECTED");
  assert.equal(seen.json.data.application.reviewNote, "Зөвшөөрлийн зураг бүдэг байна");
  assert.equal(seen.json.data.application.editable, true);
  // a rejected application cannot be approved before it is sent again
  const early = await adminApi("POST", `/${id}/approve`, {
    licenseNo: "СУ-12345",
    licenseExpiresAt: inDays(400),
    skillTags: ["INJ"],
  });
  assert.equal(early.status, 409);

  assert.equal((await upload(token, "LICENSE")).status, 201);
  const resent = await app(token, "POST", "/submit");
  assert.equal(resent.json.data.application.state, "SUBMITTED");
  assert.equal(resent.json.data.application.reviewNote, null);

  const expired = await adminApi("POST", `/${id}/approve`, {
    licenseNo: "СУ-12345",
    licenseExpiresAt: inDays(-1),
    skillTags: ["INJ"],
  });
  assert.equal(expired.status, 409);
  assert.equal((await adminApi("POST", `/${id}/approve`, { licenseNo: "x", licenseExpiresAt: inDays(400), skillTags: [] })).status, 400);

  const ok = await adminApi("POST", `/${id}/approve`, {
    licenseNo: "СУ-12345",
    licenseExpiresAt: inDays(400),
    skillTags: ["INJ", "IV"],
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.data.nurse.state, "VERIFIED");

  const me = await api(srv.baseUrl, "GET", "/api/nurse/me", { token });
  assert.equal(me.json.data.profile.status, "VERIFIED");
  assert.equal(me.json.data.profile.blocker, null);
  assert.deepEqual(me.json.data.profile.skillTags, ["INJ", "IV"]);
  const online = await api(srv.baseUrl, "PUT", "/api/nurse/me", { token, body: { isActive: true } });
  assert.equal(online.status, 200);
  assert.equal((await app(token, "PUT", "", { employer: "Өөр газар" })).status, 409);

  const susp = await adminApi("POST", `/${id}/suspend`, { reason: "Гомдол шалгагдаж байна" });
  assert.equal(susp.status, 200);
  const p = await prisma.nurseProfile.findUniqueOrThrow({ where: { userId: id } });
  assert.equal(p.status, "SUSPENDED");
  assert.equal(p.isActive, false);

  const detail = await adminApi("GET", `/${id}`);
  assert.deepEqual(
    detail.json.data.history.map((h: { action: string }) => h.action),
    ["SUSPENDED", "APPROVED", "SUBMITTED", "REJECTED", "SUBMITTED"],
  );
  assert.equal(detail.json.data.history[3].note, "Зөвшөөрлийн зураг бүдэг байна");
});

it("a nurse created by an admin starts with an unsent application", async () => {
  const r = await api(srv.baseUrl, "POST", "/api/admin/staff", {
    token: admin,
    body: { name: "Вэбээс Сувилагч", email: `nv-${Date.now()}@test.mn`, role: "NURSE", password: "Nurse-pass-2026" },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const p = await prisma.nurseProfile.findUnique({ where: { userId: r.json.data.user.id } });
  assert.equal(p?.status, "PENDING");
  assert.equal(p?.submittedAt, null);
  const drafts = await adminApi("GET", "?status=DRAFT");
  assert.ok(drafts.json.data.nurses.some((n: { id: string }) => n.id === r.json.data.user.id));
});
