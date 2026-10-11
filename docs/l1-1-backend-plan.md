# OTOCH L1-1 — Backend төлөвлөгөө

> 2026-10-11, branch `work/backend-l1-1`, суурь commit `aacfaad`. Хүлээлгэн өгөх хугацаа: **2026-10-17**.
> **10.12-ны явц:** §0-ийг үзнэ үү.

---

## 0. Явцын тэмдэглэл — 2026-10-12

| Ажил | Төлөв | Нотолгоо |
|---|---|---|
| Нийтийн signup зөвхөн CHILD үүсгэнэ, бусад role → 403 `ROLE_NOT_ALLOWED` | ✅ Хэрэгжсэн + тест | [authController.ts](../server/src/controllers/authController.ts), [tests/auth.test.ts](../server/tests/auth.test.ts) |
| Login/signup: зөв 4xx, бүртгэлтэй эсэхийг задлахгүй (401 ижил мессеж, timing) | ✅ + тест | мөн дээрх |
| `data.token` (string) + `data.user` (объект) тусдаа | ✅ + тест. **wclient-д нөлөөлнө** ([l1-1-api.md §1.2](l1-1-api.md)) | |
| Visit үүсгэх: invalid → 400, өөрийн бус parent → 404, өнгөрсөн огноо → 400 | ✅ + тест | [visitController.ts](../server/src/controllers/visitController.ts), [tests/visits.test.ts](../server/tests/visits.test.ts) |
| Нэгдсэн алдааны гэрээ, global error handler, 404 handler | ✅ Бүх controller/middleware | [utils/http.ts](../server/src/utils/http.ts), [middlwares/error.ts](../server/src/middlwares/error.ts) |
| Prisma query log: production-д үргэлж унтраалттай, dev-д `PRISMA_LOG_QUERIES=true` үед л асна | ✅ | [db.config.ts](../server/src/db/db.config.ts) |
| Алдааны log: Prisma алдаанаас зөвхөн name/code/model, production-д мессеж хэвлэхгүй | ✅ | [utils/logger.ts](../server/src/utils/logger.ts) |
| **Шинэ олдвор F16:** `rejectVisit` хариунд сувилагчийн **нууц үгийн hash** ордог байсан (`Nurse: true`) | ✅ Засагдсан + тест | [reviewController.ts](../server/src/controllers/reviewController.ts) |
| `ServiceCatalogItem` model + `GET /api/catalog/services` (зохиомол fixture) | ✅ + тест | [catalogController.ts](../server/src/controllers/catalogController.ts), [prisma/fixtures/catalog.ts](../server/prisma/fixtures/catalog.ts) |
| Migrations version control-д оруулах | ✅ SQL үүсгэсэн, **ямар ч бодит/локал DB-д apply/resolve хийгээгүй** (§3.1) | [prisma/migrations](../server/prisma/migrations) |
| Тусгаарласан тест (түр PostgreSQL, ажилласны дараа устгана) | ✅ 28/28 pass | [scripts/test-isolated.mjs](../server/scripts/test-isolated.mjs) |
| `npm run build` гаралтыг `dist/index.js` (`npm start`-тай таарах) болгосон, дотор нь `npm install` хийхгүй (F14) | ✅ | [tsconfig.build.json](../server/tsconfig.build.json) |
| CORS production allowlist (`CORS_ORIGINS`), `TRUST_PROXY`, JSON 1 MB, upload 10 MB хязгаар (F8, F10 хэсэгчлэн) | ✅ | [app.ts](../server/src/app.ts) |
| Staging Dockerfile (provider-agnostic) | 🟡 Бичсэн, **build хийгээгүй** (Docker daemon ажиллахгүй байсан), deploy хийгээгүй | [server/Dockerfile](../server/Dockerfile) |
| **Шинэ олдвор F17:** локал embedded PostgreSQL нь **WIN1252** encoding-той. Кирилл (Монгол) нэр/хаяг хадгалахад алдаа өгнө | 🟡 Шинэ cluster-уудад UTF8 болгосон. **Одоогийн локал DB-д зөвшөөрөл хэрэгтэй** (§11) | [scripts/dev-local.mjs](../server/scripts/dev-local.mjs) |
| Rate limit, helmet (F9) | ⏳ Хийгээгүй | |
| F7 (vitals-ийн дараа `COMPLETED` болохгүй) | ⏳ Хийгээгүй, урсгалын шийдвэр хэрэгтэй | |
> API гэрээ: [l1-1-api.md](l1-1-api.md) (**санал, батлагдаагүй**).
> Энэ баримтын заавар нь audit-ийн эх сурвалж. Гаднын үйлдэл (deploy, төлбөртэй resource, бодит QPay) хийх зөвшөөрөл **биш**.

### 0.1 Явцын тэмдэглэл — 2026-10-13

| Ажил | Төлөв | Нотолгоо |
|---|---|---|
| wclient auth шинэ гэрээнд нийцсэн (`data.user` объект, role routing, logout, хуучин `user_token`-д итгэхгүй, бүртгэлээс privileged role хассан) | ✅ + contract тест (7) | [wclient/lib/auth/session-core.ts](../wclient/lib/auth/session-core.ts), [tests/web-compat.test.ts](../server/tests/web-compat.test.ts) |
| Mobile `88bbc22`-ийн кодыг (scratch-д экспортолж, App-ийг өөрчлөөгүй) бодит backend-тэй тулгасан | ✅ 6/6 (нэг удаагийн шалгалт, commit хийгээгүй) | [l1-1-api.md §1.2](l1-1-api.md) |
| Нэгдсэн auth гэрээ: 401 `UNAUTHENTICATED` / **`TOKEN_EXPIRED`** / `INVALID_CREDENTIALS`, 403 `FORBIDDEN` | ✅ + тест | [middlwares/auth.ts](../server/src/middlwares/auth.ts), [l1-1-api.md §1.1.1](l1-1-api.md) |
| Draft захиалга (`Order`, `OrderItem`, `OrderEvent`) — **D2 таамаг** | ✅ + тест | [orderController.ts](../server/src/controllers/orderController.ts) |
| Red flag (`RedFlagQuestion` fixture, `RedFlagAnswer`), блок + guard | ✅ + тест | [services/orders.ts](../server/src/services/orders.ts) |
| Quote: guard бодитоор ажилладаг, үнэ → 501 `NOT_IMPLEMENTED` | ✅ (хуурамч амжилтгүй) | |
| Migration `20261013000000_add_draft_orders_red_flag`: зөвхөн шинэ хүснэгт/enum, одоогийн хүснэгтэд `ALTER` байхгүй | ✅ Хоосон UTF8 тест DB-д apply болсон. **Бодит/локал DB-д хийгээгүй** | [prisma/migrations](../server/prisma/migrations) |
| Тест | ✅ **58/58** (auth 17, catalog 4, orders/red flag 21, visits 9, web-compat 7) | `npm test` |
| Private upload гэрээ | 🟡 Эцэсэлсэн (санал), **хэрэгжээгүй** | [l1-1-api.md §5](l1-1-api.md) |
| Staging | ❌ Эрх байхгүй (§10) | |
| `next build` | ⚠️ Compile амжилттай, гэхдээ **өмнө нь байсан** хоосон `wclient/app/lab/reports/[id]/page.tsx` (0 byte, main болон upstream-д ч мөн адил) Next-ийн route type check-ийг унагаадаг. Auth-тай холбоогүй, өнөөдрийн хүрээнээс гадуур | |

### 0.2 Явцын тэмдэглэл — 2026-10-14

**Өдрийн эхэнд мэдэгдсэн blocker:** staging hosting, домэйн/TLS, managed PostgreSQL, private bucket, QPay sandbox credential — **аль нь ч байхгүй**. Docker daemon хариу өгөхгүй хэвээр.

| Ажил | Төлөв (fixture / mock / sandbox / real) | Нотолгоо |
|---|---|---|
| `POST /api/orders` Idempotency-Key (user+scope, 24 цаг, DB unique) | ✅ **Real** (код + DB constraint). Тест: давталт, өөр payload 409, 8 зэрэг хүсэлт → 1 order, timeout-ийн дараах retry, хугацаа дуусалт | [services/idempotency.ts](../server/src/services/idempotency.ts) |
| Эрт "Тийм" → серверт BLOCKED (дутуу хариутай ч) | ✅ **Real** логик. Асуултууд **fixture** | [orderController.ts](../server/src/controllers/orderController.ts) |
| Асуулгын гэрээ: `approved` талбар, тоо нь гэрээ биш | ✅ Docs + код | [l1-1-api.md §4](l1-1-api.md) |
| Quote | ✅ **Real** тооцоо (order/catalog version, guard, integer MNT). **Үнэ fixture**, хураамж тооцохгүй | [services/orders.ts](../server/src/services/orders.ts) |
| Private upload | ✅ **Real** урсгал (magic bytes, 10 MB, 5, owner, random key, soft delete). Storage: **memory (тест) / local-dev (dev)**. **S3/staging bucket хэрэгжээгүй, эрхгүй** | [attachmentController.ts](../server/src/controllers/attachmentController.ts), [services/storage.ts](../server/src/services/storage.ts) |
| Payment + QPay | ✅ **Mock** горим бүрэн тестлэгдсэн (давхар callback → 1 PAID, дүн зөрвөл PAID болохгүй, хугацаа дуусалт). **Sandbox код бий, нэг ч удаа ажиллуулаагүй (credential байхгүй).** Production идэвхгүй | [paymentController.ts](../server/src/controllers/paymentController.ts), [services/qpay.ts](../server/src/services/qpay.ts) |
| Migration `20261014000000_add_idempotency_quote_attachment_payment` | ✅ Зөвхөн шинэ хүснэгт/enum. Хоосон UTF8 тест DB-д apply болсон. **Бодит/локал DB-д хийгээгүй** | [prisma/migrations](../server/prisma/migrations) |
| `wclient/app/lab/reports/[id]/page.tsx` (0 byte) | ✅ Хамгийн бага placeholder ("хэрэгжээгүй, демо"). **Production lab feature биш.** `next build` амжилттай (14/14) | |
| `catalogVersion: null` (mobile) | ✅ "Илгээгээгүй"-тэй адил хүлээн авна (integration-аар илэрсэн) | |
| Server тест | ✅ **85/85** (null catalogVersion шалгалт одоо байгаа тест дотор) | `npm test` |
| Integration (`tmp/integration-1014` = backend + mobile `6f46d17`, локал түр branch, push хийгээгүй) | ✅ Git conflict байхгүй. Mobile unit **106/106**, server **85/85**. Mobile service функцуудыг бодит backend-тэй тулгасан **5/5** (идемпотент draft, эрт "Тийм", CLEAR+PATCH, upload/delete, PDF 415) | §14 |
| Staging | ❌ Эрх байхгүй | §10 |

### 0.3 Явцын тэмдэглэл — 2026-10-15

| Ажил | Төлөв |
|---|---|
| Mobile `cec500c`-тэй тулгалт (`tmp/integration-1015`, локал түр branch) | ✅ Git conflict байхгүй. Mobile unit **128/128**. Mobile функцууд → backend **5/5**: auth, draft retry (ижил order, өөр payload 409), хэсэгчилсэн "Тийм" → `recorded` (давтахад ч мөн), `{}` quote + upload retry (1 attachment, 1 blob), mock invoice → provider check → `PAID` + `paidAt` |
| Илэрсэн 2 зөрүү, засагдсан | (1) Mobile quote-д `{}` илгээдэг байхад сервер `orderVersion` шаарддаг байсан (400). Одоо заавал биш. (2) Mobile `parseQuote` `travelFeeMnt`/`discountMnt` integer шаарддаг. Одоо `0` ("тооцоогүй", `excludes`-тэй) |
| GAP-13/GAP-15 | Дахин хэрэгжүүлээгүй. Шинэ mobile-тэй ажиллаж байгааг баталгаажуулсан |
| Upload retry | Зэрэг 5 оролдлого ижил key-тэй → 1 attachment, orphan blob 0 (тест) |
| Config template | `server/.env.sample` (storage/QPay env нэрс, утгагүй), шинэ `wclient/.env.example`. `wclient/.gitignore`-д `!.env.example` нэмсэн (`.env*` дүрэм template-ийг ч нууж байсан) |
| Staging / bucket / QPay sandbox | ❌ Эрх байхгүй хэвээр |

### 0.4 Deploy-ийн дараалал (эрх ирсний дараа)

1. Managed PostgreSQL (**UTF8**) үүсгэж backup тохируулна.
2. Secret store-д `.env.sample`-ийн нэрсээр утга оруулна (`NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`, `QPAY_MODE=sandbox` эсвэл `mock`, `STORAGE_DRIVER`).
3. `docker build --target migrate` → нэг удаа `prisma migrate deploy` (шинэ DB тул baseline шаардлагагүй). **`db push`, `migrate reset` хориотой.**
4. `docker build` (runtime) → deploy → `GET /api/health`.
5. Smoke: signup/login, `GET /api/catalog/services`, draft, red flag, quote, (bucket байвал) upload, (sandbox байвал) invoice.
6. Fixture seed (каталог, red flag) — зөвхөн зохиомол өгөгдөл. Demo хэрэглэгчийг staging-д үүсгэхгүй.
7. Rollback: өмнөх image + DB backup. Migration-ууд зөвхөн нэмэлт тул хуучин код шинэ хүснэгтийг үл тооно.

Одоо байгаа WIN1252 локал DB-ийн үйлдэл: §12 (зөвшөөрөл хүлээж буй).

### 0.5 Явцын тэмдэглэл — 2026-10-16

Эхлэх SHA: main `901bb91`, backend `28590ee`, mobile `bd7d9f9`.

| Ажил | Төлөв |
|---|---|
| Payment recovery зөрүү | ✅ Засагдсан. Өөр key-ээр давтан invoice хүсэхэд гэрээнд байсан 409 `PAYMENT_IN_PROGRESS` + `paymentId` одоо үнэхээр буцна (өмнө нь `assertOrderReadyForPricing` түрүүлж `ORDER_NOT_EDITABLE` өгдөг байсан). Нэмэлт: `PAYMENT_ALREADY_PAID`, `PAYMENT_RECONCILIATION_REQUIRED`, `PAYMENT_UNCONFIRMED`, `error.fields.recovery`. Гэрээ: api §7.1.1 |
| Provider timeout | ✅ Тодорхойгүй үр дүн → payment `PENDING` (`PROVIDER_UNCONFIRMED`), захиалга түгжээтэй, хугацаа дуустал шинэ invoice үүсэхгүй. Тодорхой татгалзал → `FAILED`, `DRAFT`. Автомат reconciliation **байхгүй** (хязгаарыг §7.1.1-д бичсэн) |
| Аюулгүй байдлын regression | ✅ Signup зөвхөн CHILD, password/hash response-д байхгүй, logger мессеж/Prisma args хэвлэхгүй, order/payment/attachment ownership 404, upload magic-byte/10MB/5 файл (бүгд тесттэй). **Шинэ засвар:** `seed` нь `NODE_ENV=production` үед demo хэрэглэгч (нийтэд мэдэгдэж буй нууц үгтэй ADMIN гэх мэт) үүсгэдэг байсан → одоо зөвхөн fixture. Production config тест: mock QPay, memory/local-dev storage production-д ажиллахгүй |
| Fixture | Каталог `isFixture: true`, red flag `approved: false` хэвээр. Үнэ, эмнэлзүйн бичвэрийг батлаагүй |
| Integration (`tmp/integration-1016` = `d74e524` + mobile `bd7d9f9`, локал, push хийгээгүй) | ✅ Git conflict байхгүй. Mobile unit **132/132**. Mobile функцууд → backend **8/8**: auth (expired token локал ба серверийн 401), role 403 session хадгална, draft concurrent + timeout retry → 1 order, хэсэгчилсэн "Тийм" → `BLOCKED_RED_FLAG` ба PATCH/quote/payment тойрох боломжгүй, quote version/expiry/fixture, upload retry/read/delete/ownership, payment recovery (`inProgressPaymentId`), provider timeout |
| Server | 98/98, `tsc`, `prisma validate` OK. wclient `next build` 14/14 |
| Access (өдрийн эхэнд шалгасан) | ❌ Hosting/HTTPS, UTF8 managed PostgreSQL, private bucket, QPay sandbox credential/`invoice_code` байхгүй. Docker daemon API 500 |

**10.17-нд биелэхгүй үлдэх L1-1 шалгуур (одоогийн мэдээллээр):**

1. Staging HTTPS backend байхгүй → бодит төхөөрөмж + staging дээрх бүтэн урсгал (mobile plan-ийн "L1-1 дууссан" шалгуур) хийгдэхгүй.
2. QPay sandbox invoice/check/callback/PAID, буруу дүн, давхар callback-ийг sandbox дээр шалгаагүй (зөвхөн mock).
3. Private bucket (S3) adapter хэрэгжээгүй → staging/production-д upload 503 `STORAGE_UNAVAILABLE`.
4. Каталогийн үнэ, хураамж, red flag асуулт fixture (D3, D4 батлагдаагүй). `Order` model таамаг (D2).
5. Payment reconciliation-ийн operator хэрэгсэл байхгүй (`NEEDS_RECONCILIATION`, `PAID_AFTER_EXPIRY` гараар).
6. Локал WIN1252 DB-ийн UTF8 шилжилт зөвшөөрөл хүлээж байна (§12).

---

## 14. Integration шалгалт — 2026-10-14

- **Арга:** `git worktree` scratch хавтсанд, локал түр branch `tmp/integration-1014`: `work/backend-l1-1` + `origin/work/mobile-l1-1` (`6f46d17`). Өөрийн branch болон main-д нэгтгээгүй, push хийгээгүй. `node_modules`-ийг junction-оор холбосон (install хийгээгүй).
- **Git conflict байхгүй.** Энэ нь ажиллагааны нийцлийн нотолгоо биш тул доорх тестүүдийг ажиллуулсан:
  - Mobile unit тест (`App: npm test`): 106/106.
  - Server тест (тусгаарласан UTF8 DB): 85/85.
  - Mobile `App/services/{orders,authFlow,catalog,redFlag,httpClient}.ts`-ийн бодит функцууд → backend (тусгаарласан DB, mock QPay, memory storage): 5/5.
- **Илэрсэн зөрүү ба шийдэл:** mobile `catalogVersion: null` илгээдэг байсан бол сервер 400 буцааж байсан. Засагдсан (`6253cf3`).
- **Шалгаагүй:** mobile UI/дэлгэц, бодит төхөөрөмж, mobile-ийн quote/payment дэлгэц (mobile-д хараахан байхгүй), HTTPS staging.

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

### 3.1 10.12-ны байдал (бэлтгэл, apply хийгээгүй)

- `server/.gitignore`-оос `/prisma/migrations`-ийг хассан. Migrations одоо commit хийгдэнэ.
- `prisma/migrations/0_init/migration.sql`: 10.11-ний schema-аас (`3b1bc42`) `prisma migrate diff --from-empty`-ээр үүсгэсэн baseline. `DROP`, `TRUNCATE`, `DELETE` байхгүй.
- `prisma/migrations/20261012000000_add_service_catalog/migration.sql`: зөвхөн `CREATE TABLE "ServiceCatalogItem"` ба 2 index. Одоогийн хүснэгтүүдэд хүрэхгүй.
- Хоёулаа **хоосон, тусгаарласан тест DB-д** `migrate deploy`-оор амжилттай apply болсон (тест бүрд).
- **Локал DB (`.local-pg`, port 5544) болон бусад DB-д apply/resolve хийгээгүй.**

### 3.2 Одоо байгаа DB-г baseline хийх журам (зөвшөөрөл авсны дараа, DB бүрд)

1. DB-ийн backup авах.
2. `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (DB-г **өөрчлөхгүй**, зөвхөн уншиж зөрүүг SQL-ээр харуулна). Гаралт нь `20261012000000_add_service_catalog/migration.sql`-тэй **яг ижил** байх ёстой. Өөр зөрүү гарвал DB нь `0_init`-ээс зөрсөн гэсэн үг: зогсож шалгана.
3. Зөрүүгүй бол: `npx prisma migrate resolve --applied 0_init`.
4. `npx prisma migrate deploy` → catalog хүснэгт үүснэ.
5. Шинэ (хоосон) DB-д (staging): шууд `migrate deploy`.

⚠️ `npm run dev:local` нь эхлэх бүрдээ `prisma db push` + seed ажиллуулдаг. Дараагийн удаа ажиллуулахад локал DB-д `ServiceCatalogItem` хүснэгт **нэмэгдэж**, зохиомол каталог seed хийгдэнэ (нэмэлт, өгөгдөл устгахгүй). Энэ нь migration history бичихгүй. Baseline хийсний дараа dev-д `migrate deploy` руу шилжих эсэхийг шийднэ.

### 3.3 Ерөнхий төлөвлөгөө

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
| **10.12 (Да)** ✅ | Signup эрх хаах, алдааны гэрээ, login/signup response, visit validation, log, catalog endpoint + fixture, migration SQL, тусгаарласан тест, Dockerfile. **Үлдсэн:** шийдвэрүүд (D1–D15), staging эрх | branch `work/backend-l1-1` |
| **10.13 (Мя)** ✅ | wclient auth засвар (D15), mobile тулгалт, auth гэрээ, draft order, red flag, quote guard, upload гэрээ. **Staging: эрх байхгүй** | branch `work/backend-l1-1` |
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
| Үндсэн | `NODE_ENV`, `PORT`, `PUBLIC_BASE_URL`, `CORS_ORIGINS` (✅ кодонд), `LOG_LEVEL`, `TRUST_PROXY` (✅ кодонд), `PRISMA_LOG_QUERIES` (✅ кодонд, staging/prod-д тохируулахгүй) |
| DB | `DATABASE_URL`, `DATABASE_SSL_MODE` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_BOOTSTRAP_EMAIL` |
| Storage | `STORAGE_DRIVER` (✅ кодонд: `memory` тест, `local-dev` dev; `s3` хэрэгжээгүй), `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `SIGNED_URL_TTL_SECONDS` |
| QPay | `QPAY_MODE` (✅ кодонд: `mock`/`sandbox`; `production` идэвхгүй), `QPAY_BASE_URL`, `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`, `QPAY_CALLBACK_SECRET`, `PUBLIC_BASE_URL` (callback URL-ийг эндээс угсарна) |
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

## 10. Staging бэлэн байдал — 2026-10-12 (10.13, 10.14-нд дахин шалгасан: өөрчлөлтгүй, эрх ирээгүй)

| Зүйл | Байгаа юу | Тэмдэглэл |
|---|---|---|
| Hosting (container/PaaS) эрх | ❌ Үгүй | Энэ компьютерт fly/railway/render/vercel/az/gcloud/aws/doctl/heroku CLI, холбогдох env/credential олдсонгүй |
| Домэйн + TLS | ❌ Үгүй | HTTPS нь QPay callback болон iOS-д заавал |
| Managed PostgreSQL | ❌ Үгүй | UTF8 encoding-той, SSL, backup |
| Private object storage | ❌ Үгүй | L1-1 attachment-д |
| Docker | ⚠️ CLI байгаа, daemon хариу өгөхгүй (API 500). 10.13-нд дахин шалгахад мөн адил | Image build хийж шалгаагүй |
| Container тохиргоо | ✅ Бэлэн (review хийх боломжтой) | [server/Dockerfile](../server/Dockerfile): `runtime` (`node dist/index.js`, healthcheck, `USER node`) ба `migrate` (`prisma migrate deploy`) target. [server/.dockerignore](../server/.dockerignore) нь `.env`, `.local-pg`, log-ийг оруулахгүй |
| Migrations | ✅ Бэлэн | §3 |
| Staging URL | ❌ Байхгүй | **Deploy хийгдээгүй** |

**Эрх ирэхэд (≈1–2 цаг):** managed PostgreSQL (UTF8) үүсгэх → secret store-д §6-ийн env тохируулах → `migrate` target-ийг нэг удаа ажиллуулах → `runtime` deploy → `/api/health` + auth/catalog smoke test → fixture seed (зөвхөн зохиомол) → URL-ийг [l1-1-api.md §14](l1-1-api.md)-д нэмэх. Төлбөртэй resource үүсгэхээс өмнө зөвшөөрөл авна.

---

## 11. Локал DB-ийн encoding (F17)

- Хэмжилт (зөвхөн уншсан): локал `.local-pg` DB нь `server_encoding = WIN1252`, collation `English_United States.1252`.
- Үр дагавар: mobile-аас Кирилл үсэгтэй нэр/хаяг хадгалахад PostgreSQL `22P05` алдаа өгч, API 500 буцаана. Тусгаарласан тест эхэндээ яг энэ алдаагаар унасан. `initdbFlags: ['--encoding=UTF8', '--locale=C']` нэмсний дараа давсан.
- Засвар: `dev-local.mjs` болон тестийн скрипт **шинээр үүсгэх** cluster-ийг UTF8 болгоно. **Одоо байгаа `.local-pg`-д нөлөөлөхгүй.**
- Одоо байгаа локал DB-ийн сонголтууд (**аль нь ч зөвшөөрөлгүйгээр хийгдэхгүй**):
  1. Нэг cluster дотор шинэ `UTF8` database үүсгэж (`TEMPLATE template0`), `DATABASE_URL`-ийг түүн рүү шилжүүлэх. Хуучин DB хэвээр үлдэнэ.
  2. `.local-pg`-ийг нөөцөлж (нэрийг өөрчилж), шинэ UTF8 cluster үүсгэх. Demo өгөгдөл seed-ээр дахин үүснэ, гараар оруулсан өгөгдөл шилжихгүй.
- Staging/production DB-г заавал UTF8-аар үүсгэнэ.

---

## 12. Локал DB-д хийх үйлдлийн төлөвлөгөө (ЗӨВШӨӨРӨЛ ХҮЛЭЭЖ БУЙ)

Одоогийн `.local-pg` / `pariwar_care` (WIN1252)-д **хүрэхгүй**. Санал болгох арга нь **устгалгүй, буцааж болох**: тухайн cluster дотор шинэ UTF8 DB үүсгэнэ.

| # | Үйлдэл | Команд (PowerShell, `server/` дотор) | Rollback |
|---|---|---|---|
| 1 | Backup (суулгасан PostgreSQL 18-ийн `pg_dump`, embedded PG 18.4-тэй нийцнэ) | `& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -p 5544 -U postgres -Fc -f ..\..\otoch-backup-pariwar_care.dump pariwar_care` (repo-оос гадна) | — |
| 2 | Шинэ UTF8 DB | `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5544 -U postgres -c "CREATE DATABASE otoch_dev ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C';"` | `DROP DATABASE otoch_dev;` (хуучин DB хөндөгдөхгүй) |
| 3 | `.env`-ийн `DATABASE_URL`-ийг `…/otoch_dev?schema=public` болгох | гараар | хуучин URL руу буцаах |
| 4 | Migration (хоосон DB тул baseline/resolve хэрэггүй) | `npx prisma migrate deploy` | DB-г drop хийх |
| 5 | Зохиомол seed (demo хэрэглэгч, каталог, red flag fixture) | `npm run db:seed` | — |

- Dev cluster-ийн `postgres` нууц үгийг command prompt дээр оруулна. **Log/тайланд хэвлэхгүй.**
- ⚠️ `npm run dev:local` нь эхлэх бүрдээ `prisma db push` + seed ажиллуулдаг. `otoch_dev` нь migration-тай нийцэж байгаа тул `db push` өөрчлөлтгүй байх ёстой. `dev:local`-ийг `migrate deploy` руу шилжүүлэх эсэхийг тусад нь шийднэ.
- Хуучин `pariwar_care` (WIN1252) DB-ийн өгөгдлийг шилжүүлэхгүй (зохиомол demo өгөгдөл). Шаардлагатай бол `pg_restore`-оор тусад нь.

---

## 13. 10.14-ний бэлэн байдал (QPay ба upload)

| Ажил | Бэлэн зүйл | Блок |
|---|---|---|
| Quote (серверийн үнэ) | Guard (`assertOrderReadyForPricing`), `Order`/`OrderItem`, каталогийн `priceMnt`, catalogVersion | Үнийн дүрэм: унааны зардал, промо, НӨАТ (D3). Fixture үнээр л хийж болно |
| QPay invoice/check/callback | Гэрээ (api §7), model санал (plan §2: `Payment`), idempotency дүрэм, `QPAY_*` env нэрс | **QPay sandbox merchant эрх, `invoice_code`** (D5), callback-д нийтийн **HTTPS** URL (staging) |
| Private upload | Гэрээ (api §5), хэмжээ/тоо/төрлийн дүрэм, 10 MB upload хязгаар, adapter загвар (`s3`/`local-dev`/`memory`) | **Private bucket эрх** (D6). Эрхгүйгээр зөвхөн `local-dev`/`memory` adapter, түүнийг production гэж тайлагнахгүй |
| PDF заалт | — | D12 шийдвэр |

10.14-нд эрхгүй ч хийж болох ажил: quote-ийг fixture үнээр (`isFixture` тэмдэглэгээтэй), QPay client-ийн **mock** горим (`QPAY_MODE=mock`), `Payment` model + migration, upload-ийн `memory`/`local-dev` adapter ба magic-byte шалгалт, тест.

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
| Баримт | `AGENTS.md` repo-д байхгүй (2026-10-12-ны байдлаар `origin/main`-д ч байхгүй). Mobile branch remote-д хараахан байхгүй |
| ~~Шийдвэр (10.12)~~ | ~~wclient `data.user` засвар (D15)~~ — **10.13-нд хийсэн** |
| Шийдвэр (10.13) | D2: тусдаа `Order` model-ийг батлах эсэх (таамгаар хэрэгжсэн) |
| Зөвшөөрөл (10.13) | §12-ийн локал DB үйлдлүүд (backup → шинэ UTF8 DB → migrate deploy → seed) |
| Шийдвэр (10.12) | Consent (D10), өвчтөний нэмэлт талбарууд (D11), PDF заалт (D12), цагийн цонх/багтаамж (D13) |
| Зөвшөөрөл (10.12) | Локал DB-ийн encoding засвар (§11) болон baseline/migrate (§3.2)-ийг локал DB дээр ажиллуулах |
