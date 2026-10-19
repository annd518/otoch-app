import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import {
  prisma,
  api,
  createUser,
  loginAs,
  startServer,
  type TestServer,
} from "./helpers";

let srv: TestServer;
let admin: string, medical: string, child: string;
let adminId: string, childId: string, parentId: string;
const PASSWORD = "Nurse-pass-2026";

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "users-admin"),
    m = await createUser("MEDICAL_ADMIN", "users-medical"),
    c = await createUser("CHILD", "users-child");
  [admin, medical, child] = await Promise.all(
    [a, m, c].map((u) => loginAs(srv.baseUrl, u.email)),
  );
  adminId = a.id;
  childId = c.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Хэрэглэгчийн өвчтөн",
        age: 60,
        gender: "Other",
        address: "Тест хаяг",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

const createStaff = (body: Record<string, unknown>, token = admin) =>
  api(srv.baseUrl, "POST", "/api/admin/staff", { token, body });
const patch = (id: string, body: Record<string, unknown>, token = admin) =>
  api(srv.baseUrl, "PATCH", `/api/admin/users/${id}`, { token, body });
const list = (query: string, token = admin) =>
  api(srv.baseUrl, "GET", `/api/admin/users?${query}`, { token });
const login = (email: string, password = PASSWORD) =>
  api(srv.baseUrl, "POST", "/api/auth/login", { body: { email, password } });

it("only an admin manages users (medical admin and customers get 403)", async () => {
  assert.equal((await list("group=staff", medical)).status, 403);
  assert.equal((await list("group=staff", child)).status, 403);
  assert.equal(
    (await createStaff({ name: "Х", email: "x@test.mn", role: "NURSE", password: PASSWORD }, medical)).status,
    403,
  );
  assert.equal((await list("group=staff")).status, 200);
});

it("admin creates a nurse who can log in; the password is never returned", async () => {
  const email = `Nurse.${Date.now()}@Test.mn`;
  const r = await createStaff({
    name: "Шинэ Сувилагч",
    email,
    phone: "+97699001122",
    role: "NURSE",
    password: PASSWORD,
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.data.user.role, "NURSE");
  assert.equal(r.json.data.user.email, email.toLowerCase());
  assert.doesNotMatch(JSON.stringify(r.json), /password|Nurse-pass/i);
  assert.equal((await login(email.toLowerCase())).status, 200);

  // duplicates and bad input
  assert.equal(
    (await createStaff({ name: "Давхар", email: email.toUpperCase(), role: "NURSE", password: PASSWORD })).json.error.code,
    "EMAIL_TAKEN",
  );
  assert.equal(
    (await createStaff({ name: "Утас", email: `p${Date.now()}@test.mn`, phone: "+97699001122", role: "NURSE", password: PASSWORD })).json.error.code,
    "PHONE_TAKEN",
  );
  for (const bad of [
    { password: "short" },
    { role: "CHILD" },
    { phone: "99001122" },
    { email: "not-an-email" },
  ])
    assert.equal(
      (await createStaff({ name: "Буруу", email: `b${Date.now()}@test.mn`, role: "NURSE", password: PASSWORD, ...bad })).status,
      400,
      JSON.stringify(bad),
    );

  const staff = await list(`group=staff&q=${encodeURIComponent("Шинэ Сувилагч")}`);
  const row = staff.json.data.users.find((u: { email: string }) => u.email === email.toLowerCase());
  assert.ok(row);
  assert.equal(row.active, true);
  assert.equal(row.activeVisits, 0);
  assert.doesNotMatch(JSON.stringify(staff.json), /\$2[aby]\$/, "no password hash");
});

it("customers are listed read-only with their order count", async () => {
  await prisma.order.create({
    data: { childId, parentId, catalogVersion: "TEST", status: "COMPLETED", redFlagStatus: "CLEAR" },
  });
  const r = await list("group=customers");
  const me = r.json.data.users.find((u: { id: string }) => u.id === childId);
  assert.equal(me.role, "CHILD");
  assert.equal(me.orders, 1);
  assert.equal((await patch(childId, { active: false })).json.error.code, "CUSTOMER_NOT_MANAGED");
  assert.equal(
    (await api(srv.baseUrl, "POST", `/api/admin/users/${childId}/password`, { token: admin, body: { password: PASSWORD } })).json.error.code,
    "CUSTOMER_NOT_MANAGED",
  );
});

it("deactivating a nurse: refused while she has visits, then she can neither log in nor use her old token", async () => {
  const nurse = await createUser("NURSE", "users-nurse");
  await prisma.user.update({ where: { id: nurse.id }, data: { password: await import("bcryptjs").then((b) => b.default.hash(PASSWORD, 4)) } });
  const nurseToken = await loginAs(srv.baseUrl, nurse.email, PASSWORD);
  assert.equal((await api(srv.baseUrl, "GET", "/api/visits/nurse", { token: nurseToken })).status, 200);

  const order = await prisma.order.create({
    data: { childId, parentId, catalogVersion: "TEST", status: "ASSIGNED", redFlagStatus: "CLEAR", assignedNurseId: nurse.id },
  });
  const busy = await patch(nurse.id, { active: false });
  assert.equal(busy.status, 409);
  assert.equal(busy.json.error.code, "NURSE_HAS_ACTIVE_ORDERS");
  assert.equal((await patch(nurse.id, { role: "ADMIN" })).json.error.code, "NURSE_HAS_ACTIVE_ORDERS");

  await prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
  const off = await patch(nurse.id, { active: false });
  assert.equal(off.status, 200, JSON.stringify(off.json));
  assert.equal(off.json.data.user.active, false);

  const relogin = await login(nurse.email);
  assert.equal(relogin.status, 401);
  assert.equal(relogin.json.error.code, "INVALID_CREDENTIALS");
  const old = await api(srv.baseUrl, "GET", "/api/visits/nurse", { token: nurseToken });
  assert.equal(old.status, 401);
  assert.equal(old.json.error.code, "ACCOUNT_DISABLED");
  assert.equal((await api(srv.baseUrl, "GET", "/api/staff/orders", { token: nurseToken })).status, 403);

  const inactive = await list("group=inactive");
  assert.ok(inactive.json.data.users.some((u: { id: string; active: boolean }) => u.id === nurse.id && !u.active));

  assert.equal((await patch(nurse.id, { active: true })).status, 200);
  assert.equal((await login(nurse.email)).status, 200);
});

it("a role change applies to an existing token at once", async () => {
  const nurse = await createUser("NURSE", "users-promote");
  const token = await loginAs(srv.baseUrl, nurse.email);
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/summary", { token })).status, 403);
  const r = await patch(nurse.id, { role: "ADMIN" });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.user.role, "ADMIN");
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/summary", { token })).status, 200);
  assert.equal((await api(srv.baseUrl, "GET", "/api/visits/nurse", { token })).status, 403);
});

it("super-admin only: MEDICAL_ADMIN cannot be given, a leftover one has no access and can be converted", async () => {
  assert.equal(
    (await createStaff({ name: "Эмнэлгийн", email: `m${Date.now()}@test.mn`, role: "MEDICAL_ADMIN", password: PASSWORD })).status,
    400,
  );
  const legacy = await createUser("MEDICAL_ADMIN", "users-legacy");
  const token = await loginAs(srv.baseUrl, legacy.email);
  for (const path of ["/api/admin/summary", "/api/admin/users", "/api/staff/orders", "/api/review/visits/review"])
    assert.equal((await api(srv.baseUrl, "GET", path, { token })).status, 403, path);
  assert.equal((await patch(legacy.id, { role: "MEDICAL_ADMIN" })).status, 400);
  // listed with staff so it can be dealt with
  const staff = await list(`group=staff&q=${encodeURIComponent("users-legacy")}`);
  assert.ok(staff.json.data.users.some((u: { id: string }) => u.id === legacy.id));
  assert.equal((await patch(legacy.id, { active: false })).status, 200);
  assert.equal((await patch(legacy.id, { active: true })).json.error.code, "CONFLICT");
  const converted = await patch(legacy.id, { active: true, role: "NURSE" });
  assert.equal(converted.status, 200, JSON.stringify(converted.json));
  assert.equal(converted.json.data.user.role, "NURSE");
  assert.equal(converted.json.data.user.active, true);
});

it("an admin cannot change their own account; bad requests are refused", async () => {
  assert.equal((await patch(adminId, { active: false })).json.error.code, "SELF_CHANGE");
  assert.equal((await patch(adminId, { role: "NURSE" })).json.error.code, "SELF_CHANGE");
  const nurse = await createUser("NURSE", "users-bad");
  assert.equal((await patch(nurse.id, {})).status, 400);
  assert.equal((await patch(nurse.id, { role: "CHILD" })).status, 400);
  assert.equal((await patch(nurse.id, { deletedAt: null })).status, 400);
  assert.equal((await patch("no-such-user", { active: false })).status, 404);
});

it("admin sets a new password for a staff member", async () => {
  const nurse = await createUser("NURSE", "users-reset");
  const r = await api(srv.baseUrl, "POST", `/api/admin/users/${nurse.id}/password`, {
    token: admin,
    body: { password: "Brand-new-pass-1" },
  });
  assert.equal(r.status, 200);
  assert.equal((await login(nurse.email, "Brand-new-pass-1")).status, 200);
  assert.equal(
    (await api(srv.baseUrl, "POST", `/api/admin/users/${nurse.id}/password`, { token: admin, body: { password: "short" } })).status,
    400,
  );
});
