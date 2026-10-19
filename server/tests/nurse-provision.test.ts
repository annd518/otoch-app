import { after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, createUser, uniqueEmail } from "./helpers";
import { provisionNurse } from "../src/services/nurseProvision";

after(() => prisma.$disconnect());

it("creates a NURSE that can only sign in by OTP, and is idempotent", async () => {
  const first = await provisionNurse(prisma, { phone: "+97699200001", name: "Б.Номин" });
  assert.equal(first.status, "created");
  const user = await prisma.user.findUniqueOrThrow({ where: { phone: "+97699200001" } });
  assert.equal(user.role, "NURSE");
  assert.notEqual(user.password, "");
  const again = await provisionNurse(prisma, { phone: "+97699200001", name: "Өөр нэр" });
  assert.equal(again.status, "unchanged");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { phone: "+97699200001" } })).name, "Б.Номин");
});

it("never changes the role of an existing account or revives a deleted one", async () => {
  await prisma.user.update({ where: { id: (await createUser("CHILD")).id }, data: { phone: "+97699200002" } });
  const child = await provisionNurse(prisma, { phone: "+97699200002", name: "Тест" });
  assert.equal(child.status, "refused");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { phone: "+97699200002" } })).role, "CHILD");
  await prisma.user.create({
    data: { name: "Устгагдсан", email: uniqueEmail("gone"), password: "x", role: "NURSE", phone: "+97699200003", deletedAt: new Date() },
  });
  assert.equal((await provisionNurse(prisma, { phone: "+97699200003", name: "Тест" })).status, "refused");
});

it("rejects a malformed phone", async () => {
  await assert.rejects(provisionNurse(prisma, { phone: "99112233", name: "Тест" }));
});
