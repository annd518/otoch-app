import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";

// Live order board on the admin web home (GET /api/admin/board).
let srv: TestServer;
let admin: string, nurseToken: string;
let childId: string, parentId: string, nurseId: string;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "board-admin"),
    n = await createUser("NURSE", "board-nurse"),
    c = await createUser("CHILD", "board-child");
  [admin, nurseToken] = await Promise.all([a, n].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Самбарын үйлчлүүлэгч",
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
  await srv.close();
  await prisma.$disconnect();
});

const board = (token = admin) => api(srv.baseUrl, "GET", "/api/admin/board", { token });

async function order(status: string, paidMinutesAgo: number | null, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: status as never,
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(now + 3 * 3600000),
      timeSlot: "14:00–15:00",
      ...extra,
    },
  });
  if (paidMinutesAgo !== null) {
    const q = await prisma.quote.create({
      data: {
        orderId: o.id,
        orderVersion: 1,
        catalogVersion: "T",
        pricingVersion: "T",
        lines: [],
        subtotalMnt: 25000,
        totalMnt: 25000,
        isFixture: true,
        expiresAt: new Date(now + 600000),
      },
    });
    await prisma.payment.create({
      data: {
        orderId: o.id,
        quoteId: q.id,
        userId: childId,
        mode: "mock",
        idempotencyKey: `board-${o.id}`,
        amountMnt: 25000,
        status: "PAID",
        paidAt: new Date(now - paidMinutesAgo * 60000),
        expiresAt: new Date(now + 600000),
      },
    });
  }
  return o;
}

it("only the super-admin reads the board", async () => {
  assert.equal((await board(nurseToken)).status, 403);
  assert.equal((await api(srv.baseUrl, "GET", "/api/admin/board", {})).status, 401);
  assert.equal((await board()).status, 200);
});

it("lists active orders with the dispatch stage, waiting time and real KPIs", async () => {
  const before = (await board()).json.data.kpis;
  const waiting = await order("PAID", 7, { lat: 47.92, lng: 106.91 });
  const fresh = await order("PAID", 1);
  const assigned = await order("ASSIGNED", 20, { assignedNurseId: nurseId });
  // assigned 4 minutes after payment, today
  await prisma.orderEvent.create({
    data: {
      orderId: assigned.id,
      type: "ACCEPT",
      fromStatus: "PAID",
      toStatus: "ASSIGNED",
      createdAt: new Date(Date.now() - 16 * 60000),
    },
  });
  const done = await order("COMPLETED", 60);
  await prisma.orderEvent.create({ data: { orderId: done.id, type: "FINISH", toStatus: "COMPLETED" } });
  const draft = await order("DRAFT", null);
  await prisma.nurseProfile.create({
    data: {
      userId: nurseId,
      status: "VERIFIED",
      isActive: true,
      licenseExpiresAt: new Date(Date.now() + 365 * 86400000),
      skillTags: ["INJ"],
      zoneIds: [],
    },
  });

  const r = await board();
  assert.equal(r.status, 200);
  const { kpis, orders } = r.json.data;
  const byId = new Map(orders.map((o: { id: string }) => [o.id, o]));
  const w = byId.get(waiting.id) as Record<string, unknown>;
  assert.equal(w.stage, "DISPATCHING");
  assert.equal(w.overdue, true);
  assert.ok((w.waitingMinutes as number) >= 7);
  assert.deepEqual(w.location, { lat: 47.92, lng: 106.91 });
  // no catalog rows here: adding one would change the catalog other test files count
  assert.equal(w.service, null);
  assert.equal(w.patientName, "Самбарын үйлчлүүлэгч");
  assert.equal(w.isMock, true);
  assert.equal((byId.get(fresh.id) as Record<string, unknown>).overdue, false);
  const a = byId.get(assigned.id) as Record<string, unknown>;
  assert.equal(a.stage, "ASSIGNED");
  assert.equal(a.waitingMinutes, null);
  assert.ok(a.nurse);
  assert.equal(byId.has(done.id), false);
  assert.equal(byId.has(draft.id), false);

  assert.equal(kpis.active, before.active + 3);
  assert.equal(kpis.unassignedOverdue, before.unassignedOverdue + 1);
  assert.equal(kpis.completedToday, before.completedToday + 1);
  assert.equal(kpis.nursesOnline, before.nursesOnline + 1);
  assert.equal(kpis.assignedToday, before.assignedToday + 1);
  if (before.assignedToday === 0) assert.equal(kpis.avgAssignMinutes, 4);
});
