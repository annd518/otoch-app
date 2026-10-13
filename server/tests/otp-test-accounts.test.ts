import { after, afterEach, before, it } from "node:test";
import assert from "node:assert/strict";
import { api, prisma, startServer, type TestServer } from "./helpers";
import { testAccountCode } from "../src/controllers/otpController";

// Fixed-code test accounts (OTP_TEST_ACCOUNTS): store review and staging
// testers log in without SMS; everyone else keeps the normal SMS rules.
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
  for (const k of ["OTP_TEST_ACCOUNTS", "SMS_DRIVER", "EXPOSE_TEST_OTP", "SMS_WEBHOOK_URL", "SMS_WEBHOOK_TOKEN", "NODE_ENV"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const request = (phone: string) =>
  api(srv.baseUrl, "POST", "/api/auth/otp/request", { body: { phone } });
const verify = (phone: string, challengeId: string, code: string) =>
  api(srv.baseUrl, "POST", "/api/auth/otp/verify", {
    body: { phone, challengeId, code, name: "Тест шалгагч" },
  });

it("listed number logs in with its fixed code even with no SMS configured, in production mode", async () => {
  delete process.env.SMS_DRIVER;
  delete process.env.SMS_WEBHOOK_URL;
  process.env.NODE_ENV = "production";
  process.env.OTP_TEST_ACCOUNTS = "+97699000011:483920, +97699000012:715306";
  const r = await request("+97699000012");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.isMock, false);
  assert.equal("testCode" in r.json.data, false);
  assert.equal(JSON.stringify(r.json).includes("715306"), false);
  const v = await verify("+97699000012", r.json.data.challengeId, "715306");
  assert.equal(v.status, 200, JSON.stringify(v.json));
  assert.equal(v.json.data.user.role, "CHILD");
});

it("unlisted numbers are unchanged: no SMS configured -> 503", async () => {
  delete process.env.SMS_DRIVER;
  process.env.NODE_ENV = "production";
  process.env.OTP_TEST_ACCOUNTS = "+97699000011:483920";
  const r = await request("+97699000013");
  assert.equal(r.status, 503);
  assert.equal(r.json.error.code, "SMS_UNAVAILABLE");
});

it("wrong code still counts attempts and locks; rate limit still applies", async () => {
  process.env.OTP_TEST_ACCOUNTS = "+97699000014:483920";
  const r = await request("+97699000014");
  assert.equal(r.status, 200);
  for (let i = 0; i < 3; i++) {
    const v = await verify("+97699000014", r.json.data.challengeId, "111111");
    assert.equal(v.status, i === 2 ? 429 : 400);
  }
  const again = await request("+97699000014");
  assert.equal(again.status, 429);
});

it("trivial or malformed codes are ignored (number behaves as unlisted)", () => {
  for (const code of ["000000", "999999", "123456", "654321", "12345", "abcdef"]) {
    process.env.OTP_TEST_ACCOUNTS = `+97699000015:${code}`;
    assert.equal(testAccountCode("+97699000015"), null, code);
  }
  process.env.OTP_TEST_ACCOUNTS = "+97699000015:483920";
  assert.equal(testAccountCode("+97699000015"), "483920");
  assert.equal(testAccountCode("+97699000016"), null);
  delete process.env.OTP_TEST_ACCOUNTS;
  assert.equal(testAccountCode("+97699000015"), null);
});
