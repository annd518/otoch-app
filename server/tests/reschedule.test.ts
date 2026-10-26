import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { CATALOG_V2 } from "../src/data/catalogV2";
import { fixtureCatalogRow } from "../src/services/serviceMetadata";
import { pushOutbox } from "../src/services/push";
import { runUnassignedSweep } from "../src/services/unassignedSweep";

// The customer picks another time for a paid order (spec slide 25).
let srv: TestServer;
let child: string, otherChild: string;
let childId: string, parentId: string, nurseId: string;
const HOUR = 3600000;
const ZONE = "TEST_RS_ZONE";
const AT = { lat: 47.918, lng: 106.917 };
// whole hours, far enough ahead
const slotStart = (h: number) => new Date(Math.ceil((Date.now() + h * HOUR) / HOUR) * HOUR);
const ub = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ulaanbaatar" }).format(d);
const window = (d: Date) => `${ub(d)}-${ub(new Date(d.getTime() + HOUR))}`;
let slotA: Date, slotB: Date, slotFull: Date;

before(async () => {
  srv = await startServer();
  const c = await createUser("CHILD", "rs-child"),
    c2 = await createUser("CHILD", "rs-child2"),
    n = await createUser("NURSE", "rs-nurse");
  [child, otherChild] = await Promise.all([c, c2].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Цаг өвчтөн",
        age: 70,
        gender: "Other",
        address: "Тест",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  for (const row of CATALOG_V2)
    await prisma.serviceCatalogItem.upsert({ where: { code: row.code }, create: fixtureCatalogRow(row), update: {} });
  await prisma.serviceZone.create({ data: { id: ZONE, name: "Тест бүс", minLat: 47, maxLat: 49, minLng: 106, maxLng: 108 } });
  slotA = slotStart(30);
  slotB = slotStart(54);
  slotFull = slotStart(78);
  for (const s of [slotA, slotB, slotFull])
    await prisma.availabilitySlot.create({
      data: { zoneId: ZONE, startsAt: s, endsAt: new Date(s.getTime() + HOUR), capacity: 1 },
    });
  await api(srv.baseUrl, "POST", "/api/push/devices", {
    token: (await loginAs(srv.baseUrl, n.email)),
    body: { token: "ExponentPushToken[resched-nurse-xxxxxxxxx]", app: "nurse", platform: "ios" },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
beforeEach(() => {
  pushOutbox.length = 0;
});

async function order(status: string, start: Date, nurse: string | null = null) {
  const svc = await prisma.serviceCatalogItem.findUniqueOrThrow({ where: { code: "S01" } });
  return prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: status as never,
      redFlagStatus: "CLEAR",
      scheduledFor: start,
      timeSlot: window(start),
      zoneId: ZONE,
      ...AT,
      assignedNurseId: nurse,
      items: { create: [{ serviceId: svc.id, serviceCode: "S01" }] },
    },
  });
}

const move = (token: string, o: { id: string; version: number }, start: Date, slot = window(start)) =>
  api(srv.baseUrl, "POST", `/api/orders/${o.id}/reschedule`, {
    token,
    body: { version: o.version, scheduledFor: start.toISOString(), timeSlot: slot },
  });

it("a paid order without a nurse moves to a free slot; dispatch starts over", async () => {
  const o = await order("PAID", slotStart(6));
  await prisma.orderOffer.create({ data: { orderId: o.id, nurseId, wave: 1, status: "EXPIRED", expiresAt: new Date() } });
  assert.equal((await move(otherChild, o, slotA)).status, 404);
  assert.equal((await move(child, { ...o, version: 99 }, slotA)).json.error.code, "VERSION_CONFLICT");
  // not a server slot / wrong window / too soon
  assert.equal((await move(child, o, slotStart(40))).json.error.code, "AVAILABILITY_REQUIRED");
  assert.equal((await move(child, o, slotA, "09:00-10:00")).json.error.code, "AVAILABILITY_REQUIRED");
  assert.equal((await move(child, o, new Date(Date.now() + HOUR))).json.error.code, "AVAILABILITY_REQUIRED");

  const r = await move(child, o, slotA);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.order.scheduledFor, slotA.toISOString());
  assert.equal(r.json.data.order.status, "PAID");
  // the expired offer is gone, so that nurse can be asked again for the new time
  assert.equal(await prisma.orderOffer.count({ where: { orderId: o.id } }), 0);
  const ev = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: o.id, type: "RESCHEDULE" } });
  assert.equal((ev.metadata as { to: string }).to, slotA.toISOString());
});

it("a full slot is refused", async () => {
  await order("PAID", slotFull); // takes the only place
  const o = await order("PAID", slotStart(8));
  const r = await move(child, o, slotFull);
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "AVAILABILITY_REQUIRED");
});

it("an assigned nurse is released when moved early enough; too close to the visit it is refused", async () => {
  const o = await order("ASSIGNED", slotStart(6), nurseId);
  const r = await move(child, o, slotB);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  assert.equal(after.status, "PAID");
  assert.equal(after.assignedNurseId, null);
  for (let i = 0; i < 50 && !pushOutbox.some((m) => m.app === "nurse"); i++) await new Promise((res) => setTimeout(res, 20));
  assert.equal(pushOutbox.find((m) => m.app === "nurse")?.message.title, "Дуудлагын цаг өөрчлөгдлөө");

  const soon = await order("ASSIGNED", new Date(Date.now() + HOUR), nurseId);
  const late = await move(child, soon, slotStart(100));
  assert.equal(late.status, 409);
  assert.equal(late.json.error.code, "RESCHEDULE_TOO_LATE");
  const started = await order("IN_PROGRESS", slotStart(6), nurseId);
  assert.equal((await move(child, started, slotStart(100))).json.error.code, "INVALID_STATUS");
});

it("after a new time the customer can be told again that no nurse was found", async () => {
  const o = await order("PAID", slotStart(3));
  const q = await prisma.quote.create({
    data: { orderId: o.id, orderVersion: 1, catalogVersion: "T", pricingVersion: "T", lines: [], subtotalMnt: 1, totalMnt: 1, isFixture: true, expiresAt: new Date(Date.now() + 600000) },
  });
  await prisma.payment.create({
    data: {
      orderId: o.id,
      quoteId: q.id,
      userId: childId,
      mode: "mock",
      idempotencyKey: `rs-${o.id}`,
      amountMnt: 1,
      status: "PAID",
      paidAt: new Date(Date.now() - 2 * HOUR),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  await runUnassignedSweep(prisma);
  const notices = () => prisma.orderEvent.count({ where: { orderId: o.id, type: "NO_NURSE_NOTICE" } });
  assert.equal(await notices(), 1);
  await runUnassignedSweep(prisma);
  assert.equal(await notices(), 1);
  // the notice came 2 h ago, the customer moved the visit 1 h ago (backdated to skip the wait)
  await prisma.orderEvent.updateMany({ where: { orderId: o.id, type: "NO_NURSE_NOTICE" }, data: { createdAt: new Date(Date.now() - 2 * HOUR) } });
  await prisma.orderEvent.create({ data: { orderId: o.id, type: "RESCHEDULE", createdAt: new Date(Date.now() - HOUR) } });
  await runUnassignedSweep(prisma);
  assert.equal(await notices(), 2);
  await runUnassignedSweep(prisma);
  assert.equal(await notices(), 2);
});
