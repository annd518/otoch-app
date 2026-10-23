import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { clientCancelTerms } from "../src/services/cancellation";
import { getQPayAdapter, qpayMock } from "../src/services/qpay";
import { pushOutbox } from "../src/services/push";

// Cancellation and refunds (spec slide 25). QPAY_MODE=mock, PUSH_DRIVER=mock.
let srv: TestServer;
let admin: string, child: string, other: string, nurse: string;
let childId: string, parentId: string, nurseId: string;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "cx-admin"),
    c = await createUser("CHILD", "cx-child"),
    o = await createUser("CHILD", "cx-other"),
    n = await createUser("NURSE", "cx-nurse");
  [admin, child, other, nurse] = await Promise.all([a, c, o, n].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Цуцлалтын өвчтөн",
        age: 70,
        gender: "Other",
        address: "Тест",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  for (const [token, app] of [[child, "client"], [nurse, "nurse"]] as const)
    await api(srv.baseUrl, "POST", "/api/push/devices", {
      token,
      body: { token: `ExponentPushToken[cancel-${app}-xxxxxxxxxx]`, app, platform: "ios" },
    });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
beforeEach(() => {
  pushOutbox.length = 0;
});

const HOUR = 3600000;

/** An order paid through the mock QPay (so a refund can reach the fake provider). */
async function paidOrder(status: string, hoursAhead: number, amountMnt = 30000) {
  const order = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: status as never,
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() + hoursAhead * HOUR),
      ...(status !== "PAID" && status !== "AWAITING_PAYMENT" && { assignedNurseId: nurseId }),
    },
  });
  const quote = await prisma.quote.create({
    data: {
      orderId: order.id,
      orderVersion: 1,
      catalogVersion: "T",
      pricingVersion: "T",
      lines: [],
      subtotalMnt: amountMnt,
      totalMnt: amountMnt,
      isFixture: true,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  const qpay = getQPayAdapter();
  const inv = await qpay.createInvoice({
    senderInvoiceNo: order.id,
    amountMnt,
    description: "test",
    callbackUrl: "http://localhost/x",
  });
  let providerPaymentId: string | null = null;
  if (status !== "AWAITING_PAYMENT") {
    qpayMock.markPaid(inv.invoiceId);
    providerPaymentId = (await qpay.checkInvoice(inv.invoiceId)).paymentId;
  }
  await prisma.payment.create({
    data: {
      orderId: order.id,
      quoteId: quote.id,
      userId: childId,
      mode: "mock",
      idempotencyKey: `cx-${order.id}`,
      amountMnt,
      status: status === "AWAITING_PAYMENT" ? "PENDING" : "PAID",
      paidAt: status === "AWAITING_PAYMENT" ? null : new Date(),
      providerInvoiceId: inv.invoiceId,
      providerPaymentId,
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  return { order, invoiceId: inv.invoiceId };
}

const terms = (id: string, token = child) => api(srv.baseUrl, "GET", `/api/orders/${id}/cancellation`, { token });
const cancel = (id: string, body: Record<string, unknown>, token = child) =>
  api(srv.baseUrl, "POST", `/api/orders/${id}/cancel`, { token, body });

it("spec slide 25: free before assignment or 2+ hours ahead, 70% back inside 2 hours", () => {
  const now = new Date();
  const at = (h: number) => new Date(now.getTime() + h * HOUR);
  const t = (status: string, h: number, paid = 30000) => clientCancelTerms({ status, scheduledFor: at(h) }, paid, now);
  assert.deepEqual(t("PAID", 0.5), {
    allowed: true, paidMnt: 30000, refundPercent: 100, refundMnt: 30000, feeMnt: 0, rule: "BEFORE_ASSIGNMENT",
  });
  assert.equal((t("ASSIGNED", 3) as { refundPercent: number }).refundPercent, 100);
  assert.equal((t("ASSIGNED", 2) as { refundPercent: number }).refundPercent, 100);
  assert.deepEqual(t("EN_ROUTE", 1.5), {
    allowed: true, paidMnt: 30000, refundPercent: 70, refundMnt: 21000, feeMnt: 9000, rule: "LATE",
  });
  assert.equal((t("DRAFT", 5, 0) as { rule: string }).rule, "UNPAID");
  for (const s of ["IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUSED"]) assert.equal(t(s, 5).allowed, false);
});

it("a customer cancels a paid order before assignment and QPay refunds it all", async () => {
  const { order, invoiceId } = await paidOrder("PAID", 5);
  const tr = await terms(order.id);
  assert.equal(tr.status, 200);
  assert.equal(tr.json.data.terms.refundPercent, 100);
  assert.equal(tr.json.data.terms.refundMnt, 30000);

  const r = await cancel(order.id, { refundPercent: 100, reason: "Төлөвлөгөө өөрчлөгдсөн" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.order.status, "CANCELLED");
  const c = r.json.data.order.cancellation;
  assert.equal(c.by, "CLIENT");
  assert.equal(c.refund.percent, 100);
  assert.equal(c.refund.amountMnt, 30000);
  assert.equal(c.refund.status, "REFUNDED");
  assert.equal(qpayMock.invoice(invoiceId)?.refundedMnt, 30000);
  // a second cancel is refused
  assert.equal((await cancel(order.id, { refundPercent: 100 })).status, 409);
});

it("inside 2 hours the terms are 70%, a stale 100% is refused, and the nurse is told", async () => {
  const { order, invoiceId } = await paidOrder("ASSIGNED", 1);
  await prisma.orderOffer.create({
    data: { orderId: order.id, nurseId, wave: 1, expiresAt: new Date(Date.now() + 60000) },
  });
  const tr = await terms(order.id);
  assert.equal(tr.json.data.terms.refundPercent, 70);
  assert.equal(tr.json.data.terms.feeMnt, 9000);

  const stale = await cancel(order.id, { refundPercent: 100 });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error.code, "CANCEL_TERMS_CHANGED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "ASSIGNED");

  const r = await cancel(order.id, { refundPercent: 70 });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.order.cancellation.refund.amountMnt, 21000);
  assert.equal(qpayMock.invoice(invoiceId)?.refundedMnt, 21000);
  const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
  assert.ok(offers.every((o) => o.status === "CANCELLED"));
  for (let i = 0; i < 50 && !pushOutbox.some((m) => m.app === "nurse"); i++) await new Promise((r) => setTimeout(r, 20));
  const toNurse = pushOutbox.find((m) => m.app === "nurse");
  assert.equal(toNurse?.message.title, "Дуудлага цуцлагдлаа");
  // a customer cancelling does not get a push about their own action
  assert.equal(pushOutbox.some((m) => m.app === "client"), false);
});

it("a started visit or someone else's order cannot be cancelled by the customer", async () => {
  const started = await paidOrder("IN_PROGRESS", 0);
  assert.equal((await terms(started.order.id)).json.data.terms.allowed, false);
  assert.equal((await cancel(started.order.id, { refundPercent: 100 })).status, 409);
  const mine = await paidOrder("PAID", 5);
  assert.equal((await terms(mine.order.id, other)).status, 404);
  assert.equal((await cancel(mine.order.id, { refundPercent: 100 }, other)).status, 404);
  assert.equal((await cancel(mine.order.id, { refundPercent: 100 }, nurse)).status, 403);
});

it("cancelling before paying stops the open invoice and refunds nothing", async () => {
  const { order, invoiceId } = await paidOrder("AWAITING_PAYMENT", 5);
  const tr = await terms(order.id);
  assert.equal(tr.json.data.terms.rule, "UNPAID");
  const r = await cancel(order.id, { refundPercent: 0 });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.order.cancellation.refund, null);
  const p = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
  assert.equal(p.status, "CANCELLED");
  assert.equal(qpayMock.invoice(invoiceId)?.cancelled, true);
});

it("an admin cancels any active order; a refund QPay refuses waits for a person", async () => {
  const a = (method: string, path: string, body?: unknown, token = admin) =>
    api(srv.baseUrl, method, `/api/admin${path}`, { token, body });
  const { order } = await paidOrder("IN_PROGRESS", 0);
  assert.equal((await a("POST", `/orders/${order.id}/cancel`, { reason: "Өвчтөн эмнэлэгт хэвтсэн", refundPercent: 50 }, child)).status, 403);
  assert.equal((await a("POST", `/orders/${order.id}/cancel`, { reason: "x", refundPercent: 50 })).status, 400);

  qpayMock.failNextRefund();
  const r = await a("POST", `/orders/${order.id}/cancel`, { reason: "Өвчтөн эмнэлэгт хэвтсэн", refundPercent: 50 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.order.cancellation.by, "ADMIN");
  assert.equal(r.json.data.order.cancellation.refund.status, "MANUAL_REQUIRED");
  assert.equal(r.json.data.order.cancellation.refund.amountMnt, 15000);

  // the customer is told when staff cancel
  for (let i = 0; i < 50 && !pushOutbox.some((m) => m.app === "client"); i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(pushOutbox.find((m) => m.app === "client")?.message.title, "Захиалга цуцлагдлаа");

  const list = await a("GET", "/refunds?status=MANUAL_REQUIRED");
  const row = list.json.data.refunds.find((x: { orderId: string }) => x.orderId === order.id);
  assert.ok(row);
  assert.equal(row.failureCode, "PROVIDER_REJECTED");
  assert.ok(row.providerPaymentId);

  // retry reaches QPay this time
  const retry = await a("POST", `/refunds/${row.id}/retry`);
  assert.equal(retry.json.data.status, "REFUNDED");
  assert.equal((await a("POST", `/refunds/${row.id}/retry`)).status, 409);

  // a refund paid back by hand
  const second = await paidOrder("ASSIGNED", 4);
  qpayMock.failNextRefund();
  await a("POST", `/orders/${second.order.id}/cancel`, { reason: "Сувилагч өвдсөн, дахин товлоно", refundPercent: 100 });
  const pending = (await a("GET", "/refunds")).json.data.refunds.find((x: { orderId: string }) => x.orderId === second.order.id);
  assert.equal((await a("POST", `/refunds/${pending.id}/resolve`, { note: "" })).status, 400);
  const done = await a("POST", `/refunds/${pending.id}/resolve`, { note: "Хаан банкаар гараар буцаав" });
  assert.equal(done.status, 200);
  const ref = await prisma.refund.findUniqueOrThrow({ where: { id: pending.id } });
  assert.equal(ref.status, "REFUNDED");
  assert.equal(ref.resolvedNote, "Хаан банкаар гараар буцаав");
  assert.equal((await a("POST", `/refunds/${pending.id}/resolve`, { note: "дахин" })).status, 409);
  assert.equal((await a("GET", "/refunds?status=NOPE")).status, 400);
});
