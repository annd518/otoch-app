import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { readReceiptToken, receiptToken, RECEIPT_LINK_TTL_MS } from "../src/services/payoutReceipt";

// Payout receipt PDF (spec slide 83) for the nurse (signed link) and the admin.
let srv: TestServer;
let admin: string, nurse: string, otherNurse: string, finance: string, support: string;
let nurseId: string, payoutId: string;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "pr-admin"),
    n = await createUser("NURSE", "pr-nurse"),
    n2 = await createUser("NURSE", "pr-nurse2"),
    f = await createUser("ADMIN", "pr-finance", "FINANCE"),
    s = await createUser("ADMIN", "pr-support", "SUPPORT"),
    c = await createUser("CHILD", "pr-child");
  [admin, nurse, otherNurse, finance, support] = await Promise.all([a, n, n2, f, s].map((u) => loginAs(srv.baseUrl, u.email)));
  nurseId = n.id;
  const parent = await prisma.parent.create({
    data: { name: "Баримт өвчтөн", age: 70, gender: "Other", address: "Тест", emergencyContact: "99112233", children: { connect: { id: c.id } } },
  });
  const svc = await prisma.serviceCatalogItem.upsert({
    where: { code: "RECEIPT-T" },
    update: {},
    create: { code: "RECEIPT-T", name: "Тарилга", category: "TEST", priceMnt: 1, durationMin: 30, isFixture: true, isActive: false },
  });
  const payout = await prisma.payout.create({
    data: {
      nurseId,
      totalMnt: 42000,
      visits: 2,
      periodFrom: new Date("2026-10-26T02:00:00Z"),
      periodTo: new Date("2026-10-27T05:00:00Z"),
      reference: "ХААН 778899",
      paidAt: new Date("2026-10-28T03:00:00Z"),
      createdById: a.id,
    },
  });
  payoutId = payout.id;
  for (const [gross, net, at] of [
    [35000, 24500, "2026-10-26T02:00:00Z"],
    [25000, 17500, "2026-10-27T05:00:00Z"],
  ] as const) {
    const o = await prisma.order.create({
      data: {
        childId: c.id,
        parentId: parent.id,
        catalogVersion: "T",
        status: "COMPLETED",
        redFlagStatus: "CLEAR",
        assignedNurseId: nurseId,
        items: { create: [{ serviceId: svc.id, serviceCode: "RECEIPT-T" }] },
      },
    });
    await prisma.payoutEntry.create({
      data: {
        nurseId,
        orderId: o.id,
        grossMnt: gross,
        commissionPct: 30,
        commissionMnt: gross - net,
        netMnt: net,
        earnedAt: new Date(at),
        payoutId,
      },
    });
  }
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

const isPdf = async (path: string) => {
  const res = await fetch(srv.baseUrl + path);
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get("content-type"), pdf: bytes.subarray(0, 5).toString() === "%PDF-" };
};

it("the nurse opens the receipt through a 10-minute signed link, without logging in", async () => {
  const r = await api(srv.baseUrl, "GET", `/api/nurse/payouts/${payoutId}/receipt-link`, { token: nurse });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const { path, expiresAt } = r.json.data;
  assert.match(path, /^\/api\/receipts\/payout\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(Date.parse(expiresAt) - Date.now() <= RECEIPT_LINK_TTL_MS);
  const got = await isPdf(path);
  assert.equal(got.status, 200);
  assert.equal(got.type, "application/pdf");
  assert.ok(got.pdf);

  // another nurse cannot get a link for it; a changed token is refused
  assert.equal((await api(srv.baseUrl, "GET", `/api/nurse/payouts/${payoutId}/receipt-link`, { token: otherNurse })).status, 404);
  const [body, sig] = path.split("/").pop()!.split(".");
  assert.equal((await isPdf(`/api/receipts/payout/${body}.${sig.slice(0, -2)}xx`)).status, 404);
  // a token signed for the other nurse does not open this payout
  const forged = receiptToken(payoutId, "someone-else");
  assert.equal((await isPdf(`/api/receipts/payout/${forged.token}`)).status, 404);
});

it("the link expires", () => {
  const { token } = receiptToken(payoutId, nurseId, Date.now());
  assert.deepEqual(readReceiptToken(token), { payoutId, nurseId });
  assert.equal(readReceiptToken(token, Date.now() + RECEIPT_LINK_TTL_MS + 1), null);
  assert.equal(readReceiptToken("garbage"), null);
});

it("staff who see payouts download the same receipt", async () => {
  for (const token of [admin, finance]) {
    const res = await fetch(`${srv.baseUrl}/api/admin/payouts/${payoutId}/receipt.pdf`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition") ?? "", /otoch-payout-/);
  }
  const no = await fetch(`${srv.baseUrl}/api/admin/payouts/${payoutId}/receipt.pdf`, { headers: { Authorization: `Bearer ${support}` } });
  assert.equal(no.status, 403);
  const missing = await fetch(`${srv.baseUrl}/api/admin/payouts/nope/receipt.pdf`, { headers: { Authorization: `Bearer ${admin}` } });
  assert.equal(missing.status, 404);
});
