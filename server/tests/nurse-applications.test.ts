import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, errorCode, type TestServer } from "./helpers";
import { MAX_PER_PHONE_PER_DAY } from "../src/routes/nurseApplications";

let srv: TestServer, admin: string, child: string, nurse: string;
const DECL = { license: true, experience: true, scope: true };
let seq = 0;
const phone = () => `+97699${String(400000 + ++seq).padStart(6, "0")}`;
const body = (over: Record<string, unknown> = {}) => ({
  name: "Б.Номин",
  phone: phone(),
  licenseNo: "10387",
  experienceYears: 5,
  declarations: DECL,
  ...over,
});
const submit = (b: unknown) => api(srv.baseUrl, "POST", "/api/nurse-applications", { body: b });

before(async () => {
  srv = await startServer();
  const [a, c, n] = await Promise.all([createUser("ADMIN"), createUser("CHILD"), createUser("NURSE")]);
  [admin, child, nurse] = await Promise.all([a, c, n].map((u) => loginAs(srv.baseUrl, u.email)));
});
// The per-IP limit is shared by every request from 127.0.0.1: start each test clean.
beforeEach(async () => {
  await prisma.nurseApplication.deleteMany();
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

it("stores a valid application without signing in and answers 202", async () => {
  const b = body();
  const r = await submit(b);
  assert.equal(r.status, 202, JSON.stringify(r.json));
  assert.equal(r.json.data.received, true);
  const row = await prisma.nurseApplication.findFirstOrThrow({ where: { phone: b.phone } });
  assert.equal(row.status, "NEW");
  assert.equal(row.licenseNo, "10387");
  assert.equal(row.experienceYears, 5);
  assert.equal(row.consentVersion, "NURSE_APPLICATION_V1");
  assert.notEqual(row.ipHash, "127.0.0.1", "the address is stored hashed");
});

it("rejects a missing declaration, a bad phone, and unknown fields", async () => {
  for (const bad of [
    body({ declarations: { ...DECL, scope: false } }),
    body({ declarations: { license: true, experience: true } }),
    body({ phone: "99112233" }),
    body({ name: "Б" }),
    body({ licenseNo: "" }),
    body({ experienceYears: -1 }),
    body({ experienceYears: 2.5 }),
    body({ extra: "x" }),
  ]) {
    const r = await submit(bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(errorCode(r), "VALIDATION_ERROR");
  }
  assert.equal(await prisma.nurseApplication.count(), 0);
});

it("a second request for the same phone creates nothing but answers the same", async () => {
  const b = body();
  assert.equal((await submit(b)).status, 202);
  assert.equal((await submit({ ...b, name: "Өөр нэр" })).status, 202);
  assert.equal(await prisma.nurseApplication.count({ where: { phone: b.phone } }), 1);
});

it("an existing account's phone gets the same answer and no row (no probing)", async () => {
  const p = phone();
  await prisma.user.update({ where: { id: (await createUser("NURSE")).id }, data: { phone: p } });
  const r = await submit(body({ phone: p }));
  assert.equal(r.status, 202);
  assert.equal(await prisma.nurseApplication.count({ where: { phone: p } }), 0);
});

it("limits a phone to two new applications a day once earlier ones are closed", async () => {
  const p = phone();
  for (let i = 0; i < MAX_PER_PHONE_PER_DAY; i++) {
    assert.equal((await submit(body({ phone: p }))).status, 202);
    await prisma.nurseApplication.updateMany({ where: { phone: p }, data: { status: "REJECTED" } });
  }
  // the loop's updateMany keeps only closed rows; deleteMany in beforeEach is not run between
  const r = await submit(body({ phone: p }));
  assert.equal(r.status, 429);
  assert.equal(errorCode(r), "APPLICATION_RATE_LIMIT");
});

it("limits one address to five applications an hour", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await submit(body())).status, 202);
  const r = await submit(body());
  assert.equal(r.status, 429);
  assert.equal(errorCode(r), "APPLICATION_RATE_LIMIT");
});

it("only an admin can list or triage applications", async () => {
  await submit(body());
  for (const token of [child, nurse]) {
    assert.equal((await api(srv.baseUrl, "GET", "/api/admin/nurse-applications", { token })).status, 403);
  }
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/nurse-applications")).status, 401);
  const list = await api(srv.baseUrl, "GET", "/api/admin/nurse-applications", { token: admin });
  assert.equal(list.status, 200);
  assert.equal(list.json.data.applications.length, 1);
  assert.equal(JSON.stringify(list.json).includes("ipHash"), false);
  const id = list.json.data.applications[0].id;
  const patch = await api(srv.baseUrl, "PATCH", `/api/admin/nurse-applications/${id}`, {
    token: admin,
    body: { status: "CONTACTED", note: "Утсаар холбогдсон" },
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.json.data.application.status, "CONTACTED");
  const only = await api(srv.baseUrl, "GET", "/api/admin/nurse-applications?status=NEW", { token: admin });
  assert.equal(only.json.data.applications.length, 0);
  assert.equal(
    errorCode(await api(srv.baseUrl, "PATCH", "/api/admin/nurse-applications/nope", { token: admin, body: { status: "NEW" } })),
    "APPLICATION_NOT_FOUND",
  );
  assert.equal((await api(srv.baseUrl, "PATCH", `/api/admin/nurse-applications/${id}`, { token: admin, body: {} })).status, 400);
});
