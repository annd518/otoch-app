# OTOCH L1-1 — API гэрээний САНАЛ (mobile ↔ backend)

> **Статус: САНАЛ. Батлагдаагүй.** 2026-10-11, backend (`work/backend-l1-1`).
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

> ⚠️ **Одоогийн кодын зөрүү:** Одоо байгаа олон endpoint алдааг **HTTP 200**-аар буцаадаг. Жишээ нь [authController.ts:120-134](../server/src/controllers/authController.ts#L120-L134) болон [visitController.ts:56-61](../server/src/controllers/visitController.ts#L56-L61). Шинэ endpoint-ууд дээрх хүснэгтийн зөв status code-ыг ашиглана. Хуучныг өөрчлөх эсэх нь шийдвэр шаардана (§9).

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

Бүгд `server/src/index.ts:62-68` дээр mount хийгдсэн.

| Method | Path | Auth/role | Файл:мөр | Тэмдэглэл |
|---|---|---|---|---|
| POST | `/api/auth/signup` | Нээлттэй | [auth.routes.ts:27](../server/src/routes/auth.routes.ts#L27) | ⚠️ `role`-д `ADMIN` зөвшөөрнө ([authController.ts:25](../server/src/controllers/authController.ts#L25)). Token буцаадаггүй |
| POST | `/api/auth/login` | Нээлттэй | [auth.routes.ts:48](../server/src/routes/auth.routes.ts#L48) | `data.token`, `data.user` (= мөн JWT string, [authController.ts:164](../server/src/controllers/authController.ts#L164)) |
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

---

## 2. Каталог авах — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

### `GET /api/catalog/services`

- **Auth:** Нэвтэрсэн хэрэглэгч (CHILD). *Шийдвэр:* нэвтрээгүй хэрэглэгчид үнэтэй каталог харуулах эсэх.
- **Query:** `?category=HOME_VISIT` (заавал биш)
- **Үнэ:** `priceMnt` нь **зөвхөн харуулах зориулалттай**. Эцсийн үнийг §6 quote тогтооно.

```json
{
  "success": true,
  "message": "Каталог",
  "data": {
    "catalogVersion": "2026-10-11.1",
    "currency": "MNT",
    "services": [
      {
        "id": "svc_demo_basic",
        "code": "HOME_BASIC_CHECK",
        "name": "Гэрийн ердийн үзлэг",
        "description": "Даралт, сахар, судасны цохилт, хүчилтөрөгч хэмжих",
        "category": "HOME_VISIT",
        "priceMnt": 45000,
        "durationMin": 45,
        "requiresReferral": false,
        "redFlagQuestionnaire": "GENERAL_V1",
        "isActive": true
      },
      {
        "id": "svc_demo_iv",
        "code": "HOME_IV_THERAPY",
        "name": "Гэрт дусал тавих",
        "description": "Эмчийн заалтын дагуу",
        "category": "HOME_VISIT",
        "priceMnt": 60000,
        "durationMin": 90,
        "requiresReferral": true,
        "redFlagQuestionnaire": "GENERAL_V1",
        "isActive": true
      }
    ]
  }
}
```

- **Mobile-д хэрэгтэй талбар:** `id`, `name`, `description`, `priceMnt`, `durationMin`, `requiresReferral` (true бол заалтын зураг шаардана), `isActive`.
- **Status code:** 200, 401.
- **Шийдвэр шаардсан:** Каталогийн бодит агуулга, үнэ, ангилал. Одоогийн mobile-ийн 6 үйлчилгээ hard-code хийгдсэн, `रू` (Непал рупи) тэмдэгтэй ([bookappointment.tsx:52-58](../App/app/(tabs)/bookappointment.tsx#L52-L58)).

---

## 3. Draft захиалга — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

### 3.1 `POST /api/orders` — draft үүсгэх

- **Auth:** CHILD (ADMIN туршилтад). Захиалга нь нэвтэрсэн хэрэглэгчид харьяална.

Request:
```json
{
  "parentId": "par_demo_001",
  "items": [{ "serviceId": "svc_demo_basic", "quantity": 1 }],
  "scheduledFor": "2026-10-20T09:00:00+08:00",
  "timeSlot": "09:00-11:00",
  "address": {
    "text": "Улаанбаатар, Туршилтын дүүрэг, 1-р хороо, 10-р байр",
    "lat": 47.9,
    "lng": 106.9
  },
  "notes": "Ирэхээсээ 10 минутын өмнө залгана уу",
  "nurseGenderPreference": "ANY"
}
```

Response `201`:
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
      "items": [{ "serviceId": "svc_demo_basic", "quantity": 1, "name": "Гэрийн ердийн үзлэг" }],
      "scheduledFor": "2026-10-20T01:00:00.000Z",
      "timeSlot": "09:00-11:00",
      "address": { "text": "Улаанбаатар, Туршилтын дүүрэг, 1-р хороо, 10-р байр", "lat": 47.9, "lng": 106.9 },
      "notes": "Ирэхээсээ 10 минутын өмнө залгана уу",
      "nurseGenderPreference": "ANY",
      "redFlag": { "status": "NOT_ANSWERED" },
      "attachments": [],
      "quote": null,
      "requirements": { "redFlagAnswers": true, "referralAttachment": false },
      "createdAt": "2026-10-11T03:00:00.000Z",
      "updatedAt": "2026-10-11T03:00:00.000Z"
    }
  }
}
```

**Validation:**

| Талбар | Дүрэм |
|---|---|
| `parentId` | Заавал. Нэвтэрсэн хэрэглэгчийн parent байх ёстой, үгүй бол 403 |
| `items` | 1-ээс 5 ширхэг. `serviceId` идэвхтэй байх. `quantity` 1–3 |
| `scheduledFor` | Заавал биш (draft). Илгээвэл ирээдүй, 90 хоногоос ихгүй |
| `timeSlot` | `HH:MM-HH:MM` хэлбэр, серверийн зөвшөөрсөн цонхнуудаас |
| `address.text` | Quote авахаас өмнө заавал, 5–300 тэмдэгт |
| `notes` | ≤ 500 тэмдэгт |
| `nurseGenderPreference` | `ANY` / `FEMALE` / `MALE` |

**Status code:** 201, 400, 401, 403.

### 3.2 `PATCH /api/orders/:id` — draft шинэчлэх

- **Auth:** Захиалгын эзэн.
- Зөвхөн `DRAFT` төлөвт засна. Бусад төлөвт **409 `ORDER_NOT_EDITABLE`**.
- `version` заавал илгээнэ. Хуучин бол **409 `VERSION_CONFLICT`**. Ингэснээр давхар засвараас хамгаална.
- `items`, `scheduledFor` эсвэл `address` өөрчлөгдвөл өмнөх quote **хүчингүй** болно (`quote: null`).

```json
{ "version": 1, "scheduledFor": "2026-10-21T13:00:00+08:00", "timeSlot": "13:00-15:00" }
```

Response 200: §3.1-ийн `order` хэлбэр, `version: 2`.

### 3.3 `POST /api/orders/:id/cancel` — цуцлах

- `DRAFT`, `AWAITING_PAYMENT` төлөвт зөвшөөрнө. `PAID`-аас хойш цуцлах, буцаан олголт нь **шийдвэр шаардана** (§9).

---

## 4. Red flag асуулга — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

> Асуултын агуулгыг **эмнэлгийн мэргэжилтэн батлах** ёстой. Доорх асуултууд зөвхөн бүтцийн жишээ.

### 4.1 `GET /api/orders/:id/red-flag-questions`

```json
{
  "success": true,
  "message": "Асуулга",
  "data": {
    "questionnaire": "GENERAL_V1",
    "questions": [
      { "id": "rfq_demo_1", "code": "CHEST_PAIN", "text": "Одоо цээжээр өвдөж байна уу?", "type": "BOOLEAN", "required": true },
      { "id": "rfq_demo_2", "code": "BREATHING", "text": "Амьсгал давчдаж байна уу?", "type": "BOOLEAN", "required": true },
      { "id": "rfq_demo_3", "code": "CONSCIOUSNESS", "text": "Ухаан балартах шинж байна уу?", "type": "BOOLEAN", "required": true }
    ]
  }
}
```

### 4.2 `PUT /api/orders/:id/red-flag-answers`

- Зөвхөн `DRAFT` төлөвт. Бүх `required` асуултад хариулна. Дахин илгээвэл өмнөх хариулт солигдож, түүх `OrderEvent`-д үлдэнэ.

```json
{ "answers": [
  { "questionId": "rfq_demo_1", "value": false },
  { "questionId": "rfq_demo_2", "value": false },
  { "questionId": "rfq_demo_3", "value": false }
] }
```

Response 200 (аюулгүй):
```json
{ "success": true, "message": "Хариулт хадгалагдлаа",
  "data": { "redFlag": { "status": "CLEAR", "answeredAt": "2026-10-11T03:05:00.000Z" }, "orderStatus": "DRAFT" } }
```

Response 200 (аюул илэрсэн). Захиалга `BLOCKED_RED_FLAG` төлөвт шилжинэ:
```json
{ "success": true, "message": "Яаралтай тусламж шаардлагатай байж болзошгүй",
  "data": {
    "redFlag": { "status": "FLAGGED", "triggeredCodes": ["CHEST_PAIN"] },
    "orderStatus": "BLOCKED_RED_FLAG",
    "advice": { "text": "Яаралтай тусламжийн 103 дугаарт залгана уу.", "phone": "103" }
  } }
```

- **Status code:** 200, 400 (дутуу хариулт), 409 (draft биш), 403.
- **Шийдвэр шаардсан:** Асуултын агуулга, `FLAGGED` үед захиалгыг бүрэн хаах эсэх, яаралтай дугаар, `BLOCKED_RED_FLAG`-аас буцаах боломж.

---

## 5. Заалтын зураг (attachment) — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

### 5.1 `POST /api/orders/:id/attachments`

- **Auth:** Захиалгын эзэн. Зөвхөн `DRAFT` төлөвт.
- **Content-Type:** `multipart/form-data`. Талбарууд: `file` (заавал), `kind=REFERRAL`.
- **Хязгаар (санал):** `image/jpeg`, `image/png`, `image/heic`, `application/pdf`. Нэг файл ≤ 10 MB, нэг захиалгад ≤ 5 файл.
- **Хадгалалт:** **Private storage.** Нийтэд нээлттэй `/uploads/...` static зам ([index.ts:42-43](../server/src/index.ts#L42-L43)) **ашиглахгүй**.

Response 201:
```json
{ "success": true, "message": "Файл хадгалагдлаа",
  "data": { "attachment": {
    "id": "att_demo_001", "kind": "REFERRAL", "mimeType": "image/jpeg",
    "sizeBytes": 524288, "originalName": "zaalt.jpg", "createdAt": "2026-10-11T03:06:00.000Z"
  } } }
```

### 5.2 `GET /api/orders/:id/attachments/:attachmentId/url`

Богино хугацааны (жишээ нь 5 мин) signed URL буцаана: `{ "url": "https://…", "expiresAt": "…" }`. Mobile URL-ыг кэшлэхгүй.

### 5.3 `DELETE /api/orders/:id/attachments/:attachmentId`

`DRAFT` төлөвт зөвшөөрнө (soft delete). 204.

- **Status code:** 201, 400, 403, 404, 409, 413, 415.
- **Дүрэм:** `requiresReferral: true` үйлчилгээтэй захиалгад REFERRAL attachment-гүй бол quote авах үед **422 `REFERRAL_REQUIRED`**.

---

## 6. Серверийн үнийн quote — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

### `POST /api/orders/:id/quote`

- **Auth:** Захиалгын эзэн. `DRAFT` төлөвт.
- **Урьдчилсан нөхцөл:** `items`, `scheduledFor`, `address.text` бөглөгдсөн, `redFlag.status = CLEAR`, шаардлагатай бол REFERRAL attachment байх.
- Request body хоосон, эсвэл `{ "promoCode": "DEMO10" }`. **Үнийн талбар хүлээж авахгүй.**

Response 200:
```json
{ "success": true, "message": "Үнийн санал",
  "data": { "quote": {
    "id": "quo_demo_001",
    "currency": "MNT",
    "lines": [
      { "serviceId": "svc_demo_basic", "name": "Гэрийн ердийн үзлэг", "quantity": 1, "unitPriceMnt": 45000, "amountMnt": 45000 },
      { "code": "TRAVEL_FEE", "name": "Унааны зардал", "amountMnt": 5000 },
      { "code": "DISCOUNT", "name": "Хөнгөлөлт (DEMO10)", "amountMnt": -4500 }
    ],
    "subtotalMnt": 45000,
    "travelFeeMnt": 5000,
    "discountMnt": 4500,
    "totalMnt": 45500,
    "pricingVersion": "2026-10-11.1",
    "expiresAt": "2026-10-11T03:22:00.000Z"
  } } }
```

- **Status code:** 200, 409 (`QUOTE_EXPIRED` эсвэл draft биш), 422 (`RED_FLAG_BLOCKED`, `REFERRAL_REQUIRED`, `VALIDATION_ERROR`).
- **Шийдвэр шаардсан:** Унааны зардлын дүрэм (бүс/зай), промо код, НӨАТ/и-баримт, quote-ын хүчинтэй хугацаа (санал: 15 мин).

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

## 8. Захиалгын дэлгэрэнгүй ба status — 🟡 САНАЛ БОЛГОСОН, ХЭРЭГЖЭЭГҮЙ

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

## 9. Шийдвэр шаардсан асуудлууд

| # | Асуудал | Нөлөө |
|---|---|---|
| D1 | **Технологийн зөрүү:** гэрээнд Flutter/NestJS заасан бол одоогийн код React Native (Expo) + Express. Бид шилжүүлэхгүй, гэхдээ гэрээтэй зөрж байгааг баталгаажуулах шаардлагатай | Бүх ажлын хүрээ |
| D2 | Order-ыг шинэ model болгох уу (санал), эсвэл одоогийн `Visit`-ийг өргөтгөх үү | §3, migration |
| D3 | Каталог, үнэ, унааны зардал, промо, валют (MNT) | §2, §6 |
| D4 | Red flag асуултын агуулга ба эмнэлгийн баталгаажуулалт, яаралтай дугаар | §4 |
| D5 | QPay merchant эрх, sandbox credential, `invoice_code`, буцаан олголт, и-баримт | §7 |
| D6 | Private storage сонголт (S3-compatible гэх мэт) ба хадгалах хугацаа | §5 |
| D7 | Хуучин endpoint-уудын алдааг HTTP 200-аас зөв code руу шилжүүлэх эсэх (mobile-д нөлөөлнө) | §0.1 |
| D8 | Нэвтрээгүй хэрэглэгчид каталог харуулах эсэх | §2 |
| D9 | `PAID`-аас хойш цуцлах ба буцаан олголт | §3.3 |

---

## 10. Mobile хөгжүүлэгчид — mock хийх заавар

1. Дээрх JSON жишээнүүдийг mock fixture болгон ашигла. Бүгд зохиомол өгөгдөл.
2. Төлөвийн урсгалыг §0.2-оор хэрэгжүүл. `status` нь тэнд байхгүй утга ирвэл "Тодорхойгүй" гэж харуул.
3. Үнийг mobile дээр **тооцоолж харуулахгүй**. Зөвхөн `quote.totalMnt`-ийг харуулна.
4. Төлбөрийн дараа `GET /api/orders/:id/payments/:paymentId`-ээр polling хий. Deeplink-ээс буцаж ирэхэд дахин шалга.
5. Алдааг `response.data.message`-ээр харуулж, логикоо `response.data.error.code` дээр тулгуурла.
6. Token, хувийн/эрүүл мэндийн мэдээллийг `console.log`-д бүү хэвлэ. Одоо [login.tsx:39](../App/app/auth/login.tsx#L39) нь login response-ийг (token-той) log хийдэг.
