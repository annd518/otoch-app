import { fixtureCatalogRow } from "../src/services/serviceMetadata";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOG_FIXTURES } from "./fixtures/catalog";
import { CATALOG_V2 } from "./fixtures/catalogV2";
import { RED_FLAG_FIXTURES, RED_FLAG_V2_FIXTURES } from "./fixtures/redFlags";

const prisma = new PrismaClient();

export const DEMO_PASSWORD = "Demo123!";

const demoUsers: { name: string; email: string; role: Role }[] = [
  { name: "Б. Тэмүүлэн", email: "child@demo.com", role: "CHILD" },
  { name: "Г. Номин", email: "nurse@demo.com", role: "NURSE" },
  {
    name: "Д. Энхцэцэг",
    email: "medadmin@demo.com",
    role: "MEDICAL_ADMIN",
  },
  { name: "А. Бат-Эрдэнэ", email: "admin@demo.com", role: "ADMIN" },
];

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// Fictional catalog rows (isFixture = true). Upsert by stable code; never deletes rows.
async function seedCatalogFixtures() {
  for (const { isActive = true, ...item } of CATALOG_FIXTURES) {
    await prisma.serviceCatalogItem.upsert({
      where: { code: item.code },
      update: {},
      create: { ...item, isActive, isFixture: true },
    });
  }
  for (const row of CATALOG_V2) {
    const data = fixtureCatalogRow(row);
    await prisma.serviceCatalogItem.upsert({
      where: { code: row.code },
      create: data,
      update: {},
    });
    await prisma.serviceCatalogItem.updateMany({
      where: { code: row.code, isFixture: true },
      data,
    });
  }
}

// Placeholder (non-clinical) red flag questions, isFixture = true
async function seedRedFlagFixtures() {
  for (const q of [...RED_FLAG_FIXTURES, ...RED_FLAG_V2_FIXTURES]) {
    await prisma.redFlagQuestion.upsert({
      where: {
        questionnaire_code: { questionnaire: q.questionnaire, code: q.code },
      },
      update: {},
      create: { ...q, isFixture: true },
    });
  }
}

// Staging/production (NODE_ENV=production) get fixtures only: demo accounts have a published password
const isProduction = process.env.NODE_ENV === "production";

async function main() {
  if (isProduction) {
    // Fixture prices/questions are not approved data: only a staging that opts in gets them
    if (process.env.ALLOW_FIXTURE_DATA !== "true") {
      console.log(
        "NODE_ENV=production: nothing seeded (no demo users; fixtures need ALLOW_FIXTURE_DATA=true, staging only).",
      );
      return;
    }
    await seedCatalogFixtures();
    await seedRedFlagFixtures();
    console.log(
      "NODE_ENV=production + ALLOW_FIXTURE_DATA=true: fixtures only (NOT approved prices/questions), no demo users.",
    );
    return;
  }
  await seedCatalogFixtures();
  await seedRedFlagFixtures();

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users: Record<string, { id: string }> = {};
  for (const u of demoUsers) {
    users[u.role] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password },
      create: { ...u, password },
    });
  }

  const child = users.CHILD;
  const nurse = users.NURSE;
  const medAdmin = users.MEDICAL_ADMIN;

  // Only seed parents/visits once so user-created data isn't duplicated on re-runs
  const existingParents = await prisma.parent.count({
    where: { children: { some: { id: child.id } } },
  });
  if (existingParents > 0) {
    console.log("Demo users refreshed; demo parents/visits already exist.");
    return;
  }

  const anita = await prisma.parent.create({
    data: {
      name: "Д. Цэцэг",
      age: 78,
      birthYear: 1948,
      gender: "Female",
      address: "Улаанбаатар, Баянзүрх дүүрэг, 26-р хороо, Дүнжингарав хороолол",
      diseases: "Даралт ихсэлт, чихрийн шижин",
      medications: null,
      emergencyContact: "99000001",
      children: { connect: { id: child.id } },
    },
  });

  const hari = await prisma.parent.create({
    data: {
      name: "Б. Бат",
      age: 82,
      birthYear: 1944,
      gender: "Male",
      address: "Улаанбаатар, Баянзүрх дүүрэг, 26-р хороо, Дүнжингарав хороолол",
      diseases: "Үе мөчний өвдөлт",
      medications: null,
      emergencyContact: "99000002",
      children: { connect: { id: child.id } },
    },
  });

  // Visits in every interesting state so each role has something to see
  await prisma.visit.create({
    data: {
      parentId: anita.id,
      scheduledFor: daysFromNow(2),
      visitType: "FULL",
      status: "PENDING",
    },
  });
  await prisma.visit.create({
    data: {
      parentId: hari.id,
      scheduledFor: daysFromNow(1),
      visitType: "BASIC",
      status: "ASSIGNED",
      nurseId: nurse.id,
    },
  });
  await prisma.visit.create({
    data: {
      parentId: anita.id,
      scheduledFor: daysFromNow(0),
      visitType: "FULL",
      status: "STARTED",
      nurseId: nurse.id,
    },
  });
  await prisma.visit.create({
    data: {
      parentId: hari.id,
      scheduledFor: daysFromNow(-1),
      visitType: "FULL",
      status: "WAITING_APPROVAL",
      nurseId: nurse.id,
      notes: "Туршилтын үзлэг: үе мөч бага зэрэг өвдөлттэй.",
      vitals: {
        create: {
          bp: "135/85",
          sugar: "110",
          pulse: "76",
          oxygen: "97",
          temperature: "98.4",
          notes: "Туршилтын тэмдэглэл: үе мөчний өвдөлт.",
          medicines: "Paracetamol",
        },
      },
    },
  });

  // History: COMPLETED visits feed analytics trends, APPROVED ones show in the child's reports
  const history = [
    {
      days: -21,
      status: "COMPLETED",
      bp: "128/82",
      sugar: "140",
      pulse: "74",
      oxygen: "97",
      temperature: "98.6",
    },
    {
      days: -14,
      status: "COMPLETED",
      bp: "124/80",
      sugar: "132",
      pulse: "72",
      oxygen: "98",
      temperature: "98.4",
    },
    {
      days: -7,
      status: "APPROVED",
      bp: "120/78",
      sugar: "125",
      pulse: "72",
      oxygen: "98",
      temperature: "98.2",
    },
  ] as const;
  for (const h of history) {
    const date = daysFromNow(h.days);
    await prisma.visit.create({
      data: {
        parentId: anita.id,
        scheduledFor: date,
        visitType: "FULL",
        status: h.status,
        nurseId: nurse.id,
        approvedById: medAdmin.id,
        approvalNote: "Туршилтын үзлэгийн үзүүлэлтийг хянасан.",
        approvedAt: date,
        completedAt: date,
        vitals: {
          create: {
            bp: h.bp,
            sugar: h.sugar,
            pulse: h.pulse,
            oxygen: h.oxygen,
            temperature: h.temperature,
            notes: "Туршилтын давтан үзлэг.",
            medicines: "Metformin, Amlodipine",
            createdAt: date,
          },
        },
      },
    });
  }

  console.log("Demo data seeded.");
}

main()
  .then(() => {
    if (isProduction) return;
    console.log(
      `Demo logins (password: ${DEMO_PASSWORD}): ${demoUsers.map((u) => u.email).join(", ")}`,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
