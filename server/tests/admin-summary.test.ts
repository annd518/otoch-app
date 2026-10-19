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
import { ulaanbaatarDayStart, ulaanbaatarMonthStart } from "../src/routes/admin";

let srv: TestServer;
let admin: string, medical: string, nurse: string, child: string;
let adminId: string, childId: string, parentId: string;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN"),
    m = await createUser("MEDICAL_ADMIN"),
    n = await createUser("NURSE"),
    c = await createUser("CHILD");
  [admin, medical, nurse, child] = await Promise.all(
    [a, m, n, c].map((u) => loginAs(srv.baseUrl, u.email)),
  );
  adminId = a.id;
  childId = c.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Самбарын өвчтөн",
        age: 70,
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

const summary = async (token: string) =>
  api(srv.baseUrl, "GET", "/api/admin/summary", { token });

it("Ulaanbaatar day and month start, also just before midnight", () => {
  assert.equal(
    ulaanbaatarDayStart(new Date("2026-10-19T23:30:00+08:00")).toISOString(),
    "2026-10-18T16:00:00.000Z",
  );
  assert.equal(
    ulaanbaatarDayStart(new Date("2026-10-19T00:10:00+08:00")).toISOString(),
    "2026-10-18T16:00:00.000Z",
  );
  assert.equal(
    ulaanbaatarMonthStart(new Date("2026-11-01T03:00:00+08:00")).toISOString(),
    "2026-10-31T16:00:00.000Z",
  );
});

it("only admins and medical admins can read it; the role comes from the database", async () => {
  assert.equal((await summary(child)).status, 403);
  assert.equal((await summary(nurse)).status, 403);
  assert.equal((await summary(medical)).status, 200);
  assert.equal((await summary(admin)).status, 200);
  assert.equal(
    (await api(srv.baseUrl, "GET", "/api/admin/summary", {})).status,
    401,
  );
  // still holding a valid token, but deactivated
  const gone = await createUser("ADMIN", "gone-admin");
  const token = await loginAs(srv.baseUrl, gone.email);
  await prisma.user.update({
    where: { id: gone.id },
    data: { deletedAt: new Date() },
  });
  assert.equal((await summary(token)).status, 403);
});

it("counts today's and unassigned orders, real vs mock money and payments to reconcile", async () => {
  const before = (await summary(admin)).json.data;
  const now = new Date();
  const order = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "TEST",
      status: "PAID",
      redFlagStatus: "CLEAR",
      scheduledFor: now,
    },
  });
  const quote = await prisma.quote.create({
    data: {
      orderId: order.id,
      orderVersion: 1,
      catalogVersion: "TEST",
      pricingVersion: "TEST",
      lines: [],
      subtotalMnt: 30000,
      totalMnt: 30000,
      isFixture: true,
      expiresAt: new Date(now.getTime() + 600000),
    },
  });
  const pay = (key: string, mode: string, amountMnt: number, extra = {}) =>
    prisma.payment.create({
      data: {
        orderId: order.id,
        quoteId: quote.id,
        userId: childId,
        mode,
        idempotencyKey: key,
        amountMnt,
        expiresAt: new Date(now.getTime() + 600000),
        ...extra,
      },
    });
  await pay("summary-real-0001", "sandbox", 30000, {
    status: "PAID",
    paidAt: now,
  });
  await pay("summary-mock-0001", "mock", 25000, {
    status: "PAID",
    paidAt: now,
  });
  await pay("summary-reco-0001", "sandbox", 30000, {
    status: "EXPIRED",
    failureCode: "NEEDS_RECONCILIATION",
  });

  const r = await summary(admin);
  assert.equal(r.status, 200);
  const after = r.json.data;
  assert.equal(after.orders.today - before.orders.today, 1);
  assert.equal(after.orders.unassignedPaid - before.orders.unassignedPaid, 1);
  assert.equal(
    (after.orders.byStatus.PAID ?? 0) - (before.orders.byStatus.PAID ?? 0),
    1,
  );
  assert.equal(
    after.payments.today.amountMnt - before.payments.today.amountMnt,
    30000,
    "mock money is not revenue",
  );
  assert.equal(
    after.payments.today.mockAmountMnt - before.payments.today.mockAmountMnt,
    25000,
  );
  assert.equal(
    after.payments.month.amountMnt - before.payments.month.amountMnt,
    30000,
  );
  assert.equal(
    after.payments.needsReconciliation - before.payments.needsReconciliation,
    1,
  );
  const mine = after.attention.filter(
    (a: { orderId: string }) => a.orderId === order.id,
  );
  assert.deepEqual(
    mine.map((a: { kind: string }) => a.kind).sort(),
    ["RECONCILIATION", "UNASSIGNED"],
  );
  assert.equal(
    mine.find((a: { kind: string }) => a.kind === "UNASSIGNED").urgent,
    true,
  );
  assert.ok(
    after.recentOrders.some(
      (o: { id: string; patientName: string }) =>
        o.id === order.id && o.patientName === "Самбарын өвчтөн",
    ),
  );
  assert.ok(after.users.admins >= 1 && after.users.patients >= 1);
  // no personal contact data in the summary
  assert.doesNotMatch(JSON.stringify(after), /99112233|@/);
  assert.ok(adminId);
});

it("visits on the way or with an incident still count as today's work; refused ones do not", async () => {
  const before = (await summary(admin)).json.data;
  for (const status of ["EN_ROUTE", "INCIDENT", "REFUSED"] as const)
    await prisma.order.create({
      data: { childId, parentId, catalogVersion: "TEST", status, redFlagStatus: "CLEAR", scheduledFor: new Date() },
    });
  const after = (await summary(admin)).json.data;
  assert.equal(after.orders.today - before.orders.today, 2);
  assert.equal(after.orders.byStatus.REFUSED - (before.orders.byStatus.REFUSED ?? 0), 1);
});
