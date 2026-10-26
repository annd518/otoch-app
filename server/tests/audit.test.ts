import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";

// Back-office audit trail and the audit log page (spec A-11, slide 109).
let srv: TestServer;
let admin: string, nurse: string;
let adminId: string, nurseId: string, childId: string, parentId: string;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "au-admin"),
    n = await createUser("NURSE", "au-nurse"),
    c = await createUser("CHILD", "au-child");
  [admin, nurse] = await Promise.all([a, n].map((u) => loginAs(srv.baseUrl, u.email)));
  adminId = a.id;
  nurseId = n.id;
  childId = c.id;
  parentId = (
    await prisma.parent.create({
      data: { name: "Аудит өвчтөн", age: 70, gender: "Other", address: "Тест", emergencyContact: "99112233", children: { connect: { id: c.id } } },
    })
  ).id;
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

const log = (q = "") => api(srv.baseUrl, "GET", `/api/admin/audit${q}`, { token: admin });

it("staff changes are audited without the password", async () => {
  const created = await api(srv.baseUrl, "POST", "/api/admin/staff", {
    token: admin,
    body: { name: "Шинэ ажилтан", email: `au-staff-${Date.now()}@example.invalid`, role: "NURSE", password: "Secret-Pass-123" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const id = created.json.data.user.id;
  await api(srv.baseUrl, "POST", `/api/admin/users/${id}/password`, { token: admin, body: { password: "Other-Pass-456" } });
  await api(srv.baseUrl, "PATCH", `/api/admin/users/${id}`, { token: admin, body: { active: false } });

  const r = await log(`?entity=user&entityId=${id}`);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const actions = r.json.data.entries.map((e: { action: string }) => e.action);
  assert.deepEqual(actions, ["STAFF_UPDATED", "STAFF_PASSWORD_SET", "STAFF_CREATED"]);
  const e = r.json.data.entries[0];
  assert.equal(e.actorId, adminId);
  assert.equal(e.actionLabel, "Ажилтны эрх, төлөв өөрчилсөн");
  assert.deepEqual(e.before, { role: "NURSE", active: true });
  assert.deepEqual(e.after, { role: "NURSE", active: false });
  assert.equal(JSON.stringify(r.json).includes("Pass"), false);
});

it("manual assignment and a cancellation by staff are audited", async () => {
  await prisma.nurseProfile.upsert({
    where: { userId: nurseId },
    create: { userId: nurseId, status: "VERIFIED", licenseExpiresAt: new Date(Date.now() + 365 * 86400000), skillTags: [], zoneIds: [] },
    update: {},
  });
  const o = await prisma.order.create({
    data: { childId, parentId, catalogVersion: "T", status: "PAID", redFlagStatus: "CLEAR", scheduledFor: new Date(Date.now() + 5 * 3600000) },
  });
  const a = await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, { token: admin, body: { version: o.version, nurseId } });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  const c = await api(srv.baseUrl, "POST", `/api/admin/orders/${o.id}/cancel`, {
    token: admin,
    body: { reason: "Үйлчлүүлэгч утсаар цуцлуулсан", refundPercent: 100 },
  });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  const r = await log(`?entity=order&entityId=${o.id}`);
  const [cancel, assign] = r.json.data.entries;
  assert.equal(assign.action, "ORDER_ASSIGNED");
  assert.deepEqual(assign.after, { status: "ASSIGNED", nurseId });
  assert.equal(cancel.action, "ORDER_CANCELLED");
  assert.equal(cancel.after.refundPercent, 100);
});

it("looking at a nurse's documents is audited; the log is admin only and pages", async () => {
  await api(srv.baseUrl, "GET", `/api/admin/nurses/${nurseId}/documents/LICENSE`, { token: admin });
  const r = await log(`?action=NURSE_DOCUMENT_VIEWED`);
  assert.ok(r.json.data.entries.some((e: { entityId: string; after: { kind: string } }) => e.entityId === nurseId && e.after.kind === "LICENSE"));
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/audit", { token: nurse })).status, 403);
  assert.equal((await log("?entity=nope")).status, 400);

  for (let i = 0; i < 55; i++)
    await prisma.auditLog.create({ data: { actorId: adminId, action: "SETTING_UPDATED", entity: "setting", entityId: `page-${i}` } });
  const p1 = await log("?entity=setting");
  assert.equal(p1.json.data.entries.length, 50);
  assert.ok(p1.json.data.nextCursor);
  const p2 = await log(`?entity=setting&cursor=${p1.json.data.nextCursor}`);
  assert.ok(p2.json.data.entries.length >= 5);
  const ids = new Set([...p1.json.data.entries, ...p2.json.data.entries].map((e: { id: string }) => e.id));
  assert.equal(ids.size, p1.json.data.entries.length + p2.json.data.entries.length);
});
