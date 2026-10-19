import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import {
  prisma,
  api,
  createUser,
  loginAs,
  startServer,
  type TestServer,
} from "./helpers";
let srv: TestServer,
  admin: string,
  medical: string,
  nurse: string,
  otherNurse: string,
  child: string,
  parentId: string,
  nurseId: string,
  secondId: string,
  childId: string;
before(async () => {
  srv = await startServer();
  const a = await createUser("ADMIN"),
    m = await createUser("MEDICAL_ADMIN"),
    n = await createUser("NURSE"),
    o = await createUser("NURSE"),
    c = await createUser("CHILD");
  [admin, medical, nurse, otherNurse, child] = await Promise.all(
    [a, m, n, o, c].map((u) => loginAs(srv.baseUrl, u.email)),
  );
  nurseId = n.id;
  secondId = o.id;
  childId = c.id;
  parentId = (
    await prisma.parent.create({
      data: {
        name: "Тест өвчтөн",
        age: 30,
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
async function paid() {
  return prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "TEST",
      status: "PAID",
      redFlagStatus: "CLEAR",
    },
  });
}
it("only staff can list orders and only administrators can assign nurses", async () => {
  const o = await paid();
  assert.equal(
    (await api(srv.baseUrl, "GET", "/api/staff/orders", { token: child }))
      .status,
    403,
  );
  assert.equal(
    (await api(srv.baseUrl, "GET", "/api/staff/orders", { token: admin }))
      .status,
    200,
  );
  assert.equal(
    (
      await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
        token: nurse,
        body: { version: 1, nurseId },
      })
    ).status,
    403,
  );
  // OTOCH v2.0: no medical-admin role; a leftover MEDICAL_ADMIN has no access
  assert.equal(
    (
      await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
        token: medical,
        body: { version: 1, nurseId },
      })
    ).status,
    403,
  );
  assert.equal(
    (await api(srv.baseUrl, "GET", "/api/staff/orders", { token: medical }))
      .status,
    403,
  );
  assert.equal(
    (
      await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
        token: admin,
        body: { version: 1, nurseId },
      })
    ).status,
    200,
  );
});
it("concurrent assignment has one winner; reassignment revokes the former nurse access", async () => {
  const o = await paid();
  const results = await Promise.all(
    [nurseId, secondId].map((id) =>
      api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
        token: admin,
        body: { version: 1, nurseId: id },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const current = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
    token: admin,
    body: { version: current.version, nurseId },
  });
  const before = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
  await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
    token: admin,
    body: { version: before.version, nurseId: secondId },
  });
  assert.equal(
    (
      await api(srv.baseUrl, "GET", `/api/staff/orders/${o.id}`, {
        token: nurse,
      })
    ).status,
    404,
  );
});
it("assigned nurse updates ETA and advances the state once; family sees real events", async () => {
  const o = await paid();
  const assigned = await api(
    srv.baseUrl,
    "POST",
    `/api/staff/orders/${o.id}/assign`,
    { token: admin, body: { version: 1, nurseId } },
  );
  let version = assigned.json.data.order.version;
  assert.equal(
    (
      await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/start`, {
        token: otherNurse,
        body: { version },
      })
    ).status,
    404,
  );
  const e = await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/eta`, {
    token: nurse,
    body: { version, eta: new Date(Date.now() + 3600000).toISOString() },
  });
  assert.equal(e.status, 200);
  version = e.json.data.order.version;
  const starts = await Promise.all(
    [1, 2].map(() =>
      api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/start`, {
        token: nurse,
        body: { version },
      }),
    ),
  );
  assert.deepEqual(starts.map((r) => r.status).sort(), [200, 409]);
  const started = starts.find((r) => r.status === 200)!;
  const complete = await api(
    srv.baseUrl,
    "POST",
    `/api/staff/orders/${o.id}/complete`,
    { token: nurse, body: { version: started.json.data.order.version } },
  );
  assert.equal(complete.json.data.order.status, "COMPLETED");
  const family = await api(srv.baseUrl, "GET", `/api/orders/${o.id}`, {
    token: child,
  });
  assert.deepEqual(
    family.json.data.order.timeline.map((x: { status: string }) => x.status),
    ["ASSIGNED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"],
  );
  assert.equal(family.json.data.order.eta, null);
});
it("blocked orders and invalid transitions cannot be assigned or completed", async () => {
  const o = await prisma.order.create({
    data: {
      childId,
      parentId,
      catalogVersion: "TEST",
      status: "BLOCKED_RED_FLAG",
      redFlagStatus: "FLAGGED",
    },
  });
  assert.equal(
    (
      await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/assign`, {
        token: admin,
        body: { version: 1, nurseId },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api(srv.baseUrl, "POST", `/api/staff/orders/${o.id}/complete`, {
        token: nurse,
        body: { version: 1 },
      })
    ).status,
    404,
  );
});
