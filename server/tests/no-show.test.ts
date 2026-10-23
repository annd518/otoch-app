import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { getQPayAdapter, qpayMock } from "../src/services/qpay";
import { pushOutbox } from "../src/services/push";
import { runDispatchCycle } from "../src/services/dispatch";
import { runUnassignedSweep } from "../src/services/unassignedSweep";

// Spec slide 25, the remaining rows: nurse withdraws (REASSIGNING), customer
// no-show, and the system handling paid orders nobody took.
let srv: TestServer;
let admin: string, child: string, nurseA: string, nurseB: string;
let childId: string, parentId: string, nurseAId: string, nurseBId: string;
const HOUR = 3600000;
const AT = { lat: 47.918, lng: 106.917 };

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "ns-admin"),
    c = await createUser("CHILD", "ns-child"),
    na = await createUser("NURSE", "ns-nurse-a"),
    nb = await createUser("NURSE", "ns-nurse-b");
  [admin, child, nurseA, nurseB] = await Promise.all([a, c, na, nb].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseAId = na.id;
  nurseBId = nb.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "No-show өвчтөн",
        age: 70,
        gender: "Other",
        address: "Тест",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  await api(srv.baseUrl, "POST", "/api/push/devices", {
    token: child,
    body: { token: "ExponentPushToken[noshow-client-xxxxxxxxx]", app: "client", platform: "ios" },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  pushOutbox.length = 0;
  // only this file's orders are open
  await prisma.order.updateMany({ where: { status: "PAID", assignedNurseId: null }, data: { status: "CANCELLED" } });
  await prisma.nurseProfile.updateMany({ data: { isActive: false } });
});

async function order(status: string, opts: { hoursAhead: number; nurseId?: string; paidMinutesAgo?: number }) {
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: status as never,
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() + opts.hoursAhead * HOUR),
      ...AT,
      ...(opts.nurseId && { assignedNurseId: opts.nurseId }),
    },
  });
  const quote = await prisma.quote.create({
    data: {
      orderId: o.id,
      orderVersion: 1,
      catalogVersion: "T",
      pricingVersion: "T",
      lines: [],
      subtotalMnt: 30000,
      totalMnt: 30000,
      isFixture: true,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  const qpay = getQPayAdapter();
  const inv = await qpay.createInvoice({ senderInvoiceNo: o.id, amountMnt: 30000, description: "t", callbackUrl: "http://x" });
  qpayMock.markPaid(inv.invoiceId);
  await prisma.payment.create({
    data: {
      orderId: o.id,
      quoteId: quote.id,
      userId: childId,
      mode: "mock",
      idempotencyKey: `ns-${o.id}`,
      amountMnt: 30000,
      status: "PAID",
      paidAt: new Date(Date.now() - (opts.paidMinutesAgo ?? 1) * 60000),
      providerInvoiceId: inv.invoiceId,
      providerPaymentId: (await qpay.checkInvoice(inv.invoiceId)).paymentId,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  return o;
}

async function verified(userId: string) {
  await prisma.nurseProfile.upsert({
    where: { userId },
    create: {
      userId,
      status: "VERIFIED",
      isActive: true,
      licenseExpiresAt: new Date(Date.now() + 365 * 86400000),
      skillTags: [],
      zoneIds: [],
    },
    update: { status: "VERIFIED", isActive: true },
  });
}

const nurseCall = (token: string, id: string, action: string, body: unknown) =>
  api(srv.baseUrl, "POST", `/api/nurse/orders/${id}/${action}`, { token, body });

const waitPush = async (pred: (m: (typeof pushOutbox)[number]) => boolean) => {
  for (let i = 0; i < 100 && !pushOutbox.some(pred); i++) await new Promise((r) => setTimeout(r, 20));
  return pushOutbox.find(pred);
};

it("a nurse who withdraws sends the call back to dispatch and is not asked again", async () => {
  await verified(nurseAId);
  await verified(nurseBId);
  const o = await order("ASSIGNED", { hoursAhead: 5, nurseId: nurseAId });

  assert.equal((await nurseCall(nurseA, o.id, "release", { version: o.version, reason: "x" })).status, 400);
  assert.equal((await nurseCall(nurseB, o.id, "release", { version: o.version, reason: "Өвчтэй байна" })).status, 404);
  const r = await nurseCall(nurseA, o.id, "release", { version: o.version, reason: "Гэнэт өвдсөн" });
  assert.equal(r.status, 200, JSON.stringify(r.json));

  const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  assert.equal(after.status, "PAID");
  assert.equal(after.assignedNurseId, null);
  const m = await waitPush((x) => x.app === "client");
  assert.equal(m?.message.title, "Сувилагч солигдож байна");

  await runDispatchCycle(prisma);
  const offers = await prisma.orderOffer.findMany({ where: { orderId: o.id } });
  assert.ok(offers.some((x) => x.nurseId === nurseBId && x.status === "PENDING"));
  assert.ok(!offers.some((x) => x.nurseId === nurseAId && x.status === "PENDING"));
  // no refund: the customer keeps the paid order
  assert.equal(await prisma.refund.count({ where: { orderId: o.id } }), 0);
});

it("no-show: only after waiting at the address; no refund, but staff can still refund a dispute", async () => {
  const early = await order("EN_ROUTE", { hoursAhead: 0.1, nurseId: nurseAId });
  const tooEarly = await nurseCall(nurseA, early.id, "no-show", { version: early.version, ...AT });
  assert.equal(tooEarly.status, 422);

  const o = await order("EN_ROUTE", { hoursAhead: -0.5, nurseId: nurseAId });
  const far = await nurseCall(nurseA, o.id, "no-show", { version: o.version, lat: 47.95, lng: 106.99 });
  assert.equal(far.status, 422);
  assert.equal(far.json.error.code, "CHECKIN_TOO_FAR");

  const r = await nurseCall(nurseA, o.id, "no-show", { version: o.version, ...AT });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.order.status, "NO_SHOW");
  assert.equal((await waitPush((x) => x.app === "client"))?.message.title, "Сувилагч таныг олсонгүй");
  assert.equal(await prisma.refund.count({ where: { orderId: o.id } }), 0);

  // the customer cannot cancel it any more; an admin can (dispute)
  const terms = await api(srv.baseUrl, "GET", `/api/orders/${o.id}/cancellation`, { token: child });
  assert.equal(terms.json.data.terms.allowed, false);
  const adm = await api(srv.baseUrl, "POST", `/api/admin/orders/${o.id}/cancel`, {
    token: admin,
    body: { reason: "Хаяг буруу байсан, гомдлыг хүлээн авав", refundPercent: 100 },
  });
  assert.equal(adm.status, 200, JSON.stringify(adm.json));
  assert.equal(adm.json.data.order.cancellation.refund.status, "REFUNDED");
});

it("the system tells the customer after 30 minutes without a nurse, once", async () => {
  const o = await order("PAID", { hoursAhead: 3, paidMinutesAgo: 40 });
  const fresh = await order("PAID", { hoursAhead: 3, paidMinutesAgo: 5 });
  const r1 = await runUnassignedSweep(prisma);
  assert.ok(r1.noticed >= 1);
  const notices = await prisma.orderEvent.findMany({ where: { type: "NO_NURSE_NOTICE" } });
  assert.ok(notices.some((e) => e.orderId === o.id));
  assert.ok(!notices.some((e) => e.orderId === fresh.id));
  assert.equal(pushOutbox.filter((x) => x.message.data.orderId === o.id).length, 1);
  assert.equal(pushOutbox.find((x) => x.message.data.orderId === o.id)?.message.title, "Сувилагч хайсаар байна");

  await runUnassignedSweep(prisma);
  assert.equal(pushOutbox.filter((x) => x.message.data.orderId === o.id).length, 1);
  // still a normal PAID order: the customer may wait or cancel for 100%
  const terms = await api(srv.baseUrl, "GET", `/api/orders/${o.id}/cancellation`, { token: child });
  assert.equal(terms.json.data.terms.refundPercent, 100);
});

it("when the booked time passes without a nurse the order expires and is refunded in full", async () => {
  const o = await order("PAID", { hoursAhead: -1, paidMinutesAgo: 120 });
  const assigned = await order("ASSIGNED", { hoursAhead: -1, nurseId: nurseAId });
  const r = await runUnassignedSweep(prisma);
  assert.ok(r.expired >= 1);
  const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { refunds: true } });
  assert.equal(after.status, "EXPIRED");
  assert.equal(after.cancelledBy, "SYSTEM");
  assert.equal(after.refunds[0]?.percent, 100);
  assert.equal(after.refunds[0]?.status, "REFUNDED");
  assert.equal((await waitPush((x) => x.message.data.orderId === o.id))?.message.title, "Сувилагч олдсонгүй");
  // an order with a nurse is not touched
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: assigned.id } })).status, "ASSIGNED");
  // the customer's order screen explains it
  const view = await api(srv.baseUrl, "GET", `/api/orders/${o.id}`, { token: child });
  assert.equal(view.json.data.order.cancellation.by, "SYSTEM");
});
