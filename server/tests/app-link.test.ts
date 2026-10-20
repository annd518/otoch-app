import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/tests/app-link.test.ts");
// Both real app service clients; real isolated API/DB; no ADMIN or admin API.
import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
import { runDispatchCycle } from "../src/services/dispatch";
const { createHttpClient: clientHttp } =
  require("../../App/services/httpClient") as typeof import("../../App/services/httpClient");
const {
  createDraftOrder,
  getOrder,
  getRedFlagQuestions,
  submitRedFlagAnswers,
  requestQuote,
} =
  require("../../App/services/orders") as typeof import("../../App/services/orders");
const { createInvoice, getPaymentState } =
  require("../../App/services/payment") as typeof import("../../App/services/payment");
const { clientV2 } =
  require("../../App/services/clientV2") as typeof import("../../App/services/clientV2");
const { createHttpClient: nurseHttp } =
  require("../../nurse-app/services/httpClient") as typeof import("../../nurse-app/services/httpClient");
const { fetchOffers, acceptOffer } =
  require("../../nurse-app/services/offers") as typeof import("../../nurse-app/services/offers");
const { fetchNurseOrder, postEta } =
  require("../../nurse-app/services/staffOrders") as typeof import("../../nurse-app/services/staffOrders");
const { enRoute, checkin, saveRecord, finish } =
  require("../../nurse-app/services/nurseVisit") as typeof import("../../nurse-app/services/nurseVisit");
function val<T>(r: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!r.ok) throw Error(JSON.stringify(r));
  return r.data;
}
let srv: TestServer, token: string, outsider: string, parentId: string;
let customer: ReturnType<typeof clientHttp>,
  stranger: ReturnType<typeof clientHttp>,
  nurse: ReturnType<typeof nurseHttp>,
  otherNurse: ReturnType<typeof nurseHttp>;
const zoneId = "APP_LINK_ZONE",
  ub = new Date(Date.now() + 8 * 3600000),
  start = new Date(
    Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate() + 1, 10) -
      8 * 3600000,
  );
before(async () => {
  srv = await startServer();
  const [c, o, n, nn] = await Promise.all([
    createUser("CHILD"),
    createUser("CHILD"),
    createUser("NURSE"),
    createUser("NURSE"),
  ]);
  const tokens = await Promise.all(
    [c, o, n, nn].map((u) => loginAs(srv.baseUrl, u.email)),
  );
  [token, outsider] = tokens as [string, string, string, string];
  const config = {
    ok: true as const,
    baseUrl: srv.baseUrl,
    mode: "real" as const,
    source: "explicit" as const,
    mockRequestIgnored: false,
  };
  customer = clientHttp({ config, fetch, getToken: async () => tokens[0]! });
  stranger = clientHttp({ config, fetch, getToken: async () => tokens[1]! });
  nurse = nurseHttp({ config, fetch, getToken: async () => tokens[2]! });
  otherNurse = nurseHttp({ config, fetch, getToken: async () => tokens[3]! });
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Д. Цэцэг · тест",
        birthYear: 1985,
        age: 41,
        gender: "Female",
        address: "Тест хаяг",
        emergencyContact: "99000001",
        children: { connect: { id: c.id } },
      },
    })
  ).id;
  await prisma.nurseProfile.updateMany({ data: { isActive: false } });
  await prisma.nurseProfile.create({
    data: {
      userId: n.id,
      status: "VERIFIED",
      isActive: true,
      licenseNo: "TEST-ONLY",
      licenseExpiresAt: new Date(Date.now() + 365 * 86400000),
      skillTags: [],
      zoneIds: [zoneId],
    },
  });
  for (const row of CATALOG_V2)
    await prisma.serviceCatalogItem.upsert({
      where: { code: row.code },
      create: fixtureCatalogRow(row),
      update: fixtureCatalogRow(row),
    });
  for (const q of RED_FLAG_V2_FIXTURES)
    await prisma.redFlagQuestion.upsert({
      where: {
        questionnaire_code: { questionnaire: q.questionnaire, code: q.code },
      },
      create: { ...q, isFixture: true },
      update: { ...q, isFixture: true },
    });
  await prisma.serviceZone.create({
    data: {
      id: zoneId,
      name: "Тест бүс",
      minLat: 47,
      maxLat: 49,
      minLng: 106,
      maxLng: 108,
    },
  });
  await prisma.availabilitySlot.create({
    data: {
      zoneId,
      startsAt: start,
      endsAt: new Date(+start + 3600000),
      capacity: 10,
    },
  });
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
async function draft() {
  const key = randomUUID();
  const input = {
    parentId,
    catalogVersion: null,
    items: [{ serviceCode: "S01", serviceId: "S01", quantity: 1 }],
    scheduledFor: start.toISOString(),
    timeSlot: "10:00-11:00",
    address: { text: "Туршилтын хаяг 123", lat: 48, lng: 107 },
    zoneId,
    bookingForm: {
      consent: {
        service: true,
        sensitiveData: true,
        version: "V2_2026_10" as const,
        signer: "RECIPIENT" as const,
        acceptedAt: new Date().toISOString(),
      },
      familyPresent: false,
      postoperative: false,
      medication: null,
    },
  };
  const order = val(await createDraftOrder(customer, input, key));
  const replay = val(await createDraftOrder(customer, input, key));
  assert.equal(replay.id, order.id, "retry must reuse the same draft");
  return order;
}
it("customer payment → nurse offer/accept → ETA/en-route/check-in → signed visit → owner record/PDF without admin", async () => {
  let order = await draft();
  const id = order.id,
    q = val(await getRedFlagQuestions(customer, id));
  assert.equal(q.questions.length, 6);
  val(
    await submitRedFlagAnswers(
      customer,
      id,
      q.questions.map((x) => ({ questionId: x.id, value: false })),
      q.questionnaires,
    ),
  );
  order = val(await getOrder(customer, id));
  const quote = val(await requestQuote(customer, id, order.version));
  const invoice = val(
    await createInvoice(customer, id, quote.id, randomUUID()),
  );
  assert.equal(invoice.isMock, true);
  assert.equal(
    (
      await api(
        srv.baseUrl,
        "POST",
        `/api/dev/qpay-mock/orders/${id}/payments/${invoice.id}/pay`,
        { token },
      )
    ).status,
    200,
  );
  assert.equal(
    val(await getPaymentState(customer, id, invoice.id)).status,
    "PAID",
  );
  await runDispatchCycle(prisma, start);
  const offers = val(await fetchOffers(nurse));
  const offer = offers.find((x) =>
    x.items.some((i) => i.serviceCode === "S01"),
  );
  assert.ok(offer);
  assert.equal(JSON.stringify(offers).includes("Туршилтын хаяг 123"), false);
  assert.equal((await fetchNurseOrder(otherNurse, id)).ok, false);
  let assigned = val(await acceptOffer(nurse, offer.id));
  assert.equal(assigned.id, id);
  assert.equal(val(await getOrder(customer, id)).status, "ASSIGNED");
  const eta = new Date(+start - 10 * 60000).toISOString();
  assigned = val(await postEta(nurse, id, assigned.version, eta));
  assert.equal(val(await getOrder(customer, id)).eta, eta);
  const stale = assigned.version;
  assigned = val(await enRoute(nurse, id, assigned.version));
  assert.equal(val(await getOrder(customer, id)).status, "EN_ROUTE");
  assert.equal((await enRoute(nurse, id, stale)).ok, false);
  // Only this isolated fixture moves to now; production GPS/time checks stay intact.
  await prisma.order.update({
    where: { id },
    data: { scheduledFor: new Date() },
  });
  assigned = val(
    await checkin(nurse, id, { version: assigned.version, lat: 48, lng: 107 }),
  );
  assert.equal(val(await getOrder(customer, id)).status, "IN_PROGRESS");
  const records = () => clientV2(customer).records();
  assert.equal(
    val(await records()).some((r) => r.orderId === id),
    false,
  );
  const signature = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(
    (
      await finish(nurse, id, {
        version: assigned.version,
        signerName: "Д.Цэцэг",
        signature,
      })
    ).ok,
    false,
  );
  val(
    await saveRecord(nurse, id, {
      vitals: { pulse: 72, spo2: 98 },
      procedures: ["VITALS"],
      note: "Туршилтын сувилахуйн тэмдэглэл",
    }),
  );
  assert.equal(
    val(await records()).some((r) => r.orderId === id),
    false,
    "unsigned record is private",
  );
  assert.equal(
    val(
      await finish(nurse, id, {
        version: assigned.version,
        signerName: "Д.Цэцэг",
        signature,
      }),
    ).status,
    "COMPLETED",
  );
  const completed = val(await getOrder(customer, id));
  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.timeline?.some((e) => e.status === "EN_ROUTE"));
  assert.ok(completed.timeline?.some((e) => e.status === "COMPLETED"));
  const rows = val(await records()),
    row = rows.find((r) => r.orderId === id);
  assert.ok(row);
  assert.equal(row.source, "nurse");
  assert.equal(row.notes, "Туршилтын сувилахуйн тэмдэглэл");
  assert.equal(JSON.stringify(rows).includes("signature"), false);
  assert.equal(
    val(await clientV2(stranger).records()).some((r) => r.orderId === id),
    false,
  );
  assert.equal((await getOrder(stranger, id)).ok, false);
  const path = `${srv.baseUrl}/api/client/records/${encodeURIComponent(row.id)}/pdf`;
  const pdf = await fetch(path, {
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
  assert.equal(
    (await fetch(path, { headers: { Authorization: `Bearer ${outsider}` } }))
      .status,
    404,
  );
  assert.equal((await saveRecord(nurse, id, { note: "overwrite" })).ok, false);
});
it("positive red flag cannot become a quote or dispatch offer", async () => {
  const order = await draft(),
    q = val(await getRedFlagQuestions(customer, order.id));
  val(
    await submitRedFlagAnswers(
      customer,
      order.id,
      [{ questionId: q.questions[0]!.id, value: true }],
      q.questionnaires,
    ),
  );
  assert.equal(
    val(await getOrder(customer, order.id)).status,
    "BLOCKED_RED_FLAG",
  );
  assert.equal((await requestQuote(customer, order.id, 2)).ok, false);
  await runDispatchCycle(prisma);
  assert.equal(
    await prisma.orderOffer.count({ where: { orderId: order.id } }),
    0,
  );
  assert.equal((await fetchNurseOrder(nurse, order.id)).ok, false);
});
