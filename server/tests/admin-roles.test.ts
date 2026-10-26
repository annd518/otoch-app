import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, uniqueEmail, type TestServer } from "./helpers";
import { PERMISSIONS, can, permissionsOf } from "../src/services/permissions";

// Back-office roles (spec slide 109): Super-admin, Ops, Finance, Support.
let srv: TestServer;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

before(async () => {
  srv = await startServer();
  for (const r of ["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT"] as const) {
    const u = await createUser("ADMIN", `rl-${r.toLowerCase()}`, r);
    ids[r] = u.id;
    tokens[r] = await loginAs(srv.baseUrl, u.email);
  }
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

const status = async (role: string, method: string, path: string, body?: unknown) =>
  (await api(srv.baseUrl, method, path, { token: tokens[role], body })).status;

it("the policy is default deny and follows the spec table", () => {
  assert.equal(can(null, "orders.view"), false);
  assert.equal(can("NURSE", "orders.view"), false);
  assert.equal(can("SUPPORT", "money.view"), false);
  assert.equal(can("FINANCE", "money.manage"), true);
  assert.equal(can("OPS", "money.manage"), false);
  assert.equal(can("OPS", "nurses.verify"), true);
  // only the super-admin manages staff and reads the audit log
  for (const p of ["staff.manage", "audit.view", "catalog.manage"] as const)
    assert.deepEqual([...PERMISSIONS[p]], ["SUPER_ADMIN"]);
  assert.equal(permissionsOf("SUPER_ADMIN").length, Object.keys(PERMISSIONS).length);
});

it("each role reaches only its pages' APIs", async () => {
  // [path, method, roles allowed]
  const table: [string, string, string[]][] = [
    ["/api/admin/board", "GET", ["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT"]],
    ["/api/admin/summary", "GET", ["SUPER_ADMIN", "OPS", "FINANCE"]],
    ["/api/staff/orders", "GET", ["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT"]],
    ["/api/staff/orders/nurses", "GET", ["SUPER_ADMIN", "OPS"]],
    ["/api/admin/users?group=customers", "GET", ["SUPER_ADMIN", "OPS", "SUPPORT"]],
    ["/api/admin/users?group=staff", "GET", ["SUPER_ADMIN"]],
    ["/api/admin/nurses", "GET", ["SUPER_ADMIN", "OPS"]],
    ["/api/admin/refunds", "GET", ["SUPER_ADMIN", "OPS", "FINANCE"]],
    ["/api/admin/payouts/due", "GET", ["SUPER_ADMIN", "OPS", "FINANCE"]],
    ["/api/admin/settings", "GET", ["SUPER_ADMIN", "OPS"]],
    ["/api/admin/catalog", "GET", ["SUPER_ADMIN", "OPS"]],
    ["/api/admin/audit", "GET", ["SUPER_ADMIN"]],
    // older Visit flow endpoints: super-admin only
    ["/api/nurses", "GET", ["SUPER_ADMIN"]],
  ];
  for (const [path, method, allowed] of table)
    for (const role of ["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT"]) {
      const s = await status(role, method, path);
      assert.equal(s === 403, !allowed.includes(role), `${role} ${method} ${path} → ${s}`);
    }
  // changing things
  assert.equal(await status("OPS", "PUT", "/api/admin/settings", { values: { waveSize: 3 } }), 403);
  assert.equal(await status("FINANCE", "POST", "/api/admin/payouts", {}), 400); // allowed, body invalid
  assert.equal(await status("OPS", "POST", "/api/admin/payouts", {}), 403);
  assert.equal(await status("SUPPORT", "POST", "/api/admin/orders/x/cancel", { reason: "Туршилт", refundPercent: 0 }), 403);
  assert.equal(await status("OPS", "POST", "/api/admin/orders/x/cancel", { reason: "Туршилт", refundPercent: 0 }), 404);
});

it("/api/admin/me tells the web which menu items to show", async () => {
  const r = await api(srv.baseUrl, "GET", "/api/admin/me", { token: tokens.FINANCE });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.adminRole, "FINANCE");
  assert.equal(r.json.data.adminRoleLabel, "Санхүү");
  assert.ok(r.json.data.permissions.includes("money.manage"));
  assert.ok(!r.json.data.permissions.includes("audit.view"));
});

it("the super-admin gives and changes back-office roles; the last super-admin stays", async () => {
  const create = (body: Record<string, unknown>) =>
    api(srv.baseUrl, "POST", "/api/admin/staff", { token: tokens.SUPER_ADMIN, body });
  const base = { name: "Шинэ админ", password: "Secret-Pass-123" };
  assert.equal((await create({ ...base, email: uniqueEmail("rl-a"), role: "ADMIN" })).status, 400);
  assert.equal((await create({ ...base, email: uniqueEmail("rl-b"), role: "NURSE", adminRole: "OPS" })).status, 400);
  const c = await create({ ...base, email: uniqueEmail("rl-c"), role: "ADMIN", adminRole: "SUPPORT" });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  assert.equal(c.json.data.user.adminRole, "SUPPORT");
  assert.equal(await status("OPS", "POST", "/api/admin/staff", { ...base, email: uniqueEmail("rl-d"), role: "ADMIN", adminRole: "OPS" }), 403);

  const patch = (id: string, body: Record<string, unknown>) =>
    api(srv.baseUrl, "PATCH", `/api/admin/users/${id}`, { token: tokens.SUPER_ADMIN, body });
  const id = c.json.data.user.id;
  assert.equal((await patch(id, { adminRole: "FINANCE" })).status, 200);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id } })).adminRole, "FINANCE");
  // a nurse has no back-office role
  assert.equal((await patch(id, { role: "NURSE" })).status, 200);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id } })).adminRole, null);
  assert.equal((await patch(id, { role: "ADMIN" })).status, 400);
  assert.equal((await patch(id, { adminRole: "OPS" })).status, 400);

  // only one active super-admin is left besides the test's: demote the others first
  await prisma.user.updateMany({
    where: { role: "ADMIN", adminRole: "SUPER_ADMIN", id: { not: ids.SUPER_ADMIN } },
    data: { adminRole: "OPS" },
  });
  const other = await create({ ...base, email: uniqueEmail("rl-e"), role: "ADMIN", adminRole: "SUPER_ADMIN" });
  const otherToken = await loginAs(srv.baseUrl, other.json.data.user.email, "Secret-Pass-123");
  // the other super-admin demotes the test's one: allowed while two exist
  const r = await api(srv.baseUrl, "PATCH", `/api/admin/users/${ids.SUPER_ADMIN}`, { token: otherToken, body: { adminRole: "OPS" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  // now the remaining one cannot be demoted (by anyone)
  const last = await api(srv.baseUrl, "PATCH", `/api/admin/users/${other.json.data.user.id}`, {
    token: otherToken,
    body: { adminRole: "OPS" },
  });
  assert.equal(last.status, 409); // SELF_CHANGE first; a second super-admin would get LAST_ADMIN
  // the database refuses an admin without a role
  await assert.rejects(prisma.user.update({ where: { id: other.json.data.user.id }, data: { adminRole: null } }));
});
