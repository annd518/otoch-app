import assert from "node:assert/strict";
import { it } from "node:test";
import { clientV2 } from "../services/clientV2";
import { otpApi } from "../services/otp";
import { makeClient } from "./helpers";

it("a successful HTTP status without valid availability never becomes a selectable slot", async () => {
  const { client } = makeClient(
    [
      {
        status: 200,
        body: {
          success: true,
          data: { slots: [{ id: "s", startsAt: 42, endsAt: "later" }] },
        },
      },
    ],
    { token: "t" },
  );
  const r = await clientV2(client).availability("zone", "2026-10-18", "S01");
  assert.equal(r.ok, false);
});
it("missing refresh token in an OTP response cannot create a session", async () => {
  const { client } = makeClient([
    {
      status: 200,
      body: {
        success: true,
        data: {
          token: "access",
          user: {
            id: "u",
            name: "Нэр",
            role: "CHILD",
            email: "test@example.invalid",
          },
        },
      },
    },
  ]);
  assert.equal(
    (await otpApi(client).verifyOtp("+97699112233", "challenge", "123456")).ok,
    false,
  );
});
it("records are empty when there are no approved clinical notes; fabricated values are not added", async () => {
  const { client } = makeClient(
    [{ status: 200, body: { success: true, data: { records: [] } } }],
    { token: "t" },
  );
  const r = await clientV2(client).records();
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.data, []);
});
