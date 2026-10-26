import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { pushOutbox } from "../src/services/push";
import { earningsRange, splitEarning } from "../src/services/payouts";

// Nurse earnings and admin-recorded payouts (spec slides 83, 98).
let srv: TestServer;
let admin: string, child: string, nurse: string, otherNurse: string;
let childId: string, parentId: string, nurseId: string;
let serviceId: string;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "po-admin"),
    c = await createUser("CHILD", "po-child"),
    n = await createUser("NURSE", "po-nurse"),
    n2 = await createUser("NURSE", "po-nurse2");
  [admin, child, nurse, otherNurse] = await Promise.all([a, c, n, n2].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Орлого өвчтөн",
        age: 70,
        gender: "Other",
        address: "Тест",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  for (const id of [n.id, n2.id])
    await prisma.nurseProfile.create({
      data: { userId: id, status: "VERIFIED", licenseExpiresAt: new Date(Date.now() + 365 * 86400000), skillTags: [], zoneIds: [] },
    });
  serviceId = (
    await prisma.serviceCatalogItem.upsert({
      where: { code: "PAYOUT-T" },
      update: {},
      create: { code: "PAYOUT-T", name: "Тарилга", category: "TEST", priceMnt: 1, durationMin: 30, isFixture: true, isActive: false },
    })
  ).id;
  await api(srv.baseUrl, "POST", "/api/push/devices", {
    token: nurse,
    body: { token: "ExponentPushToken[payout-nurse-xxxxxxxxx]", app: "nurse", platform: "ios" },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
beforeEach(() => {
  pushOutbox.length = 0;
});

/** A visit in progress, paid `paidMnt`, assigned to the nurse. */
async function inProgress(paidMnt: number, assignee = nurseId) {
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: "IN_PROGRESS",
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() - 3600000),
      assignedNurseId: assignee,
      items: { create: [{ serviceId, serviceCode: "PAYOUT-T" }] },
    },
  });
  if (paidMnt > 0) {
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
        idempotencyKey: `po-${o.id}`,
        amountMnt: paidMnt,
        status: "PAID",
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      },
    });
  }
  return o;
}

/** The assigned nurse completes a visit without a record (POST /api/staff/orders/:id/complete). */
const complete = (o: { id: string; version: number }) =>
  api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/complete`, { token: nurse, body: { version: o.version } });

it("splits a price into the nurse's 70% and the 30% commission, in whole tögrög", () => {
  assert.deepEqual(splitEarning(35000), { grossMnt: 35000, netMnt: 24500, commissionMnt: 10500, commissionPct: 30 });
  assert.deepEqual(splitEarning(25001), { grossMnt: 25001, netMnt: 17500, commissionMnt: 7501, commissionPct: 30 });
});

it("weeks start on Monday and months on the 1st, in Ulaanbaatar time", () => {
  // Wednesday 2026-10-28 01:00 in Ulaanbaatar = 2026-10-27 17:00 UTC
  const now = new Date("2026-10-27T17:00:00Z");
  const w = earningsRange("week", 0, now);
  assert.equal(w.days[0], "2026-10-26");
  assert.equal(w.days.length, 7);
  assert.equal(w.from.toISOString(), "2026-10-25T16:00:00.000Z");
  assert.equal(earningsRange("week", 1, now).days[0], "2026-10-19");
  const m = earningsRange("month", 1, now);
  assert.equal(m.days[0], "2026-09-01");
  assert.equal(m.days.length, 30);
});

it("a finished visit earns once; the nurse sees the week, the admin pays it out", async () => {
  const a = await inProgress(35000);
  const b = await inProgress(25000);
  const free = await inProgress(0); // nothing was paid: nothing to earn
  for (const o of [a, b, free]) assert.equal((await complete(o)).status, 200);
  assert.equal(await prisma.payoutEntry.count({ where: { orderId: free.id } }), 0);
  const entry = await prisma.payoutEntry.findUniqueOrThrow({ where: { orderId: a.id } });
  assert.equal(entry.netMnt, 24500);
  assert.equal(entry.commissionMnt, 10500);

  const week = await api(srv.baseUrl, "GET", "/api/nurse/earnings?range=week", { token: nurse });
  assert.equal(week.status, 200, JSON.stringify(week.json));
  const d = week.json.data;
  assert.equal(d.totals.netMnt, 24500 + 17500);
  assert.equal(d.totals.visits, 2);
  assert.equal(d.days.length, 7);
  assert.equal(d.days.reduce((s: number, x: { netMnt: number }) => s + x.netMnt, 0), 42000);
  assert.deepEqual(d.unpaid, { netMnt: 42000, visits: 2 });
  assert.deepEqual(d.entries[0].services, ["Тарилга"]);
  assert.equal(d.bank, null);
  // another nurse sees none of it
  const other = await api(srv.baseUrl, "GET", "/api/nurse/earnings", { token: otherNurse });
  assert.equal(other.json.data.totals.visits, 0);
  assert.equal((await api(srv.baseUrl, "GET", "/api/nurse/earnings?range=year", { token: nurse })).status, 400);

  // the admin sees what is owed
  const due = await api(srv.baseUrl, "GET", "/api/admin/payouts/due", { token: admin });
  const row = due.json.data.nurses.find((n: { nurseId: string }) => n.nurseId === nurseId);
  assert.equal(row.netMnt, 42000);
  assert.equal(row.visits, 2);
  const pay = (body: Record<string, unknown>) =>
    api(srv.baseUrl, "POST", "/api/admin/payouts", {
      token: admin,
      body: { nurseId, expectedNetMnt: 42000, expectedVisits: 2, reference: "ХААН 123456", ...body },
    });
  // no bank account yet
  assert.equal((await pay({})).json.error.code, "BANK_ACCOUNT_MISSING");

  // the nurse adds an account (IBAN with spaces is accepted)
  assert.equal((await api(srv.baseUrl, "PUT", "/api/nurse/bank", { token: nurse, body: { bankName: "Хаан банк", accountNo: "12", accountName: "Б.Номин" } })).status, 400);
  assert.equal((await api(srv.baseUrl, "PUT", "/api/nurse/bank", { token: nurse, body: { bankName: "Сайн банк", accountNo: "5000123456", accountName: "Б.Номин" } })).status, 400);
  const bank = await api(srv.baseUrl, "PUT", "/api/nurse/bank", {
    token: nurse,
    body: { bankName: "Хаан банк", accountNo: "mn12 0005 00 5000123456", accountName: "Б.Номин" },
  });
  assert.equal(bank.status, 200, JSON.stringify(bank.json));
  assert.equal(bank.json.data.bank.accountNo, "MN120005005000123456");
  // the change is in the history (last digits only) and flagged to the admin
  const ev = await prisma.nurseReviewEvent.findFirstOrThrow({ where: { nurseId, action: "BANK_UPDATED" } });
  assert.equal(ev.note, "Хаан банк ···3456");
  const due2 = await api(srv.baseUrl, "GET", "/api/admin/payouts/due", { token: admin });
  assert.ok(due2.json.data.nurses.find((n: { nurseId: string }) => n.nurseId === nurseId).bankChangedAt);

  // a new visit finished after the admin looked: the amount no longer matches
  const c = await inProgress(30000);
  await complete(c);
  assert.equal((await pay({})).json.error.code, "PAYOUT_CHANGED");
  const r = await pay({ expectedNetMnt: 63000, expectedVisits: 3 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.payout.totalMnt, 63000);
  assert.equal(await prisma.payoutEntry.count({ where: { nurseId, payoutId: null } }), 0);
  assert.equal((await pay({ expectedNetMnt: 63000, expectedVisits: 3 })).json.error.code, "NOTHING_TO_PAY");
  for (let i = 0; i < 50 && !pushOutbox.some((m) => m.message.data.type === "EARNINGS"); i++)
    await new Promise((res) => setTimeout(res, 20));
  assert.equal(pushOutbox.find((m) => m.message.data.type === "EARNINGS")?.message.body, "63,000₮ таны дансанд шилжүүлэгдлээ.");

  // both sides see the transfer
  const after = await api(srv.baseUrl, "GET", "/api/nurse/earnings", { token: nurse });
  assert.deepEqual(after.json.data.unpaid, { netMnt: 0, visits: 0 });
  assert.equal(after.json.data.payouts[0].totalMnt, 63000);
  assert.ok(after.json.data.entries.every((e: { paidAt: string | null }) => e.paidAt));
  const detail = await api(srv.baseUrl, "GET", `/api/admin/payouts/${r.json.data.payout.id}`, { token: admin });
  assert.equal(detail.json.data.entries.length, 3);
  assert.equal(detail.json.data.entries[0].commissionPct, 30);
  // only admins
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/payouts/due", { token: nurse })).status, 403);
});

it("the nurse app's own finish writes the earning too", async () => {
  const o = await inProgress(40000, nurseId);
  await prisma.visitRecord.create({
    data: { orderId: o.id, nurseId, vitals: { pulse: 70 }, procedures: ["INJ"], checkinAt: new Date() },
  });
  const r = await api(srv.baseUrl, "POST", `/api/nurse/orders/${o.id}/finish`, {
    token: nurse,
    body: { version: o.version, signerName: "Ч.Бат", signature: "data:image/png;base64,iVBORw0KGgo=" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await prisma.payoutEntry.findUniqueOrThrow({ where: { orderId: o.id } })).netMnt, 28000);
});
