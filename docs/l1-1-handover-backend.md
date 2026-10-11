# OTOCH L1-1 — Backend хүлээлгэн өгөх баримт (2026-10-17)

> Бэлтгэсэн: backend (`work/backend-l1-1`). Бүх жишээ өгөгдөл **зохиомол**.
> **Энэ backend production-д бэлэн БИШ.** Каталогийн үнэ, red flag асуулт fixture (батлагдаагүй), QPay зөвхөн mock-оор шалгагдсан, staging байхгүй, private bucket хэрэгжээгүй.

Холбоотой: [l1-1-api.md](l1-1-api.md) (гэрээ), [l1-1-backend-plan.md](l1-1-backend-plan.md) (явц, шийдвэр, DB төлөвлөгөө).

---

## 1. Эх код ба PR

| | |
|---|---|
| Repository | https://github.com/annd518/otoch-app |
| Branch | `work/backend-l1-1` |
| Тестэлсэн backend | **`db8837e`** (код `49f0f65`-аас хойш өөрчлөгдөөгүй; дараагийн commit-ууд зөвхөн docs) |
| Суурь | `main` = `901bb91` |
| PR | **#5** https://github.com/annd518/otoch-app/pull/5 → `main`. **Merge хийгээгүй** |
| Mobile | `work/mobile-l1-1` = **`4b711da`** (PR #4) |
| Хамтатган тестэлсэн (эцсийн) | backend **`db8837e`** + mobile **`4b711da`** (локал түр branch `tmp/integration-1017b`, push хийгээгүй). Өмнө нь `49f0f65` + `0200821` (`tmp/integration-1017`) |

PR-ийн commit-ууд (`main`-аас хойш): `f302020` wclient build · `c0761be` orders/red flag/quote/upload/QPay · `6253cf3` null catalogVersion · `76b7e9e` docs · `d0bd64a` mobile quote нийцэл · `28590ee` env template · `d74e524` payment recovery, prod seed · `81ce53d`, `8f6309f` docs · `49f0f65` production fixture хамгаалалт.

## 2. Хэрэгжсэн ба mock/fixture хэсэг

| Хэсэг | Төлөв | Тэмдэглэл |
|---|---|---|
| Auth (signup зөвхөн CHILD, login `{token,user}`, `TOKEN_EXPIRED`, нэгдсэн алдаа) | ✅ Бодит | wclient мөн нийцсэн |
| Каталог `GET /api/catalog/services` | ✅ Код бодит, **өгөгдөл fixture** | `isFixture: true`, `containsFixtures` |
| Draft захиалга + `Idempotency-Key` | ✅ Бодит | `Order` model таамаг (D2) |
| Red flag (эрт "Тийм" → `BLOCKED_RED_FLAG`) | ✅ Логик бодит, **асуулт fixture** | `approved: false` |
| Quote | ✅ Тооцоо бодит, **үнэ fixture** | `TRAVEL_FEE`, `DISCOUNT`, `VAT` тооцоогүй (`excludes`) |
| Upload (JPEG/PNG magic byte, ≤10MB, ≤5, эзэмшил, retry) | ✅ Урсгал бодит | Storage: `memory` (тест) / `local-dev` (dev) л. **S3 байхгүй** → production 503 |
| QPay invoice/status/callback/recovery | ✅ **Mock** горимд | Sandbox код бий, **ажиллуулаагүй**. Production идэвхгүй |
| Production хамгаалалт | ✅ | Mock QPay, memory/local-dev storage, demo хэрэглэгч production-д ажиллахгүй. **Fixture үнэ/асуулгаар quote, payment → 503 `FIXTURE_DATA_NOT_ALLOWED`** (`ALLOW_FIXTURE_DATA=true` зөвхөн staging-д) |
| Payment reconciliation operator хэрэгсэл | ❌ Байхгүй | `NEEDS_RECONCILIATION`, `PAID_AFTER_EXPIRY` гараар |

## 3. Payment recovery — mobile хөгжүүлэгчид (H1–H5)

`ORDER_NOT_EDITABLE`-ийн асуудал **`d74e524`-д шийдэгдсэн**. Өөр key-ээр давтан invoice хүсэхэд одоо `409 PAYMENT_IN_PROGRESS` + `paymentId` буцна. Mobile `0200821` болон `4b711da`-ийн `recoverPayment`-аар integration-д шалгасан (шинэ төхөөрөмж → ижил invoice).

Mobile **`4b711da`** (`17cbfa9`) H1–H5-ийг `error.fields.recovery`-гоор хэрэгжүүлсэн. Доорх "4b711da" баганыг integration (`db8837e` + `4b711da`) баталгаажуулсан.

Бүх төлбөрийн алдаа (409/502) ижил `error.fields` хэлбэртэй:

```json
{ "paymentId": "pay_demo_001", "paymentStatus": "PENDING", "recovery": "RESUME", "expiresAt": "2026-10-17T03:30:00.000Z" }
```

| `error.code` | HTTP | `recovery` | Mobile `0200821` | Handoff | Mobile `4b711da` (шалгасан) |
|---|---|---|---|---|---|
| `PAYMENT_IN_PROGRESS` | 409 | `RESUME` | ✅ `paymentId`-аар сэргээнэ | — | ✅ `pending` |
| `PAYMENT_ALREADY_PAID` | 409 | `DONE` | ❌ `error` | **H1:** `fields.paymentId` → `getInvoice` → `paid` | ✅ `paid` (шинэ төхөөрөмж) |
| `PAYMENT_UNCONFIRMED` | 502 | `WAIT` | ❌ `error` | **H2:** QR-гүй. `getPaymentState`-ээр `expiresAt` хүртэл polling, "хүлээж байна" | ✅ `unconfirmed`, QR байхгүй |
| `PAYMENT_IN_PROGRESS` | 409 | `WAIT` | ⚠️ сэргээх гэж оролдоод `getInvoice` унана (`qrText` байхгүй) | **H2:** мөн адил, `getInvoice` биш `getPaymentState` | ✅ `unconfirmed` (хадгалсан id ба шинэ төхөөрөмж) |
| `PAYMENT_RECONCILIATION_REQUIRED` | 409 | `CONTACT_SUPPORT` | ❌ `error` | **H3:** дахин оролдуулахгүй, тусламж руу | ✅ `reconciliation` |
| `ORDER_NOT_EDITABLE` (төлбөрийн үед) | — | — | `unknown_pending` салбар | **H4:** шинэ backend төлбөрт буцаахгүй. Хуучин серверийн fallback болгож үлдээж болно | fallback хэвээр (шинэ backend-д хүрэхгүй) |
| `PAYMENT_PROVIDER_ERROR` | 502 | `NEW_QUOTE` | ❌ `error`. Ижил key-ээр давтвал ижил 502 | **H5:** шинэ quote + шинэ key | ✅ `new_quote` |

Хоёр mobile хувилбарт ч давхар invoice үүсээгүй, хуурамч амжилт харагдаагүй (integration-аар шалгасан). UX-ийн дутагдлыг `4b711da` нөхсөн. Дэлгэцийн харагдацыг төхөөрөмж дээр шалгаагүй.

**Жишээ хариунууд** (зохиомол, mock):

```json
HTTP/1.1 409
{ "success": false, "message": "Энэ захиалгын төлбөр төлөгдсөн байна",
  "error": { "code": "PAYMENT_ALREADY_PAID",
    "fields": { "paymentId": "pay_demo_001", "paymentStatus": "PAID", "recovery": "DONE", "expiresAt": "2026-10-17T03:30:00.000Z" } } }
```

```json
HTTP/1.1 502
{ "success": false, "message": "Нэхэмжлэх үүссэн эсэх тодорхойгүй байна. Давхар төлбөрөөс сэргийлж түр хүлээнэ үү",
  "error": { "code": "PAYMENT_UNCONFIRMED",
    "fields": { "paymentId": "pay_demo_002", "paymentStatus": "PENDING", "recovery": "WAIT", "expiresAt": "2026-10-17T03:30:00.000Z" } } }
```

`GET /api/orders/:id/payments/pay_demo_002` (QR-гүй pending):

```json
{ "success": true, "message": "Төлбөрийн төлөв",
  "data": { "orderStatus": "AWAITING_PAYMENT",
    "payment": { "id": "pay_demo_002", "provider": "QPAY", "mode": "mock", "isMock": true, "status": "PENDING",
      "amountMnt": 45000, "currency": "MNT", "qrText": null, "qrImageBase64": null, "deeplinks": [],
      "expiresAt": "2026-10-17T03:30:00.000Z", "paidAt": null, "failureCode": "PROVIDER_UNCONFIRMED" } } }
```

```json
HTTP/1.1 409
{ "success": false, "message": "Төлбөрийг гараар шалгах шаардлагатай. Тусламжийн төвтэй холбогдоно уу",
  "error": { "code": "PAYMENT_RECONCILIATION_REQUIRED",
    "fields": { "paymentId": "pay_demo_003", "paymentStatus": "PENDING", "recovery": "CONTACT_SUPPORT", "expiresAt": "2026-10-17T03:30:00.000Z" } } }
```

```json
HTTP/1.1 502
{ "success": false, "message": "Төлбөрийн үйлчилгээ түр алдаатай байна. Шинэ үнийн санал авч дахин оролдоно уу",
  "error": { "code": "PAYMENT_PROVIDER_ERROR",
    "fields": { "paymentId": "pay_demo_004", "paymentStatus": "FAILED", "recovery": "NEW_QUOTE", "expiresAt": "2026-10-17T03:30:00.000Z" } } }
```

```json
HTTP/1.1 503
{ "success": false, "message": "Үнэ эсвэл аюулын шинжийн асуулга батлагдаагүй байгаа тул захиалга түр боломжгүй",
  "error": { "code": "FIXTURE_DATA_NOT_ALLOWED" } }
```

`failureCode` утгууд: `null`, `AMOUNT_MISMATCH`, `PROVIDER_UNCONFIRMED`, `PROVIDER_REJECTED`, `NEEDS_RECONCILIATION`, `PAID_AFTER_EXPIRY`. Дэлгэрэнгүй: api §7.1.1.

## 4. Migration / deploy / rollback

Migration-ууд (бүгд **зөвхөн нэмэлт**, одоо байгаа хүснэгтэд `ALTER`/`DROP` байхгүй). Аль ч бодит эсвэл локал DB-д **apply хийгээгүй**, зөвхөн тест бүрт шинэ UTF8 DB дээр:

1. `0_init` (main-ийн одоогийн schema-ийн baseline)
2. `20261012000000_add_service_catalog`
3. `20261013000000_add_draft_orders_red_flag`
4. `20261014000000_add_idempotency_quote_attachment_payment`

10.16–10.17-нд schema/migration **өөрчлөгдөөгүй**.

**Шинэ (хоосон) staging DB-д deploy:**

1. Managed PostgreSQL, **UTF8** encoding, backup идэвхтэй.
2. Secret store-д `server/.env.sample`-ийн нэрсээр утга оруулна: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (≥32 тэмдэгт), `CORS_ORIGINS`, `PUBLIC_BASE_URL` (HTTPS), `TRUST_PROXY`, `QPAY_MODE=sandbox` + `QPAY_*`, `STORAGE_DRIVER` (S3 хэрэгжтэл upload 503), `ALLOW_FIXTURE_DATA=true` **зөвхөн fixture-тэй staging-д**.
3. `docker build --target migrate` → `npx prisma migrate deploy` нэг удаа. **`db push`, `migrate reset`, `migrate resolve` хориотой.**
4. Runtime image → `GET /api/health`.
5. Seed (`npx prisma db seed` → `tsx prisma/seed.ts`): production-д demo хэрэглэгч **үүсэхгүй**. Fixture зөвхөн `ALLOW_FIXTURE_DATA=true` үед.
6. Smoke: signup/login, каталог, draft, red flag, quote, (bucket байвал) upload, (sandbox байвал) invoice → check → callback → PAID, буруу дүн, давхар callback.

**Одоо өгөгдөлтэй DB (жишээ нь main-ийн local DB):** `0_init`-ийг baseline болгож `migrate resolve --applied` хийх шаардлагатай. Энэ нь өгөгдөлд нөлөөлөх үйлдэл тул **зөвшөөрөлгүй хийхгүй** (plan §12). Локал WIN1252 DB-г хөндөөгүй.

**Rollback:** өмнөх image руу буцааж, DB backup-аас сэргээнэ. Migration-ууд зөвхөн нэмэлт тул хуучин код шинэ хүснэгтүүдийг үл тоож ажиллана. Шинэ хүснэгтийг устгах `DROP` скрипт бэлдээгүй (өгөгдөл алдах эрсдэлтэй, гараар шийдэх).

## 5. Тестийн үр дүн (2026-10-17)

| Шалгалт | SHA | Дүн |
|---|---|---|
| Server `npm test` (тусдаа устдаг UTF8 PostgreSQL, 4 migration хоосон DB-д) | `49f0f65` | **100/100** |
| `tsc --noEmit`, `prisma validate` | `49f0f65` | OK |
| Mobile unit (`App`, integration tree) | `4b711da` | **149/149** (`0200821`: 143/143) |
| Mobile service функц → backend (эцсийн) | `db8837e` + `4b711da` | **14/14** |
| Mobile service функц → backend | `49f0f65` + `0200821` | 14/14 |
| wclient `next build` | wclient `28590ee`-аас хойш өөрчлөгдөөгүй (10.16-нд шалгасан) | 14/14 |

Integration 14 тест: auth (локал болон серверийн token хугацаа дуусалт), role 403, draft зэрэг хүсэлт + timeout retry → 1 order, хэсэгчилсэн "Тийм" → `BLOCKED` ба PATCH/quote/payment тойрох боломжгүй, quote version/хугацаа/fixture/`excludes`, upload retry/унших/устгах/эзэмшил, invoice → mock PAID → `DONE`, provider timeout, `recoverPayment` (хадгалсан id, ижил key, шинэ төхөөрөмж), unconfirmed, `NEW_QUOTE`, `WAIT` (QR-гүй pending polling → expired), `CONTACT_SUPPORT`, payment эзэмшил (`paymentId` задрахгүй). `4b711da`-тай үед `recoverPayment`-ийн үр дүн: `paid` / `unconfirmed` / `new_quote` / `reconciliation` гэж тус тусад нь шалгасан. Бүгд **mock QPay** ба memory storage.

## 6. Staging / private storage / QPay sandbox — бодит төлөв

| | Төлөв |
|---|---|
| Staging HTTPS backend | ❌ **Байхгүй, deploy хийгдээгүй.** Hosting, домэйн/TLS эрх ирээгүй |
| UTF8 managed PostgreSQL | ❌ Байхгүй |
| Private bucket | ❌ Эрх байхгүй, S3 adapter хэрэгжээгүй |
| QPay sandbox | ❌ Credential, `invoice_code` байхгүй. Sandbox adapter **нэг ч удаа ажиллаагүй** |
| Docker image | ❌ Build шалгагдаагүй (энэ машины Docker daemon API 500) |
| QPay mock | ✅ Тестэд л. **QPay биш** |

## 7. Дутуу access ба шийдвэр

**Access:** staging hosting + HTTPS домэйн, UTF8 PostgreSQL, private bucket (S3-compatible), QPay sandbox merchant credential + `invoice_code`, ажиллагаатай Docker орчин.

**Шийдвэр** (дэлгэрэнгүй api §9): D1 технологийн зөрүү (Flutter/NestJS ↔ RN/Express, шилжүүлээгүй) · D2 `Order` model · D3 үнэ, унааны зардал, хөнгөлөлт, НӨАТ · D4 red flag асуултын эмнэлзүйн агуулга · D5 QPay merchant, буцаан олголт, **reconciliation процесс** · D6 storage, хадгалах хугацаа · D9 цуцлалт/буцаалт · D10–D13 зөвшөөрөл, өвчтөний талбар, PDF, цагийн цонх · D14 staging сонголт · D16 нэмэлт draft талбарууд. Мөн локал WIN1252 DB-ийн UTF8 шилжилтийн зөвшөөрөл (plan §12).

## 8. L1-1-ийн биелээгүй шалгуур

1. Staging backend + бодит iOS/Android төхөөрөмж дээр эхнээс нь дуустал урсгал **хийгдээгүй**.
2. QPay sandbox invoice/check/callback/PAID, буруу дүн, давхар callback **sandbox дээр шалгаагүй** (mock л).
3. Private bucket upload, restart-ийн дараах хадгалалт **шалгаагүй** (S3 байхгүй).
4. Үнэ, хураамж, red flag асуулт **fixture** → production-д хаалттай (`FIXTURE_DATA_NOT_ALLOWED`). Батлагдсан өгөгдөл ирэх хүртэл бодит захиалга авах боломжгүй.
5. Payment reconciliation-ийн operator хэрэгсэл байхгүй.
6. Mobile H1–H5 нь service түвшинд хийгдсэн (`4b711da`). Дэлгэцийг бодит төхөөрөмж дээр шалгаагүй.
7. PR #5 merge хийгдээгүй (review болон шийдвэр хүлээж байна).

## 9. Локалд үлдсэн зүйл

- Gitignore хийсэн, commit хийгээгүй: `server/.env`, `wclient/.env.local`, `server/.local-pg/` (WIN1252 dev DB, хөндөөгүй), log, build/cache.
- Түр integration worktree (scratch хавтсанд, push хийгээгүй): `tmp/integration-1014`, `-1015`, `-1016`, `-1016b`, `-1017`, `-1017b`. Зөвшөөрөл авсны дараа устгана.
