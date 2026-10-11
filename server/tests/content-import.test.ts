import { after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./helpers";
import { importContent } from "../src/services/contentImport";
import { CATALOG_V2 } from "../src/data/catalogV2";
import { fixtureCatalogRow } from "../src/services/serviceMetadata";
import { RED_FLAG_V2_FIXTURES } from "../prisma/fixtures/redFlags";
const approval = {
  approvedBy: "Тест эмнэлгийн хариуцагч",
  approvedAt: new Date(Date.now() - 1000).toISOString(),
};
const questionnaire = {
  ...approval,
  kind: "questionnaire",
  version: "APPROVED_TEST_RF_V1",
  questions: RED_FLAG_V2_FIXTURES.map(({ code, text, sortOrder }) => ({
    code,
    text,
    sortOrder,
  })),
};
const catalog = (version: string) => ({
  ...approval,
  kind: "catalog",
  version,
  services: CATALOG_V2.map((row) => {
    const { isFixture, contentVersion, ...item } = fixtureCatalogRow(row);
    return {
      ...item,
      questionnaire: questionnaire.version,
      metadata: {
        ...item.metadata,
        formConfig: { ...item.metadata.formConfig, approved: true },
      },
    };
  }),
});
after(() => prisma.$disconnect());
it("dry-run validates without any publication or catalog write", async () => {
  const before = await prisma.contentPublication.count();
  const r = await importContent(questionnaire);
  assert.equal(r.count, 6);
  assert.equal(r.apply, false);
  assert.equal(await prisma.contentPublication.count(), before);
  assert.equal(
    await prisma.redFlagQuestion.count({
      where: { questionnaire: questionnaire.version },
    }),
    0,
  );
  await assert.rejects(() =>
    importContent({
      ...questionnaire,
      questions: questionnaire.questions.slice(0, 5),
    }),
  );
});
it("questionnaire versions are immutable; replay is idempotent and changed content is rejected", async () => {
  await importContent(questionnaire, true);
  await importContent(questionnaire, true);
  assert.equal(
    await prisma.redFlagQuestion.count({
      where: { questionnaire: questionnaire.version },
    }),
    6,
  );
  await assert.rejects(() =>
    importContent(
      {
        ...questionnaire,
        questions: questionnaire.questions.map((q, i) =>
          i ? q : { ...q, text: "Өөрчилсөн тест асуулт" },
        ),
      },
      true,
    ),
  );
  assert.ok(
    (
      await prisma.redFlagQuestion.findMany({
        where: { questionnaire: questionnaire.version },
      })
    ).every((q) => !q.isFixture && q.approvedBy === approval.approvedBy),
  );
});
it("catalog stores approved metadata and invalid references rollback the entire publication", async () => {
  await importContent(catalog("APPROVED_TEST_CATALOG_V1"), true);
  const row = await prisma.serviceCatalogItem.findUniqueOrThrow({
    where: { code: "S01" },
  });
  assert.equal(row.isFixture, false);
  assert.equal(row.contentVersion, "APPROVED_TEST_CATALOG_V1");
  assert.ok(row.metadata);
  const bad = catalog("APPROVED_TEST_CATALOG_BAD");
  bad.services[1].questionnaire = "UNPUBLISHED";
  await assert.rejects(() => importContent(bad, true));
  assert.equal(
    (
      await prisma.serviceCatalogItem.findUniqueOrThrow({
        where: { code: "S01" },
      })
    ).contentVersion,
    "APPROVED_TEST_CATALOG_V1",
  );
  assert.equal(
    await prisma.contentPublication.count({ where: { version: bad.version } }),
    0,
  );
});
it("publishing a catalog invalidates clear editable drafts without unblocking blocked orders", async () => {
  const user = await prisma.user.create({
    data: {
      name: "Тест",
      email: "content-test@example.invalid",
      password: "not-a-login-hash",
      role: "CHILD",
    },
  });
  const parent = await prisma.parent.create({
    data: {
      name: "Тест",
      age: 30,
      gender: "Other",
      address: "Тест хаяг",
      emergencyContact: "99112233",
    },
  });
  const draft = await prisma.order.create({
    data: {
      childId: user.id,
      parentId: parent.id,
      catalogVersion: "OLD",
      redFlagStatus: "CLEAR",
    },
  });
  const blocked = await prisma.order.create({
    data: {
      childId: user.id,
      parentId: parent.id,
      catalogVersion: "OLD",
      status: "BLOCKED_RED_FLAG",
      redFlagStatus: "FLAGGED",
    },
  });
  await importContent(catalog("APPROVED_TEST_CATALOG_V2"), true);
  assert.equal(
    (await prisma.order.findUniqueOrThrow({ where: { id: draft.id } }))
      .redFlagStatus,
    "NOT_ANSWERED",
  );
  assert.equal(
    (await prisma.order.findUniqueOrThrow({ where: { id: blocked.id } }))
      .status,
    "BLOCKED_RED_FLAG",
  );
});
it("availability import validates bounds and duplicate/overlapping slots atomically", async () => {
  const start = new Date(Date.now() + 86400000),
    end = new Date(start.getTime() + 7200000);
  const body = {
    ...approval,
    kind: "availability",
    version: "TEST_SCHEDULE_V1",
    zones: [
      {
        id: "TEST_IMPORT_ZONE",
        name: "Тест бүс",
        isActive: true,
        minLat: 47,
        maxLat: 49,
        minLng: 106,
        maxLng: 108,
      },
    ],
    slots: [
      {
        zoneId: "TEST_IMPORT_ZONE",
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        capacity: 2,
      },
    ],
  };
  await importContent(body, true);
  await importContent(body, true);
  await assert.rejects(() =>
    importContent(
      {
        ...body,
        version: "TEST_SCHEDULE_V2",
        slots: [
          {
            ...body.slots[0],
            startsAt: new Date(start.getTime() + 60000).toISOString(),
          },
        ],
      },
      true,
    ),
  );
  assert.equal(
    await prisma.availabilitySlot.count({
      where: { zoneId: "TEST_IMPORT_ZONE" },
    }),
    1,
  );
});
