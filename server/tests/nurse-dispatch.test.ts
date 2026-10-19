import { before, beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prisma,
  api,
  createUser,
  loginAs,
  startServer,
  errorCode,
  type TestServer,
} from "./helpers";
import {
  OFFER_TTL_MS,
  WAVE_SIZE,
  acceptOffer,
  ineligibleReason,
  requiredSkills,
  runDispatchCycle,
} from "../src/services/dispatch";

let srv: TestServer, childId: string, parentId: string, admin: string, child: string;
const HOUR = 3_600_000;
const future = (h: number) => new Date(Date.now() + h * HOUR);

before(async () => {
  srv = await startServer();
  const [c, a] = await Promise.all([createUser("CHILD"), createUser("ADMIN")]);
  childId = c.id;
  [child, admin] = await Promise.all([c, a].map((u) => loginAs(srv.baseUrl, u.email)));
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Тест өвчтөн",
        age: 70,
        gender: "Other",
        address: "Нууц хаяг 12-34",
        emergencyContact: "99112233",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  for (const [code, name] of [["S02", "Тарилга"], ["S01", "Амин үзүүлэлт"]] as const)
    await prisma.serviceCatalogItem.upsert({
      where: { code },
      update: {},
      create: { code, name, category: "TEST", priceMnt: 25000, durationMin: 30, isFixture: true },
    });
  await prisma.serviceZone.upsert({
    where: { id: "Z1" },
    update: {},
    create: { id: "Z1", name: "Баянзүрх", minLat: 0, maxLat: 90, minLng: 0, maxLng: 180 },
  });
});
// Tests share one database: park every nurse and open order left by earlier tests.
beforeEach(async () => {
  await prisma.nurseProfile.updateMany({ data: { isActive: false } });
  await prisma.order.updateMany({
    where: { status: "PAID", assignedNurseId: null },
    data: { status: "CANCELLED" },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

type NurseOpts = Partial<{
  status: "PENDING" | "VERIFIED" | "SUSPENDED";
  isActive: boolean;
  licenseExpiresAt: Date | null;
  skillTags: string[];
  zoneIds: string[];
  deleted: boolean;
}>;
async function nurse(opts: NurseOpts = {}) {
  const u = await createUser("NURSE");
  if (opts.deleted) await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
  await prisma.nurseProfile.create({
    data: {
      userId: u.id,
      status: opts.status ?? "VERIFIED",
      isActive: opts.isActive ?? true,
      licenseExpiresAt: opts.licenseExpiresAt === undefined ? future(24 * 365) : opts.licenseExpiresAt,
      skillTags: opts.skillTags ?? ["INJ"],
      zoneIds: opts.zoneIds ?? [],
      licenseNo: "L-1",
    },
  });
  // A deactivated account cannot sign in (loginController refuses deletedAt).
  return { id: u.id, token: opts.deleted ? "" : await loginAs(srv.baseUrl, u.email), email: u.email };
}

async function paid(over: Record<string, unknown> = {}, service = "S02") {
  const svc = await prisma.serviceCatalogItem.findUniqueOrThrow({ where: { code: service } });
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "T",
      status: "PAID",
      redFlagStatus: "CLEAR",
      scheduledFor: future(5),
      timeSlot: "14:00–15:00",
      zoneId: "Z1",
      addressText: "Нууц хаяг 12-34",
      items: { create: [{ serviceId: svc.id, serviceCode: service }] },
      ...over,
    },
  });
  await prisma.quote.create({
    data: {
      orderId: o.id,
      orderVersion: o.version,
      catalogVersion: "T",
      pricingVersion: "T",
      lines: [],
      subtotalMnt: 25000,
      totalMnt: 25000,
      isFixture: true,
      expiresAt: future(48),
    },
  });
  return o;
}
const offersOf = (orderId: string) => prisma.orderOffer.findMany({ where: { orderId } });
const call = (m: string, path: string, token: string, body?: unknown) =>
  api(srv.baseUrl, m, path, { token, body });

describe("eligibility rules", () => {
  it("maps services to skills", () => {
    assert.deepEqual(requiredSkills(["S02", "S03", "S08", "S01"]).sort(), ["INJ", "IV"]);
    assert.deepEqual(requiredSkills(["S01", "S05"]), []);
  });
  it("explains why a nurse is not eligible", () => {
    const base = { status: "VERIFIED", isActive: true, licenseExpiresAt: future(10), skillTags: ["INJ"], zoneIds: [] };
    const need = { skills: ["INJ"], zoneId: "Z1" };
    const now = new Date();
    assert.equal(ineligibleReason(base, need, now), null);
    assert.ok(ineligibleReason(null, need, now));
    assert.ok(ineligibleReason({ ...base, status: "PENDING" }, need, now));
    assert.ok(ineligibleReason({ ...base, licenseExpiresAt: new Date(now.getTime() - 1) }, need, now));
    assert.ok(ineligibleReason({ ...base, licenseExpiresAt: null }, need, now));
    assert.ok(ineligibleReason({ ...base, isActive: false }, need, now));
    assert.ok(ineligibleReason(base, { skills: ["IV"], zoneId: "Z1" }, now));
    assert.ok(ineligibleReason({ ...base, zoneIds: ["Z2"] }, need, now));
    assert.equal(ineligibleReason({ ...base, zoneIds: ["Z1"] }, need, now), null);
  });
});

describe("dispatch waves", () => {
  it("offers only to eligible nurses, at most WAVE_SIZE, then the next wave skips the asked", async () => {
    const good = await Promise.all([1, 2, 3, 4, 5].map(() => nurse()));
    const bad = await Promise.all([
      nurse({ status: "PENDING" }),
      nurse({ isActive: false }),
      nurse({ licenseExpiresAt: future(-1) }),
      nurse({ skillTags: ["IV"] }),
      nurse({ zoneIds: ["Z2"] }),
      nurse({ deleted: true }),
    ]);
    const o = await paid();
    const t0 = new Date();
    const first = await runDispatchCycle(prisma, t0);
    assert.ok(first.offersCreated >= WAVE_SIZE);
    const w1 = await offersOf(o.id);
    assert.equal(w1.length, WAVE_SIZE);
    assert.ok(w1.every((x) => x.wave === 1 && x.status === "PENDING"));
    const goodIds = new Set(good.map((n) => n.id));
    assert.ok(w1.every((x) => goodIds.has(x.nurseId)));
    assert.ok(!w1.some((x) => bad.some((b) => b.id === x.nurseId)));

    // Nothing new while a wave is live.
    await runDispatchCycle(prisma, new Date(t0.getTime() + 10_000));
    assert.equal((await offersOf(o.id)).length, WAVE_SIZE);

    // After the offers expire the remaining two nurses get wave 2.
    const t1 = new Date(t0.getTime() + OFFER_TTL_MS + 1000);
    await runDispatchCycle(prisma, t1);
    const all = await offersOf(o.id);
    assert.equal(all.length, 5);
    assert.equal(all.filter((x) => x.wave === 2).length, 2);
    assert.equal(new Set(all.map((x) => x.nurseId)).size, 5);
    assert.ok(all.filter((x) => x.wave === 1).every((x) => x.status === "EXPIRED"));

    // Everyone was asked: nothing more is offered; the order stays PAID for an admin.
    await runDispatchCycle(prisma, new Date(t1.getTime() + OFFER_TTL_MS + 1000));
    assert.equal((await offersOf(o.id)).length, 5);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "PAID");
  });

  it("does not dispatch far-future, unscheduled, flagged or already-assigned orders", async () => {
    await nurse();
    const far = await paid({ scheduledFor: future(48) });
    const none = await paid({ scheduledFor: null });
    const flagged = await paid({ redFlagStatus: "FLAGGED" });
    const taken = await paid({ assignedNurseId: (await nurse()).id });
    await runDispatchCycle(prisma);
    for (const o of [far, none, flagged, taken]) assert.equal((await offersOf(o.id)).length, 0, o.id);
  });

  it("skips a nurse with another visit within 2 hours", async () => {
    const busy = await nurse();
    const start = future(6);
    await paid({ status: "ASSIGNED", assignedNurseId: busy.id, scheduledFor: new Date(start.getTime() + HOUR) });
    const o = await paid({ scheduledFor: start });
    await runDispatchCycle(prisma);
    assert.ok(!(await offersOf(o.id)).some((x) => x.nurseId === busy.id));
  });
});

describe("accept and decline", () => {
  it("the first accept wins, the rest are cancelled, the loser is told", async () => {
    const [a, b, c] = await Promise.all([nurse(), nurse(), nurse()]);
    const o = await paid();
    await runDispatchCycle(prisma);
    const offers = await offersOf(o.id);
    const mine = (n: { id: string }) => offers.find((x) => x.nurseId === n.id);
    const [winner, loser] = [a, b, c].filter((n) => mine(n));
    assert.ok(winner && loser);
    const ok1 = await call("POST", `/api/nurse/offers/${mine(winner)!.id}/accept`, winner.token);
    assert.equal(ok1.status, 200, JSON.stringify(ok1.json));
    assert.equal(ok1.json.data.order.status, "ASSIGNED");
    assert.equal(ok1.json.data.order.address.text, "Нууц хаяг 12-34");
    const late = await call("POST", `/api/nurse/offers/${mine(loser)!.id}/accept`, loser.token);
    assert.equal(late.status, 409);
    assert.equal(errorCode(late), "OFFER_EXPIRED");
    const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    assert.equal(row.assignedNurseId, winner.id);
    assert.equal(row.version, o.version + 1);
    const after = await offersOf(o.id);
    assert.equal(after.filter((x) => x.status === "ACCEPTED").length, 1);
    assert.ok(after.filter((x) => x.id !== mine(winner)!.id).every((x) => x.status === "CANCELLED"));
    assert.ok(await prisma.orderEvent.findFirst({ where: { orderId: o.id, type: "ACCEPT", actorId: winner.id } }));
    // The winner now works the order with the visit endpoints.
    const detail = await call("GET", `/api/nurse/orders/${o.id}`, winner.token);
    assert.equal(detail.status, 200);
  });

  it("simultaneous accepts: exactly one succeeds", async () => {
    const ns = await Promise.all([nurse(), nurse(), nurse()]);
    const o = await paid();
    await runDispatchCycle(prisma);
    const offers = (await offersOf(o.id)).filter((x) => ns.some((n) => n.id === x.nurseId));
    const res = await Promise.all(
      offers.map((of) => call("POST", `/api/nurse/offers/${of.id}/accept`, ns.find((n) => n.id === of.nurseId)!.token)),
    );
    assert.equal(res.filter((r) => r.status === 200).length, 1);
    assert.ok(res.filter((r) => r.status !== 200).every((r) => r.status === 409));
  });

  it("an expired offer cannot be accepted", async () => {
    const n = await nurse();
    const o = await paid();
    const t0 = new Date();
    await runDispatchCycle(prisma, t0);
    const of = (await offersOf(o.id)).find((x) => x.nurseId === n.id);
    assert.ok(of);
    await assert.rejects(
      acceptOffer(prisma, n.id, of!.id, new Date(t0.getTime() + OFFER_TTL_MS + 1)),
      (e: { code?: string }) => e.code === "OFFER_EXPIRED",
    );
  });

  it("decline marks the offer and the nurse is not asked again", async () => {
    const n = await nurse();
    const o = await paid();
    await runDispatchCycle(prisma);
    const of = (await offersOf(o.id)).find((x) => x.nurseId === n.id);
    assert.ok(of);
    const r = await call("POST", `/api/nurse/offers/${of!.id}/decline`, n.token);
    assert.equal(r.status, 200);
    assert.equal((await prisma.orderOffer.findUniqueOrThrow({ where: { id: of!.id } })).status, "DECLINED");
    const again = await call("POST", `/api/nurse/offers/${of!.id}/decline`, n.token);
    assert.equal(errorCode(again), "OFFER_EXPIRED");
  });

  it("a nurse cannot touch someone else's offer", async () => {
    const [a, b] = await Promise.all([nurse(), nurse()]);
    const o = await paid();
    await runDispatchCycle(prisma);
    const of = (await offersOf(o.id)).find((x) => x.nurseId === a.id);
    assert.ok(of);
    const r = await call("POST", `/api/nurse/offers/${of!.id}/accept`, b.token);
    assert.equal(r.status, 404);
    assert.equal(errorCode(r), "OFFER_NOT_FOUND");
  });

  it("losing eligibility between offer and accept blocks the accept", async () => {
    const n = await nurse();
    const o = await paid();
    await runDispatchCycle(prisma);
    const of = (await offersOf(o.id)).find((x) => x.nurseId === n.id);
    assert.ok(of);
    await prisma.nurseProfile.update({ where: { userId: n.id }, data: { status: "SUSPENDED" } });
    const r = await call("POST", `/api/nurse/offers/${of!.id}/accept`, n.token);
    assert.equal(r.status, 409);
    assert.equal(errorCode(r), "NOT_ELIGIBLE");
  });

  it("an admin's hand assignment cancels the open offers", async () => {
    await nurse();
    const target = await nurse();
    const o = await paid();
    await runDispatchCycle(prisma);
    assert.ok((await offersOf(o.id)).some((x) => x.status === "PENDING"));
    const r = await call("POST", `/api/staff/orders/${o.id}/assign`, admin, { version: o.version, nurseId: target.id });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.ok((await offersOf(o.id)).every((x) => x.status !== "PENDING"));
  });
});

describe("nurse offers API and profile", () => {
  it("lists only my live offers, hides the address and shows the 70% share", async () => {
    const n = await nurse();
    const o = await paid();
    await runDispatchCycle(prisma);
    const mine = (await offersOf(o.id)).find((x) => x.nurseId === n.id);
    assert.ok(mine);
    const r = await call("GET", "/api/nurse/offers", n.token);
    assert.equal(r.status, 200);
    const offer = r.json.data.offers.find((x: { id: string }) => x.id === mine!.id);
    assert.ok(offer);
    assert.equal(offer.order.area, "Баянзүрх");
    assert.equal(offer.earnings.nurseShareMnt, 17500);
    assert.equal(offer.earnings.sharePercent, 70);
    assert.equal(JSON.stringify(r.json).includes("Нууц хаяг"), false);
    assert.equal(JSON.stringify(r.json).includes("99112233"), false);
    assert.equal((await call("GET", "/api/nurse/offers", child)).status, 403);
  });

  it("online toggle: refused when unverified or licence expired, allowed otherwise", async () => {
    const pending = await nurse({ status: "PENDING", isActive: false });
    const r1 = await call("PUT", "/api/nurse/me", pending.token, { isActive: true });
    assert.equal(r1.status, 409);
    assert.equal(errorCode(r1), "NOT_ELIGIBLE");
    const expired = await nurse({ licenseExpiresAt: future(-5), isActive: false });
    assert.equal((await call("PUT", "/api/nurse/me", expired.token, { isActive: true })).status, 409);

    const okNurse = await nurse({ isActive: false });
    const on = await call("PUT", "/api/nurse/me", okNurse.token, { isActive: true });
    assert.equal(on.status, 200);
    assert.equal(on.json.data.profile.isActive, true);
    const off = await call("PUT", "/api/nurse/me", okNurse.token, { isActive: false });
    assert.equal(off.json.data.profile.isActive, false);
    // An unverified nurse can always go offline.
    assert.equal((await call("PUT", "/api/nurse/me", pending.token, { isActive: false })).status, 200);
  });

  it("a nurse with no profile row sees null and cannot go online", async () => {
    const u = await createUser("NURSE");
    const token = await loginAs(srv.baseUrl, u.email);
    const me = await call("GET", "/api/nurse/me", token);
    assert.equal(me.json.data.profile, null);
    assert.equal((await call("PUT", "/api/nurse/me", token, { isActive: true })).status, 409);
    assert.equal((await call("PUT", "/api/nurse/me", token, { isActive: "yes" })).status, 400);
  });
});
