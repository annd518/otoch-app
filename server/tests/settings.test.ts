import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { runDispatchCycle } from "../src/services/dispatch";
import { DEFAULT_SETTINGS } from "../src/services/settings";

// Admin settings and catalog prices (spec A-08, slide 103).
let srv: TestServer;
let admin: string, child: string, nurse: string;
let childId: string, parentId: string, nurseId: string;
const HOUR = 3600000;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "st-admin"),
    c = await createUser("CHILD", "st-child"),
    n = await createUser("NURSE", "st-nurse");
  [admin, child, nurse] = await Promise.all([a, c, n].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Тохиргоо өвчтөн",
        age: 70,
        gender: "Other",
        address: "Тест",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
});
after(async () => {
  // the database is shared with the other test files: back to the spec values
  await api(srv.baseUrl, "PUT", "/api/admin/settings", { token: admin, body: { values: DEFAULT_SETTINGS } });
  await srv.close();
  await prisma.$disconnect();
});

const put = (values: Record<string, number>, token = admin) =>
  api(srv.baseUrl, "PUT", "/api/admin/settings", { token, body: { values } });

async function paidOrder(status: string, hoursAhead: number, paidMnt = 30000, nurse: string | null = null) {
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: status as never,
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() + hoursAhead * HOUR),
      assignedNurseId: nurse,
    },
  });
  const q = await prisma.quote.create({
    data: {
      orderId: o.id,
      orderVersion: 1,
      catalogVersion: "T",
      pricingVersion: "T",
      lines: [],
      subtotalMnt: paidMnt,
      totalMnt: paidMnt,
      isFixture: true,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  await prisma.payment.create({
    data: {
      orderId: o.id,
      quoteId: q.id,
      userId: childId,
      mode: "mock",
      idempotencyKey: `st-${o.id}`,
      amountMnt: paidMnt,
      status: "PAID",
      paidAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  return o;
}

it("the admin sees the spec defaults and can change them within limits; every change is audited", async () => {
  const r = await api(srv.baseUrl, "GET", "/api/admin/settings", { token: admin });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const commission = r.json.data.settings.find((s: { key: string }) => s.key === "commissionPct");
  assert.equal(commission.value, 30);
  assert.equal(commission.default, 30);

  assert.equal((await put({ commissionPct: 101 })).status, 400);
  assert.equal((await put({ nope: 1 })).status, 400);
  assert.equal((await put({ commissionPct: 25 }, child)).status, 403);
  assert.equal((await put({ commissionPct: 25 }, nurse)).status, 403);

  const ok = await put({ commissionPct: 25, waveSize: 3 });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  // waveSize did not change: only commissionPct is recorded
  assert.deepEqual(ok.json.data.changed, ["commissionPct"]);
  const log = await prisma.auditLog.findMany({ where: { entity: "setting", entityId: "commissionPct" } });
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].before, { value: 30 });
  assert.deepEqual(log[0].after, { value: 25 });
  const again = await api(srv.baseUrl, "GET", "/api/admin/settings", { token: admin });
  assert.equal(again.json.data.audit[0].entityId, "commissionPct");
});

it("the commission setting decides the nurse's share of a finished visit", async () => {
  await put({ commissionPct: 25 });
  await prisma.nurseProfile.upsert({
    where: { userId: nurseId },
    create: { userId: nurseId, status: "VERIFIED", licenseExpiresAt: new Date(Date.now() + 365 * 86400000), skillTags: [], zoneIds: [] },
    update: {},
  });
  const o = await paidOrder("IN_PROGRESS", -1, 40000, nurseId);
  const r = await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/complete`, { token: nurse, body: { version: o.version } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const e = await prisma.payoutEntry.findUniqueOrThrow({ where: { orderId: o.id } });
  assert.equal(e.netMnt, 30000);
  assert.equal(e.commissionPct, 25);
  const earnings = await api(srv.baseUrl, "GET", "/api/nurse/earnings", { token: nurse });
  assert.equal(earnings.json.data.sharePercent, 75);
  await put({ commissionPct: 30 });
});

it("cancellation terms follow the settings", async () => {
  await put({ cancelFreeHours: 6, cancelFeePct: 40 });
  const o = await paidOrder("ASSIGNED", 4, 30000, nurseId);
  const t = await api(srv.baseUrl, "GET", `/api/orders/${o.id}/cancellation`, { token: child });
  assert.equal(t.json.data.terms.rule, "LATE");
  assert.equal(t.json.data.terms.refundPercent, 60);
  assert.equal(t.json.data.terms.refundMnt, 18000);
  assert.deepEqual(t.json.data.policy, { freeHoursBefore: 6, lateRefundPercent: 60 });
  await put({ cancelFreeHours: 2, cancelFeePct: 30 });
  const t2 = await api(srv.baseUrl, "GET", `/api/orders/${o.id}/cancellation`, { token: child });
  assert.equal(t2.json.data.terms.rule, "EARLY");
});

it("dispatch uses the wave size and answer time settings", async () => {
  await prisma.nurseProfile.updateMany({ data: { isActive: false } });
  await prisma.order.updateMany({ where: { status: "PAID", assignedNurseId: null }, data: { status: "CANCELLED" } });
  const ids: string[] = [];
  for (const tag of ["st-a", "st-b", "st-c"]) {
    const u = await createUser("NURSE", tag);
    await prisma.nurseProfile.create({
      data: { userId: u.id, status: "VERIFIED", isActive: true, licenseExpiresAt: new Date(Date.now() + 365 * 86400000), skillTags: [], zoneIds: [] },
    });
    ids.push(u.id);
  }
  await put({ waveSize: 1, offerTtlSec: 60 });
  const o = await paidOrder("PAID", 5);
  const now = new Date();
  await runDispatchCycle(prisma, now);
  const offers = await prisma.orderOffer.findMany({ where: { orderId: o.id } });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].expiresAt.getTime() - now.getTime(), 60_000);
  await put({ waveSize: 3, offerTtlSec: 120 });
  await prisma.nurseProfile.updateMany({ where: { userId: { in: ids } }, data: { isActive: false } });
});

it("the admin changes a price, switches a service off and on; a stale edit is refused", async () => {
  const svc = await prisma.serviceCatalogItem.upsert({
    where: { code: "SETTINGS-T" },
    update: { priceMnt: 1000, isActive: false },
    create: { code: "SETTINGS-T", name: "Тохиргооны тест", category: "TEST", priceMnt: 1000, durationMin: 30, isFixture: true, isActive: false },
  });
  const list = await api(srv.baseUrl, "GET", "/api/admin/catalog", { token: admin });
  const row = list.json.data.services.find((s: { code: string }) => s.code === "SETTINGS-T");
  assert.equal(row.priceMnt, 1000);
  assert.equal(row.isFixture, true);

  const patch = (body: Record<string, unknown>) =>
    api(srv.baseUrl, "PATCH", `/api/admin/catalog/${svc.id}`, { token: admin, body });
  assert.equal((await patch({ priceMnt: -5, updatedAt: row.updatedAt })).status, 400);
  assert.equal((await patch({ name: "Өөр нэр", updatedAt: row.updatedAt })).status, 400);
  const r = await patch({ priceMnt: 45000, updatedAt: row.updatedAt });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.service.priceMnt, 45000);
  // a second admin still holding the old row
  const stale = await patch({ priceMnt: 50000, updatedAt: row.updatedAt });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error.code, "VERSION_CONFLICT");
  const log = await prisma.auditLog.findFirstOrThrow({ where: { entity: "service", entityId: "SETTINGS-T" } });
  assert.deepEqual(log.before, { priceMnt: 1000, isActive: false, sortOrder: 0 });
  assert.deepEqual(log.after, { priceMnt: 45000, isActive: false, sortOrder: 0 });

  // switched on, the public catalog shows the new price; then off again
  const on = await patch({ isActive: true, updatedAt: r.json.data.service.updatedAt });
  assert.equal(on.status, 200);
  const pub = await api(srv.baseUrl, "GET", "/api/catalog/services", { token: child });
  assert.equal(pub.json.data.services.find((s: { code: string }) => s.code === "SETTINGS-T").priceMnt, 45000);
  await patch({ isActive: false, updatedAt: on.json.data.service.updatedAt });
  assert.equal(
    (await api(srv.baseUrl, "GET", "/api/catalog/services", { token: child })).json.data.services.some((s: { code: string }) => s.code === "SETTINGS-T"),
    false,
  );
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/catalog", { token: nurse })).status, 403);
});
