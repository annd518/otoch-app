import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  createUser,
  loginAs,
  prisma,
  startServer,
  type TestServer,
} from "./helpers";
import { fixtureCatalogRow } from "../src/services/serviceMetadata";
import { CATALOG_V2 } from "../src/data/catalogV2";
import { RED_FLAG_V2_FIXTURES } from "../prisma/fixtures/redFlags";
let srv: TestServer,
  token: string,
  otherToken: string,
  parentId: string,
  userId: string;
const startsAt = new Date(Date.now() + 4 * 3600000);
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
}).format(startsAt);
before(async () => {
  srv = await startServer();
  const user = await createUser("CHILD");
  userId = user.id;
  token = await loginAs(srv.baseUrl, user.email);
  const other = await createUser("CHILD");
  otherToken = await loginAs(srv.baseUrl, other.email);
  const parent = await prisma.parent.create({
    data: {
      name: "Тест өвчтөн",
      age: 30,
      birthYear: 1996,
      gender: "Other",
      address: "Тест хаяг",
      emergencyContact: "99112233",
      children: { connect: { id: user.id } },
    },
  });
  parentId = parent.id;
  for (const row of CATALOG_V2)
    await prisma.serviceCatalogItem.upsert({
      where: { code: row.code },
      create: fixtureCatalogRow(row),
      update: {},
    });
  for (const q of RED_FLAG_V2_FIXTURES)
    await prisma.redFlagQuestion.upsert({
      where: {
        questionnaire_code: { questionnaire: q.questionnaire, code: q.code },
      },
      create: { ...q, isFixture: true },
      update: {},
    });
  await prisma.serviceZone.create({
    data: {
      id: "TEST_V2_ZONE",
      name: "Тест бүс",
      minLat: 47,
      maxLat: 49,
      minLng: 106,
      maxLng: 108,
    },
  });
  await prisma.availabilitySlot.create({
    data: {
      zoneId: "TEST_V2_ZONE",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      capacity: 1,
    },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
const form = {
  consent: {
    service: true,
    sensitiveData: true,
    version: "V2_2026_10",
    acceptedAt: new Date().toISOString(),
  },
  familyPresent: false,
  postoperative: false,
  medication: null,
};
it("optional medication is validated when supplied; expired medicine cannot bypass guards", async () => {
  const r = await draft({
    ...form,
    medication: {
      name: "Тест эм",
      dose: "Тест тун",
      route: "Тест арга",
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
      doseNumber: 2,
    },
  });
  const id = r.json.data.order.id;
  await clear(id);
  const quote = await api(srv.baseUrl, "POST", `/api/orders/${id}/quote`, {
    token,
    body: {},
  });
  assert.equal(quote.status, 422);
  assert.equal(quote.json.error.code, "MED_EXPIRED");
});
async function draft(bookingForm?: Record<string, unknown>) {
  return api(srv.baseUrl, "POST", "/api/orders", {
    token,
    body: {
      parentId,
      items: [{ serviceCode: "S01" }],
      scheduledFor: startsAt.toISOString(),
      timeSlot: `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ulaanbaatar" }).format(startsAt)}-${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ulaanbaatar" }).format(new Date(startsAt.getTime() + 3600000))}`,
      address: { text: "Тест хаяг 123", lat: 48, lng: 107 },
      zoneId: "TEST_V2_ZONE",
      ...(bookingForm && { bookingForm }),
    },
  });
}
async function clear(id: string) {
  const q = await api(
    srv.baseUrl,
    "GET",
    `/api/orders/${id}/red-flag-questions`,
    { token },
  );
  return api(srv.baseUrl, "PUT", `/api/orders/${id}/red-flag-answers`, {
    token,
    body: {
      questionnaires: q.json.data.questionnaires,
      answers: q.json.data.questions.map((question: { id: string }) => ({
        questionId: question.id,
        value: false,
      })),
    },
  });
}
it("serves 10 document-derived services in four groups, with unapproved config", async () => {
  const r = await api(srv.baseUrl, "GET", "/api/catalog/services", { token });
  const services = r.json.data.services.filter((s: { code: string }) =>
    /^S\d{2}$/.test(s.code),
  );
  assert.equal(services.length, 10);
  assert.equal(
    new Set(services.map((s: { group: string }) => s.group)).size,
    4,
  );
  assert.ok(
    services.every(
      (s: { isFixture: boolean; formConfig: { approved: boolean } }) =>
        s.isFixture && !s.formConfig.approved,
    ),
  );
});
it("six answers are required; positive response blocks immediately", async () => {
  const r = await draft(form);
  const id = r.json.data.order.id;
  const q = await api(
    srv.baseUrl,
    "GET",
    `/api/orders/${id}/red-flag-questions`,
    { token },
  );
  assert.equal(q.json.data.questions.length, 6);
  const answer = q.json.data.questions[0].id;
  const incomplete = await api(
    srv.baseUrl,
    "PUT",
    `/api/orders/${id}/red-flag-answers`,
    { token, body: { answers: [{ questionId: answer, value: false }] } },
  );
  assert.equal(incomplete.status, 400);
  const positive = await api(
    srv.baseUrl,
    "PUT",
    `/api/orders/${id}/red-flag-answers`,
    { token, body: { answers: [{ questionId: answer, value: true }] } },
  );
  assert.equal(positive.json.data.orderStatus, "BLOCKED_RED_FLAG");
});
it("direct quote cannot bypass missing consent", async () => {
  const r = await draft();
  const id = r.json.data.order.id;
  await clear(id);
  const q = await api(srv.baseUrl, "POST", `/api/orders/${id}/quote`, {
    token,
    body: {},
  });
  assert.equal(q.json.error.code, "CONSENT_REQUIRED");
});
it("valid safety data and actual slot allow a fixture quote", async () => {
  const r = await draft(form);
  const id = r.json.data.order.id;
  await clear(id);
  const q = await api(srv.baseUrl, "POST", `/api/orders/${id}/quote`, {
    token,
    body: {},
  });
  assert.equal(q.status, 201);
  assert.equal(q.json.data.quote.totalMnt, 25000);
});
it("returns real configured availability, omits full slots", async () => {
  let r = await api(
    srv.baseUrl,
    "GET",
    `/api/client/availability?zoneId=TEST_V2_ZONE&date=${day}&serviceCode=S01`,
    { token },
  );
  assert.equal(r.json.data.slots.length, 1);
  const d = await draft(form);
  await prisma.order.update({
    where: { id: d.json.data.order.id },
    data: { status: "PAID" },
  });
  r = await api(
    srv.baseUrl,
    "GET",
    `/api/client/availability?zoneId=TEST_V2_ZONE&date=${day}&serviceCode=S01`,
    { token },
  );
  assert.equal(r.json.data.slots.length, 0);
});
it("foreign order and record access stay private", async () => {
  const d = await draft(form);
  const r = await api(
    srv.baseUrl,
    "GET",
    `/api/orders/${d.json.data.order.id}`,
    { token: otherToken },
  );
  assert.equal(r.status, 404);
  const pdf = await fetch(`${srv.baseUrl}/api/client/records/missing/pdf`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  assert.equal(pdf.status, 404);
});
it("account deletion requests are idempotent and retain existing records", async () => {
  const a = await api(
    srv.baseUrl,
    "POST",
    "/api/client/account/deletion-request",
    { token, body: {} },
  );
  const b = await api(
    srv.baseUrl,
    "POST",
    "/api/client/account/deletion-request",
    { token, body: {} },
  );
  assert.equal(a.json.data.id, b.json.data.id);
  assert.ok(await prisma.user.findUnique({ where: { id: userId } }));
});
it("OTP delivery is gated, then mock verify rotates refresh token once", async () => {
  delete process.env.SMS_DRIVER;
  const gated = await api(srv.baseUrl, "POST", "/api/auth/otp/request", {
    body: { phone: "+97699009900" },
  });
  assert.equal(gated.status, 503);
  process.env.SMS_DRIVER = "mock";
  process.env.EXPOSE_TEST_OTP = "true";
  const a = await api(srv.baseUrl, "POST", "/api/auth/otp/request", {
    body: { phone: "+97699009900" },
  });
  assert.equal(a.status, 200);
  const repeated = await api(srv.baseUrl, "POST", "/api/auth/otp/request", {
    body: { phone: "+97699009900" },
  });
  assert.equal(repeated.status, 429);
  const v = await api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
    body: {
      phone: "+97699009900",
      challengeId: a.json.data.challengeId,
      code: a.json.data.testCode,
      name: "Тест хэрэглэгч",
    },
  });
  assert.equal(v.status, 200);
  assert.equal(v.json.data.user.role, "CHILD");
  assert.equal("password" in v.json.data.user, false);
  const reused = await api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
    body: {
      phone: "+97699009900",
      challengeId: a.json.data.challengeId,
      code: a.json.data.testCode,
    },
  });
  assert.equal(reused.status, 400);
  const rotated = await api(srv.baseUrl, "POST", "/api/auth/refresh", {
    body: { refreshToken: v.json.data.refreshToken },
  });
  assert.equal(rotated.status, 200);
  const replay = await api(srv.baseUrl, "POST", "/api/auth/refresh", {
    body: { refreshToken: v.json.data.refreshToken },
  });
  assert.equal(replay.status, 401);
  await api(srv.baseUrl, "POST", "/api/auth/logout", {
    body: { refreshToken: rotated.json.data.refreshToken },
  });
  const loggedOut = await api(srv.baseUrl, "POST", "/api/auth/refresh", {
    body: { refreshToken: rotated.json.data.refreshToken },
  });
  assert.equal(loggedOut.status, 401);
  delete process.env.SMS_DRIVER;
  delete process.env.EXPOSE_TEST_OTP;
});
it("three wrong codes lock the challenge; production never exposes mock codes", async () => {
  process.env.SMS_DRIVER = "mock";
  process.env.EXPOSE_TEST_OTP = "true";
  const a = await api(srv.baseUrl, "POST", "/api/auth/otp/request", {
    body: { phone: "+97699009901" },
  });
  const wrong = a.json.data.testCode === "000000" ? "111111" : "000000";
  for (let i = 0; i < 3; i++) {
    const r = await api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
      body: {
        phone: "+97699009901",
        challengeId: a.json.data.challengeId,
        code: wrong,
      },
    });
    assert.equal(r.status, i === 2 ? 429 : 400);
  }
  const locked = await prisma.otpChallenge.findUniqueOrThrow({
    where: { id: a.json.data.challengeId },
  });
  assert.ok(
    locked.lockedUntil &&
      locked.lockedUntil.getTime() > Date.now() + 14 * 60000,
  );
  const lockResend = await api(srv.baseUrl, "POST", "/api/auth/otp/request", {
    body: { phone: "+97699009901" },
  });
  assert.equal(lockResend.json.error.code, "OTP_LOCKED");
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const prod = await api(srv.baseUrl, "POST", "/api/auth/otp/request", {
    body: { phone: "+97699009902" },
  });
  assert.equal(prod.status, 503);
  process.env.NODE_ENV = before;
  delete process.env.SMS_DRIVER;
  delete process.env.EXPOSE_TEST_OTP;
});
it("missing birth year and required family presence block direct quote", async () => {
  await prisma.parent.update({
    where: { id: parentId },
    data: { birthYear: null },
  });
  let d = await draft(form);
  await clear(d.json.data.order.id);
  let q = await api(
    srv.baseUrl,
    "POST",
    `/api/orders/${d.json.data.order.id}/quote`,
    { token, body: {} },
  );
  assert.equal(q.json.error.code, "PATIENT_DETAILS_REQUIRED");
  await prisma.parent.update({
    where: { id: parentId },
    data: { birthYear: 1996, needsRepresentative: true },
  });
  d = await draft(form);
  await clear(d.json.data.order.id);
  q = await api(
    srv.baseUrl,
    "POST",
    `/api/orders/${d.json.data.order.id}/quote`,
    { token, body: {} },
  );
  assert.equal(q.json.error.code, "FAMILY_REQUIRED");
  await prisma.parent.update({
    where: { id: parentId },
    data: { needsRepresentative: false },
  });
});
it("medication, first dose and expiry guards cannot be bypassed", async () => {
  for (const [medication, expected] of [
    [null, "MEDICATION_REQUIRED"],
    [
      {
        name: "Тест эм",
        dose: "1",
        route: "Тест арга",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        doseNumber: 1,
      },
      "FIRST_DOSE_NOT_ALLOWED",
    ],
    [
      {
        name: "Тест эм",
        dose: "1",
        route: "Тест арга",
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        doseNumber: 2,
      },
      "MED_EXPIRED",
    ],
  ] as const) {
    const d = await api(srv.baseUrl, "POST", "/api/orders", {
      token,
      body: {
        parentId,
        items: [{ serviceCode: "S02" }],
        bookingForm: { ...form, medication },
        zoneId: "TEST_V2_ZONE",
        scheduledFor: startsAt.toISOString(),
        timeSlot: "09:00-10:00",
        address: { text: "Тест хаяг 123", lat: 48, lng: 107 },
      },
    });
    await clear(d.json.data.order.id);
    const q = await api(
      srv.baseUrl,
      "POST",
      `/api/orders/${d.json.data.order.id}/quote`,
      { token, body: {} },
    );
    assert.equal(q.json.error.code, expected);
  }
});
it("approved Cyrillic note exports a private PDF; foreign users cannot read it", async () => {
  const visit = await prisma.visit.create({
    data: {
      parentId,
      visitType: "FULL",
      status: "APPROVED",
      scheduledFor: new Date(),
      approvedAt: new Date(),
      vitals: {
        create: { notes: "Монгол тэмдэглэл: Өвчтөний мэдээлэл", pulse: "72" },
      },
    },
  });
  const records = await api(srv.baseUrl, "GET", "/api/client/records", {
    token,
  });
  assert.ok(
    records.json.data.records.some((r: { id: string }) => r.id === visit.id),
  );
  const pdf = await fetch(srv.baseUrl + `/api/client/records/${visit.id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type") ?? "", /application\/pdf/);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  const foreign = await fetch(
    srv.baseUrl + `/api/client/records/${visit.id}/pdf`,
    { headers: { Authorization: `Bearer ${otherToken}` } },
  );
  assert.equal(foreign.status, 404);
});
it("short windows and under-two-hour bookings are refused by quote guards", async () => {
  const short = await api(srv.baseUrl, "POST", "/api/orders", {
    token,
    body: {
      parentId,
      items: [{ serviceCode: "S01" }],
      bookingForm: form,
      zoneId: "TEST_V2_ZONE",
      scheduledFor: new Date(Date.now() + 3600000).toISOString(),
      timeSlot: "09:00-10:00",
      address: { text: "Тест хаяг 123", lat: 48, lng: 107 },
    },
  });
  await clear(short.json.data.order.id);
  const quote = await api(
    srv.baseUrl,
    "POST",
    `/api/orders/${short.json.data.order.id}/quote`,
    { token, body: {} },
  );
  assert.equal(quote.json.error.code, "AVAILABILITY_REQUIRED");
});
it("availability rejects an invalid calendar date and excludes a short window for S03", async () => {
  const bad = await api(
    srv.baseUrl,
    "GET",
    "/api/client/availability?zoneId=TEST_V2_ZONE&date=2026-02-30&serviceCode=S01",
    { token },
  );
  assert.equal(bad.status, 400);
  const short = await api(
    srv.baseUrl,
    "GET",
    `/api/client/availability?zoneId=TEST_V2_ZONE&date=${day}&serviceCode=S03`,
    { token },
  );
  assert.equal(short.status, 200);
  assert.deepEqual(short.json.data.slots, []);
});
it("two simultaneous capacity claims create only one invoice for a single slot", async () => {
  const start = new Date(Date.now() + 24 * 3600000),
    end = new Date(start.getTime() + 3600000);
  await prisma.availabilitySlot.create({
    data: { zoneId: "TEST_V2_ZONE", startsAt: start, endsAt: end, capacity: 1 },
  });
  const time = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ulaanbaatar",
    }).format(d);
  const ids: string[] = [],
    quoteIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const d = await api(srv.baseUrl, "POST", "/api/orders", {
      token,
      body: {
        parentId,
        items: [{ serviceCode: "S01" }],
        bookingForm: form,
        zoneId: "TEST_V2_ZONE",
        scheduledFor: start.toISOString(),
        timeSlot: `${time(start)}-${time(end)}`,
        address: { text: "Тест хаяг 123", lat: 48, lng: 107 },
      },
    });
    const id = d.json.data.order.id;
    await clear(id);
    const q = await api(srv.baseUrl, "POST", `/api/orders/${id}/quote`, {
      token,
      body: {},
    });
    assert.equal(q.status, 201);
    ids.push(id);
    quoteIds.push(q.json.data.quote.id);
  }
  const results = await Promise.all(
    ids.map((id, i) =>
      fetch(srv.baseUrl + `/api/orders/${id}/payments/qpay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `capacity-claim-${i}`,
        },
        body: JSON.stringify({ quoteId: quoteIds[i] }),
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await prisma.payment.count({ where: { orderId: { in: ids } } }),
    1,
  );
  assert.equal(
    await prisma.order.count({
      where: { id: { in: ids }, status: "AWAITING_PAYMENT" },
    }),
    1,
  );
});
