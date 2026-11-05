import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, api, createUser, loginAs, startServer, type TestServer } from "./helpers";

// Customers and nurses may make an avatar; it is optional (spec: profile photo not required).
let srv: TestServer;
const AVATAR = {
  v: 1,
  gender: "male",
  skinColor: "d08b5b",
  top: "shortFlat",
  hairColor: "2c1b18",
  facialHair: "beardLight",
  eyes: "default",
  eyebrows: "defaultNatural",
  mouth: "smile",
  accessories: "none",
  clothing: "shirtCrewNeck",
  clothesColor: "65c9ff",
  backgroundColor: "b6e3f4",
};

before(async () => {
  srv = await startServer();
});
after(async () => {
  await srv.close();
  await prisma.$disconnect();
});

it("a customer and a nurse save, read and remove their own avatar", async () => {
  for (const role of ["CHILD", "NURSE"] as const) {
    const u = await createUser(role, `avatar-${role.toLowerCase()}`);
    const token = await loginAs(srv.baseUrl, u.email);
    // optional: nobody has one at first
    assert.equal((await api(srv.baseUrl, "GET", "/api/users/me/avatar", { token })).json.data.avatar, null);
    const put = await api(srv.baseUrl, "PUT", "/api/users/me/avatar", { token, body: { avatar: AVATAR } });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    assert.deepEqual(put.json.data.avatar, AVATAR);
    assert.deepEqual((await api(srv.baseUrl, "GET", "/api/users/me/avatar", { token })).json.data.avatar, AVATAR);
    const removed = await api(srv.baseUrl, "PUT", "/api/users/me/avatar", { token, body: { avatar: null } });
    assert.equal(removed.status, 200);
    assert.equal(removed.json.data.avatar, null);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).avatar, null);
  }
});

it("an avatar with unknown parts or odd values is refused, and sign-in is required", async () => {
  const u = await createUser("CHILD", "avatar-bad");
  const token = await loginAs(srv.baseUrl, u.email);
  for (const avatar of [
    { ...AVATAR, extra: "x" },
    { ...AVATAR, top: "<svg onload=1>" },
    { ...AVATAR, gender: "other" },
    { ...AVATAR, v: 2 },
  ]) {
    const r = await api(srv.baseUrl, "PUT", "/api/users/me/avatar", { token, body: { avatar } });
    assert.equal(r.status, 400, JSON.stringify(avatar));
  }
  assert.equal((await api(srv.baseUrl, "PUT", "/api/users/me/avatar", { body: { avatar: AVATAR } })).status, 401);
});

it("the customer sees the assigned nurse's avatar on the order", async () => {
  const child = await createUser("CHILD", "avatar-order-child");
  const nurse = await createUser("NURSE", "avatar-order-nurse");
  await prisma.user.update({ where: { id: nurse.id }, data: { avatar: AVATAR } });
  const parent = await prisma.parent.create({
    data: {
      name: "Аватар өвчтөн",
      age: 60,
      gender: "Other",
      address: "Тест",
      emergencyContact: "99112233",
      children: { connect: { id: child.id } },
    },
  });
  const order = await prisma.order.create({
    data: { childId: child.id, parentId: parent.id, catalogVersion: "T", status: "ASSIGNED", assignedNurseId: nurse.id },
  });
  const token = await loginAs(srv.baseUrl, child.email);
  const r = await api(srv.baseUrl, "GET", `/api/orders/${order.id}`, { token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.data.order.nurse.avatar, AVATAR);
});
