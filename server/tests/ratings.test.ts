import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { pushOutbox } from "../src/services/push";
import { runDispatchCycle } from "../src/services/dispatch";
import { runRatingReminders } from "../src/services/ratings";

// Customer ratings of finished visits (spec SCR-C16, slide 71).
let srv: TestServer;
let admin: string, child: string, otherChild: string, nurse: string;
let childId: string, parentId: string, nurseId: string;
const MIN = 60000;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "rt-admin"),
    c = await createUser("CHILD", "rt-child"),
    c2 = await createUser("CHILD", "rt-child2"),
    n = await createUser("NURSE", "rt-nurse");
  [admin, child, otherChild, nurse] = await Promise.all([a, c, c2, n].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Үнэлгээ өвчтөн",
        age: 70,
        gender: "Other",
        address: "Тест",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  await prisma.nurseProfile.create({
    data: { userId: nurseId, status: "VERIFIED", licenseExpiresAt: new Date(Date.now() + 365 * 86400000), skillTags: [], zoneIds: [] },
  });
  await api(srv.baseUrl, "POST", "/api/push/devices", {
    token: child,
    body: { token: "ExponentPushToken[rating-client-xxxxxxxxx]", app: "client", platform: "ios" },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
beforeEach(() => {
  pushOutbox.length = 0;
});

/** A visit that ended `endedMinutesAgo` ago (the COMPLETED event's time). */
async function finished(endedMinutesAgo = 30, status: "COMPLETED" | "CANCELLED" = "COMPLETED", nurse: string | null = nurseId) {
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status,
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() - 2 * 3600000),
      assignedNurseId: nurse,
    },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: o.id,
      type: "FINISH",
      fromStatus: "IN_PROGRESS",
      toStatus: status,
      createdAt: new Date(Date.now() - endedMinutesAgo * MIN),
    },
  });
  return o;
}

const rate = (token: string, id: string, body: unknown) =>
  api(srv.baseUrl, "POST", `/api/orders/${id}/rating`, { token, body });

it("the customer rates a finished visit once; the nurse sees only the average", async () => {
  const o = await finished();
  const before = await api(srv.baseUrl, "GET", `/api/orders/${o.id}`, { token: child });
  assert.equal(before.json.data.order.canRate, true);
  assert.equal(before.json.data.order.rating, null);

  assert.equal((await rate(child, o.id, { stars: 0 })).status, 400);
  assert.equal((await rate(child, o.id, { stars: 6 })).status, 400);
  assert.equal((await rate(child, o.id, { stars: 5, tags: ["RUDE"] })).status, 400);
  assert.equal((await rate(otherChild, o.id, { stars: 1 })).status, 404);

  const r = await rate(child, o.id, { stars: 5, tags: ["ON_TIME", "KIND", "KIND"], comment: "Маш анхааралтай" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.data.order.rating.tags, ["ON_TIME", "KIND"]);
  assert.equal(r.json.data.order.rating.stars, 5);
  assert.equal(r.json.data.order.canRate, false);

  const again = await rate(child, o.id, { stars: 1 });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, "ALREADY_RATED");

  // the audit event has the stars but never the comment
  const ev = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: o.id, type: "RATING" } });
  assert.equal(JSON.stringify(ev.metadata).includes("анхааралтай"), false);

  const o2 = await finished();
  await rate(child, o2.id, { stars: 4 });
  const me = await api(srv.baseUrl, "GET", "/api/nurse/me", { token: nurse });
  assert.deepEqual(me.json.data.profile.rating, { average: 4.5, count: 2 });
  // the nurse's view of the order hides who rated what
  const view = await api(srv.baseUrl, "GET", `/api/nurse/orders/${o.id}`, { token: nurse });
  assert.equal(view.status, 200, JSON.stringify(view.json));
  assert.equal(view.json.data.order.rating, null);
  const staffView = await api(srv.baseUrl, "GET", `/api/staff/orders/${o.id}`, { token: nurse });
  assert.equal(staffView.status, 200, JSON.stringify(staffView.json));
  assert.equal(staffView.json.data.order.rating, null);
  const adminView = await api(srv.baseUrl, "GET", `/api/staff/orders/${o.id}`, { token: admin });
  assert.equal(adminView.json.data.order.rating.stars, 5);

  // the admin sees the comment and the average
  const detail = await api(srv.baseUrl, "GET", `/api/admin/nurses/${nurseId}`, { token: admin });
  assert.equal(detail.json.data.nurse.rating.count, 2);
  assert.ok(detail.json.data.ratings.some((x: { comment: string | null }) => x.comment === "Маш анхааралтай"));
  assert.deepEqual(detail.json.data.ratings.find((x: { stars: number }) => x.stars === 5).tags, ["Цагтаа", "Эелдэг"]);
});

it("only a finished visit with a nurse can be rated", async () => {
  const cancelled = await finished(30, "CANCELLED");
  const r = await rate(child, cancelled.id, { stars: 3 });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "NOT_RATEABLE");
  const noNurse = await finished(30, "COMPLETED", null);
  assert.equal((await rate(child, noNurse.id, { stars: 3 })).json.error.code, "NOT_RATEABLE");
});

it("the customer is reminded once, 10 minutes after the visit, unless already rated", async () => {
  const tooSoon = await finished(5);
  const due = await finished(15);
  const rated = await finished(15);
  await rate(child, rated.id, { stars: 5 });
  const old = await finished(48 * 60);

  await runRatingReminders(prisma);
  const sent = (id: string) => pushOutbox.filter((m) => m.message.data.orderId === id).length;
  assert.equal(sent(due.id), 1);
  assert.equal(pushOutbox.find((m) => m.message.data.orderId === due.id)?.message.title, "Үйлчилгээг үнэлнэ үү");
  assert.equal(sent(tooSoon.id), 0);
  assert.equal(sent(rated.id), 0);
  assert.equal(sent(old.id), 0);

  await runRatingReminders(prisma);
  assert.equal(sent(due.id), 1);
});

it("dispatch asks the better rated nurse first when the workload is equal", async () => {
  await prisma.nurseProfile.updateMany({ data: { isActive: false } });
  await prisma.order.updateMany({ where: { status: "PAID", assignedNurseId: null }, data: { status: "CANCELLED" } });
  const make = async (tag: string) => {
    const u = await createUser("NURSE", tag);
    await prisma.nurseProfile.create({
      data: {
        userId: u.id,
        status: "VERIFIED",
        isActive: true,
        licenseExpiresAt: new Date(Date.now() + 365 * 86400000),
        skillTags: [],
        zoneIds: [],
      },
    });
    return u.id;
  };
  // four nurses, one wave asks three: the low rated one waits
  const [good1, good2, fresh, low] = [await make("rt-a"), await make("rt-b"), await make("rt-c"), await make("rt-d")];
  for (const [id, stars] of [
    [good1, 5],
    [good2, 5],
    [low, 2],
  ] as const) {
    const o = await finished(60, "COMPLETED", id);
    await prisma.nurseRating.create({ data: { orderId: o.id, nurseId: id, clientId: childId, stars } });
  }
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: "PAID",
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() + 5 * 3600000),
    },
  });
  await runDispatchCycle(prisma);
  const offered = (await prisma.orderOffer.findMany({ where: { orderId: o.id } })).map((x) => x.nurseId);
  assert.equal(offered.length, 3);
  assert.ok(offered.includes(good1) && offered.includes(good2) && offered.includes(fresh));
  assert.ok(!offered.includes(low));
  await prisma.nurseProfile.updateMany({ where: { userId: { in: [good1, good2, fresh, low] } }, data: { isActive: false } });
});
