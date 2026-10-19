# nurse-app: Үе 2-ын API санал (B1–B6, B10)

| Талбар | Утга |
|---|---|
| Огноо | 2026-10-19 |
| Төлөв | **Хэрэгжсэн** (2026-10-19, `feat/nurse-app`): B2–B6, B10 + хуучин `complete` guard. 17 шинэ тест. B1 (OTP): `POST /api/auth/otp/verify` `{..., app:"nurse"}`: зөвхөн админ урьдчилан утсыг нь бүртгэсэн NURSE нэвтэрнэ, хэзээ ч шинэ хэрэглэгч үүсгэхгүй, танихгүй дугаар/буруу role нь `OTP_INVALID` (enumeration-гүй); `app` байхгүй бол хуучин зан төлөв хэвээр. Талбарууд санал хэвээр, үр дүнд нь батлагдаагүй (эзэмшигч хянана) |
| Холбоотой | [nurse-app-plan.md](nurse-app-plan.md) §3, spec v2.0 слайд 34–36, 70, 82 |

Зарчим: одоогийн `/api/staff/orders` (assign, eta, start, complete) **өөрчлөгдөхгүй**. wclient `dashboard/orders` эдгээрийг ашигладаг. Бүгд нэмэлт (additive). Бүх хариу нэгдсэн гэрээгээр (`{success, message, data}` / `error.code`). Сувилагч зөвхөн `assignedNurseId = өөрөө` захиалгад хандана, бусад нь 404. Төлөв шилжүүлэх үйлдэл `version` (optimistic lock) шаардаж `409 VERSION_CONFLICT` өгнө.

## 1. Schema

```prisma
enum OrderStatus { ... ASSIGNED  EN_ROUTE  IN_PROGRESS  COMPLETED  REFUSED  INCIDENT ... }  // 3 шинэ утга

model VisitRecord {            // нэг захиалгад нэг
  id, orderId @unique, nurseId
  checkinAt, checkinMethod, checkinLat, checkinLng, checkinDistanceM
  checklist Json?              // { identified, hygiene, medicationChecked }
  vitals Json?                 // { systolic, diastolic, pulse, temperatureC, spo2 }
  procedures Json?             // string[]
  medicationChecks Json?       // { patient, medicine, dose, route, time } (5 зөв, А/41 5.4)
  note String?
  signerName String?, signature String? (PNG data URL), signedAt DateTime?
  createdAt, updatedAt
}
```

Нэмэлт migration (`ALTER TYPE ... ADD VALUE`, `CREATE TABLE`). `paymentController`-ын «цаг дүүрсэн» тооцооны `status in [...]` жагсаалтад `EN_ROUTE` нэмнэ.

## 2. Endpoint-ууд (`/api/nurse/orders`, зөвхөн NURSE)

| # | Endpoint | Хэрэг | Дүрэм |
|---|---|---|---|
| B2 | `POST /:id/en-route` `{version}` | Замдаа гарлаа | `ASSIGNED → EN_ROUTE`; event `EN_ROUTE` |
| B5 | `POST /:id/checkin` `{version, method:"GEO", lat, lng, checklist:{identified,hygiene,medicationChecked}}` | Ирлээ, эргэлт эхлүүлэх | `ASSIGNED\|EN_ROUTE → IN_PROGRESS`; checklist 3 бүгд `true`; захиалгын lat/lng-ээс ≤ 200 м (`422 CHECKIN_TOO_FAR`); товлосон цагаас ±30 мин (`422 CHECKIN_TIME_WINDOW`); `redFlag ≠ FLAGGED`. QR нь тусдаа (үнэмлэх token) |
| B3 | `PUT /:id/record` `{vitals?, procedures?, medicationChecks?, note?}` | Autosave (version шаардахгүй) | Зөвхөн `IN_PROGRESS`; хязгаар: systolic 50–260, diastolic 30–160, pulse 20–220, temperatureC 30–43, spo2 50–100, note ≤ 2000 тэмдэгт |
| B3 | `GET /:id/record` | Хадгалсан draft-ыг сэргээх | |
| B3 | `POST /:id/finish` `{version, signerName, signature}` | Гарын үсэг + дуусгах | `IN_PROGRESS → COMPLETED`; шаардлага: ≥ 1 амин үзүүлэлт, ≥ 1 ажилбар, эмтэй захиалгад 5 зөв бүгд `true`; signature = `data:image/png;base64,` ≤ 100 KB. Эс бөгөөс `422 RECORD_INCOMPLETE` |
| B4 | `POST /:id/reject` `{version, reason, comment?}` | Татгалзах | `reason ∈ NO_REFERRAL, MED_EXPIRED, NAME_MISMATCH, FIRST_DOSE`; `ASSIGNED\|EN_ROUTE\|IN_PROGRESS → REFUSED`; event-д шалтгаан. Төлбөрийн үр дагавар (слайд 32 ⚑ хуульч) энэ санал хамаарахгүй, админ шийднэ |
| B4 | `POST /:id/incident` `{version, description}` | Осол | `... → INCIDENT`; event; админ харах |
| B6 | `GET /:id/attachments/:attachmentId/content` | Заалтын зураг харах | Зөвхөн томилогдсон сувилагч, `ASSIGNED\|EN_ROUTE\|IN_PROGRESS` үед. `Cache-Control: private, no-store` |
| B10 | `GET /:id` | Дэлгэрэнгүй + `patientContact` | Одоо `staff/orders/:id` дээр үйлчлүүлэгчийн утас байхгүй. Идэвхтэй захиалгад л буцаана |
| B1 | OTP нэвтрэлт (`POST /api/auth/otp/*`) NURSE role зөвшөөрөх | Утас + OTP | `otpController.ts:218` одоо CHILD-only. Шийдвэр: сувилагчийн утас хэрхэн бүртгэгдэх вэ (админ урьдчилан) |

## 3. Хуучин endpoint-той уялдаа (хэрэгжсэн)

`POST /api/staff/orders/:id/complete` одоо тэмдэглэлгүйгээр дуусгана. Санал: `VisitRecord` бүхий захиалгад гарын үсэггүй бол `409 RECORD_REQUIRED`. Ингэхэд wclient-ийн «start/complete» үргэлжилнэ (record байхгүй). Бүрэн хаах нь wclient-ийг `finish` руу шилжүүлсний дараа.

## 4. Хойшлуулсан

- Байршил ping (`EN_ROUTE` үед) ба үйлчлүүлэгчид ETA харуулах: нууцлалын шийдвэр (хэнд, хэр удаан хадгалах) хэрэгтэй.
- Талбарын шифрлэлт (spec слайд 110).
- wclient-д шинэ статусын шошго (`EN_ROUTE`, `REFUSED`, `INCIDENT`).
- QR үнэмлэх token.
