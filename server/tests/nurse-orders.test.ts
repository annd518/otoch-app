import { before, after, describe, it } from "node:test";
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
import { getStorage } from "../src/services/storage";
import { distanceMeters } from "../src/routes/nurseOrders";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const HOME = { lat: 47.9184, lng: 106.9177 };
const GOOD = {
  method: "GEO",
  ...HOME,
  checklist: { identified: true, hygiene: true, medicationChecked: true },
};

let srv: TestServer,
  nurse: string,
  other: string,
  child: string,
  admin: string,
  nurseId: string,
  childId: string,
  parentId: string;

before(async () => {
  srv = await startServer();
  const [n, o, c, a] = await Promise.all([
    createUser("NURSE"),
    createUser("NURSE"),
    createUser("CHILD"),
    createUser("ADMIN"),
  ]);
  [nurse, other, child, admin] = await Promise.all(
    [n, o, c, a].map((u) => loginAs(srv.baseUrl, u.email)),
  );
  nurseId = n.id;
  childId = c.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Тест өвчтөн",
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

const url = (id: string, tail = "") => `/api/nurse/orders/${id}${tail}`;
const call = (
  method: string,
  id: string,
  tail: string,
  token: string,
  body?: unknown,
) => api(srv.baseUrl, method, url(id, tail), { token, body });

async function assigned(
  extra: Record<string, unknown> = {},
  withMedication = false,
) {
  return prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "TEST",
      status: "ASSIGNED",
      redFlagStatus: "CLEAR",
      assignedNurseId: nurseId,
      scheduledFor: new Date(),
      lat: HOME.lat,
      lng: HOME.lng,
      bookingForm: withMedication
        ? { medication: { name: "X", dose: "1", route: "im" } }
        : undefined,
      ...extra,
    },
  });
}
const version = async (id: string) =>
  (await prisma.order.findUniqueOrThrow({ where: { id } })).version;
const checkedIn = async (withMedication = false) => {
  const o = await assigned({}, withMedication);
  const r = await call("POST", o.id, "/checkin", nurse, {
    version: o.version,
    ...GOOD,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return o;
};

describe("access", () => {
  it("a deactivated nurse's token answers 401 ACCOUNT_DISABLED on the nurse routes (the app signs out), a wrong role stays 403", async () => {
    const gone = await createUser("NURSE");
    const token = await loginAs(srv.baseUrl, gone.email);
    const o = await assigned();
    assert.equal((await call("GET", o.id, "", token)).status, 404, "still active: not hers");
    await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    for (const path of [
      url(o.id),
      "/api/nurse/offers",
      "/api/nurse/me",
    ]) {
      const r = await api(srv.baseUrl, "GET", path, { token });
      assert.equal(r.status, 401, path);
      assert.equal(errorCode(r), "ACCOUNT_DISABLED", path);
    }
    // The shared staff router keeps its documented 403 (admin web depends on it).
    assert.equal((await api(srv.baseUrl, "GET", "/api/staff/orders", { token })).status, 403);
    assert.equal((await call("GET", o.id, "", child)).status, 403);
  });

  it("only NURSE role; only the assigned nurse", async () => {
    const o = await assigned();
    assert.equal((await call("GET", o.id, "", child)).status, 403);
    assert.equal((await call("GET", o.id, "", admin)).status, 403);
    assert.equal((await call("GET", o.id, "", other)).status, 404);
    assert.equal(
      (await call("POST", o.id, "/en-route", other, { version: 1 })).status,
      404,
    );
    const mine = await call("GET", o.id, "", nurse);
    assert.equal(mine.status, 200);
    assert.equal(mine.json.data.order.patientContact, "99112233");
  });

  it("patient phone is withheld once the visit is over", async () => {
    const o = await assigned({ status: "COMPLETED" });
    const r = await call("GET", o.id, "", nurse);
    assert.equal(r.json.data.order.patientContact, null);
  });
});

describe("en route and check-in", () => {
  it("ASSIGNED -> EN_ROUTE, ETA still settable, family timeline shows it", async () => {
    const o = await assigned();
    const r = await call("POST", o.id, "/en-route", nurse, {
      version: o.version,
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.order.status, "EN_ROUTE");
    const eta = await api(
      srv.baseUrl,
      "POST",
      `/api/staff/orders/${o.id}/eta`,
      {
        token: nurse,
        body: {
          version: r.json.data.order.version,
          eta: new Date(Date.now() + 600_000).toISOString(),
        },
      },
    );
    assert.equal(eta.status, 200);
    const family = await api(srv.baseUrl, "GET", `/api/orders/${o.id}`, {
      token: child,
    });
    assert.ok(
      family.json.data.order.timeline.some(
        (x: { status: string }) => x.status === "EN_ROUTE",
      ),
    );
  });

  it("stale version -> VERSION_CONFLICT; wrong status -> INVALID_STATUS", async () => {
    const o = await assigned();
    const stale = await call("POST", o.id, "/en-route", nurse, {
      version: o.version + 5,
    });
    assert.equal(errorCode(stale), "VERSION_CONFLICT");
    const done = await assigned({ status: "COMPLETED" });
    const wrong = await call("POST", done.id, "/en-route", nurse, {
      version: done.version,
    });
    assert.equal(errorCode(wrong), "INVALID_STATUS");
  });

  it("flagged orders cannot start", async () => {
    const o = await assigned({ redFlagStatus: "FLAGGED" });
    const r = await call("POST", o.id, "/checkin", nurse, {
      version: o.version,
      ...GOOD,
    });
    assert.equal(errorCode(r), "INVALID_STATUS");
  });

  it("check-in needs all three checklist items", async () => {
    const o = await assigned();
    const r = await call("POST", o.id, "/checkin", nurse, {
      version: o.version,
      ...GOOD,
      checklist: { identified: true, hygiene: false, medicationChecked: true },
    });
    assert.equal(r.status, 400);
    assert.equal(errorCode(r), "VALIDATION_ERROR");
  });

  it("check-in refuses to start from far away (> 200 m)", async () => {
    const o = await assigned();
    const r = await call("POST", o.id, "/checkin", nurse, {
      version: o.version,
      ...GOOD,
      lat: HOME.lat + 0.01, // about 1.1 km
    });
    assert.equal(r.status, 422);
    assert.equal(errorCode(r), "CHECKIN_TOO_FAR");
    assert.equal(await version(o.id), o.version);
  });

  it("check-in refuses outside +-30 min of the booked time", async () => {
    const o = await assigned({
      scheduledFor: new Date(Date.now() + 3 * 3600_000),
    });
    const r = await call("POST", o.id, "/checkin", nurse, {
      version: o.version,
      ...GOOD,
    });
    assert.equal(r.status, 422);
    assert.equal(errorCode(r), "CHECKIN_TIME_WINDOW");
  });

  it("check-in succeeds near the address, stores the record and moves to IN_PROGRESS", async () => {
    const o = await assigned();
    const r = await call("POST", o.id, "/checkin", nurse, {
      version: o.version,
      ...GOOD,
      lat: HOME.lat + 0.0005, // about 55 m
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.data.order.status, "IN_PROGRESS");
    const rec = await call("GET", o.id, "/record", nurse);
    assert.ok(rec.json.data.record.checkinAt);
    assert.ok(rec.json.data.record.checkinDistanceM < 200);
  });

  it("an order without coordinates can still be started (distance unverified)", async () => {
    const o = await assigned({ lat: null, lng: null });
    const r = await call("POST", o.id, "/checkin", nurse, {
      version: o.version,
      ...GOOD,
    });
    assert.equal(r.status, 200);
    const rec = await call("GET", o.id, "/record", nurse);
    assert.equal(rec.json.data.record.checkinDistanceM, null);
  });

  it("haversine sanity", () => {
    assert.equal(distanceMeters(HOME, HOME), 0);
    const d = distanceMeters(HOME, { lat: HOME.lat + 0.001, lng: HOME.lng });
    assert.ok(d > 105 && d < 118, String(d));
  });
});

describe("visit record", () => {
  it("autosave only while IN_PROGRESS", async () => {
    const o = await assigned();
    const r = await call("PUT", o.id, "/record", nurse, { note: "x" });
    assert.equal(errorCode(r), "INVALID_STATUS");
  });

  it("rejects out-of-range vitals and unknown fields", async () => {
    const o = await checkedIn();
    for (const body of [
      { vitals: { systolic: 400 } },
      { vitals: { pulse: 5 } },
      { vitals: { temperatureC: 50 } },
      { vitals: { spo2: 101 } },
      { vitals: { systolic: 80, diastolic: 90 } },
      { note: "x".repeat(2001) },
      { surprise: true },
    ]) {
      const r = await call("PUT", o.id, "/record", nurse, body);
      assert.equal(r.status, 400, JSON.stringify(body));
    }
  });

  it("autosave merges fields and survives a reload", async () => {
    const o = await checkedIn();
    await call("PUT", o.id, "/record", nurse, {
      vitals: { systolic: 128, diastolic: 82, pulse: 74 },
    });
    await call("PUT", o.id, "/record", nurse, {
      procedures: ["INJ"],
      note: "Хүндрэлгүй",
    });
    const rec = (await call("GET", o.id, "/record", nurse)).json.data.record;
    assert.deepEqual(rec.vitals, { systolic: 128, diastolic: 82, pulse: 74 });
    assert.deepEqual(rec.procedures, ["INJ"]);
    assert.equal(rec.note, "Хүндрэлгүй");
    assert.equal(rec.signed, false);
  });

  it("finish needs vitals and procedures (RECORD_INCOMPLETE with fields)", async () => {
    const o = await checkedIn();
    const v = await version(o.id);
    const r = await call("POST", o.id, "/finish", nurse, {
      version: v,
      signerName: "Д.Цэцэг",
      signature: PNG,
    });
    assert.equal(r.status, 422);
    assert.equal(errorCode(r), "RECORD_INCOMPLETE");
    assert.ok(r.json.error.fields.vitals);
    assert.ok(r.json.error.fields.procedures);
    assert.equal((await version(o.id)), v);
  });

  it("finish needs all five medication checks when the order has a medicine", async () => {
    const o = await checkedIn(true);
    await call("PUT", o.id, "/record", nurse, {
      vitals: { pulse: 70 },
      procedures: ["INJ"],
      medicationChecks: {
        patient: true,
        medicine: true,
        dose: true,
        route: true,
        time: false,
      },
    });
    const body = {
      version: await version(o.id),
      signerName: "Д.Цэцэг",
      signature: PNG,
    };
    const r = await call("POST", o.id, "/finish", nurse, body);
    assert.equal(errorCode(r), "RECORD_INCOMPLETE");
    assert.ok(r.json.error.fields.medicationChecks);
    await call("PUT", o.id, "/record", nurse, {
      medicationChecks: {
        patient: true,
        medicine: true,
        dose: true,
        route: true,
        time: true,
      },
    });
    const ok2 = await call("POST", o.id, "/finish", nurse, body);
    assert.equal(ok2.status, 200, JSON.stringify(ok2.json));
  });

  it("finish rejects a signature that is not a PNG data URL", async () => {
    const o = await checkedIn();
    await call("PUT", o.id, "/record", nurse, {
      vitals: { pulse: 70 },
      procedures: ["INJ"],
    });
    const r = await call("POST", o.id, "/finish", nurse, {
      version: await version(o.id),
      signerName: "Д.Цэцэг",
      signature: "data:text/html;base64,PHNjcmlwdD4=",
    });
    assert.equal(r.status, 400);
  });

  it("signed finish completes the order; the record is then locked", async () => {
    const o = await checkedIn();
    await call("PUT", o.id, "/record", nurse, {
      vitals: { systolic: 120, diastolic: 80, pulse: 70, spo2: 98 },
      procedures: ["INJ", "VITALS"],
    });
    const r = await call("POST", o.id, "/finish", nurse, {
      version: await version(o.id),
      signerName: "Д.Цэцэг",
      signature: PNG,
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.data.order.status, "COMPLETED");
    const rec = (await call("GET", o.id, "/record", nurse)).json.data.record;
    assert.equal(rec.signed, true);
    const late = await call("PUT", o.id, "/record", nurse, { note: "late" });
    assert.equal(errorCode(late), "INVALID_STATUS");
  });

  it("the legacy complete cannot skip the signature of a nurse-app visit", async () => {
    const o = await checkedIn();
    const r = await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/complete`, {
      token: nurse,
      body: { version: await version(o.id) },
    });
    assert.equal(r.status, 409);
    assert.equal(errorCode(r), "RECORD_REQUIRED");
  });
});

describe("reject, incident, attachments", () => {
  it("rejects with a listed reason and stores it in the event", async () => {
    const o = await assigned();
    const bad = await call("POST", o.id, "/reject", nurse, {
      version: o.version,
      reason: "BORED",
    });
    assert.equal(bad.status, 400);
    const r = await call("POST", o.id, "/reject", nurse, {
      version: o.version,
      reason: "MED_EXPIRED",
      comment: "Хугацаа дууссан",
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.order.status, "REFUSED");
    const ev = await prisma.orderEvent.findFirstOrThrow({
      where: { orderId: o.id, type: "REJECT" },
    });
    assert.equal((ev.metadata as { reason: string }).reason, "MED_EXPIRED");
    assert.equal(ev.actorId, nurseId);
    const again = await call("POST", o.id, "/reject", nurse, {
      version: r.json.data.order.version,
      reason: "MED_EXPIRED",
    });
    assert.equal(errorCode(again), "INVALID_STATUS");
  });

  it("incident works from IN_PROGRESS and needs a description", async () => {
    const o = await checkedIn();
    const v = await version(o.id);
    assert.equal(
      (await call("POST", o.id, "/incident", nurse, { version: v })).status,
      400,
    );
    const r = await call("POST", o.id, "/incident", nurse, {
      version: v,
      description: "Өвчтөн ухаан алдсан, 103 дуудсан",
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.order.status, "INCIDENT");
  });

  it("referral photo is readable by the assigned nurse only, and only while open", async () => {
    const storage = getStorage();
    assert.ok(storage, "tests run with STORAGE_DRIVER=memory");
    const o = await assigned();
    const key = `test/${o.id}/ref.png`;
    await storage.put(key, Buffer.from("PNGDATA"));
    const att = await prisma.attachment.create({
      data: {
        orderId: o.id,
        uploaderId: childId,
        storageDriver: storage.driver,
        storageKey: key,
        mimeType: "image/png",
        sizeBytes: 7,
        sha256: "0".repeat(64),
      },
    });
    const path = `/attachments/${att.id}/content`;
    const mine = await fetch(srv.baseUrl + url(o.id, path), {
      headers: { Authorization: `Bearer ${nurse}` },
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.headers.get("content-type"), "image/png");
    assert.equal(mine.headers.get("cache-control"), "private, no-store");
    assert.equal(await mine.text(), "PNGDATA");
    assert.equal((await call("GET", o.id, path, other)).status, 404);
    assert.equal((await call("GET", o.id, path, child)).status, 403);
    await prisma.order.update({ where: { id: o.id }, data: { status: "COMPLETED" } });
    assert.equal((await call("GET", o.id, path, nurse)).status, 404);
  });
});
