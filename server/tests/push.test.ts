import { before, after, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";
import { pushOutbox, isExpoPushToken, notifyApplication } from "../src/services/push";
import { runDispatchCycle } from "../src/services/dispatch";

// Push notifications (PUSH_DRIVER=mock in tests: messages land in pushOutbox).
let srv: TestServer;
let admin: string, child: string, nurse: string, otherChild: string;
let childId: string, nurseId: string, otherChildId: string, parentId: string;

const tok = (s: string) => `ExponentPushToken[${s.padEnd(22, "x")}]`;

before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN", "push-admin"),
    c = await createUser("CHILD", "push-child"),
    n = await createUser("NURSE", "push-nurse"),
    c2 = await createUser("CHILD", "push-child2");
  [admin, child, nurse, otherChild] = await Promise.all([a, c, n, c2].map((u) => loginAs(srv.baseUrl, u.email)));
  childId = c.id;
  nurseId = n.id;
  otherChildId = c2.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Push өвчтөн",
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
beforeEach(() => {
  pushOutbox.length = 0;
});

const register = (token: string, body: Record<string, unknown>) =>
  api(srv.baseUrl, "POST", "/api/push/devices", { token, body });

/** notify*() runs after the response; wait until it lands. */
async function waitFor<T>(find: () => T | undefined, ms = 2000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = find();
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error("push not sent");
    await new Promise((r) => setTimeout(r, 20));
  }
}

it("recognises Expo push tokens", () => {
  assert.equal(isExpoPushToken(tok("abc")), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abcdefghijklmnop]"), true);
  assert.equal(isExpoPushToken("not-a-token"), false);
  assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
});

it("a phone registers for its own app only; a token moves to the account signed in last", async () => {
  assert.equal((await api(srv.baseUrl, "POST", "/api/push/devices", { body: {} })).status, 401);
  assert.equal((await register(child, { token: "bad", app: "client", platform: "ios" })).status, 400);
  assert.equal((await register(child, { token: tok("c1"), app: "nurse", platform: "ios" })).status, 403);
  assert.equal((await register(nurse, { token: tok("n1"), app: "client", platform: "ios" })).status, 403);
  assert.equal((await register(child, { token: tok("c1"), app: "client", platform: "ios" })).status, 200);
  assert.equal((await register(child, { token: tok("c1"), app: "client", platform: "ios" })).status, 200);
  assert.equal(await prisma.pushDevice.count({ where: { token: tok("c1") } }), 1);

  // the same phone, now signed in with another family account
  assert.equal((await register(otherChild, { token: tok("c1"), app: "client", platform: "ios" })).status, 200);
  const row = await prisma.pushDevice.findUniqueOrThrow({ where: { token: tok("c1") } });
  assert.equal(row.userId, otherChildId);

  // sign-out removes only your own token
  assert.equal(
    (await api(srv.baseUrl, "DELETE", "/api/push/devices", { token: child, body: { token: tok("c1") } })).status,
    200,
  );
  assert.equal(await prisma.pushDevice.count({ where: { token: tok("c1") } }), 1);
  await api(srv.baseUrl, "DELETE", "/api/push/devices", { token: otherChild, body: { token: tok("c1") } });
  assert.equal(await prisma.pushDevice.count({ where: { token: tok("c1") } }), 0);
});

async function paidOrder(extra: Record<string, unknown> = {}) {
  const svc = await prisma.serviceCatalogItem.upsert({
    where: { code: "PUSH-T" },
    update: {},
    create: { code: "PUSH-T", name: "Тарилга", category: "TEST", priceMnt: 1, durationMin: 30, isFixture: true, isActive: false },
  });
  return prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: "PAID",
      redFlagStatus: "CLEAR",
      scheduledFor: new Date(Date.now() + 3 * 3600000),
      addressText: "Хан-Уул дүүрэг, 3-р хороо, 7 тоот",
      items: { create: [{ serviceId: svc.id, serviceCode: "PUSH-T" }] },
      ...extra,
    },
  });
}

it("the customer hears when a nurse is assigned and the nurse hears it was assigned", async () => {
  await register(child, { token: tok("child"), app: "client", platform: "android" });
  await register(nurse, { token: tok("nurse"), app: "nurse", platform: "ios" });
  const o = await paidOrder();
  const r = await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
    token: admin,
    body: { version: o.version, nurseId },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const toChild = await waitFor(() => pushOutbox.find((m) => m.app === "client"));
  assert.equal(toChild.to, tok("child"));
  assert.equal(toChild.message.title, "Сувилагч олдлоо");
  assert.deepEqual(toChild.message.data, { type: "ORDER", orderId: o.id });
  // no patient details on a lock screen
  assert.equal(JSON.stringify(toChild.message).includes("Push өвчтөн"), false);
  const toNurse = await waitFor(() => pushOutbox.find((m) => m.app === "nurse"));
  assert.equal(toNurse.to, tok("nurse"));
  assert.equal(toNurse.message.data.orderId, o.id);

  // a deactivated customer gets nothing
  pushOutbox.length = 0;
  await prisma.user.update({ where: { id: childId }, data: { deletedAt: new Date() } });
  const o2 = await paidOrder();
  await api(srv.baseUrl, "POST", `/api/staff/orders/${o2.id}/assign`, { token: admin, body: { version: o2.version, nurseId } });
  await waitFor(() => pushOutbox.find((m) => m.app === "nurse"));
  assert.equal(pushOutbox.some((m) => m.app === "client"), false);
  await prisma.user.update({ where: { id: childId }, data: { deletedAt: null } });
});

it("a dispatch wave tells the offered nurses, with the service and district only", async () => {
  await prisma.nurseProfile.updateMany({ data: { isActive: false } });
  await prisma.nurseProfile.upsert({
    where: { userId: nurseId },
    create: {
      userId: nurseId,
      status: "VERIFIED",
      isActive: true,
      licenseExpiresAt: new Date(Date.now() + 365 * 86400000),
      skillTags: ["INJ", "IV", "WOUND", "CATH", "NG", "CARE"],
      zoneIds: [],
    },
    update: { status: "VERIFIED", isActive: true, licenseExpiresAt: new Date(Date.now() + 365 * 86400000) },
  });
  await register(nurse, { token: tok("nurse"), app: "nurse", platform: "ios" });
  // only this order is open
  await prisma.order.updateMany({ where: { status: "PAID", assignedNurseId: null }, data: { status: "CANCELLED" } });
  // later than the visits assigned above (a nurse is not offered overlapping calls)
  const o = await paidOrder({ scheduledFor: new Date(Date.now() + 12 * 3600000) });
  await runDispatchCycle(prisma);
  const m = pushOutbox.find((x) => x.app === "nurse" && x.message.data.type === "OFFER");
  assert.ok(m, JSON.stringify(pushOutbox));
  assert.equal(m.message.title, "Шинэ дуудлага");
  assert.equal(m.message.body, "Тарилга · Хан-Уул дүүрэг");
  assert.equal(m.message.data.orderId, o.id);
  assert.equal(JSON.stringify(m.message).includes("7 тоот"), false);
});

it("application decisions reach the nurse app", async () => {
  await register(nurse, { token: tok("nurse"), app: "nurse", platform: "ios" });
  await notifyApplication(nurseId, "REJECTED");
  const m = pushOutbox.find((x) => x.message.data.type === "APPLICATION");
  assert.ok(m);
  assert.equal(m.message.title, "Өргөдөл буцаагдлаа");
});
