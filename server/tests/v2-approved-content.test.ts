import { after, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prisma, api, startServer, createUser, loginAs } from "./helpers";
import { importContent } from "../src/services/contentImport";
after(() => prisma.$disconnect());
it("owner-approved PDF pack publishes ten services and six source-worded questions", async () => {
  const questionnaire = JSON.parse(
    await readFile("content/approved/questionnaire-v2.json", "utf8"),
  );
  const catalog = JSON.parse(
    await readFile("content/approved/catalog-v2.json", "utf8"),
  );
  assert.equal((await importContent(questionnaire)).apply, false);
  assert.equal((await importContent(catalog)).count, 10);
  await importContent(questionnaire, true);
  await importContent(catalog, true);
  const srv = await startServer();
  try {
    const user = await createUser("CHILD");
    const token = await loginAs(srv.baseUrl, user.email);
    const result = await api(srv.baseUrl, "GET", "/api/catalog/services", {
      token,
    });
    assert.equal(result.status, 200);
    const services = result.json.data.services.filter((s: { code: string }) =>
      /^S\d{2}$/.test(s.code),
    );
    assert.equal(services.length, 10);
    for (const service of services) {
      assert.equal(service.isFixture, false);
      assert.equal(service.approval.approved, true);
      assert.equal(
        service.formConfig.attachmentLimit,
        service.code === "S05" ? 2 : 3,
      );
      assert.equal(
        service.formConfig.medicationRequired,
        ["S02", "S03", "S08", "S09", "S10"].includes(service.code),
      );
      assert.equal(
        service.formConfig.medicationFieldsVisible,
        service.code !== "S01",
      );
    }
    assert.equal(
      await prisma.redFlagQuestion.count({
        where: { questionnaire: questionnaire.version, isFixture: false },
      }),
      6,
    );
    const q6 = await prisma.redFlagQuestion.findFirstOrThrow({
      where: { questionnaire: questionnaire.version, code: "RF6" },
    });
    assert.equal(q6.text, "Ухаангүй, маш хүнд, оврогын байдалтай юу?");
    await importContent(catalog, true);
    assert.equal(
      await prisma.contentPublication.count({
        where: { kind: "catalog", version: catalog.version },
      }),
      1,
    );
  } finally {
    await srv.close();
  }
});
