# OTOCH L1-1 — API гэрээний САНАЛ (mobile ↔ backend)

> **Статус: САНАЛ. Батлагдаагүй.** Анх 2026-10-11, шинэчилсэн 2026-10-13, backend (`work/backend-l1-1`).
> **Хэрэгжсэн (branch дээр, main-д нэгтгэгдээгүй):** 10.12 — алдааны гэрээ (§0.1), signup/login (§1.1), каталог (§2). 10.13 — нэгдсэн auth гэрээ + `TOKEN_EXPIRED` (§1.1), draft захиалга (§3), red flag (§4), quote guard (§6, үнэгүй 501).
> **Таамаг:** захиалгыг тусдаа `Order` model-оор хийсэн (D2 батлагдаагүй). Red flag асуулт, каталог нь **fixture**.
> Энэ баримтад "санал болгосон, хэрэгжээгүй" гэж тэмдэглэсэн endpoint-ууд **одоогоор кодонд байхгүй**.
> Mobile тал эдгээрийг mock-оор хөгжүүлж болно. Бодит сервертэй холбохоос өмнө энэ гэрээг хоёр тал батлах ёстой.
> Бүх жишээ өгөгдөл **зохиомол** (бодит хүн, өвчтөн, гүйлгээ биш).

Холбоотой баримт: [l1-1-backend-plan.md](l1-1-backend-plan.md)

---

## 0. Ерөнхий дүрэм

| Зүйл | Санал |
|---|---|
| Base URL | `{API_BASE}/api` — локалд `http://<PC-LAN-IP>:8000/api`, staging-д HTTPS домэйн (тодорхойгүй) |
| Auth | `Authorization: Bearer <JWT>` (одоогийн `/api/auth/login`-оос авна) |
| Content-Type | `application/json; charset=utf-8` (upload-аас бусад) |
| Огноо/цаг | ISO-8601, **offset-тэй** (`2026-10-20T09:00:00+08:00`). Сервер UTC-ээр хадгална |
| Мөнгө | **Бүхэл тоо, төгрөг (MNT)**, `amountMnt`. Float ашиглахгүй |
| Үнэ | **Зөвхөн сервер тооцоолно.** Mobile-ийн илгээсэн үнийг сервер үл тооцно |
| QPay түлхүүр | **Зөвхөн backend-д.** Mobile QPay API-г шууд дуудахгүй |
| ID | Сервер үүсгэсэн string (`cuid`). Mobile ID зохиохгүй |
| Idempotency | Төлбөр үүсгэх хүсэлтэд `Idempotency-Key: <uuid>` header заавал |

### 0.1 Response хэлбэр (шинэ endpoint-ууд)

Одоогийн mobile `response.data.message` болон `response.data.data`-г уншдаг тул тэр хэлбэрийг хадгална. `error` объектыг нэмнэ:

```json
// Амжилттай
{ "success": true, "message": "…", "data": { } }

// Алдаа
{
  "success": false,
  "message": "Хүний уншихуйц тайлбар (Монгол)",
  "error": {
    "code": "ORDER_NOT_EDITABLE",
    "fields": { "scheduledFor": "Ирээдүйн огноо байх ёстой" }
  }
}
```

| HTTP | Хэзээ | `error.code` жишээ |
|---|---|---|
| 400 | Validation алдаа | `VALIDATION_ERROR` |
| 401 | Token байхгүй/хүчингүй | `UNAUTHENTICATED` |
| 403 | Эрх хүрэхгүй, өөр хүний захиалга | `FORBIDDEN` |
| 404 | Олдсонгүй | `NOT_FOUND` |
| 409 | Төлөв зөрсөн, хуучин version | `ORDER_NOT_EDITABLE`, `VERSION_CONFLICT`, `QUOTE_EXPIRED` |
| 413 | Файл хэт том | `FILE_TOO_LARGE` |
| 415 | Файлын төрөл буруу | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | Бизнес дүрэм зөрчсөн | `RED_FLAG_BLOCKED`, `REFERRAL_REQUIRED` |
| 429 | Хэт олон хүсэлт | `RATE_LIMITED` |
| 502 | QPay алдаа | `PAYMENT_PROVIDER_ERROR` |

> ✅ **10.12: ХЭРЭГЖСЭН.** Бүх одоо байгаа endpoint (auth, parents, visits, review, users, analytics, catalog, auth/RBAC middleware) энэ хэлбэрт шилжсэн. Алдааг HTTP 200-аар буцаахаа больсон. Код: [server/src/utils/http.ts](../server/src/utils/http.ts), [server/src/middlwares/error.ts](../server/src/middlwares/error.ts).
> 500 алдаанд дотоод мессеж (`error.message`) буцаахгүй, зөвхөн ерөнхий мессеж ба `INTERNAL_ERROR` буцна.

**Одоо хэрэгжсэн `error.code` утгууд:** `VALIDATION_ERROR`, `INVALID_JSON`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `ROLE_NOT_ALLOWED`, `NOT_FOUND`, `PARENT_NOT_FOUND`, `VISIT_NOT_FOUND`, `NURSE_NOT_FOUND`, `USER_NOT_FOUND`, `EMAIL_TAKEN`, `INVALID_STATUS`, `CONFLICT`, `ORDER_NOT_FOUND`, `ORDER_NOT_EDITABLE`, `VERSION_CONFLICT`, `CATALOG_OUTDATED`, `ORDER_INCOMPLETE`, `RED_FLAG_REQUIRED`, `RED_FLAG_INCOMPLETE`, `RED_FLAG_BLOCKED`, `QUESTIONNAIRE_OUTDATED`, `QUESTIONNAIRE_UNAVAILABLE`, `REFERRAL_REQUIRED`, `NOT_IMPLEMENTED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.
Хүснэгтийн бусад code (`QUOTE_EXPIRED`, `UNSUPPORTED_MEDIA_TYPE`, `FILE_TOO_LARGE`, `PAYMENT_PROVIDER_ERROR` гэх мэт) нь тухайн endpoint-тэй хамт нэмэгдэнэ.

`VALIDATION_ERROR`-ийн `error.fields` нь `{ "талбарын.зам": "Монгол мессеж" }` хэлбэртэй, талбар бүрд эхний алдааг харуулна.

#### 0.1.1 Одоогийн endpoint-уудын status code өөрчлөлт (10.12)

| Endpoint | Өмнө | Одоо |
|---|---|---|
| `POST /api/auth/login` буруу нууц үг / имэйл | 200 `{message:"Нууц үг буруу"}` / `{message:"Хэрэглэгч олдсонгүй"}` | **401** `INVALID_CREDENTIALS`, хоёулаа ижил мессеж |
| `POST /api/auth/login\|signup` буруу body | 200 | **400** `VALIDATION_ERROR` |
| `POST /api/auth/signup` бүртгэлтэй имэйл | 200 | **409** `EMAIL_TAKEN` |
| `POST /api/auth/signup` `role` ≠ CHILD | 201 (ADMIN үүсдэг байсан!) | **403** `ROLE_NOT_ALLOWED` |
| Token байхгүй | 401 `{error:"…"}` | 401 `UNAUTHENTICATED` |
| Token хүчингүй/хугацаа дууссан | **403** | **401** `UNAUTHENTICATED` |
| `POST /api/visits` буруу body | 200 | **400** `VALIDATION_ERROR` (+ өнгөрсөн огноо одоо татгалзана) |
| `POST /api/visits` өөрийн бус/байхгүй parent | 200 | **404** `PARENT_NOT_FOUND` |
| `POST /api/visits/:id/assign\|start\|complete` олдохгүй | 200 | **404** `VISIT_NOT_FOUND` / `NURSE_NOT_FOUND` |
| start/vitals/complete буруу төлөв | 200 эсвэл 400 | **409** `INVALID_STATUS` |
| review approve/reject буруу төлөв | 400 | **409** `INVALID_STATUS` |
| `/api/parents/*` буруу body / олдохгүй | 200 | **400** / **404** `PARENT_NOT_FOUND` |
| `DELETE /api/parents/:id` үзлэгтэй parent | 400 (Prisma мессеж) | **409** `CONFLICT` |
| Malformed JSON | 400 HTML/текст | **400** `INVALID_JSON` |
| Байхгүй `/api/*` зам | 404 HTML | **404** `NOT_FOUND` |

### 0.2 Захиалгын төлөв (Order status) — санал

```
DRAFT ──quote──▶ DRAFT(quote-той) ──invoice──▶ AWAITING_PAYMENT ──paid──▶ PAID
  │                                                │                        │
  │ red flag гарвал                                │ хугацаа дуусвал        ▼
  ▼                                                ▼                  ASSIGNED ──▶ IN_PROGRESS ──▶ COMPLETED
BLOCKED_RED_FLAG                                 EXPIRED                  (сувилагч)    (үзлэг)      (тайлан батлагдсан)
                         CANCELLED  ◀── DRAFT/AWAITING_PAYMENT үед хэрэглэгч цуцлах
```

| Order status | Утга | Mobile харуулах | Хуучин `Visit.status`-тай холбоо |
|---|---|---|---|
| `DRAFT` | Бөглөж буй | "Ноорог" | Visit үүсээгүй |
| `BLOCKED_RED_FLAG` | Аюулын шинж илэрсэн, үргэлжлүүлэхгүй | "Яаралтай тусламж авна уу" | Visit үүсээгүй |
| `AWAITING_PAYMENT` | QPay invoice үүссэн | "Төлбөр хүлээж буй" | Visit үүсээгүй |
| `PAID` | Төлбөр баталгаажсан | "Төлөгдсөн, сувилагч хуваарилж байна" | Visit `PENDING` үүснэ |
| `ASSIGNED` | Сувилагч томилогдсон | "Сувилагч томилогдсон" | `ASSIGNED` |
| `IN_PROGRESS` | Үзлэг явагдаж буй | "Үзлэг явагдаж байна" | `STARTED`, `WAITING_APPROVAL`, `REVISION_REQUIRED` |
| `COMPLETED` | Тайлан батлагдсан | "Дууссан" | `APPROVED` (эсвэл `COMPLETED`) |
| `CANCELLED` | Цуцлагдсан | "Цуцлагдсан" | — |
| `EXPIRED` | Төлбөрийн хугацаа дууссан | "Хугацаа дууссан" | — |

Mobile-д `WAITING_APPROVAL` зэрэг дотоод эмнэлгийн төлвүүд харагдахгүй. Энэ нь одоогийн дүрэмтэй нийцнэ: [visitController.ts:103-106](../server/src/controllers/visitController.ts#L103-L106).

---

## 1. Одоо байгаа (ХЭРЭГЖСЭН) endpoint-ууд — эвдэхгүй

Бүгд [server/src/app.ts](../server/src/app.ts) дээр mount хийгдсэн.

| Method | Path | Auth/role | Файл:мөр | Тэмдэглэл |
|---|---|---|---|---|
| POST | `/api/auth/signup` | Нээлттэй | [auth.routes.ts:27](../server/src/routes/auth.routes.ts#L27) | ✅ 10.12: зөвхөн CHILD үүсгэнэ, `data.token` + `data.user` (объект) буцаана. §1.1 |
| POST | `/api/auth/login` | Нээлттэй | [auth.routes.ts:48](../server/src/routes/auth.routes.ts#L48) | ✅ 10.12: `data.user` нь **объект** болсон (өмнө JWT string байсан). §1.1 |
| GET | `/api/catalog/services` | Нэвтэрсэн | [catalog.routes.ts](../server/src/routes/catalog.routes.ts) | ✅ 10.12: шинэ. §2 |
| POST/GET | `/api/orders`, `GET/PATCH /api/orders/:id` | CHILD, өөрийн | [orders.routes.ts](../server/src/routes/orders.routes.ts) | ✅ 10.13: шинэ draft захиалга. §3 |
| GET/PUT | `/api/orders/:id/red-flag-questions`, `/red-flag-answers` | CHILD, өөрийн | мөн дээрх | ✅ 10.13: §4 |
| POST | `/api/orders/:id/quote` | CHILD, өөрийн | мөн дээрх | 🟡 10.13: guard ажилладаг, үнэ хэрэгжээгүй → 501. §6 |
| GET | `/api/users` | ADMIN | [users.ts:12](../server/src/routes/users.ts#L12) | |
| GET | `/api/users/:id` | Өөрөө эсвэл ADMIN | [users.ts:30](../server/src/routes/users.ts#L30) | |
| POST/GET | `/api/parents` | Нэвтэрсэн | [parents.routes.ts:33,47](../server/src/routes/parents.routes.ts#L33) | Role шалгахгүй |
| GET/PUT/DELETE | `/api/parents/:id` | Нэвтэрсэн, өөрийн | [parents.routes.ts:67,101,121](../server/src/routes/parents.routes.ts#L67) | |
| POST | `/api/visits` | Нэвтэрсэн | [visits.routes.ts:59](../server/src/routes/visits.routes.ts#L59) | Mobile одоо `{parentId, scheduledFor, visitType:"FULL"}` илгээдэг ([bookappointment.tsx:128-130](../App/app/(tabs)/bookappointment.tsx#L128-L130)). Үнэ, төлбөр, үйлчилгээ байхгүй |
| GET | `/api/visits/child` | Нэвтэрсэн | [visits.routes.ts:120](../server/src/routes/visits.routes.ts#L120) | |
| POST | `/api/visits/:id/assign` | ADMIN | [visits.routes.ts:153](../server/src/routes/visits.routes.ts#L153) | |
| GET | `/api/visits/nurse` | NURSE | [visits.routes.ts:167](../server/src/routes/visits.routes.ts#L167) | |
| POST | `/api/visits/:id/start`, `/vitals`, `/complete` | NURSE | [visits.routes.ts:188,234,255](../server/src/routes/visits.routes.ts#L188) | |
| GET | `/api/nurses` | ADMIN | [nurses.routes.ts:43](../server/src/routes/nurses.routes.ts#L43) | |
| GET | `/api/analytics/parent/:id/trends` | Нэвтэрсэн, өөрийн | [analytics.routes.ts:7](../server/src/routes/analytics.routes.ts#L7) | |
| GET/POST | `/api/review/visits/...` | MEDICAL_ADMIN, ADMIN | [review.routes.ts:25-104](../server/src/routes/review.routes.ts#L25) | |
| GET | `/api/health` | Нээлттэй | [index.ts:54](../server/src/index.ts#L54) | |

**Шинэ endpoint бүр нэмэлт (additive).** Дээрх route-ууд хэвээр ажиллана. Mobile шинэ урсгалд шилжих хүртэл `POST /api/visits` хэвээр байна.

### 1.1 Auth — ✅ ХЭРЭГЖСЭН (10.12)

Код: [authController.ts](../server/src/controllers/authController.ts). Тест: [tests/auth.test.ts](../server/tests/auth.test.ts).

**`POST /api/auth/signup`**

Request (`role` заавал биш; илгээвэл зөвхөн `"CHILD"` зөвшөөрнө):
```json
{ "name": "Туршилт Хэрэглэгч", "email": "test.user@example.invalid", "password": "Test-Only-123", "role": "CHILD" }
```

Response **201**:
```json
{
  "success": true,
  "message": "Хэрэглэгч амжилттай бүртгэгдлээ",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs…(зохиомол)",
    "user": { "id": "usr_demo_001", "name": "Туршилт Хэрэглэгч", "email": "test.user@example.invalid", "role": "CHILD", "createdAt": "2026-10-12T02:00:00.000Z" }
  }
}
```

| Тохиолдол | HTTP | `error.code` |
|---|---|---|
| `role` нь `ADMIN`, `NURSE`, `MEDICAL_ADMIN` болон бусад | 403 | `ROLE_NOT_ALLOWED` (`error.fields.role`) |
| Имэйл бүртгэлтэй (том/жижиг үсэг ялгахгүй) | 409 | `EMAIL_TAKEN` |
| `name` < 2, имэйл буруу, нууц үг < 6 эсвэл > 128 | 400 | `VALIDATION_ERROR` |

**`POST /api/auth/login`** → **200**: signup-тай ижил `data` (`token` string, `user` объект).
Буруу имэйл болон буруу нууц үг **ижил** хариу өгнө: **401** `INVALID_CREDENTIALS`, "Имэйл эсвэл нууц үг буруу байна". Хариуны хугацааг ойролцоо байлгах үүднээс хэрэглэгч олдоогүй үед ч bcrypt ажилладаг.

- `data.user`-д нууц үг хэзээ ч ордоггүй.
- JWT payload: `{ userId, email, role }`. Хугацааг `JWT_EXPIRES_IN` env-ээс авна (default `24h`). Өмнө нь `24h` код дотор шууд бичигдсэн байсан.
- Имэйлийг том/жижиг үсэг ялгахгүй хайна. Шинэ бүртгэлийн имэйлийг жижиг үсгээр хадгална.

#### 1.1.1 Нэгдсэн auth гэрээ (10.13) — status / `error.code`

Дүрэм: **401 = "чи хэн бэ?"** (token байхгүй, хүчингүй, хугацаа дууссан, буруу нэвтрэлт) → клиент дахин нэвтрүүлнэ. **403 = "чамайг таньж байгаа ч эрхгүй"** → session-ийг устгахгүй.

| Тохиолдол | HTTP | `error.code` | Клиентийн үйлдэл |
|---|---|---|---|
| Login: буруу имэйл эсвэл нууц үг | 401 | `INVALID_CREDENTIALS` | Мессеж харуулна. Хадгалсан session-д хүрэхгүй (login нь token-гүй хүсэлт) |
| Login/signup: буруу body | 400 | `VALIDATION_ERROR` | `error.fields`-ийг талбар дээр харуулна |
| `Authorization` header байхгүй | 401 | `UNAUTHENTICATED` | Login руу шилжүүлнэ |
| Token хүчингүй (гарын үсэг буруу, хэлбэр буруу) | 401 | `UNAUTHENTICATED` | Session устгаад login руу шилжүүлнэ |
| Token-ий хугацаа дууссан | 401 | **`TOKEN_EXPIRED`** | Session устгаад "Нэвтрэх хугацаа дууссан" гэж харуулна |
| Token зөв, role тохирохгүй (жишээ нь CHILD → `/api/users`, NURSE → `/api/orders`) | 403 | `FORBIDDEN` | Session-ийг **устгахгүй**, "Хандах эрхгүй" |
| Signup: `role` ≠ CHILD | 403 | `ROLE_NOT_ALLOWED` | Мессеж харуулна |
| Өөр хэрэглэгчийн parent/order | 404 | `PARENT_NOT_FOUND` / `ORDER_NOT_FOUND` | Байгаа эсэхийг задлахгүй |

- Token зөвхөн `Authorization: Bearer <token>` (эсвэл backend-ийн тавьсан httpOnly `token` cookie)-аар ирнэ.
- **Log:** token, нууц үг, `Authorization` header, request body, эрүүл мэндийн мэдээлэл log-д хэвлэгдэхгүй. Алдааны log-д зөвхөн `name`/`code`/`model` гарна ([utils/logger.ts](../server/src/utils/logger.ts)). Prisma query log production-д унтраалттай.
- Тестээр баталгаажсан: [tests/auth.test.ts](../server/tests/auth.test.ts), [tests/web-compat.test.ts](../server/tests/web-compat.test.ts).

#### 1.2 Одоогийн хэрэглэгчдэд нөлөөлөх өөрчлөлт

| Өөрчлөлт | Хэнд нөлөөлөх | Шаардлагатай арга хэмжээ |
|---|---|---|
| Login-ийн `data.user` JWT string-ээс **объект** болсон | **wclient** | ✅ **10.13-нд зассан** (энэ branch дээр). Шинэ [lib/auth/session-core.ts](../wclient/lib/auth/session-core.ts) нь `data.user` объектыг шалгаж, token-ий claims-тэй тулгана. `auth_user` cookie-д хадгалж, role-оор чиглүүлнэ. Хуучин `user_token` (JWT)-д итгэхгүй, logout бүгдийг цэвэрлэнэ. Энэ branch нэгтгэгдсэний дараа хуучин session-тэй хэрэглэгч нэг удаа дахин нэвтэрнэ |
| Mobile login/register | Mobile `88bbc22` нь хоёр хэлбэрийг хоёуланг нь хүлээж авдаг | ✅ **10.13-нд бодит backend-тэй тулгасан** (6/6, §10): login 1 хүсэлтээр `data.user` объектыг шууд ашиглана, signup шууд нэвтэрнэ. Mobile-д өөрчлөлт шаардлагагүй |
| Нийтийн signup-аар NURSE/ADMIN/MEDICAL_ADMIN үүсгэх боломжгүй | wclient бүртгэлийн хуудас | ✅ 10.13: вэб бүртгэлээс role сонголтыг хассан (зөвхөн CHILD). Ажилтны эрхийг seed эсвэл admin-ий хамгаалагдсан урсгалаар үүсгэнэ (хэрэгжээгүй) |
| Хүчингүй token 403-аас **401** болсон | wclient interceptor 401 үед login руу шилжүүлдэг. Энэ нь хүсэлтэй үйлдэл | — |
| Өмнө нээлттэй signup-аар үүссэн privileged хэрэглэгчид | Хэрэв байгаа бол хэвээр үлдэнэ | Production/staging DB-д ADMIN/NURSE/MEDICAL_ADMIN жагсаалтыг гараар шалгах |

---

## 2. Каталог авах — ✅ ХЭРЭГЖСЭН (10.12, зохиомол өгөгдөлтэй)

### `GET /api/catalog/services`

Код: [catalogController.ts](../server/src/controllers/catalogController.ts). Model: `ServiceCatalogItem` ([schema.prisma](../server/prisma/schema.prisma)). Тест: [tests/catalog.test.ts](../server/tests/catalog.test.ts).

- **Auth:** Нэвтэрсэн ямар ч хэрэглэгч. *Шийдвэр (D8):* нэвтрээгүй хэрэглэгчид харуулах эсэх.
- **Query:** `?category=HOME_VISIT` (заавал биш, `^[A-Z_]{2,40}$`, буруу бол 400).
- Зөвхөн `isActive = true` мөрийг `sortOrder`, дараа нь `code`-оор эрэмбэлж буцаана.
- **Үнэ:** `priceMnt` нь **бүхэл төгрөг, зөвхөн харуулах зориулалттай**. Эцсийн үнийг §6 quote тогтооно.
- `code` нь тогтвортой машин код (`HOME_BASIC_CHECK`). Mobile логикоо `id` биш `code` дээр тулгуурлана.
- ⚠️ **Одоогийн өгөгдөл ЗОХИОМОЛ.** `isFixture: true`, `containsFixtures: true` гэж ирнэ. Бодит үйлчилгээ ба үнэ батлагдаагүй (D3). Fixture: [prisma/fixtures/catalog.ts](../server/prisma/fixtures/catalog.ts).
- `catalogVersion` нь идэвхтэй мөрүүдийн хамгийн сүүлийн `updatedAt` (ISO). Каталог өөрчлөгдөхөд солигдох тул mobile кэшийн түлхүүр болгож болно. Хоосон каталогт `null`.

Response **200** (бодит хариунаас авсан бүтэц, утга зохиомол):
```json
{
  "success": true,
  "message": "Каталог",
  "data": {
    "catalogVersion": "2026-10-12T06:00:00.000Z",
    "currency": "MNT",
    "containsFixtures": true,
    "services": [
      {
        "id": "cmg_demo_basic",
        "code": "HOME_BASIC_CHECK",
        "name": "Гэрийн ердийн үзлэг (тест)",
        "description": "Даралт, сахар, судасны цохилт, хүчилтөрөгч хэмжих. Туршилтын өгөгдөл, бодит үнэ биш.",
        "category": "HOME_VISIT",
        "priceMnt": 45000,
        "durationMin": 45,
        "requiresReferral": false,
        "redFlagQuestionnaire": "GENERAL_V1",
        "isActive": true,
        "isFixture": true
      },
      {
        "id": "cmg_demo_iv",
        "code": "HOME_IV_THERAPY",
        "name": "Гэрт дусал тавих (тест)",
        "description": "Эмчийн заалтын дагуу. Туршилтын өгөгдөл, бодит үнэ биш.",
        "category": "HOME_PROCEDURE",
        "priceMnt": 60000,
        "durationMin": 90,
        "requiresReferral": true,
        "redFlagQuestionnaire": "GENERAL_V1",
        "isActive": true,
        "isFixture": true
      }
    ]
  }
}
```

- **Mobile-д хэрэгтэй талбар:** `code`, `name`, `description`, `priceMnt`, `durationMin`, `requiresReferral` (true бол заалтын зураг шаардана), `isFixture` (true бол "тест" гэж харуулах эсэх нь mobile-ийн шийдвэр).
- **Status code:** 200, 400, 401, 503 (`SERVICE_UNAVAILABLE` — DB-д migration хийгдээгүй үед).
- **Шийдвэр шаардсан (D3):** Каталогийн бодит агуулга, үнэ, ангилал. Одоогийн mobile-ийн 6 үйлчилгээ hard-code хийгдсэн, `रू` (Непал рупи) тэмдэгтэй ([bookappointment.tsx:52-58](../App/app/(tabs)/bookappointment.tsx#L52-L58)).

---

## 3. Draft захиалга — ✅ ХЭРЭГЖСЭН (10.13, branch дээр)

> ⚠️ **Архитектурын таамаг (D2 батлагдаагүй):** захиалгыг тусдаа `Order` model-оор хэрэгжүүлсэн. Одоогийн `Visit` урсгал **хөндөгдөөгүй** (`POST /api/visits` хэвээр ажиллана). Төлбөрийн дараа Order-оос Visit үүсгэх хэсэг хэрэгжээгүй. D2 өөр шийдвэр гарвал энэ хэсэг өөрчлөгдөнө.

Код: [orderController.ts](../server/src/controllers/orderController.ts), [services/orders.ts](../server/src/services/orders.ts). Тест: [tests/orders.test.ts](../server/tests/orders.test.ts).

- **Auth:** зөвхөн **CHILD** (`requireRole(['CHILD'])`). Бусад role → 403 `FORBIDDEN`.
- **Эзэмшил:** захиалга нь нэвтэрсэн хэрэглэгчид харьяална. Өөр хэрэглэгчийн захиалга, мөн байхгүй захиалга аль аль нь **404 `ORDER_NOT_FOUND`** (байгаа эсэхийг задлахгүй). Read, PATCH, red flag, quote бүгдэд хамаарна.
- **Хадгалагдаагүй талбар:** server хүлээн авдаггүй талбаруудыг (жишээ нь `bloodGroup`, `phone`, `allergies`, `status`) **хадгалахгүй, хариунд буцаахгүй**. Тэдгээрийн нэрийг `data.ignoredFields`-д жагсаана. Mobile үүнийг "хадгалагдаагүй" гэж ойлгоно.
- `quote` одоогоор үргэлж `null`. Хуурамч үнэ, хуурамч төлбөр буцаахгүй.

### 3.1 `POST /api/orders` — draft үүсгэх

Request:
```json
{
  "parentId": "par_demo_001",
  "items": [{ "serviceCode": "HOME_BASIC_CHECK", "quantity": 1 }],
  "scheduledFor": "2026-10-16T09:00:00+08:00",
  "timeSlot": "09:00-11:00",
  "address": { "text": "Улаанбаатар, Туршилтын дүүрэг, 1-р хороо, 10-р байр", "lat": 47.92, "lng": 106.92 },
  "notes": "Ирэхээсээ өмнө залгана уу",
  "catalogVersion": "2026-10-13T07:54:01.808Z",
  "bloodGroup": "A+"
}
```

Response **201** (бодит хариунаас, ID ба огноо зохиомол):
```json
{
  "success": true,
  "message": "Ноорог үүслээ",
  "data": {
    "order": {
      "id": "ord_demo_001",
      "status": "DRAFT",
      "version": 1,
      "parentId": "par_demo_001",
      "catalogVersion": "2026-10-13T07:54:01.808Z",
      "items": [{ "serviceCode": "HOME_BASIC_CHECK", "name": "Гэрийн ердийн үзлэг (тест)", "quantity": 1, "requiresReferral": false, "isFixture": true }],
      "scheduledFor": "2026-10-16T01:00:00.000Z",
      "timeSlot": "09:00-11:00",
      "address": { "text": "Улаанбаатар, Туршилтын дүүрэг, 1-р хороо, 10-р байр", "lat": 47.92, "lng": 106.92 },
      "notes": "Ирэхээсээ өмнө залгана уу",
      "redFlag": { "status": "NOT_ANSWERED", "required": true, "questionnaires": ["GENERAL_V1"], "answeredAt": null },
      "requirements": { "redFlagAnswers": true, "referralAttachment": false, "referralUploadAvailable": false },
      "quote": null,
      "createdAt": "2026-10-13T07:54:01.912Z",
      "updatedAt": "2026-10-13T07:54:01.912Z"
    },
    "ignoredFields": ["bloodGroup"]
  }
}
```

**Validation (сервер):**

| Талбар | Дүрэм | Алдаа |
|---|---|---|
| `parentId` | Заавал, өөрийн parent | 404 `PARENT_NOT_FOUND` |
| `items` | 1–5 ширхэг, `serviceCode` давхардахгүй | 400 `VALIDATION_ERROR` (`items`) |
| `items[].serviceCode` | `^[A-Z][A-Z0-9_]{1,59}$`, каталогт **идэвхтэй** | 400 (`items.N.serviceCode`) |
| `items[].quantity` | 1–3 бүхэл тоо, default 1 | 400 |
| `scheduledFor` | Заавал биш. ISO-8601 offset-тэй, ирээдүй, ≤ 90 хоног | 400 (`scheduledFor`) |
| `timeSlot` | Заавал биш. `HH:MM-HH:MM`, эхлэх < дуусах. **Цонхны жагсаалт/багтаамжийг шалгахгүй (D13)** | 400 |
| `address.text` | Заавал биш (draft). 5–300 тэмдэгт. `lat`/`lng` хүрээнд | 400 (`address.text`) |
| `notes` | ≤ 500 тэмдэгт | 400 |
| `catalogVersion` | Заавал биш. Илгээвэл одоогийн каталогийн хувилбартай таарах | 409 `CATALOG_OUTDATED` |

- Validation хоёр шаттай: эхлээд хэлбэр, дараа нь каталог. Хэлбэрийн алдаа байвал үйлчилгээний кодыг шалгахгүй.
- Сервер draft-ыг одоогийн `catalogVersion`-оор тэмдэглэнэ (хариунд буцна).
- Кирилл текст UTF8 DB-д бүрэн хадгалагдана (тестээр баталгаажсан). Локал WIN1252 DB дээр хадгалагдахгүй (plan §11).

### 3.2 `GET /api/orders/:id`, `GET /api/orders?status=DRAFT`

`{ order }` (§3.1-тэй ижил хэлбэр) / `{ orders: [...] }`. Жагсаалт нь зөвхөн өөрийн, шинэ нь эхэндээ, ихдээ 20. `status` буруу бол 400.

### 3.3 `PATCH /api/orders/:id` — draft шинэчлэх

```json
{ "version": 1, "timeSlot": "11:00-13:00", "notes": null }
```

- `version` **заавал**. Таарахгүй бол **409 `VERSION_CONFLICT`**. Амжилттай бол `version` +1.
- Засах боломжтой талбар: `items`, `scheduledFor`, `timeSlot`, `address`, `notes`, `catalogVersion`. `null` бол утгыг цэвэрлэнэ (`items`-аас бусад).
- `status`, `redFlagStatus`, `childId`, `parentId` зэргийг **өөрчлөх боломжгүй**. Тэдгээр нь `ignoredFields`-д орно.
- Зөвхөн `DRAFT` төлөвт засна. `BLOCKED_RED_FLAG` → **409 `RED_FLAG_BLOCKED`**, бусад → **409 `ORDER_NOT_EDITABLE`**.
- `items` өөрчлөгдвөл red flag-ийн хариулт **устаж**, `redFlag.status` нь `NOT_ANSWERED` болно. Үйлчилгээ өөрчлөгдвөл асуулга өөр байж болох тул дахин хариулна.

### 3.4 Цуцлах — 🟡 хэрэгжээгүй

`POST /api/orders/:id/cancel` санал хэвээр (D9).

---

## 4. Red flag асуулга — ✅ ХЭРЭГЖСЭН (10.13), асуултууд нь FIXTURE

> ⚠️ **Асуултын бичвэр нь эмнэлзүйн бус placeholder** ("Туршилтын асуулт 1 (эмнэлзүйн бичвэр батлагдаагүй)"), `isFixture: true`. Блоклох үеийн мэдэгдэл мөн placeholder. Жинхэнэ асуулт болон дүрмийг эмнэлгийн мэргэжилтэн батлах ёстой (D4). Сервер зөвхөн **"нэг л 'Тийм' байвал блоклох"** механизмыг хэрэгжүүлсэн. Өөр эмнэлзүйн дүрэм зохиогоогүй.

Код: `getRedFlagQuestions`, `putRedFlagAnswers` ([orderController.ts](../server/src/controllers/orderController.ts)). Fixture: [prisma/fixtures/redFlags.ts](../server/prisma/fixtures/redFlags.ts).

**Хувилбар:** асуулгын код нь хувилбартай (`GENERAL_V1`). Бичвэр өөрчлөгдвөл шинэ код (`GENERAL_V2`) үүснэ. Захиалгын асуулгыг үйлчилгээ бүрийн `redFlagQuestionnaire`-ээс тодорхойлно.

### 4.1 `GET /api/orders/:id/red-flag-questions`

```json
{
  "success": true,
  "message": "Асуулга",
  "data": {
    "orderId": "ord_demo_001",
    "orderStatus": "DRAFT",
    "redFlag": { "status": "NOT_ANSWERED" },
    "questionnaires": ["GENERAL_V1"],
    "containsFixtures": true,
    "questions": [
      { "id": "rfq_demo_1", "questionnaire": "GENERAL_V1", "code": "TEST_Q1", "text": "Туршилтын асуулт 1 (эмнэлзүйн бичвэр батлагдаагүй)", "isFixture": true },
      { "id": "rfq_demo_2", "questionnaire": "GENERAL_V1", "code": "TEST_Q2", "text": "Туршилтын асуулт 2 (эмнэлзүйн бичвэр батлагдаагүй)", "isFixture": true },
      { "id": "rfq_demo_3", "questionnaire": "GENERAL_V1", "code": "TEST_Q3", "text": "Туршилтын асуулт 3 (эмнэлзүйн бичвэр батлагдаагүй)", "isFixture": true }
    ]
  }
}
```

Асуулга DB-д байхгүй (seed/migration хийгдээгүй) бол **503 `QUESTIONNAIRE_UNAVAILABLE`**.

### 4.2 `PUT /api/orders/:id/red-flag-answers` — бүх хариултыг солих

```json
{
  "questionnaires": ["GENERAL_V1"],
  "answers": [
    { "questionId": "rfq_demo_1", "value": false },
    { "questionId": "rfq_demo_2", "value": false },
    { "questionId": "rfq_demo_3", "value": false }
  ]
}
```

| Тохиолдол | Хариу |
|---|---|
| Бүгд `false` | **200**, `{ "redFlag": { "status": "CLEAR", "answeredAt": "…" }, "orderStatus": "DRAFT", "version": 3 }` |
| Нэг нь ч гэсэн `true` | **200**, `redFlag.status: "FLAGGED"`, `orderStatus: "BLOCKED_RED_FLAG"`, `advice: { text: "Туршилтын мэдэгдэл: …", isFixture: true }` |
| Асуулт дутуу | **400 `RED_FLAG_INCOMPLETE`**, `error.fields`: `{ "<questionId>": "Хариулаагүй" }` |
| `value` нь boolean биш (`"false"` гэх мэт), өөр захиалгын асуулт, давхардсан | **400 `VALIDATION_ERROR`** |
| `questionnaires` нь серверийнхтэй таарахгүй (хуучин асуулга) | **409 `QUESTIONNAIRE_OUTDATED`** |
| Захиалга аль хэдийн `BLOCKED_RED_FLAG` | **409 `RED_FLAG_BLOCKED`**. Хариултыг "Үгүй" болгож блокийг арилгах боломжгүй |
| Захиалга `DRAFT` биш | **409 `ORDER_NOT_EDITABLE`** |

**Хамгаалалт (тестээр баталгаажсан):**
- Төлөвийг зөвхөн сервер хариултаас тооцоолно. Клиент `status`/`redFlagStatus` илгээх боломжгүй (§3.3).
- Блоклогдсон захиалгыг хариулт солих, PATCH, үйлчилгээ солих, quote руу шууд үсрэх зэргээр **тойрох боломжгүй**.
- Quote болон цаашдын төлбөр, submit алхам бүр `assertOrderReadyForPricing` guard-ыг **дахин** ажиллуулна ([services/orders.ts](../server/src/services/orders.ts)).
- Audit (`OrderEvent`) нь зөвхөн `RED_FLAG_CLEAR`/`RED_FLAG_FLAGGED` үр дүнг хадгална. **Аль асуултад "Тийм" гэснийг log, event, analytics-д бичихгүй.** Хариултууд зөвхөн `RedFlagAnswer` хүснэгтэд байна.

---

## 5. Заалтын зураг (private upload) — 🟡 ГЭРЭЭ ЭЦЭСЛЭСЭН (санал), ХЭРЭГЖЭЭГҮЙ

> Storage эрх байхгүй тул **ажилладаг production upload байхгүй**. Одоо `requirements.referralUploadAvailable: false` буцна. `requiresReferral` үйлчилгээтэй захиалга quote алхамд **422 `REFERRAL_REQUIRED`** авна.

### 5.1 `POST /api/orders/:id/attachments` (multipart/form-data)

| Зүйл | Гэрээ |
|---|---|
| Auth / эзэмшил | CHILD, **өөрийн** захиалга (бусад → 404 `ORDER_NOT_FOUND`) |
| Төлөв | Зөвхөн `DRAFT` (`BLOCKED_RED_FLAG` → 409 `RED_FLAG_BLOCKED`, бусад → 409 `ORDER_NOT_EDITABLE`) |
| Талбар | `file` (заавал, 1 файл), `kind` = `REFERRAL` |
| Төрөл | **Зөвхөн `image/jpeg`, `image/png`.** Header биш, файлын эхний байтаар (magic bytes) шалгана. HEIC-ийг mobile JPEG болгоно. **PDF хүлээж авахгүй (D12)** |
| Хэмжээ | Нэг файл **≤ 10 MB** (`express-fileupload` хязгаар 10 MB аль хэдийн тохируулагдсан) |
| Тоо | Нэг захиалгад **≤ 5** идэвхтэй файл |
| Хадгалалт | Private bucket, `storageKey = orders/<orderId>/<uuid>.<ext>`. Анхны нэрийг зөвхөн metadata-д. EXIF/GPS-ийг серверт арилгах (санал). **`/uploads` нийтийн static замд хэзээ ч хадгалахгүй** |
| Холбоос | `Attachment.orderId`. Захиалгын `requirements.referralAttachment` хангагдсан эсэхийг сервер тооцно |

Response **201**: `{ attachment: { id, kind, mimeType, sizeBytes, createdAt } }` (URL буцаахгүй).

| Алдаа | HTTP / code |
|---|---|
| Файл байхгүй, `kind` буруу | 400 `VALIDATION_ERROR` |
| JPEG/PNG биш, PDF | 415 `UNSUPPORTED_MEDIA_TYPE` |
| 10 MB-аас их | 413 `FILE_TOO_LARGE` |
| 5-аас олон | 409 `ATTACHMENT_LIMIT` |
| Storage тохируулаагүй | 503 `STORAGE_UNAVAILABLE` (хуурамч амжилт буцаахгүй) |

### 5.2 `GET /api/orders/:id/attachments/:attachmentId/url`

Эзэмшигчид ≤ 5 минутын signed URL: `{ url, expiresAt }`. Mobile URL-ыг хадгалахгүй.

### 5.3 `DELETE /api/orders/:id/attachments/:attachmentId`

`DRAFT` төлөвт soft delete хийнэ, **204** буцна.

### 5.4 Storage adapter (хэрэгжүүлэх төлөвлөгөө)

| Adapter | Хэзээ | Тэмдэглэл |
|---|---|---|
| `s3` (S3-compatible private bucket) | staging/production | Эрх байхгүй (D6) |
| `local-dev` | Зөвхөн `NODE_ENV=development`, `STORAGE_DRIVER=local-dev` | `server/.local-uploads/` (gitignore). Production-д ажиллуулахаас **татгалзана**. Хариунд `storage: "local-dev"` гэж ил тэмдэглэнэ |
| `memory` | Зөвхөн тест | Тусгаарласан тестэд |

---

## 6. Серверийн үнийн quote — 🟡 GUARD ХЭРЭГЖСЭН, ҮНЭ ХЭРЭГЖЭЭГҮЙ

### `POST /api/orders/:id/quote`

Одоо хийгддэг зүйл:
1. Эзэмшил (404 `ORDER_NOT_FOUND`).
2. `assertOrderReadyForPricing`: блоклогдсон → **422 `RED_FLAG_BLOCKED`**. `DRAFT` биш → 409 `ORDER_NOT_EDITABLE`. Red flag хариулаагүй/`CLEAR` биш → **422 `RED_FLAG_REQUIRED`**. Огноо/хаяг дутуу, өнгөрсөн огноо, идэвхгүй үйлчилгээ → **422 `ORDER_INCOMPLETE`** (`error.fields`). Заалт шаардлагатай → **422 `REFERRAL_REQUIRED`**.
3. Бүх guard давсан бол → **501 `NOT_IMPLEMENTED`** ("Серверийн үнийн санал (quote) хараахан хэрэгжээгүй байна"). **Хуурамч үнэ буцаахгүй.**

Санал хэвээр (хэрэгжээгүй): амжилттай үед `{ quote: { id, currency: "MNT", lines[], subtotalMnt, travelFeeMnt, discountMnt, totalMnt, pricingVersion, expiresAt } }`. Үнийг зөвхөн сервер каталогоос тооцно, body-д үнийн талбар хүлээж авахгүй. Хүчинтэй хугацаа 15 мин (санал). Шийдвэр: унааны зардал, промо, НӨАТ/и-баримт (D3).

---

## 7. QPay төлбөр — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

> Backend нь QPay merchant API-тай **серверээс сервер** рүү холбогдоно. Credential зөвхөн backend env-д байна. Бодит гүйлгээг **sandbox баталгаажсаны дараа л** идэвхжүүлнэ.

### 7.1 `POST /api/orders/:id/payments/qpay` — invoice үүсгэх

- **Auth:** Захиалгын эзэн.
- **Header:** `Idempotency-Key: <uuid>` заавал. Ижил key-ээр давтан дуудвал ижил invoice буцна.
- **Body:** `{ "quoteId": "quo_demo_001" }`. Дүнг сервер quote-оос авна.
- Амжилттай бол захиалга `AWAITING_PAYMENT` төлөвт шилжиж, draft түгжигдэнэ.

Response 201:
```json
{ "success": true, "message": "Нэхэмжлэх үүслээ",
  "data": { "payment": {
    "id": "pay_demo_001",
    "provider": "QPAY",
    "status": "PENDING",
    "amountMnt": 45500,
    "qrText": "DEMO_QR_TEXT_NOT_REAL",
    "qrImageBase64": "iVBORw0KGgo…(зохиомол)",
    "deeplinks": [
      { "name": "Khan bank", "logo": "https://…", "link": "khanbank://q?qPay_QRcode=DEMO" }
    ],
    "expiresAt": "2026-10-11T03:30:00.000Z"
  } } }
```

- **Status code:** 201, 200 (idempotent давталт), 409 (`QUOTE_EXPIRED`, буруу төлөв), 422, 502 (`PAYMENT_PROVIDER_ERROR`).

### 7.2 `GET /api/orders/:id/payments/:paymentId` — төлөв шалгах

- Сервер өөрийн DB-гээ шалгана. `PENDING` бол QPay `payment/check`-ээр баталгаажуулна (rate limit-тэй).
- **Mobile polling:** 3–5 сек тутам, дээд тал нь `expiresAt` хүртэл. Мөн app foreground-д буцаж ирэхэд дахин шалгана.

```json
{ "success": true, "message": "Төлбөрийн төлөв",
  "data": { "payment": { "id": "pay_demo_001", "status": "PAID", "amountMnt": 45500, "paidAt": "2026-10-11T03:12:00.000Z" },
            "orderStatus": "PAID" } }
```

`payment.status`: `PENDING` / `PAID` / `FAILED` / `EXPIRED` / `CANCELLED`.

### 7.3 `POST /api/payments/qpay/callback` — QPay → backend (**mobile дуудахгүй**)

- Нууц token-той URL ашиглана. Callback-ийн агуулгад **итгэхгүй**: сервер QPay `payment/check`-ээр заавал дахин баталгаажуулна.
- Idempotent: давтан callback ирэхэд давхар `PAID` үүсгэхгүй.
- Дүн quote-той таарахгүй бол `PAID` болгохгүй, alert үүсгэнэ.

**Шийдвэр шаардсан:** QPay merchant эрх (sandbox/prod), `invoice_code`, буцаан олголтын бодлого, и-баримт.

---

## 8. Захиалгын дэлгэрэнгүй ба status — 🟡 ХЭСЭГЧЛЭН (10.13)

> 10.13: `GET /api/orders/:id` ба `GET /api/orders` нь **draft хэлбэрээр** хэрэгжсэн (§3.2). Доорх `payment`, `assignment`, `tracking`, `timeline`, `statusLabel` талбарууд **санал хэвээр, хэрэгжээгүй**. Төлбөр ба Visit холболт хийгдсэний дараа нэмэгдэнэ.

### 8.1 `GET /api/orders/:id`

```json
{ "success": true, "message": "Захиалга",
  "data": { "order": {
    "id": "ord_demo_001",
    "status": "ASSIGNED",
    "statusLabel": "Сувилагч томилогдсон",
    "parent": { "id": "par_demo_001", "name": "Туршилтын Эх" },
    "items": [{ "serviceId": "svc_demo_basic", "name": "Гэрийн ердийн үзлэг", "quantity": 1 }],
    "scheduledFor": "2026-10-20T01:00:00.000Z",
    "timeSlot": "09:00-11:00",
    "address": { "text": "Улаанбаатар, Туршилтын дүүрэг, 1-р хороо, 10-р байр" },
    "quote": { "id": "quo_demo_001", "totalMnt": 45500 },
    "payment": { "id": "pay_demo_001", "status": "PAID", "paidAt": "2026-10-11T03:12:00.000Z" },
    "assignment": { "nurseName": "Туршилтын Сувилагч", "assignedAt": "2026-10-11T05:00:00.000Z" },
    "tracking": { "visitId": "vis_demo_001", "etaMinutes": null },
    "timeline": [
      { "type": "CREATED", "at": "2026-10-11T03:00:00.000Z" },
      { "type": "RED_FLAG_CLEAR", "at": "2026-10-11T03:05:00.000Z" },
      { "type": "QUOTED", "at": "2026-10-11T03:07:00.000Z" },
      { "type": "PAYMENT_PAID", "at": "2026-10-11T03:12:00.000Z" },
      { "type": "NURSE_ASSIGNED", "at": "2026-10-11T05:00:00.000Z" }
    ],
    "version": 4
  } } }
```

- **Нууцлал:** Сувилагчийн утас, имэйл, бусад хувийн мэдээллийг **буцаахгүй** (нэр л харагдана). `etaMinutes`, бодит цагийн байршил нь L1-1-ийн хүрээнд **хэрэгжихгүй** (null).

### 8.2 `GET /api/orders?status=ACTIVE&limit=20&cursor=…`

Миний захиалгын жагсаалт. `ACTIVE` = `PAID`, `ASSIGNED`, `IN_PROGRESS`. Response: `{ orders: [...товч], nextCursor }`.

- **Status code:** 200, 401, 403, 404.

---

## 11. Сул цагийн цонх — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

**Одоогийн байдал:** Mobile 5 цонхыг hard-code хийсэн ([bookappointment.tsx:61](../App/app/(tabs)/bookappointment.tsx#L61)) бөгөөд сонгосон цонхны **эхлэх цагийг** `scheduledFor` болгодог ([bookappointment.tsx:174-190](../App/app/(tabs)/bookappointment.tsx#L174-L190)). Сервер 10.12-оос зөвхөн "ирээдүйн огноо" эсэхийг шалгадаг. Цонх, багтаамж, ажлын цагийн шалгалт байхгүй.
⚠️ Mobile `new Date("YYYY-MM-DD")` + `setHours` нь утасны цагийн бүсээс хамаардаг. Улаанбаатарын (UTC+8) бус бүсэд өдөр шилжиж болзошгүй. Санал: mobile `+08:00` offset-тэй ISO илгээх.

### `GET /api/availability/slots?date=2026-10-20&serviceCodes=HOME_BASIC_CHECK`

```json
{ "success": true, "message": "Сул цаг",
  "data": { "date": "2026-10-20", "timezone": "Asia/Ulaanbaatar",
    "slots": [
      { "id": "2026-10-20T09:00+08:00", "label": "09:00-11:00", "start": "2026-10-20T09:00:00+08:00", "end": "2026-10-20T11:00:00+08:00", "available": true },
      { "id": "2026-10-20T11:00+08:00", "label": "11:00-13:00", "start": "2026-10-20T11:00:00+08:00", "end": "2026-10-20T13:00:00+08:00", "available": false }
    ] } }
```

- **Серверийн validation (санал):** Draft/order дээр `scheduledFor` нь буцаасан `slot.start`-тай яг таарах, `available: true`, өнөөдрөөс хамгийн багадаа N цагийн дараа, 90 хоногоос ихгүй байх. Таарахгүй бол **422 `SLOT_UNAVAILABLE`**. Төлбөр хийх үед дахин шалгана.
- `date` нь `YYYY-MM-DD`, буруу бол 400.
- **Шийдвэр (D13):** ажлын цаг, цонхны урт, нэг цонхонд хэдэн үзлэг (багтаамж), амралтын өдөр, бүс/хаягаас хамаарах эсэх.

---

## 12. Үйлчилгээний нөхцөл / зөвшөөрөл (consent) — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

**Одоогийн байдал:** Mobile бүртгэл "Үйлчилгээний нөхцөл болон Нууцлалын бодлогыг зөвшөөрч байна" гэсэн текстийг зөвхөн харуулдаг ([register.tsx:176-180](../App/app/auth/register.tsx#L176-L180)). Checkbox, илгээх талбар, серверт хадгалах model байхгүй. Эрүүл мэндийн мэдээлэл боловсруулах тул зөвшөөрлийг **хувилбар, цагтай нь** бүртгэх шаардлагатай.

**Санал:** `POST /api/auth/signup`-д нэмэлт талбар (одоогийн хүсэлтүүдийг эвдэхгүйн тулд эхэндээ заавал биш, батлагдсаны дараа заавал болно):
```json
{ "consents": [
  { "type": "TERMS", "version": "2026-10-v1" },
  { "type": "PRIVACY", "version": "2026-10-v1" },
  { "type": "HEALTH_DATA", "version": "2026-10-v1" }
] }
```
- Сервер `UserConsent { userId, type, version, acceptedAt, ip?, userAgent? }` хадгална. Хувилбар шинэчлэгдвэл `GET /api/consents/required` болон `POST /api/consents`-оор дахин зөвшөөрөл авна.
- Захиалга үүсгэхэд `HEALTH_DATA` зөвшөөрөлгүй бол **403 `CONSENT_REQUIRED`** (санал).
- **Шийдвэр (D10):** нөхцөл/нууцлалын бичвэр ба хувилбар, заавал авах зөвшөөрлийн төрөл, хуучин хэрэглэгчдээс дахин авах эсэх.

---

## 13. Өвчтөний (Parent) талбарууд — зөрүү ба санал

| Талбар | Mobile цуглуулдаг уу | Серверт илгээдэг үү ([add-parent.tsx:69-79](../App/app/(tabs)/add-parent.tsx#L69-L79)) | Schema-д байгаа юу | Санал |
|---|---|---|---|---|
| Нэр, нас, хүйс, хаяг | Тийм | Тийм | Тийм | Хэвээр |
| Өвчний түүх → `diseases` | Тийм | Тийм (хоосон бол `"None"`) | Тийм | Хэвээр |
| Эм → `medications` | Тийм | Тийм (хоосон бол `"None"`) | Тийм | Хэвээр |
| Утас (өвчтөний) | Тийм, **заавал** | **Үгүй**. Яаралтай дугааргүй үед л `emergencyContact` болж явдаг | **Үгүй** | `phone String?` нэмэх. Шийдвэр: заавал эсэх |
| Яаралтай үед холбогдох хүний нэр | Тийм | **Үгүй** | **Үгүй** | `emergencyContactName String?` |
| Яаралтай үеийн утас | Тийм | Тийм (`emergencyContact`) | Тийм | 10.12: доод урт 10-аас **8** болсон (Монгол дугаар 8 оронтой). Өмнө 8 оронтой дугаар татгалзагддаг байсан |
| Таны хэн болох (Ээж/Аав/Өөрөө) | Тийм | **Үгүй** | **Үгүй** | `relation String?` |
| Цусны бүлэг | Тийм (default `A+`) | **Үгүй** | **Үгүй** | `bloodGroup String?`: `A+…O-` эсвэл `UNKNOWN`. **Default `A+` нь буруу өгөгдөл үүсгэх эрсдэлтэй**, mobile-ийн default-ыг "Мэдэхгүй" болгох нь зүйтэй |
| Харшил | Тийм | **Үгүй** | **Үгүй** | `allergies String?`. Сувилагчид чухал (эм, тариа) |

- **Одоо mobile-ийн бөглөсөн утас, цусны бүлэг, харшил хадгалагддаггүй.** Хэрэглэгч оруулсан гэж бодох боловч алга болдог.
- Бүх шинэ талбар nullable байх тул migration нэмэлт, буцааж болохуйц.
- Эдгээр нь эрүүл мэндийн эмзэг мэдээлэл тул log хийхгүй, зөвхөн тухайн хүүхэд, томилогдсон сувилагч, эмнэлгийн админд харагдана.
- **Шийдвэр (D11):** аль талбар заавал, цусны бүлгийн утгын жагсаалт, `"None"` placeholder-ийг `null` болгох эсэх.

---

## 14. Staging хуваарь (10.16-аас өмнө)

| Огноо | Зорилт | Нөхцөл / блок |
|---|---|---|
| **10.13** | Mobile ашиглах **эхний HTTPS API** (auth, parents, visits, catalog, orders, red flag), зөвхөн зохиомол өгөгдөл | ❌ **Хийгдээгүй.** 10.13-ны байдлаар hosting, managed PostgreSQL, домэйн/TLS, storage эрх ирээгүй. Эрх ирсэн өдөртөө боломжтой (Dockerfile, migration бэлэн). Шинэ хамгийн эрт огноо: эрх ирсэн өдөр |
| 10.14 | Staging-д migration-ийн урсгал (`migrate deploy`), seed (fixture), log/health шалгалт | 10.13 амжилттай болсон бол |
| 10.15 | QPay **sandbox** callback URL (HTTPS) тохиргоо, private storage bucket | QPay sandbox эрх, storage эрх |
| 10.16 | Staging-д бүрэн L1-1 урсгалын smoke test (mobile-тай) | Дээрх бүгд |

Эрх ирэхээс өмнө mobile **локал API** (`http://<PC-LAN-IP>:8000/api`) болон энэ баримтын mock-уудыг ашиглана. Staging URL гарсан үед энэ хэсэгт нэмнэ. **Одоогоор staging deploy хийгдээгүй.**

---

## 9. Шийдвэр шаардсан асуудлууд

| # | Асуудал | Нөлөө |
|---|---|---|
| D1 | **Технологийн зөрүү:** гэрээнд Flutter/NestJS заасан бол одоогийн код React Native (Expo) + Express. Бид шилжүүлэхгүй, гэхдээ гэрээтэй зөрж байгааг баталгаажуулах шаардлагатай | Бүх ажлын хүрээ |
| D2 | Order-ыг шинэ model болгох уу, эсвэл одоогийн `Visit`-ийг өргөтгөх үү. **10.13: тусдаа `Order` model-оор таамаглан хэрэгжүүлсэн** (нэмэлт, буцааж болох). Батлах эсвэл өөрчлөх шийдвэр хэрэгтэй | §3, migration |
| D3 | Каталог, үнэ, унааны зардал, промо, валют (MNT) | §2, §6 |
| D4 | Red flag асуултын агуулга ба эмнэлгийн баталгаажуулалт, яаралтай дугаар | §4 |
| D5 | QPay merchant эрх, sandbox credential, `invoice_code`, буцаан олголт, и-баримт | §7 |
| D6 | Private storage сонголт (S3-compatible гэх мэт) ба хадгалах хугацаа | §5 |
| D7 | ~~Хуучин endpoint-уудын алдааг HTTP 200-аас зөв code руу шилжүүлэх эсэх~~. 10.12-ны даалгаврын дагуу **хэрэгжсэн** (§0.1.1). Main-д нэгтгэхээс өмнө mobile/wclient-тэй тохиролцох | §0.1 |
| D8 | Нэвтрээгүй хэрэглэгчид каталог харуулах эсэх | §2 |
| D9 | `PAID`-аас хойш цуцлах ба буцаан олголт | §3.3 |
| D10 | Нөхцөл/зөвшөөрлийн бичвэр, хувилбар, заавал авах төрлүүд | §12 |
| D11 | Өвчтөний утас, цусны бүлэг, харшил, холбогдох хүн: заавал эсэх, утгын жагсаалт | §13 |
| D12 | Заалтын **PDF** дэмжих эсэх (одоогоор зөвхөн JPEG/PNG) | §5 |
| D13 | Цагийн цонх, багтаамж, ажлын цаг | §11 |
| D14 | Staging hosting/DB/домэйн/storage сонголт ба эрх | §14 |
| D15 | ~~Login `data.user` объект болсон тул wclient засвар~~. **10.13-нд энэ branch дээр зассан, тестэлсэн** | §1.2 |
| D16 | Draft захиалгад `nurseGenderPreference`, төлбөрийн хэрэгсэл, промо код хадгалах эсэх (одоо `ignoredFields`) | §3 |

---

## 10. Mobile хөгжүүлэгчид — mock хийх заавар

1. Дээрх JSON жишээнүүдийг mock fixture болгон ашигла. Бүгд зохиомол өгөгдөл.
2. Төлөвийн урсгалыг §0.2-оор хэрэгжүүл. `status` нь тэнд байхгүй утга ирвэл "Тодорхойгүй" гэж харуул.
3. Үнийг mobile дээр **тооцоолж харуулахгүй**. Зөвхөн `quote.totalMnt`-ийг харуулна.
4. Төлбөрийн дараа `GET /api/orders/:id/payments/:paymentId`-ээр polling хий. Deeplink-ээс буцаж ирэхэд дахин шалга.
5. Алдааг `response.data.message`-ээр харуулж, логикоо `response.data.error.code` дээр тулгуурла. **10.12-оос** одоо байгаа endpoint-ууд ч энэ хэлбэрээр 4xx буцаана (§0.1.1). Axios 4xx-ийг `catch`-д шиддэг тул `error.response.data.message` ажилласаар байна.
   - Login: `data.user` нь объект `{id,name,email,role,createdAt}` болсон. Буруу нэвтрэлт **401 `INVALID_CREDENTIALS`**.
   - Signup: `role` илгээхгүй эсвэл `"CHILD"` илгээнэ. Хариунд `data.token` ирдэг болсон.
   - Каталог (§2) **бодит endpoint-оор** ажиллана, гэхдээ өгөгдөл нь зохиомол (`isFixture: true`).
6. Token, хувийн/эрүүл мэндийн мэдээллийг `console.log`-д бүү хэвлэ. Red flag-ийн хариултыг analytics/log-д бүү илгээ.
7. **10.13: Захиалгын урсгал (бодит endpoint):** `GET /api/catalog/services` → `POST /api/orders` (`serviceCode`, `catalogVersion`, `+08:00` огноо) → `GET /api/orders/:id/red-flag-questions` → `PUT …/red-flag-answers` (`questionnaires` + **бүх** асуултын boolean хариулт) → `POST …/quote`.
   - Quote одоогоор **501 `NOT_IMPLEMENTED`** буцаана. Үүнийг амжилт гэж харуулахгүй, "Үнийн санал удахгүй" гэж харуулна.
   - `orderStatus: BLOCKED_RED_FLAG` болвол урсгалыг зогсоож `advice.text`-ийг харуулна (placeholder). Дахин хариулах, засах товчийг идэвхгүй болгоно.
   - `ignoredFields`-д орсон талбарыг (цусны бүлэг, харшил, утас) "хадгалагдсан" гэж бүү харуул.
   - `requirements.referralUploadAvailable: false` үед заалт шаардах үйлчилгээг сонгох боломжгүй, эсвэл "удахгүй" гэж харуулна.
   - `409 VERSION_CONFLICT` → захиалгыг дахин ачаална. `409 CATALOG_OUTDATED` → каталогийг дахин ачаална. `409 QUESTIONNAIRE_OUTDATED` → асуултыг дахин ачаална.
   - `401 TOKEN_EXPIRED` → "Нэвтрэх хугацаа дууссан". `403 FORBIDDEN` дээр session-ийг бүү устга.
