import { after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma, createUser, uniqueEmail } from "./helpers";
import { provisionNurse } from "../src/services/nurseProvision";

after(() => prisma.$disconnect());
const future = () => new Date(Date.now() + 365 * 86400000);

it("creates a NURSE with a PENDING profile that can only sign in by OTP, and is idempotent", async () => {
  const first = await provisionNurse(prisma, { phone: "+97699200001", name: "Б.Номин" });
  assert.equal(first.status, "created");
  const user = await prisma.user.findUniqueOrThrow({ where: { phone: "+97699200001" }, include: { nurseProfile: true } });
  assert.equal(user.role, "NURSE");
  assert.equal(user.nurseProfile?.status, "PENDING");
  assert.equal(user.nurseProfile?.isActive, false);
  const again = await provisionNurse(prisma, { phone: "+97699200001", name: "Өөр нэр" });
  assert.equal(again.status, "unchanged");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { phone: "+97699200001" } })).name, "Б.Номин");
});

it("verifying needs a licence number and a future expiry", async () => {
  assert.equal((await provisionNurse(prisma, { phone: "+97699200004", name: "Тест", verified: true })).status, "refused");
  assert.equal(
    (await provisionNurse(prisma, { phone: "+97699200004", name: "Тест", verified: true, licenseNo: "1", licenseExpiresAt: new Date(Date.now() - 1000) })).status,
    "refused",
  );
  assert.equal(await prisma.user.count({ where: { phone: "+97699200004" } }), 0);
  const ok = await provisionNurse(prisma, {
    phone: "+97699200004",
    name: "Тест",
    verified: true,
    licenseNo: "10387",
    licenseExpiresAt: future(),
    skillTags: ["INJ", "IV"],
    zoneIds: ["Z1"],
  });
  assert.equal(ok.status, "created");
  assert.equal(ok.status === "created" && ok.verified, true);
  const p = await prisma.nurseProfile.findFirstOrThrow({ where: { user: { phone: "+97699200004" } } });
  assert.deepEqual([p.status, p.licenseNo, p.skillTags, p.zoneIds], ["VERIFIED", "10387", ["INJ", "IV"], ["Z1"]]);
  assert.equal(p.isActive, false); // going online is the nurse's own action
});

it("updates the profile of an existing nurse, including suspending", async () => {
  await provisionNurse(prisma, { phone: "+97699200005", name: "Тест", verified: true, licenseNo: "5", licenseExpiresAt: future(), skillTags: ["INJ"] });
  const r = await provisionNurse(prisma, { phone: "+97699200005", name: "Тест", skillTags: ["INJ", "WOUND"] });
  assert.equal(r.status, "updated");
  const s = await provisionNurse(prisma, { phone: "+97699200005", name: "Тест", verified: false });
  assert.equal(s.status === "updated" && s.verified, false);
});

it("never changes the role of an existing account or revives a deleted one", async () => {
  await prisma.user.update({ where: { id: (await createUser("CHILD")).id }, data: { phone: "+97699200002" } });
  assert.equal((await provisionNurse(prisma, { phone: "+97699200002", name: "Тест" })).status, "refused");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { phone: "+97699200002" } })).role, "CHILD");
  await prisma.user.create({
    data: { name: "Устгагдсан", email: uniqueEmail("gone"), password: "x", role: "NURSE", phone: "+97699200003", deletedAt: new Date() },
  });
  assert.equal((await provisionNurse(prisma, { phone: "+97699200003", name: "Тест" })).status, "refused");
});

it("rejects a malformed phone or unknown skill", async () => {
  await assert.rejects(provisionNurse(prisma, { phone: "99112233", name: "Тест" }));
  await assert.rejects(provisionNurse(prisma, { phone: "+97699200006", name: "Тест", skillTags: ["MAGIC" as never] }));
});
