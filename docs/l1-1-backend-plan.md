# OTOCH L1-1 — Backend төлөвлөгөө

> 2026-10-11, branch `work/backend-l1-1`, суурь commit `aacfaad`. Хүлээлгэн өгөх хугацаа: **2026-10-17**.
> API гэрээ: [l1-1-api.md](l1-1-api.md) (**санал, батлагдаагүй**).
> Энэ баримтын заавар нь audit-ийн эх сурвалж. Гаднын үйлдэл (deploy, төлбөртэй resource, бодит QPay) хийх зөвшөөрөл **биш**.

---

## 1. Одоогийн төлөв (кодоор баталгаажсан)

### 1.1 Stack

| Зүйл | Нотолгоо |
|---|---|
| Express 5 + TypeScript, `tsx`/nodemon-оор ажилладаг | [server/package.json](../server/package.json), [nodemon.json](../server/nodemon.json) |
| Prisma 6.18 + PostgreSQL | [schema.prisma:1-8](../server/prisma/schema.prisma#L1-L8) |
| Model: `User`, `Parent`, `Visit`, `Vitals` (+ enum `Role`, `VisitStatus`, `VisitType`) | [schema.prisma:10-90](../server/prisma/schema.prisma#L10-L90) |
| JWT auth (Bearer эсвэл cookie), role middleware | [middlwares/auth.ts](../server/src/middlwares/auth.ts), [middlwares/rbac.ts](../server/src/middlwares/rbac.ts) |
| Локал DB: embedded PostgreSQL (`npm run dev:local`, port 5544) эсвэл docker-compose | [scripts/dev-local.mjs](../server/scripts/dev-local.mjs), [docker-compose.yml](../docker-compose.yml) |
| Lockfile: `server/package-lock.json` (npm). `engines` талбар байхгүй | |

### 1.2 Өмнөх audit-ийн олдворуудыг дахин шалгасан нь

| Олдвор | Дүгнэлт | Нотолгоо |
|---|---|---|
| Express + TS + Prisma/PostgreSQL | ✅ Батлагдсан | дээрх хүснэгт |
| Parent, Visit, Vitals model | ✅ Батлагдсан | [schema.prisma:29-75](../server/prisma/schema.prisma#L29-L75) |
| Mobile `parentId, scheduledFor, visitType=FULL` илгээдэг | ✅ Батлагдсан | [bookappointment.tsx:128-130](../App/app/(tabs)/bookappointment.tsx#L128-L130) |
| Каталог, red flag, заалтын attachment, QPay model/endpoint байхгүй | ✅ Батлагдсан. Schema болон `src/` дотор холбогдох model, route, `req.files` handler олдсонгүй | `grep` хоосон |
| Нээлттэй signup ADMIN үүсгэж болно | ✅ **Батлагдсан (кодоор).** Route нь auth шаарддаггүй, schema `ADMIN`, `MEDICAL_ADMIN`-ийг хүлээн авдаг. Runtime-д туршаагүй, учир нь локал DB-д хэрэглэгч үүсгэнэ | [auth.routes.ts:27](../server/src/routes/auth.routes.ts#L27), [authController.ts:25](../server/src/controllers/authController.ts#L25) |
| Prisma migrations `.gitignore`-д | ✅ Батлагдсан. Одоо зөвхөн `db push` ашиглагддаг | [server/.gitignore:8](../server/.gitignore#L8) |
| Локал PostgreSQL скрипт бий, staging нотлогдоогүй | ✅ Батлагдсан. Deploy config, CI, Dockerfile байхгүй | |

### 1.3 Нэмэлт олдворууд

| # | Олдвор | Нотолгоо | Ноцтой байдал |
|---|---|---|---|
| F1 | Prisma бүх орчинд `query` log хийдэг | [db.config.ts:4](../server/src/db/db.config.ts#L4) | Дунд (log-ийн хэмжээ, мэдээлэл задрах эрсдэл) |
| F2 | Login амжилтгүй үед **HTTP 200** буцаадаг. "Хэрэглэгч олдсонгүй"/"Нууц үг буруу" гэж ялгаж хэлдэг тул хэрэглэгч байгаа эсэхийг тааж болно | [authController.ts:120-134](../server/src/controllers/authController.ts#L120-L134) | Дунд |
| F3 | Олон endpoint алдааг HTTP 200-аар, `success` талбаргүй буцаадаг | жишээ нь [visitController.ts:36-42](../server/src/controllers/visitController.ts#L36-L42) | Бага (гэрээний зөрүү) |
| F4 | `JWT_EXPIRES_IN` env-ийг ашигладаггүй, `24h` hard-code | [authController.ts:145](../server/src/controllers/authController.ts#L145) | Бага |
| F5 | Signup token буцаадаггүй, харин mobile token хүлээдэг. Иймээс бүртгэлийн дараа шилжилт хийгддэггүй | [authController.ts:82-86](../server/src/controllers/authController.ts#L82-L86), [register.tsx:57](../App/app/auth/register.tsx#L57) | Дунд (mobile UX) |
| F6 | Login-ийн `data.user` нь объект биш, JWT string. wclient үүнийг decode хийдэг тул **өөрчлөхгүй** | [authController.ts:164](../server/src/controllers/authController.ts#L164) | Мэдээлэл |
| F7 | Vitals илгээхэд `WAITING_APPROVAL` болдог, харин `complete` нь `STARTED` шаарддаг. Иймээс vitals-ийн дараа `COMPLETED` болох боломжгүй. Analytics зөвхөн `COMPLETED`-ийг тоолдог | [visitController.ts:357,378,415](../server/src/controllers/visitController.ts#L357), [analyticsController.ts:36](../server/src/controllers/analyticsController.ts#L36) | Дунд (workflow) |
| F8 | `express-fileupload` хэмжээний хязгааргүй. `/uploads/*` нь нийтэд нээлттэй static | [index.ts:31,42-43](../server/src/index.ts#L31) | **Өндөр** (заалтын зургийг энд хадгалж болохгүй) |
| F9 | Rate limit, helmet байхгүй | `grep` хоосон | Дунд |
| F10 | CORS production-д `'your-frontend-url'` placeholder | [index.ts:32-36](../server/src/index.ts#L32-L36) | Staging-д заавал засна |
| F11 | Visit дуусахад vitals-ийг Gmail-ээр илгээдэг (эрүүл мэндийн мэдээлэл имэйлээр) | [sendEmail.ts:28-56](../server/src/utils/sendEmail.ts#L28-L56) | Дунд (нууцлал) |
| F12 | Тест файл байхгүй (`server/src`-д `*.test.*` = 0) | | Дунд |
| F13 | `embedded-postgres: "latest"` — pin хийгээгүй, lockfile дээр `18.4.0-beta.17` | [server/package.json:46](../server/package.json#L46) | Бага (зөвхөн dev) |
| F14 | `npm run build` нь дотроо `npm install` ажиллуулдаг. Staging build-д `npm ci` ашиглах хэрэгтэй | [server/package.json](../server/package.json) | Бага |
| F15 | `types/auth.ts`-ийн `Role` төрөлд `MEDICAL_ADMIN` байхгүй. Одоогоор хаана ч ашиглагддаггүй | [types/auth.ts:1](../server/src/types/auth.ts#L1) | Бага |

### 1.4 README ба бодит код

| README-ийн тайлбар | Бодит байдал |
|---|---|
| "Rate limiting implementation", "Secure headers" (README:385-393) | ❌ Кодонд байхгүй. `upstream/optimized` салбарт байж магадгүй ("security middleware and rate limiting"), гэхдээ нэгтгэгдээгүй |
| "Audit trails for all medical actions" | ❌ Event/audit model байхгүй. Зөвхөн `approvedById/approvedAt` бий |
| "Secure file upload handling" | ❌ Upload handler байхгүй, `/uploads` нь нийтэд нээлттэй |
| "Encrypted data transmission" | ⚠️ Локалд HTTP. HTTPS нь deploy орчноос хамаарна |
| "Real-time" мэдэгдэл | ❌ WebSocket/push байхгүй. Зөвхөн visit дуусахад имэйл |
| "Unit tests for critical functions" | ❌ Тест байхгүй |
| `DATABASE_URL`, `JWT_SECRET`, `EMAIL_*`, `PORT`, `NODE_ENV` (README:310-327) | ✅ Ашиглагддаг. `EMAIL_HOST/PORT`-ийг ашигладаггүй (`service: 'gmail'` hard-code) |
| Endpoint жагсаалт | ✅ Ерөнхийдөө таарна |

---

## 2. Шаардлагатай model / field / relation (санал)

**Зарчим:** Одоогийн `User`, `Parent`, `Visit`, `Vitals`-ийг **устгахгүй, нэр солихгүй**. Зөвхөн шинэ model болон nullable талбар нэмнэ.

```prisma
// ---- Каталог ----
model ServiceCatalogItem {
  id               String   @id @default(cuid())
  code             String   @unique              // HOME_BASIC_CHECK
  name             String                         // Монгол нэр
  description      String?
  category         String                         // HOME_VISIT, LAB …
  priceMnt         Int                            // бүхэл төгрөг
  durationMin      Int
  requiresReferral Boolean  @default(false)
  questionnaire    String?                        // GENERAL_V1
  isActive         Boolean  @default(true)
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  orderItems       OrderItem[]
}

// ---- Захиалга ----
enum OrderStatus {
  DRAFT
  BLOCKED_RED_FLAG
  AWAITING_PAYMENT
  PAID
  ASSIGNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  EXPIRED
}

enum RedFlagStatus {
  NOT_ANSWERED
  CLEAR
  FLAGGED
}

model Order {
  id                    String        @id @default(cuid())
  childId               String
  parentId              String
  status                OrderStatus   @default(DRAFT)
  version               Int           @default(1)       // optimistic lock
  scheduledFor          DateTime?
  timeSlot              String?
  addressText           String?
  lat                   Float?
  lng                   Float?
  notes                 String?
  nurseGenderPreference String        @default("ANY")
  redFlagStatus         RedFlagStatus @default(NOT_ANSWERED)
  visitId               String?       @unique           // PAID болоход үүсгэсэн Visit
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
  child        User         @relation("ChildOrders", fields: [childId], references: [id])
  parent       Parent       @relation(fields: [parentId], references: [id])
  visit        Visit?       @relation(fields: [visitId], references: [id])
  items        OrderItem[]
  quotes       Quote[]
  payments     Payment[]
  attachments  Attachment[]
  redFlagAnswers RedFlagAnswer[]
  events       OrderEvent[]
  @@index([childId, status])
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  serviceId String
  quantity  Int    @default(1)
  order     Order              @relation(fields: [orderId], references: [id])
  service   ServiceCatalogItem @relation(fields: [serviceId], references: [id])
}

// ---- Серверийн үнэ ----
model Quote {
  id             String   @id @default(cuid())
  orderId        String
  lines          Json                 // тухайн үеийн үнийн snapshot
  subtotalMnt    Int
  travelFeeMnt   Int
  discountMnt    Int
  totalMnt       Int
  pricingVersion String
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  order          Order     @relation(fields: [orderId], references: [id])
  payments       Payment[]
}

// ---- Төлбөр ----
enum PaymentStatus {
  PENDING
  PAID
  FAILED
  EXPIRED
  CANCELLED
}

model Payment {
  id                String        @id @default(cuid())
  orderId           String
  quoteId           String
  provider          String        @default("QPAY")
  providerInvoiceId String?       @unique
  providerPaymentId String?       @unique
  idempotencyKey    String        @unique
  amountMnt         Int
  status            PaymentStatus @default(PENDING)
  expiresAt         DateTime?
  paidAt            DateTime?
  lastCheckedAt     DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  order             Order @relation(fields: [orderId], references: [id])
  quote             Quote @relation(fields: [quoteId], references: [id])
}

// ---- Заалтын файл (private storage) ----
model Attachment {
  id           String    @id @default(cuid())
  orderId      String
  uploaderId   String
  kind         String    @default("REFERRAL")
  storageKey   String    @unique   // bucket доторх зам. Нийтийн URL биш
  mimeType     String
  sizeBytes    Int
  sha256       String
  originalName String?
  createdAt    DateTime  @default(now())
  deletedAt    DateTime?
  order        Order @relation(fields: [orderId], references: [id])
}

// ---- Red flag ----
model RedFlagQuestion {
  id            String  @id @default(cuid())
  questionnaire String                      // GENERAL_V1
  code          String
  text          String
  type          String  @default("BOOLEAN")
  triggerValue  Json                        // жишээ нь true
  required      Boolean @default(true)
  sortOrder     Int     @default(0)
  isActive      Boolean @default(true)
  answers       RedFlagAnswer[]
  @@unique([questionnaire, code])
}
model RedFlagAnswer {
  id         String   @id @default(cuid())
  orderId    String
  questionId String
  value      Json
  triggered  Boolean
  createdAt  DateTime @default(now())
  order      Order           @relation(fields: [orderId], references: [id])
  question   RedFlagQuestion @relation(fields: [questionId], references: [id])
  @@unique([orderId, questionId])
}

// ---- Event history (audit) ----
model OrderEvent {
  id         String   @id @default(cuid())
  orderId    String
  type       String               // CREATED, UPDATED, RED_FLAG_CLEAR, QUOTED, PAYMENT_PAID …
  fromStatus String?
  toStatus   String?
  actorId    String?
  actorRole  String?
  metadata   Json?                // эрүүл мэндийн дэлгэрэнгүй, нууц утга хадгалахгүй
  createdAt  DateTime @default(now())
  order      Order @relation(fields: [orderId], references: [id])
  @@index([orderId, createdAt])
}
```

Одоогийн model-д нэмэх **back-relation** (nullable, эвдэхгүй): `User.orders Order[] @relation("ChildOrders")`, `Parent.orders Order[]`, `Visit.order Order?`.

---

## 3. Migration ба backward compatibility

1. **Migrations-ийг git-д оруулах.** `server/.gitignore:8`-аас `/prisma/migrations`-ийг хасна. Энэ нь backend-ийн config тул миний хариуцах хүрээнд багтана. Шалтгаан: staging/production-д `db push` биш, `migrate deploy` ашиглах.
2. **Baseline:** одоогийн schema-аас `0_init` migration үүсгэнэ (`prisma migrate diff --from-empty --to-schema-datamodel …`). Одоо байгаа DB-д `prisma migrate resolve --applied 0_init` хийж тэмдэглэнэ. Локал DB-д ажиллуулахаас өмнө хэлэлцэнэ.
3. **L1-1 migration:** зөвхөн шинэ хүснэгт болон nullable/default-тэй талбар нэмнэ. `ALTER ... DROP` хийхгүй.
4. **Хуучин API хэвээр:** `POST /api/visits` болон бусад route өөрчлөгдөхгүй. Шинэ урсгал нь `PAID` болоход `Visit`-ийг (`PENDING`, `visitType` = каталогоос) үүсгэж `Order.visitId`-д холбоно. Иймээс wclient-ийн нурс/админ/эмнэлгийн урсгал өөрчлөлтгүй ажиллана.
5. **Төлөвийн sync:** `Visit.status` өөрчлөгдөх бүрд (assign/start/vitals/approve) харгалзах `Order.status`-ийг шинэчилж `OrderEvent` бичнэ (нэг transaction-д).
6. **Seed:** демо каталог болон red flag асуултыг `prisma/seed.ts`-д **зохиомол** өгөгдлөөр нэмнэ.
7. **Rollback:** шинэ хүснэгтүүд хуучин код ашигладаггүй тул app-ийг өмнөх commit руу буцаахад DB эвдрэхгүй.

---

## 4. Ажлын дараалал (2026-10-12 → 10-17)

| Өдөр | Ажил | Гаралт |
|---|---|---|
| **10.12 (Да)** | Гэрээний шийдвэр (D1–D9) авах. Signup-ийн ADMIN эрхийг хаах (§5). Migrations baseline. `ServiceCatalogItem` + `GET /api/catalog/services`. Prisma query log-ийг dev-д л идэвхжүүлэх | PR #1 |
| **10.13 (Мя)** | `Order`, `OrderItem`, `OrderEvent`. `POST/PATCH /api/orders`, cancel, `GET /api/orders/:id`, list. Validation + зөв status code. Unit/integration тест | PR #2 |
| **10.14 (Лх)** | Red flag (асуулт, хариулт, блоклох). Attachment: private storage adapter (локал диск + S3-compatible interface), хэмжээ/төрлийн хязгаар, signed URL | PR #3 |
| **10.15 (Пү)** | Quote (серверийн үнэ, хугацаа). QPay client: **sandbox/mock горим**, invoice, check, callback (idempotent, дахин баталгаажуулалттай) | PR #4 |
| **10.16 (Ба)** | `PAID` → Visit үүсгэх, Visit ↔ Order төлөвийн sync. Rate limit, helmet, CORS allowlist. Staging (эрх байвал) | PR #5, staging |
| **10.17 (Бя)** | Mobile-тай integration тест, засвар, баримт шинэчлэх, L1-1 хүлээлгэн өгөх | Release note |

---

## 5. Аюулгүй байдлын асуудлууд

### 5.1 Нээлттэй admin signup (F: §1.2)
- `signupSchema.role`-ийг **зөвхөн `CHILD`** болгоно (эсвэл role талбарыг хүлээн авахгүй).
- `NURSE`, `MEDICAL_ADMIN`, `ADMIN`-ийг зөвхөн ADMIN-ий хамгаалагдсан endpoint эсвэл seed/CLI-аар үүсгэнэ.
- **Нөлөө:** wclient-ийн бүртгэлийн хуудас role сонгуулдаг. Wclient-ийг өнөөдөр өөрчлөхгүй, тусад нь зохицуулна.
- Production DB-д ADMIN хэрэглэгчдийн жагсаалтыг шалгах шаардлагатай.

### 5.2 Эмзэг өгөгдлийн logging
- Prisma `query` log-ийг зөвхөн `NODE_ENV=development` + `LOG_LEVEL=debug` үед асаана (F1).
- `console.error(error)` нь Prisma алдааны дотор оролтын өгөгдөл агуулж болно. Бүтэцтэй logger (pino/winston) ашиглаж `password`, `token`, `authorization`, vitals, `diseases`, `medications`, хаяг, утсыг redact хийнэ.
- QPay callback-ийн raw body-г log хийхгүй. Зөвхөн invoice ID ба статус.
- Mobile нь token-той login response-ийг log хийдэг ([login.tsx:39](../App/app/auth/login.tsx#L39)). Mobile хөгжүүлэгчид мэдэгдэнэ (App/**-ийг би өөрчлөхгүй).
- Visit дууссаны имэйлд vitals илгээхийг (F11) хязгаарлах шийдвэр.

---

## 6. Staging env variable (зөвхөн НЭР)

| Бүлэг | Нэр |
|---|---|
| Үндсэн | `NODE_ENV`, `PORT`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL`, `TRUST_PROXY` |
| DB | `DATABASE_URL`, `DATABASE_SSL_MODE` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_BOOTSTRAP_EMAIL` |
| Storage | `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `ATTACHMENT_MAX_BYTES`, `SIGNED_URL_TTL_SECONDS` |
| QPay | `QPAY_MODE` (`mock`/`sandbox`/`production`), `QPAY_BASE_URL`, `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`, `QPAY_CALLBACK_URL`, `QPAY_CALLBACK_SECRET` |
| Үнэ/дүрэм | `QUOTE_TTL_SECONDS`, `PAYMENT_TTL_SECONDS`, `EMERGENCY_PHONE` |
| Имэйл (заавал биш) | `EMAIL_USER`, `EMAIL_PASS` |
| Rate limit | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |

Утгыг зөвхөн hosting provider-ийн secret store-д хадгална. `.env` файлыг commit хийхгүй.

---

## 7. Staging дэд бүтцийн шаардлага

- **HTTPS:** Заавал (QPay callback, mobile ATS). TLS-ийг reverse proxy эсвэл платформ дээр. `TRUST_PROXY` тохируулна.
- **DB:** Managed PostgreSQL 14+, SSL-тэй, өдөр тутмын backup, staging-д **зөвхөн зохиомол өгөгдөл**. `migrate deploy` ашиглана, `db push` болон `migrate reset` хориотой.
- **Private storage:** Bucket нь public биш, server-side encryption, signed URL (≤ 5 мин), CORS хаалттай.
- **QPay sandbox callback:** Нийтэд хүрэх HTTPS URL, нууц token-той зам, callback ирэхэд `payment/check`-ээр дахин баталгаажуулах, idempotent байх.
- **Ажиллагаа:** `/api/health` (DB холболт шалгах хувилбар нэмэх), log хадгалах, алдааны мэдэгдэл.

---

## 8. Deploy хийхийн өмнөх шалгалт

- [ ] `npm ci` (lockfile) → `npx prisma generate` → `npx tsc --noEmit` → тест
- [ ] `prisma migrate deploy` staging DB-д амжилттай. `db push` ашиглаагүй
- [ ] `NODE_ENV=production`, CORS allowlist, `JWT_SECRET` ≥ 32 тэмдэгт санамсаргүй
- [ ] Signup-аар ADMIN үүсгэх боломжгүй (тестээр баталгаажуулсан)
- [ ] Prisma query log унтарсан. Log-д token, нууц үг, эрүүл мэндийн мэдээлэл гарахгүй
- [ ] `/uploads` static замаар хувийн файл гарахгүй. Attachment-ыг зөвхөн signed URL-аар авна
- [ ] QPay `mock`/`sandbox` горимд. Бодит гүйлгээ хийгдэхгүй
- [ ] Rate limit + helmet идэвхтэй
- [ ] Demo seed нь зөвхөн зохиомол өгөгдөлтэй
- [ ] Rollback төлөвлөгөө (өмнөх image/commit + DB backup)

---

## 9. Дутуу account / access / шийдвэр

| Төрөл | Юу хэрэгтэй |
|---|---|
| Шийдвэр | API гэрээг батлах. Flutter/NestJS ба RN/Express-ийн зөрүү (D1). Order ба Visit-ийн загвар (D2) |
| Шийдвэр | Каталог, үнэ, унааны зардал, промо, валют (D3) |
| Шийдвэр | Red flag асуулт (эмнэлгийн баталгаажуулалт), яаралтай дугаар (D4) |
| Access | QPay merchant **sandbox** credential + `invoice_code` (D5) |
| Access | Staging hosting (платформ сонголт), домэйн + TLS, managed PostgreSQL |
| Access | Private object storage bucket (D6) |
| Баримт | `AGENTS.md` repo-д байхгүй (2026-10-11-ний байдлаар `origin/main`-д ч байхгүй) |
