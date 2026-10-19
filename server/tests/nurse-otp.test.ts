import { after, afterEach, before, it } from "node:test";
import assert from "node:assert/strict";
import { api, createUser, prisma, startServer, type TestServer } from "./helpers";

// Nurse app sign-in by phone + OTP (app: "nurse"). Fixed-code numbers avoid SMS.
let srv: TestServer;
const saved = { ...process.env };
before(async () => {
  srv = await startServer();
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});
afterEach(() => {
  for (const k of ["OTP_TEST_ACCOUNTS", "SMS_DRIVER", "NODE_ENV"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const request = (phone: string) =>
  api(srv.baseUrl, "POST", "/api/auth/otp/request", { body: { phone } });
const verify = (phone: string, challengeId: string, code: string, app?: string) =>
  api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
    body: { phone, challengeId, code, ...(app && { app }) },
  });
const login = async (phone: string, code: string, app?: string) => {
  const r = await request(phone);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return verify(phone, r.json.data.challengeId, code, app);
};

it("a provisioned nurse signs in with phone + OTP and gets a refresh token", async () => {
  const nurse = await prisma.user.update({
    where: { id: (await createUser("NURSE")).id },
    data: { phone: "+97699100001" },
  });
  process.env.OTP_TEST_ACCOUNTS = "+97699100001:483920";
  const v = await login("+97699100001", "483920", "nurse");
  assert.equal(v.status, 200, JSON.stringify(v.json));
  assert.equal(v.json.data.user.role, "NURSE");
  assert.equal(v.json.data.user.id, nurse.id);
  assert.ok(v.json.data.refreshToken);
  const me = await api(srv.baseUrl, "GET", "/api/staff/orders", { token: v.json.data.token });
  assert.equal(me.status, 200);
});

it("an unknown phone never creates an account through the nurse app", async () => {
  process.env.OTP_TEST_ACCOUNTS = "+97699100002:715306";
  const v = await login("+97699100002", "715306", "nurse");
  assert.equal(v.status, 400);
  assert.equal(v.json.error.code, "OTP_INVALID");
  assert.equal(await prisma.user.count({ where: { phone: "+97699100002" } }), 0);
});

it("a family (CHILD) phone cannot sign in through the nurse app", async () => {
  await prisma.user.update({
    where: { id: (await createUser("CHILD")).id },
    data: { phone: "+97699100003" },
  });
  process.env.OTP_TEST_ACCOUNTS = "+97699100003:483921";
  const v = await login("+97699100003", "483921", "nurse");
  assert.equal(v.status, 400);
  assert.equal(v.json.error.code, "OTP_INVALID");
});

it("a deleted nurse is refused", async () => {
  await prisma.user.update({
    where: { id: (await createUser("NURSE")).id },
    data: { phone: "+97699100004", deletedAt: new Date() },
  });
  process.env.OTP_TEST_ACCOUNTS = "+97699100004:483922";
  const v = await login("+97699100004", "483922", "nurse");
  assert.equal(v.status, 400);
});

it("the family app path is unchanged: a nurse phone is still refused without app=nurse", async () => {
  await prisma.user.update({
    where: { id: (await createUser("NURSE")).id },
    data: { phone: "+97699100005" },
  });
  process.env.OTP_TEST_ACCOUNTS = "+97699100005:483923";
  const v = await login("+97699100005", "483923");
  assert.equal(v.status, 400);
  assert.equal(v.json.error.code, "OTP_INVALID");
});

it("wrong code still counts attempts for the nurse app", async () => {
  process.env.OTP_TEST_ACCOUNTS = "+97699100006:483924";
  const r = await request("+97699100006");
  for (let i = 0; i < 3; i++) {
    const v = await verify("+97699100006", r.json.data.challengeId, "111111", "nurse");
    assert.equal(v.status, i === 2 ? 429 : 400);
  }
});
