# L1-1 Mobile төлөвлөгөө: дэлгэц ба өгөгдлийн зураглал

| Талбар | Утга |
|---|---|
| Огноо | 2026-10-11 |
| Хариуцагч | Mobile хөгжүүлэгч |
| Branch | `work/mobile-l1-1` |
| Суурь commit | `aacfaad` (origin/main, "Update OTOCH app development") |
| Хүлээлгэн өгөх | 2026-10-17 |
| Төлөв | Ноорог. API гэрээ батлагдаагүй. 10-12: auth засвар, каталог (9-р хэсэг). 10-13: draft, red flag, 103, заалтын зураг (10-р хэсэг). |

> **Анхаар.** API-ийн хэсгүүд backend-ийн `docs/l1-1-api.md` саналд тулгуурласан.
> Тэр файл 2026-10-11-ний байдлаар зөвхөн `origin/work/backend-l1-1` (commit `3b1bc42`) дээр байгаа, main-д ороогүй, **батлагдаагүй**.
> Гэрээ өөрчлөгдвөл энэ баримтын 2, 4, 5-р хэсгийг дагуулж засна. Mock өгөгдөл бүгд зохиомол.

---

## 1. Одоогийн төлөв (кодоор шалгасан)

> Энэ хэсэг 2026-10-11-ний төлвийг бичсэн. 2026-10-12-нд засагдсан зүйлсийг 9-р хэсгээс үзнэ үү.

### 1.1 Стек

- **React Native + Expo Router.** `App/package.json:3` нь `expo-router/entry`, `:20` нь `expo ~57.0.27`, `:27` нь `expo-router ~57.0.25`, `:35` нь `react-native 0.86.3`.
- **HTTP.** Дэлгэцүүд `axios`-оор API-г шууд дууддаг. `App/services/api.ts` дахь `apiService` класс аль ч дэлгэцэд ашиглагдаагүй.
- **Storage.** `App/utils/storage.ts:12` JWT-г AsyncStorage-д шифрлэлгүй хадгална.
- **API URL.** `App/utils/env.ts:19-20` дээр `EXPO_PUBLIC_API_URL` байвал түүнийг ашиглана. Үгүй бол Metro-ийн LAN IP (`:24-27`), Android emulator-ийн `10.0.2.2` (`:30`), эсвэл `localhost` (`:31`) руу унана.
- **Navigation.** `App/app/_layout.tsx:8-13` нь Stack. Нэвтрэлт шалгах guard байхгүй. Tab-ууд `App/app/(tabs)/_layout.tsx:23-70` дээр байна.

### 1.2 Дэлгэц бүрийн ангилал

| Route | Файл | Ангилал | Нотолгоо |
|---|---|---|---|
| `/` | `App/app/index.tsx` | Static (зориуд) | `:9-11` зөвхөн `/auth/login` руу шилжүүлнэ. API шаардлагагүй. |
| `/auth/login` | `App/app/auth/login.tsx` | **Бодит API** | `:34` `POST /api/auth/login`. Асуудлууд 1.4-т. |
| `/auth/register` | `App/app/auth/register.tsx` | **Бодит API** (урсгал эвдэрхий) | `:48-53` `POST /api/auth/signup`. Амжилттай үед ч дэлгэц шилжихгүй (1.4). |
| `/(tabs)` Нүүр | `App/app/(tabs)/index.tsx` | **Mock/static** | `:28` "Анита Шарма, 78 нас", `:37-49` амин үзүүлэлт, `:58-76` мэдэгдэл, `:86` `/parent/1` холбоос бүгд кодод бичигдсэн. |
| `/(tabs)/bookappointment` | `App/app/(tabs)/bookappointment.tsx` | **Хэсэгчлэн бодит** | `:82` `GET /api/parents` ба `:125-131` `POST /api/visits` бодит. Каталог, үнэ, цаг, байршил, төлбөр static. |
| `/(tabs)/add-parent` | `App/app/(tabs)/add-parent.tsx` | **Бодит API** (талбар алддаг) | `:69-85` `POST /api/parents`. Хэд хэдэн талбар илгээгддэггүй (1.4). |
| `/(tabs)/profile` | `App/app/(tabs)/profile.tsx` | **Mock/static** | `:17-21` "Ramesh Kumar" болон pexels зураг кодод бичигдсэн. `:23-26` logout нь token устгадаггүй. |
| `/parent/[id]` | `App/app/parent/[id].tsx` | **Mock/static** | `:10-17` "Anita Sharma", `:35-36` түүх кодод бичигдсэн. `id`-г зөвхөн харуулахад ашиглана. |
| `/report-viewer` | `App/app/report-viewer.tsx` | **Mock/static** | `:5-10` амин үзүүлэлт, тэмдэглэл кодод бичигдсэн. |
| `/notifications` | `App/app/notifications.tsx` | **Mock/static** | `:4-8` мэдэгдлүүд кодод бичигдсэн. |
| Каталог API | — | **Байхгүй** | `bookappointment.tsx:52-59` дотор массиваар бичигдсэн. |
| Red flag | — | **Байхгүй** | Код, dependency аль алинд нь олдсонгүй. |
| Заалтын зураг upload | — | **Байхгүй** | `expo-image-picker` dependency ч байхгүй. |
| QPay | — | **Байхгүй** | `bookappointment.tsx:522-534` дээр зөвхөн eSewa, Khalti, Карт гэсэн ажиллагаагүй товч бий. |
| Захиалгын жагсаалт / tracking | — | **Байхгүй** | Backend-д `GET /api/visits/child` бий (`server/src/routes/visits.routes.ts:120`). Mobile дээр `services/api.ts:140` л тодорхойлсон, ямар ч дэлгэц дууддаггүй. |

### 1.3 Өмнөх audit-ийн олдворыг дахин шалгасан дүн

| Audit-ийн олдвор | Дүн | Нотолгоо |
|---|---|---|
| Mobile нь React Native + Expo Router | Баталгаажсан | `App/package.json:3,20,27,35` |
| Каталог кодод бичигдсэн, үнэ रू тэмдэгтэй | Баталгаажсан | `bookappointment.tsx:52-59`, `:487-502` |
| Захиалга зөвхөн `parentId`, `scheduledFor`, `visitType=FULL` илгээдэг | Баталгаажсан | `bookappointment.tsx:127-131`. Үйлчилгээ, давтамж, байршил, заавар, сувилагчийн хүйс, промо код илгээгддэггүй. |
| Red flag, заалтын зураг upload, QPay олдоогүй | Баталгаажсан | `App/` дотор grep хийхэд олдсонгүй. |
| Home, parent profile mock | Баталгаажсан, илүү өргөн | Profile, report-viewer, notifications ч мөн mock. |
| Бодит tracking холбогдоогүй | Баталгаажсан | Захиалгын жагсаалт, төлөвийн дэлгэц байхгүй. |
| `app.json`-д iOS `bundleIdentifier`, Android `package` байхгүй | Баталгаажсан | `App/app.json:11-13`, `:14-23` |
| `eas.json`, store release нотолгоо байхгүй | Баталгаажсан | `eas.json`, `extra.eas.projectId`, `owner`, CI тохиргоо аль нь ч repo-д байхгүй. |

### 1.4 Шинээр илэрсэн асуудлууд

**Backend-тэй зөрөх асуудал (backend-д handoff хийнэ):**

- **Signup token буцаадаггүй.** `server/src/controllers/authController.ts:82-86` зөвхөн `data.user` буцаана. `register.tsx:57` нь `data.data.token` шалгадаг тул амжилттай бүртгүүлсэн ч хэрэглэгч ямар ч мэдэгдэлгүйгээр дэлгэц дээрээ үлдэнэ.
- **Login-ийн `user` талбарт token орж ирдэг.** `authController.ts:164` нь `user: token`. `login.tsx:47-48` энэ string-ийг хэрэглэгчийн өгөгдөл гэж хадгална. Role хадгалагдахгүй.
- **Validation алдаа HTTP 200 буцаадаг.** `server/src/controllers/visitController.ts:38-41`, `:56-60` болон `authController.ts:38,55,107,121,131` нь status кодгүй `res.json({message})` буцаана. `bookappointment.tsx:139-155` нь 2xx бүрийг амжилт гэж үзэж "Захиалга баталгаажлаа" гэж харуулна. Иймээс алдаатай захиалга амжилттай мэт харагдана.
- **Backend schema-д mobile-ийн цуглуулдаг талбар алга.** `server/prisma/schema.prisma:17-27` User-д утас байхгүй. `:29-40` Parent-д утас, хамаарал, цусны бүлэг, харшил, координат байхгүй.

**Зөвхөн mobile талын асуудал:**

- `register.tsx:23,125-133` утас авдаг ч `:48-53` илгээдэггүй.
- `register.tsx:191` "Нэвтрэх" холбоос `/auth/login` биш `/` руу очдог.
- `add-parent.tsx:30,38,42,45` хамаарал, яаралтай холбоо барих хүний нэр, цусны бүлэг, харшлыг илгээдэггүй. `:67` хот, шуудангийн кодыг хаягт залгана. `:76-77` хоосон утгыг `"None"` болгоно.
- `add-parent.tsx:193,256` placeholder `+91` (Энэтхэг), `bookappointment.tsx:47` анхдагч байршил "Lalitpur" (Балба).
- `bookappointment.tsx:174-191` огноог UTC шөнө дунд гэж parse хийгээд локал цаг тавьдаг. UTC+8-д зөв ажиллах ч сөрөг offset-тэй цагийн бүсэд нэг өдөр шилжинэ.
- `bookappointment.tsx:357-363` огноог чөлөөт текстээр (`YYYY-MM-DD`) оруулдаг.
- `bookappointment.tsx:423` `MapView`-д region, marker байхгүй. `:429` "Газрын зураг дээр засах" товчинд `onPress` байхгүй.
- `bookappointment.tsx:516` промо кодын товч ажилладаггүй.
- `profile.tsx:23-26` logout нь storage цэвэрлэдэггүй тул token үлдэнэ.
- `login.tsx:39`, `register.tsx:55` response-ийг (token-той) console руу хэвлэдэг. Release build-д ч device log руу орно.
- `login.tsx:61`, `register.tsx:76`, `add-parent.tsx:96`, `bookappointment.tsx:97,163` алдааны гарчиг англиар "Error" байна.
- `services/api.ts:36-39` 2xx бүрийг `success: true` гэж үздэг тул ашиглахаасаа өмнө засах шаардлагатай.
- "PariwarCare" нэр `App/app/index.tsx:26`, `login.tsx:80`, `register.tsx:94`, `(tabs)/index.tsx:18` дээр үлдсэн. `App/app.json:3-4` нэр, slug нь "App". App icon нь Expo template-ийн анхны зураг.

---

## 2. L1-1 урсгалын зураглал

```
S1 Каталог
  → S2 Өвчтөн / хаяг / цаг      (серверт DRAFT захиалга үүснэ)
  → S3 Red flag асуулга          (FLAGGED бол захиалга BLOCKED_RED_FLAG болж зогсоно)
  → S4 Заалтын зураг              (зөвхөн requiresReferral = true үед)
  → S5 Үнэ ба баталгаажуулалт     (серверийн quote)
  → S6 QPay sandbox төлбөр
  → S7 Tracking (захиалгын төлөв)
```

**API-ийн эх сурвалж.** Endpoint ба талбарын нэрийг backend-ийн `docs/l1-1-api.md` (`origin/work/backend-l1-1`, commit `3b1bc42`) саналаас авсан. Доор "API §N" гэж тэр баримтын хэсгийг заана. Тэр баримт ч **санал**, main руу ороогүй. Зөрүү ба дутууг 4.2-т жагсаав.

**Бүтцийн санал.**

- Одоогийн нэг урт `bookappointment.tsx` дэлгэцийг `app/booking/` доорх алхам бүхий Stack болгон хуваана. "Захиалга" tab нь S1 руу орно.
- Захиалгын ноорог серверт (`DRAFT`) хадгалагдана. Апп зөвхөн `orderId`, `version`-ийг `app/booking/_layout.tsx` дахь React context-д барина. Шинэ state сан нэмэхгүй.
- Үнэ, red flag, заалтын шалгалтыг сервер хийнэ. Client зөвхөн UX-д зориулж урьдчилан шалгана.
- Алдааг `response.data.message`-ээр харуулж, салбарлалтыг `response.data.error.code`-оор хийнэ (API §0.1).

### S1. Каталог

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | `bookappointment.tsx:52-59` (static массив, रू үнэ) |
| Шинэ route | `app/booking/index.tsx` |
| Хэрэглэгчийн үйлдэл | Үйлчилгээний жагсаалт харах, тайлбар, хугацаа, заалт шаардлагатай эсэхийг харах, нэгийг сонгох |
| API | `GET /api/catalog/services` (API §2): `id`, `name`, `description`, `priceMnt`, `durationMin`, `requiresReferral`, `isActive`, `catalogVersion`, `currency` |
| Validation | Зөвхөн `isActive` үйлчилгээ. Сонголтгүйгээр үргэлжлүүлэх товч идэвхгүй. `priceMnt`-ийг "-аас эхэлнэ" гэж зөвхөн мэдээллийн зорилгоор харуулна. Эцсийн үнэ S5-д. |
| Loading / error / empty | Skeleton карт. 401 бол login руу. Бусад алдаанд "Дахин оролдох". Хоосон бол "Одоогоор үйлчилгээ алга". |
| Дууссан гэх шалгуур | Кодод үйлчилгээ, үнэ бичигдээгүй. रू устсан. Үнэ ₮-өөр, мянгатын тусгаарлагчтай. Сонгосон `serviceId` S2 руу дамжина. |

### S2. Өвчтөн / хаяг / цаг

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | `bookappointment.tsx:273-417` (өвчтөн сонголт бодит API, огноо чөлөөт текст, цаг static), `add-parent.tsx` |
| Шинэ route | `app/booking/details.tsx`. Шинэ өвчтөн нэмэхэд одоогийн `add-parent` дэлгэцийг дахин ашиглаад буцаж ирнэ. |
| Хэрэглэгчийн үйлдэл | Өвчтөн сонгох эсвэл нэмэх. Хаягийг текстээр оруулах, газрын зураг дээр цэг тавих нь сонголттой. Огноо, цагийн цонх сонгох. Тэмдэглэл, сувилагчийн хүйсийн сонголт. |
| API | `GET /api/parents` (байгаа, `data.parents`). `POST /api/orders` (API §3.1): `parentId`, `items[{serviceId, quantity: 1}]`, `scheduledFor` (`+08:00`), `timeSlot`, `address{text, lat?, lng?}`, `notes`, `nurseGenderPreference`. Буцаж засахад `PATCH /api/orders/:id` `version`-тэй (API §3.2). |
| Validation | API §3.1-ийн дүрэм: `scheduledFor` ирээдүйд, 90 хоногоос ихгүй. `timeSlot` `HH:MM-HH:MM`, серверийн зөвшөөрсөн цонхноос. `address.text` 5-300 тэмдэгт. `notes` 500 хүртэл. Огноог Улаанбаатарын цагаар харуулна. |
| Loading / error / empty | Өвчтөн байхгүй бол одоогийн "Эцэг/эх нэмэх" CTA-г үлдээнэ (`bookappointment.tsx:281-294`). 400 бол `error.fields`-ийг талбар бүрийн доор харуулна. 409 `VERSION_CONFLICT` бол захиалгыг дахин татаад хэрэглэгчид мэдэгдэнэ. |
| Дууссан гэх шалгуур | Чөлөөт текст огноо байхгүй. `scheduledFor` нь сонгосон цонхны эхлэл, `+08:00` offset-тэй. DRAFT захиалга үүсч `orderId`, `version` хадгалагдсан. Байршлын permission шаардахгүй. |
| Дутуу | Сул цагийн цонхыг авах endpoint API саналд алга (4.2, GAP-1). Шийдэгдэх хүртэл `bookappointment.tsx:61`-ийн 5 цонхыг зөвхөн mock-д ашиглана. |

### S3. Red flag асуулга

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | Байхгүй |
| Шинэ route | `app/booking/red-flags.tsx` |
| Хэрэглэгчийн үйлдэл | Асуулт бүрт Тийм/Үгүй хариулах. FLAGGED бол захиалга зогсож, серверээс ирсэн зөвлөмж ба залгах товч харагдана. |
| API | `GET /api/orders/:id/red-flag-questions` (API §4.1). `PUT /api/orders/:id/red-flag-answers` (API §4.2) → `redFlag.status: CLEAR \| FLAGGED`, `orderStatus`, FLAGGED үед `advice{text, phone}` |
| Validation | `required` асуулт бүрт хариулсан байх. Үнэлгээг сервер хийнэ. Залгах дугаарыг кодод бичихгүй, `advice.phone`-оос авна. |
| Loading / error / empty | Асуулга ачаалж чадахгүй бол урсгалыг **хаана**, алгасахгүй. 400 бол дутуу асуултыг тодруулна. 409 бол захиалгын төлөвийг дахин татна. |
| Дууссан гэх шалгуур | FLAGGED үед S5, S6 руу орох боломжгүй, захиалгын жагсаалтад "Яаралтай тусламж авна уу" төлөвтэй харагдана. CLEAR үед S4 эсвэл S5 руу шилжинэ. Асуултын агуулгыг эмнэлгийн хариуцагч баталсан (API D4). |

### S4. Заалтын зураг (шаардлагатай үед)

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | Байхгүй. `expo-image-picker` dependency байхгүй. |
| Шинэ route | `app/booking/referral.tsx`, зөвхөн `requiresReferral = true` үед |
| Хэрэглэгчийн үйлдэл | Камераар авах эсвэл галерейгаас сонгох, урьдчилан харах, устгах, дахин авах |
| API | `POST /api/orders/:id/attachments` (`multipart/form-data`, `file`, `kind=REFERRAL`) (API §5.1). `DELETE /api/orders/:id/attachments/:attachmentId` (API §5.3). Дараа нь харах шаардлагатай бол богино хугацааны signed URL (API §5.2), кэшлэхгүй. |
| Validation | API §5.1: JPEG, PNG, HEIC, PDF. Нэг файл 10 MB хүртэл, захиалгад 5 хүртэл. Шаардлагатай үед дор хаяж 1 файл. L1-1-д зөвхөн зураг (камер, галерей) санал болгоно. PDF хэрэгтэй бол `expo-document-picker` нэмнэ (GAP-6). |
| Permission | iOS: камер, зургийн сангийн usage string. Android: CAMERA. Галерейд Android photo picker. |
| Loading / error / empty | Зураг бүрийн upload явц. 413 бол "Файл хэт том", 415 бол "Төрөл буруу". Сүлжээ тасарвал тухайн файлыг дахин оролдох. Permission татгалзвал тайлбар ба "Тохиргоо нээх". |
| Дууссан гэх шалгуур | Attachment захиалгад холбогдсон. Quote авах үед `422 REFERRAL_REQUIRED` гарахгүй. Бодит iOS, Android төхөөрөмж дээр камер ба галерей ажилласан. |

### S5. Үнэ ба баталгаажуулалт

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | `bookappointment.tsx:481-536` (रू 800/150/100/850 кодод бичигдсэн), `:539-547` илгээх товч |
| Шинэ route | `app/booking/review.tsx` |
| Хэрэглэгчийн үйлдэл | Үйлчилгээ, өвчтөн, хаяг, цаг, red flag дүн, хавсралтыг шалгах. Серверийн үнийн задаргааг харах. Нөхцөл зөвшөөрөх. "Төлбөр төлөх" дарах. |
| API | `POST /api/orders/:id/quote` (API §6), body хоосон эсвэл `{promoCode}` → `quote.id`, `lines[]`, `subtotalMnt`, `travelFeeMnt`, `discountMnt`, `totalMnt`, `expiresAt` |
| Validation | Апп үнэ тооцохгүй, зөвхөн `lines` ба `totalMnt`-ийг харуулна. Quote-ийн хугацааг харуулна. Промо кодын талбарыг бүтээгдэхүүний шийдвэр (API D3) гарвал л харуулна. |
| Loading / error / empty | Quote ачаалах үед товч идэвхгүй. 409 `QUOTE_EXPIRED` бол дахин quote авна. 422 `RED_FLAG_BLOCKED` бол S3, `REFERRAL_REQUIRED` бол S4 руу буцаана. |
| Дууссан гэх шалгуур | Харагдах нийт дүн `quote.totalMnt`-тэй тэнцүү. `quote.id` S6 руу дамжина. Нөхцөл зөвшөөрөөгүй бол үргэлжлэхгүй. |

### S6. QPay sandbox төлбөр

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | Байхгүй. `bookappointment.tsx:522-534`-ийн eSewa, Khalti товчийг устгана. |
| Шинэ route | `app/booking/payment.tsx` |
| Хэрэглэгчийн үйлдэл | Дүн ба QR харах, банкны апп сонгож deeplink-ээр нээх, апп руу буцах, "Төлбөр шалгах", цуцлах |
| API | `POST /api/orders/:id/payments/qpay` (API §7.1), `Idempotency-Key: <uuid>` header, body `{quoteId}` → `payment{id, status, amountMnt, qrText, qrImageBase64, deeplinks[], expiresAt}`. `GET /api/orders/:id/payments/:paymentId` (API §7.2). Цуцлах: `POST /api/orders/:id/cancel` (API §3.3). |
| Аюулгүй байдал | QPay-ийн credential, callback, `payment/check` бүгд backend-д. Апп QPay руу шууд хандахгүй. |
| Validation | Төлөгдсөн эсэхийг зөвхөн серверийн `payment.status`-аар шийднэ. Банкны аппаас буцаж ирснийг төлбөр гэж үзэхгүй. Нэг оролдлогод нэг `Idempotency-Key`. Сүлжээ тасраад дахин илгээхэд ижил key ашиглана. |
| Loading / error / empty | Invoice үүсгэх үед loading. Дэлгэц нээлттэй, апп идэвхтэй үед 3-5 секунд тутам, `expiresAt` хүртэл шалгана. Foreground-д буцаж ирэхэд дахин шалгана. `EXPIRED` бол шинэ quote, invoice. 502 `PAYMENT_PROVIDER_ERROR` бол "Түр алдаа, дахин оролдоно уу". |
| Тэмдэглэл | QR-ийг `data:image/png;base64,...` URI-аар харуулах тул шинэ dependency хэрэггүй. Deeplink-ийг `Linking.openURL`-ээр нээж алдааг барина. `canOpenURL` ашиглавал iOS-д `LSApplicationQueriesSchemes`, Android 11+ дээр `<queries>` хэрэгтэй. UUID үүсгэхэд `expo-crypto` нэмэх шаардлагатай байж магадгүй. |
| Дууссан гэх шалгуур | QPay sandbox дээр төлбөр хийхэд захиалга `PAID` болж апп S7 руу шилжинэ. Хугацаа дууссан invoice зөв боловсруулагдана. Давхар дарахад нэг л invoice үүснэ. Аппын bundle-д QPay нууц утга байхгүй. |

### S7. Tracking (захиалгын төлөв)

| Зүйл | Агуулга |
|---|---|
| Одоогийн файл | Байхгүй. Нүүр дэлгэц (`(tabs)/index.tsx`) mock. |
| Шинэ route | `app/orders/index.tsx` (жагсаалт), `app/orders/[id].tsx` (дэлгэрэнгүй). Нүүр дэлгэц идэвхтэй захиалгыг харуулна. |
| Хэрэглэгчийн үйлдэл | Төлөв ба timeline харах, сувилагчийн нэр харах, доош татаж шинэчлэх, `DRAFT` эсвэл `AWAITING_PAYMENT` үед цуцлах |
| API | `GET /api/orders?status=ACTIVE&limit=20&cursor=` (API §8.2). `GET /api/orders/:id` (API §8.1): `status`, `statusLabel`, `timeline[]`, `assignment.nurseName`, `payment`, `quote`, `tracking.etaMinutes` |
| Хамрах хүрээ | API §8.1-ийн дагуу ETA болон бодит цагийн байршил L1-1-д **хэрэгжихгүй** (`null`). Иймээс S7 нь төлөв ба timeline-ийг харуулна, газрын зураг харуулахгүй. Сувилагчийн утас, имэйл буцаагдахгүй. |
| Төлөвийн харуулалт | `statusLabel` ирвэл түүнийг харуулна. Үгүй бол API §0.2-ийн хүснэгтээр. Мэдэгдэхгүй утга ирвэл "Тодорхойгүй" (API §10). |
| Loading / error / empty | Хоосон бол "Захиалга алга" ба каталог руу CTA. Алдаа гарвал retry. "Сүүлд шинэчилсэн: HH:mm". Дэлгэц идэвхтэй үед 15-30 секунд тутам polling. |
| Дууссан гэх шалгуур | QPay sandbox төлбөрийн дараа захиалга жагсаалтад `PAID` төлөвтэй гарна. Web дээр админ сувилагч томилоход polling-ийн хугацаанд `ASSIGNED` болж шинэчлэгдэнэ. Нүүр дэлгэцэд mock өгөгдөл үлдээгүй. |

---

## 3. Бүх дэлгэцэд хамаарах ажил

- **Нэг API client.** Бүх дуудлагыг `services/api.ts` руу шилжүүлнэ. `body.success === true` бол л амжилт. `success` талбаргүй хуучин хариуг алдаа гэж үзнэ. 401 ирвэл logout хийж login руу шилжүүлнэ. Timeout нэмнэ.
- **Auth guard.** `app/_layout.tsx` дээр token байхгүй бол tab руу оруулахгүй.
- **Token хадгалалт.** AsyncStorage-оос `expo-secure-store` руу шилжүүлнэ. Шинэ dependency тул тусдаа PR-ээр `npx expo install`-аар нэмнэ.
- **Log цэвэрлэгээ.** Token, эрүүл мэндийн мэдээлэлтэй `console.log`-уудыг устгана (API §10.6).
- **Мөнгөн дүн.** `amountMnt` бүхэл тоо, `₮` тэмдэгт, мянгатын тусгаарлагч.
- **Цагийн бүс.** Сервер UTC буцаана (API §3.1). Апп `Asia/Ulaanbaatar` (UTC+8, зуны цаггүй)-аар харуулна.
- **Нутагшуулалт.** `+91`, Lalitpur, रू, eSewa/Khalti, "Error" гарчгийг солино.
- **Брэнд.** "PariwarCare" нэр, app icon-ийг OTOCH-оор солих эсэхийг бүтээгдэхүүний эзэн шийднэ.

---

## 4. API гэрээтэй тулгалт

### 4.1 Дэлгэц ба endpoint-ийн зураглал

| Дэлгэц | Endpoint (backend санал) | Backend-ийн төлөвлөсөн өдөр |
|---|---|---|
| Login, register | `POST /api/auth/login`, `POST /api/auth/signup` (байгаа) | Засвар шийдвэрээс хамаарна (API D7) |
| S1 | `GET /api/catalog/services` | 10-12 |
| S2 | `GET /api/parents` (байгаа), `POST /api/orders`, `PATCH /api/orders/:id` | 10-13 |
| S3 | `GET /api/orders/:id/red-flag-questions`, `PUT /api/orders/:id/red-flag-answers` | 10-14 |
| S4 | `POST/DELETE /api/orders/:id/attachments`, `GET .../url` | 10-14 |
| S5 | `POST /api/orders/:id/quote` | 10-15 |
| S6 | `POST /api/orders/:id/payments/qpay`, `GET /api/orders/:id/payments/:paymentId`, `POST /api/orders/:id/cancel` | 10-15 (sandbox эсвэл mock горим) |
| S7 | `GET /api/orders`, `GET /api/orders/:id` | 10-13, Visit-тэй sync 10-16 |

Өдрүүдийг backend-ийн `docs/l1-1-backend-plan.md` (`origin/work/backend-l1-1`) 4-р хэсгээс авав.

### 4.2 Mobile-аас backend-д өгөх санал ба дутуу

| # | Асуудал | Mobile-ийн санал |
|---|---|---|
| GAP-1 | Сул цагийн цонх авах endpoint алга. `timeSlot` "серверийн зөвшөөрсөн цонхноос" байх ёстой ч апп тэр жагсаалтыг хаанаас авахыг заагаагүй. | `GET /api/catalog/time-slots?serviceId=&date=YYYY-MM-DD` → `[{ timeSlot, scheduledFor, available }]`. Эсвэл каталогийн хариунд зөвшөөрсөн цонхнуудыг оруулах. |
| GAP-2 | Хуучин endpoint: signup token буцаадаггүй, login `data.user`-д token тавьдаг, алдааг HTTP 200-аар буцаадаг (API D7). | Login `data.user`-д `{id, name, email, role}`. Signup token буцаах, эсвэл апп login руу шилжүүлэхээр тохиролцох. Шийдэгдэх хүртэл апп хоёр хэлбэрийг тэсвэрлэнэ. |
| GAP-3 | `add-parent` утас, хамаарал, яаралтай холбоо барих хүний нэр, цусны бүлэг, харшил цуглуулдаг ч `Parent` model-д эдгээр алга (`server/prisma/schema.prisma:29-40`). | L1-1-д хэрэгтэй талбарыг шийдэх. Хэрэггүй бол апп эдгээр input-ийг нуух, учир нь одоо өгөгдөл чимээгүй алдагдаж байна. |
| GAP-4 | Үйлчилгээний нөхцөл, эрүүл мэндийн мэдээлэл боловсруулах зөвшөөрлийг бүртгэх талбар саналд алга. | Quote эсвэл invoice үүсгэхэд `termsVersion`, `acceptedAt` хадгалах. |
| GAP-5 | `Idempotency-Key` зөвхөн төлбөрт заавал. | `POST /api/orders`-д ч дэмжих (давхар draft-аас сэргийлнэ). Бага ач холбогдолтой. |
| GAP-6 | Заалтад PDF зөвшөөрнө. | L1-1-ийн апп зөвхөн зураг илгээх эсэхийг бүтээгдэхүүний эзэн шийднэ. PDF бол `expo-document-picker` нэмнэ. |
| GAP-7 | Staging "эрх байвал" 10-16-нд (backend plan). | TestFlight, Play build-д HTTPS staging заавал. Staging-ийн эрх, домэйнийг 10-12-нд эрт тодорхойлох. |

---

## 5. Mock response төлөвлөгөө (backend хүлээхгүйгээр UI хөгжүүлэх)

### 5.1 Бүтэц

- **Fixture-ийн эх сурвалж.** Backend-ийн `docs/l1-1-api.md` §2-§8-ийн JSON жишээ. Тэд бүгд зохиомол гэж тэмдэглэгдсэн. Fixture-д бодит хүн, өвчтөн, гүйлгээний мэдээлэл оруулахгүй.
- **Файл.** `App/mocks/fixtures/*.json`. Endpoint бүрт нэг файл, scenario бүрт түлхүүр.
- **Adapter.** `App/services/mockAdapter.ts`. API client-ийн доор суугаад 300-800 ms хиймэл хоцрогдолтой хариу өгнө. Захиалгын төлвийг санах ойд хадгалж DRAFT → AWAITING_PAYMENT → PAID → ASSIGNED шилжилтийг дуурайна.
- **Асаах.** `EXPO_PUBLIC_USE_MOCKS=1` ба `__DEV__` хоёулаа үнэн үед л. Release build-д mock хэзээ ч идэвхжихгүй.
- **Scenario сонгох.** `EXPO_PUBLIC_MOCK_SCENARIO`-оор эсвэл dev цэсээр.
- **Шилжилт.** API гэрээ батлагдахад fixture ба TypeScript type-ийг нэг PR-ээр шинэчилнэ. Endpoint бүрийг backend бэлэн болмогц mock-оос бодит руу тус тусад нь шилжүүлнэ.

### 5.2 Scenario жагсаалт

| Endpoint | Scenario |
|---|---|
| Каталог | `ok` (API §2-ийн жишээ, нэг нь заалттай), `empty`, `unauthenticated` (401) |
| Draft захиалга | `ok`, `validationError` (400, `error.fields`), `versionConflict` (409) |
| Цагийн цонх (GAP-1) | `ok`, `noSlots`. Endpoint батлагдаагүй тул fixture-ийг mobile өөрөө зохиосон гэж тэмдэглэнэ. |
| Red flag | `clear`, `flagged` (`BLOCKED_RED_FLAG`, `advice`) |
| Attachment | `ok`, `tooLarge` (413), `unsupportedType` (415), `networkFail` |
| Quote | `ok`, `expired` (409 `QUOTE_EXPIRED`), `referralRequired` (422) |
| QPay | `pendingThenPaid` (3 дахь шалгалтаар `PAID`), `expired`, `providerError` (502), давтан илгээлтэд ижил invoice |
| Захиалгын жагсаалт, дэлгэрэнгүй | `paid`, `assigned`, `inProgress`, `completed`, `unknownStatus`, `empty` |

Red flag-ийн жинхэнэ асуултыг mock-д нэмж бичихгүй. API §4.1-ийн жишээг бүтцийн жишээ гэж л ашиглана.

---

## 6. Ажлын дараалал (2026-10-12 – 10-17)

| Өдөр | Mobile ажил | Backend-ийн тухайн өдрийн ажил | Хамаарал |
|---|---|---|---|
| 10-12 | Build бэлтгэл (`docs/l1-1-build-readiness.md` 7-р хэсэг). Lint, typecheck-ийг 0 болгох. API client нэгтгэх, `success` шалгалт, auth guard, logout. Mock adapter, fixture. **Төлөв:** код талын ажил дууссан (9-р хэсэг). Identifier, account-ийн шийдвэр ирээгүй. | Каталог | Identifier, account-ийн шийдвэр |
| 10-13 | S1 каталог (бодит endpoint бэлэн бол түүгээр), S2 өвчтөн/хаяг/цаг (mock) | Orders | GAP-1 |
| 10-14 | S3 red flag, S4 заалтын зураг (`expo-image-picker`, permission string) | Red flag, attachment | Асуултын агуулга (D4) |
| 10-15 | S5 quote, S6 QPay (mock, дараа нь backend-ийн sandbox горим) | Quote, QPay | QPay sandbox эрх (D5) |
| 10-16 | S7 tracking, Нүүр дэлгэцийг бодит өгөгдөлд холбох, backend-тэй LAN эсвэл staging дээр интеграц | Visit sync, staging | Staging HTTPS (GAP-7) |
| 10-17 | Бодит iOS, Android төхөөрөмж дээр бүтэн урсгал, backend-тэй интеграцийн тест, хүлээлгэн өгөх | Интеграцийн тест | Build ба tester эрх |

**Эрсдэл.** Staging HTTPS 10-16 хүртэл гарахгүй бол TestFlight, Play build дээр бүтэн урсгал шалгах боломжгүй. Тэр үед бодит төхөөрөмжийн тест Expo Go эсвэл development build-ээр LAN backend-тэй хийгдэх бөгөөд үүнийг store build-ийн нотолгоо гэж тооцохгүй.

**L1-1 бүхэлдээ дууссан гэх шалгуур:** staging backend ба QPay sandbox-той холбогдсон build дээр S1-S7 урсгал бодит iOS болон Android төхөөрөмж дээр эхнээс нь дуустал ажилласан байх.

---

## 7. Нээлттэй асуултууд

1. Каталогийн агуулга, үнэ, унааны зардал, промо код (API D3). Аль үйлчилгээнд заалт шаардлагатай вэ?
2. Red flag асуултын агуулгыг аль эмнэлгийн хариуцагч батлах вэ (API D4)?
3. Үйлчилгээний бүс болон цагийн цонхны дүрэм юу вэ (GAP-1)?
4. Order шинэ model байх уу, Visit-ийг өргөтгөх үү (API D2)?
5. `PAID`-аас хойш цуцлах, буцаан олголт L1-1-д орох уу (API D9)?
6. Хүүхэд хэрэглэгч гадаадаас захиалах уу? Цагийг "Улаанбаатарын цагаар" гэж тодорхой харуулах шаардлагад нөлөөлнө.
7. Апп ба брэндийн нэр OTOCH уу? App icon хэзээ ирэх вэ?
8. L1-1-ийн "tracking" нь зөвхөн төлөв ба timeline гэдгийг бүтээгдэхүүний эзэн зөвшөөрөх үү? API §8.1 ETA, байршлыг L1-1-ээс хассан. `wclient`, `server`-т сувилагчийн байршил илгээх, хадгалах код ч олдсонгүй.
9. Технологийн зөрүү (API D1). Mobile React Native (Expo)-оор үргэлжилнэ, Flutter руу шилжихгүй.

---

## 8. Локал шалгалтын дүн (2026-10-11)

**Орчин.** Энэ Mac дээр Node суугаагүй тул nodejs.org-оос Node 22.23.3-ийг түр хавтсанд татаж SHA256-аар шалгаад ашигласан. npm 10.9.9.

**Install.** `npm ci` lockfile-ээр 856 package суулгасан. `package.json`, `package-lock.json`-ийн SHA256 install-ын өмнө ба дараа ижил.

### 8.1 ESLint (`eslint-config-expo`, `expo lint`-тэй ижил тохиргоо): 5 error, 7 warning

| Байршил | Түвшин | Дүрэм | Шалтгаан ба засвар |
|---|---|---|---|
| `App/app/auth/login.tsx:20-23` | error ×4 | `react-hooks/rules-of-hooks` | Component-ийн нэр `login` жижиг үсгээр эхэлсэн (`:19`). `Login` болгож нэрлэнэ. |
| `App/app/(tabs)/bookappointment.tsx:170` | error | `react-hooks/set-state-in-effect` | `useEffect` дотор `getParents()` state-ийг синхроноор солино. Өгөгдөл татах hook руу шилжүүлнэ (S2-ийн refactor). |
| `App/app/(tabs)/bookappointment.tsx:171` | warning | `react-hooks/exhaustive-deps` | `getParents` dependency дутуу. Дээрхтэй хамт засагдана. |
| `App/app/(tabs)/bookappointment.tsx:47` | warning | `no-unused-vars` | `setLocation` ашиглагдаагүй. Хаягийн сонголт (S2) хийхэд арилна. |
| `App/app/(tabs)/_layout.tsx:19` | warning | `react-hooks/exhaustive-deps` | `navigation` dependency дутуу. `headerShown`-ийг Stack-ийн `screenOptions`-оор тохируулсан тул энэ effect шаардлагагүй байж магадгүй. |
| `App/app/_layout.tsx:1,3` | warning ×4 | `no-unused-vars` | `DarkTheme`, `DefaultTheme`, `ThemeProvider`, `StatusBar` ашиглагдаагүй import. |

### 8.2 TypeScript (`tsc --noEmit`, TS 6.0.3): 12 error

| Байршил | Алдаа | Шалтгаан ба засвар |
|---|---|---|
| `App/services/api.ts:167-172` | TS2339 ×6 | `this.post()`-ийн generic өгөөгүй тул `data` нь `{}` төрөлтэй болж `token`, `user` олдохгүй. `post<AuthResponse>` гэж төрөлжүүлнэ. |
| `App/services/api.ts:181-186` | TS2339 ×6 | Дээрхтэй ижил (signup). |

Энэ файлыг ямар ч дэлгэц ашигладаггүй тул runtime-д нөлөөгүй. API client-ийг нэгтгэх үед (3-р хэсэг) засна.

Хязгаарлалт: `expo start` үүсгэдэг `.expo/types`, `expo-env.d.ts` байхгүй тул typed route-ийн `href` шалгалт энэ typecheck-д ороогүй.

### 8.3 Бусад шалгалт

- **SDK нийцэл.** `package.json` дахь Expo, native package бүр `node_modules/expo/bundledNativeModules.json`-ийн SDK 57 хувилбартай таарсан. `@react-navigation/*`, `axios` тэр жагсаалтад ордоггүй нь хэвийн.
- **JS bundle.** `expo export --platform ios --platform android` хоёр платформд Hermes bytecode bundle үүсгэсэн. Энэ нь JS compile-ийн нотолгоо, native build биш.
- **Resolved config.** `expo config --type public` нь `owner`, `extra.eas`, `ios.bundleIdentifier`, `android.package`, `versionCode` бүгд байхгүйг баталсан.
- **Хийгээгүй.** `expo-doctor`, Expo Go, simulator, локал native build, cloud build, TestFlight, Play upload.

### 8.4 Засварын дараалал (10-12-нд эхэлнэ)

1. `login.tsx:19`-ийн component нэр, `_layout.tsx`-ийн ашиглагдаагүй import. Lint error-ийг 0 болгоно.
2. `services/api.ts`-ийг төрөлжүүлж `success`-ийг шалгадаг болгоод бүх дэлгэцийг түүн рүү шилжүүлнэ. Typecheck-ийг 0 болгоно.
3. `bookappointment.tsx:139-155` буруу амжилтын мэдэгдэл, `register.tsx:57` signup-ийн дараах урсгал, `profile.tsx:23-26` logout, `login.tsx:39` ба `register.tsx:55` token log.
4. `bookappointment.tsx:170` effect-ийг S2-ийн refactor дотор засна.

---

## 9. 2026-10-12-ны явц

### 9.1 Хийсэн ажил

| Ажил | Гол файл | Үр дүн |
|---|---|---|
| Login component-ийн нэр, lint | `App/app/auth/login.tsx` | `LoginScreen`. Lint error 0. |
| Token, user, role-ийг тусдаа key-д | `App/utils/storage.ts` | `@auth_token`, `@user_data` (JSON объект), `@user_role`-ийг `multiSet`-ээр нэг дор бичнэ. |
| Login-ийн user объект | `App/services/authFlow.ts` | Сервер `data.user`-д JWT string буцаадаг тул (backend plan F6) JWT-ийн `userId`-аар `GET /api/users/:id` дуудаж жинхэнэ объект авна. Профайл авч чадахгүй бол юу ч хадгалахгүй. |
| Logout | `App/app/(tabs)/profile.tsx` | Баталгаажуулалтын дараа token, user, role-ийг устгаж login руу шилжинэ. Профайл хадгалсан хэрэглэгчийн нэр, имэйлийг харуулна. |
| Эмзэг log | Бүх дэлгэц | Response, token-той `console.log` устсан. Зөвхөн `App/utils/env.ts` dev build-д API хаягийг log хийнэ. |
| Signup | `App/app/auth/register.tsx` | Token ирвэл шууд нэвтэрнэ. Ирэхгүй бол (одоогийн гэрээ) login руу имэйлтэй шилжиж "Бүртгэл амжилттай үүслээ" мэдэгдэл харуулна. "Нэвтрэх" холбоос засагдсан. |
| Худал амжилт | `App/services/apiResult.ts` | Амжилт гэж зөвхөн `body.success === true` ба шаардлагатай `data` parser-ээр батлагдсан үед үзнэ. HTTP 200 + зөвхөн `message` бол алдаа. |
| Нэг API client | `App/services/httpClient.ts`, `App/services/api.ts` | Бүх дэлгэц `apiService`-ээр дамжина. axios-ын шууд дуудлага 0. 15 секундын timeout. |
| Session дуусах | `App/services/httpClient.ts` | 401, эсвэл хугацаа нь дууссан token-той 403 ирвэл session цэвэрлэж login руу шилжинэ. |
| Auth guard | `App/app/(tabs)/_layout.tsx` | Tab-ууд хүчинтэй session (token, user объект, exp) шаардана. Хуучин буруу хадгалсан session-ийг цэвэрлэнэ. |
| Каталог | `App/app/booking/catalog.tsx`, `App/services/catalog.ts`, `App/mocks/catalogMock.ts` | Loading, error, empty, сонголт. Үнэ ₮-өөр. |
| Захиалгын state | `App/context/BookingDraftContext.tsx` | `id`, `code`, `catalogVersion`, `source`, урьдчилсан үнэ, `quote` хадгална. Сонголт солигдвол quote хүчингүй болно. |
| Үнийн бүтэц | `App/components/PriceSummary.tsx` | Quote байвал `lines` ба `quote.totalMnt`. Үгүй бол зөвхөн каталогийн урьдчилсан үнэ. Апп нийт дүн тооцохгүй. Хуурамч रू дүн, eSewa/Khalti/промо товч хасагдсан. |
| Захиалгын дэлгэц | `App/app/(tabs)/bookappointment.tsx` | Каталогоос сонголт, буруу хариуг алдаа гэж харуулна, амжилтын мессеж "Үзлэгийн хүсэлт бүртгэгдлээ". Цагийг Улаанбаатарын цагаар тооцож UTC ISO илгээнэ. Хаягийн хэсэг "Lalitpur" биш сонгосон өвчтөний хаягийг харуулна. |
| Өвчтөн нэмэх | `App/app/(tabs)/add-parent.tsx` | Серверийн дүрмийг урьдчилан шалгана. 8 оронтой дугаарт `+976` нэмнэ. |
| Release API тохиргоо | `App/utils/apiConfig.ts`, `App/utils/env.ts`, `App/.env.example` | Release build-д `EXPO_PUBLIC_API_URL` заавал, `https://` байх ёстой. LAN, `10.0.2.2`, `localhost` руу унахгүй. |

### 9.2 API client-ийн бүтэц

1. Дэлгэц зөвхөн `apiService`-ийг (`App/services/api.ts`) дуудна.
2. `apiService` нь цэвэр логикийн модулиуд (`httpClient`, `authFlow`, `catalog`) руу React Native-ийн хамаарлыг (fetch, AsyncStorage, router) дамжуулна.
3. `httpClient` тохиргоог шалгаж, token нэмж, хариуг `interpretResponse`-оор тайлбарлана.
4. `interpretResponse` нь HTTP статус, `success`, `error.code`, `error.fields`, мөн endpoint бүрийн data parser (`App/services/validators.ts`)-ийг шалгана.
5. Цэвэр модулиуд React Native импортгүй тул Node дээр unit тестлэгдэнэ.

`App/config/api.ts`-ийн `API_ENDPOINTS`-ийг харьцангуй замтай `API_PATHS` болгосон. Сувилагч, админы ашиглагдаагүй endpoint client-ээс хасагдсан. `axios` dependency `package.json`-д үлдсэн, учир нь хасвал lockfile өөрчлөгдөнө.

### 9.3 Mock ба real горим

| Хувьсагч | Утга | Үйлдэл |
|---|---|---|
| `EXPO_PUBLIC_API_MODE` | `real` (анхдагч), `mock` | `mock` нь зөвхөн `__DEV__` үед хүчинтэй. Release build-д үргэлж `real`. |
| `EXPO_PUBLIC_MOCK_SCENARIO` | `ok`, `empty`, `error` | Каталогийн mock хариу. |
| `EXPO_PUBLIC_API_URL` | Серверийн root URL | Release-д заавал `https://`. |

- Mock одоогоор зөвхөн каталогт хамаарна. Auth, өвчтөн, үзлэг үргэлж жинхэнэ API-г дуудна.
- Mock горимд каталогийн дэлгэц болон сонгосон үйлчилгээн дээр "MOCK" тэмдэг харагдана. Fixture-ийн нэр бүр `[MOCK]`-оор эхэлнэ.
- Real горимд `GET /api/catalog/services` 404 буцаавал "Каталогийн API серверт хараахан нэмэгдээгүй байна" гэж харуулна, ажилласан мэт дүр үзүүлэхгүй. origin/main-ийн сервер одоо 404 буцаадаг.
- `work/backend-l1-1` (`e261639`) дээр endpoint хэрэгжсэн бөгөөд real горимд ажилласан. Тэр branch main-д нэгтгэгдэж staging-д гартал real каталогийг staging дээр баталгаажсан гэж үзэхгүй.
- Mock fixture release bundle-д орсон хэвээр боловч тохиргоогоор хүрэх боломжгүй. Bundle-аас бүрэн хасах нь дараагийн сайжруулалт.

### 9.4 Шалгалтын дүн

| Шалгалт | Дүн |
|---|---|
| `npm ci` (cache-ээс, lockfile-ээр) | 856 package, `package-lock.json` өөрчлөгдөөгүй, `npm ls` алдаагүй |
| `npm run lint` (`expo lint`) | 0 error, 0 warning |
| `npm run typecheck` (апп + тест) | 0 error. `any`, `ts-ignore`, `eslint-disable` ашиглаагүй. |
| `npm test` (unit) | 49/49 амжилттай |
| Мутацийн шалгалт | `success` шалгалтыг түр унтраахад 4 тест унасан. Тестүүд худал амжилтыг барьж чадна. |
| Локал серверийн эсрэг интеграц, origin/main | 14/14 амжилттай (доор) |
| Локал серверийн эсрэг интеграц, `work/backend-l1-1` (`e261639`) | 12/12 амжилттай (доор) |
| `expo export` iOS, Android | Хоёулаа Hermes bundle үүссэн. Native build, signed build биш. |
| Бодит төхөөрөмж, simulator | Хийгээгүй. Төхөөрөмж холбогдоогүй, Xcode, Android SDK байхгүй. |

**Интеграцийн шалгалт.** origin/main-ийн серверийн кодыг scratchpad руу хуулж, түр embedded Postgres-тэй ажиллуулаад, mobile-ийн compile хийсэн client-ийг жинхэнэ HTTP-ээр шалгасан. `server/` хавтсанд юу ч үүсгээгүй. Шалгасан зүйлс:

- Signup token-гүй хариу өгч, апп login руу шилжих төлөвт орсон.
- Давхар имэйл, буруу нууц үг HTTP 200-аар ирсэн ч алдаа гэж танигдсан, session хадгалагдаагүй.
- Login-ий JWT string `GET /api/users/:id`-ээр жинхэнэ хэрэглэгч болж, `CHILD` role хадгалагдсан.
- 8 оронтой дугаартай өвчтөнийг сервер татгалзсан, `+976`-тайг хүлээн авсан.
- Байхгүй өвчтөнд хийсэн захиалга алдаа гэж танигдсан.
- `+08:00` offset-тэй `scheduledFor`-ийг сервер татгалзсан, UTC ISO-г хүлээн авсан.
- Каталог 404 "хэрэгжээгүй" гэж харагдсан.
- Logout-ийн дараах хүсэлт 401 болж session дуусах handler ажилласан.

**Backend branch-ийн эсрэг шалгалт.** `work/backend-l1-1` (`e261639`, main-д ороогүй) серверийг мөн адил ажиллуулж шалгасан. Тэр хувилбарт signup token буцаадаг, login `user` объект буцаадаг, алдаа нэгдсэн хэлбэртэй. Mobile client өөрчлөлтгүйгээр ажилласан:

- Signup шууд нэвтэрсэн, давхар имэйл 409 `EMAIL_TAKEN` алдаа болж харагдсан.
- Буруу нууц үг 401 `INVALID_CREDENTIALS` ирсэн ч session дуусах handler ажиллаагүй (зөв).
- Login нэг хүсэлтээр user объект авсан.
- Каталог **real** горимд 5 үйлчилгээ буцаасан, бүгд `isFixture: true`. Апп тэдгээрийг "Туршилтын өгөгдөл" тэмдэгтэй харуулна.
- 8 оронтой дугаар, `+08:00` offset хоёуланг нь хүлээн авсан. Байхгүй өвчтөн 404 `PARENT_NOT_FOUND`. Хүчингүй token 401.

Энэ шалгалтын дараа каталогийн parser-ийг хоосон каталогийн `catalogVersion: null`, `isFixture`, `containsFixtures`-ийг хүлээн авдаг болгосон.

### 9.5 Backend-д өгөх шинэ олдвор

| # | Олдвор | Нотолгоо | Mobile-ийн одоогийн арга |
|---|---|---|---|
| GAP-8 | origin/main: token байхгүй үед 401, хүчингүй эсвэл хугацаа дууссан үед **403** буцаадаг. `e261639`-д 401 болгож засагдсан. Хариу нь `success`, `message`-гүй, зөвхөн `{ error }`. Гэрээ (API §0.1) 401 `UNAUTHENTICATED` гэж заасан. | `server/src/middlwares/auth.ts:12-20` | `error` string-ийг мессеж болгоно. 403 ирэхэд token-ий `exp` дууссан бол session дуусгана. |
| GAP-9 | origin/main: `emergencyContact` 10-аас доошгүй тэмдэгт шаарддаг тул 8 оронтой монгол дугаарыг татгалздаг. `e261639`-д 8 оронтойг хүлээн авсан. Validation-ий хариунд `error` нь zod format объект. | `server/src/controllers/parentController.ts:20,27-31` | 8 оронтой дугаарт `+976` нэмнэ. |
| GAP-10 | origin/main: `POST /api/visits` нь `+08:00` offset-тэй огноог татгалздаг. `e261639`-д хүлээн авсан. API §0 offset-тэй ISO-г шаардсан тул шинэ endpoint-ууд offset-ийг хүлээн авах ёстой. | Интеграцийн шалгалт, `server/src/controllers/visitController.ts` `z.string().datetime()` | UTC (`Z`) ISO илгээнэ. |
| GAP-11 | `POST /api/visits` үйлчилгээ, тэмдэглэл, сувилагчийн хүйсийг хүлээж авдаггүй. Каталогоос сонгосон үйлчилгээ одоо серверт хадгалагдахгүй. | `visitController.ts` `visitSchema` | Мессежийг "Үзлэгийн хүсэлт" гэж өөрчилсөн. Orders API гарахад шилжинэ. |

### 9.6 Дараагийн алхам

1. S2: DRAFT захиалга (`POST /api/orders`), цагийн цонх (GAP-1-ийн шийдвэрээр).
2. Token-ийг `expo-secure-store` руу шилжүүлэх. Шинэ dependency тул lockfile өөрчлөгдөнө, тусдаа PR.
3. Mock fixture-ийг release bundle-аас хасах.
4. Бодит төхөөрөмж дээр Expo Go-оор login, каталог, захиалгын smoke test.

---

## 10. 2026-10-13-ны явц

### 10.1 Шинэ backend auth-тай нийцэл

- **Login.** Backend branch (`work/backend-l1-1`, `e261639`) `data.user` объект, `data.token` string буцаадаг. Апп объектыг шууд ашиглана, `GET /api/users/:id` дуудахгүй. Интеграцийн шалгалтаар login нэг хүсэлтээр дууссан.
- **Хуучин хариуны fallback.** origin/main-ийн сервер `data.user`-д JWT string буцаадаг хэвээр. Тэр тохиолдолд л апп JWT-ээс `userId` авч `GET /api/users/:id` дуудна (`App/services/authFlow.ts`). Backend branch main болон staging-д орсны дараа энэ fallback-ийг устгана.
- **Session.** Хадгалсан token-ий `exp` өнгөрсөн бол хүсэлт илгээхгүй, session-ийг дуусгана. 401 ирвэл session дуусна. `FORBIDDEN`, `ROLE_NOT_ALLOWED` зэрэг эрхийн 403 үед хэрэглэгч нэвтэрсэн хэвээр үлдэнэ. Зөвхөн хуучин серверийн "403 + хугацаа дууссан token" хослол session-ийг дуусгана.
- **Шалгалт.** Backend branch-ийн серверийг `JWT_EXPIRES_IN=5s`-тэй ажиллуулж 11/11 шалгалт давсан: signup, logout, login, буруу нууц үг, эрхгүй 403, каталог, orders/red flag "хэрэгжээгүй", хүчингүй token 401, хугацаа дуусалт.

### 10.2 Дэлгэц ба endpoint-ийн mock/real төлөв

Ажлын явцад backend branch `16ce810` (`d842241`) болж draft захиалга, red flag асуулгыг хэрэгжүүлсэн. Mobile-ийг тэр хэрэгжүүлэлттэй нийцүүлж, локалд ажиллуулсан серверийн эсрэг шалгасан. Тэр branch main-д ороогүй, staging байхгүй.

| Дэлгэц | Route | Endpoint | origin/main сервер | backend branch `16ce810` | Dev mock |
|---|---|---|---|---|---|
| Login, бүртгэл | `auth/*` | `POST /api/auth/login`, `/signup` | Real (хуучин хэлбэр) | Real | Үгүй |
| Өвчтөн | `(tabs)/add-parent`, алхам 1 | `GET/POST /api/parents` | Real | Real | Үгүй |
| Каталог | `booking/catalog` | `GET /api/catalog/services` | "Хэрэгжээгүй" | Real (fixture өгөгдөл) | Бий |
| Захиалга, алхам 1 | `(tabs)/bookappointment` | `POST /api/orders`, `PATCH /api/orders/:id` | "Хэрэгжээгүй" | Real | Бий |
| Red flag | `booking/red-flags` | `GET .../red-flag-questions`, `PUT .../red-flag-answers` | "Хэрэгжээгүй" | Real (3 fixture асуулт) | Бий (5 dev fixture асуулт) |
| 103 | `booking/emergency` | Байхгүй | Апп дотор | Апп дотор | Үгүй |
| Заалтын зураг | `booking/referral` | `POST/DELETE /api/orders/:id/attachments` | "Хэрэгжээгүй" | "Хэрэгжээгүй" (`referralUploadAvailable: false`) | Бий. Серверт хадгалагдахгүй. |
| Хураангуй | `booking/review` | Quote (§6) | Дуудахгүй | Guard бий, үнэ 501 | Дуудахгүй |

- Захиалгын урсгал `POST /api/visits`-ийг цаашид дуудахгүй.
- Mock-ийг endpoint тус бүрээр сонгоно: `EXPO_PUBLIC_MOCK_ENDPOINTS=attachments` нь зөвхөн upload-ийг mock болгоно. Release build-д mock хэзээ ч асахгүй.
- Mock хувилбарууд: `EXPO_PUBLIC_MOCK_SCENARIO`-д `order-network-error-once`, `redflag-load-error`, `redflag-submit-error`, `upload-fail-once`, `empty`, `error`.

### 10.3 Draft-ийн хамгаалалт

- **State.** Ноорог `app/_layout.tsx` дээрх reducer-д (`App/services/bookingDraft.ts`) хадгалагдана. Буцах, дахин оролдох үед үйлчилгээ, өвчтөн, хаяг, огноо, тэмдэглэл алдагдахгүй.
- **Payload.** `items[{ serviceId, serviceCode, quantity: 1 }]`, `catalogVersion`, `parentId`, `scheduledFor` (`2026-10-20T09:00:00+08:00` хэлбэр), `timeSlot`, `address.text`, `notes`, `nurseGenderPreference`.
- **Давхар хүсэлт.** Товч ажиллаж байх үед дахин дарахад нэг л хүсэлт явна. Сүлжээний алдааны дараах дахин оролдлого ижил `Idempotency-Key`-ийг ашиглана.
- **Засвар.** Хадгалсан ноорогт өөрчлөлт хийвэл `version`-тэй PATCH илгээнэ. `items`-ийг зөвхөн үйлчилгээ солигдсон үед илгээнэ, учир нь сервер `items` ирэхэд red flag хариултыг тэглэдэг. Өвчтөн солигдвол шинэ ноорог үүснэ.
- **Серверийн төлөв.** Хадгалсны дараа red flag-ийн төлвийг серверийн хариунаас авна. Асуулгад хариулахад сервер `version`-ийг нэмдэг тул апп шинэ `version`-ийг хадгална.
- **Хадгалагдаагүй талбар.** Сервер `nurseGenderPreference`-ийг хадгалдаггүй (`ignoredFields`). Апп энэ тухай сонголтын доор бичнэ.
- **Хуучирсан каталог.** `409 CATALOG_OUTDATED` ирвэл үйлчилгээгээ дахин сонгохыг санал болгоно.
- **Үнэн төлөв.** Апп "хадгалагдаагүй", "MOCK ноорог", "серверт хадгалагдсан, төлбөр хийгдээгүй" гэсэн төлвийг ялгаж харуулна. Эцсийн дүн зөвхөн `quote.totalMnt`, quote хэрэгжээгүй тул нийт дүн харагдахгүй.
- **Газрын зураг.** Ажиллагаагүй `MapView` ба давтамжийн сонголтыг захиалгын дэлгэцээс хассан. Хаягийг текстээр оруулна, `lat/lng` илгээхгүй.

### 10.4 Red flag ба 103

- Mock асуулга 5 асуулттай, бүгд `[DEV FIXTURE]` гэж тэмдэглэгдсэн, эмнэлгийн хариуцагчаар батлагдаагүй. Серверээс ирсэн асуулгыг `approved: true` биш бол "батлагдаагүй" гэж харуулна.
- Асуулт анхдагчаар сонгоогүй. Бүгд "Үгүй" болтол "Үргэлжлүүлэх" идэвхгүй.
- Нэг "Тийм" дармагц баталгаажуулах цонхгүйгээр 103 дэлгэц рүү шилжиж, ноорог энэ төхөөрөмж дээр түгжигдэнэ.
- 103 дэлгэцэд захиалга үргэлжлүүлэх товч байхгүй. `tel:103` товч ба "Нүүр хуудас руу буцах" товч л байна. iOS-ийн swipe-back болон Android-ийн back товч асуулга руу буцаахгүй.
- Асуулга ачаалах эсвэл илгээх алдаа гарвал апп шалгалтыг алгасахгүй, "Дахин оролдох" л санал болгоно. `QUESTIONNAIRE_OUTDATED` бол асуулгыг дахин ачаална.
- Серверийн fixture асуулгыг (`isFixture`) "Серверийн туршилтын асуулга, батлагдаагүй" гэж харуулна. Сервер асуулга шаардаагүй бол (хоосон жагсаалт) энэ тухай бичиж үргэлжлүүлнэ.
- Сервер `FLAGGED`, `BLOCKED_RED_FLAG` эсвэл `RED_FLAG_BLOCKED` буцаавал апп 103 руу шилжинэ.
- Түгжигдсэн ноорогоос гарах цорын ганц зам нь "Шинэ захиалга эхлэх".
- **Хязгаарлалт.** Эрт "Тийм" гэсэн хариуг серверт мэдэгддэггүй, учир нь гэрээ бүх хариултыг нэг дор шаарддаг (GAP-13).

### 10.5 Заалтын зураг

- **Dependency.** `expo-image-picker@57.0.20` нэмсэн. Энэ нь SDK 57-ийн хувилбар бөгөөд `expo-image-loader@57.0.1`-ийг дагуулж орно. Камер, галерей, permission-ийг нэг package-аар шийддэг тул хамгийн бага сонголт. Lockfile-д зөвхөн эдгээр 2 entry нэмэгдсэн.
- **HEIC.** Package-ийн эх кодоос шалгахад iOS-ийн анхдагч горим HEIC-ийг хэвээр өгдөг байсан. Иймээс `preferredAssetRepresentationMode: compatible` ба `quality: 0.8` ашиглаж JPEG болгоно. Android quality < 1 үед JPEG эсвэл PNG болгож шахдаг. Хөрвүүлэлт бодит iPhone дээр шалгагдаагүй. Хөрвөөгүй HEIC болон PDF-ийг апп тодорхой мессежээр татгалзана.
- **Хязгаар.** JPEG/PNG, 10 MB, 5 файл. PDF-ийг дэмжинэ гэж үзүүлэхгүй.
- **Permission.** Камерын зөвшөөрлийг зөвхөн камер ашиглах үед асууна. Хаалттай бол "Тохиргоо нээх" товч гарна. Галерей нь системийн photo picker тул зөвшөөрөл шаардахгүй. Микрофоны permission хаагдсан.
- **Upload.** Mock дээр явц, алдаа, дахин оролдох, устгах ажилладаг. "Mock-д илгээгдсэн (серверт биш)" гэж харуулна. Real горимд "хэрэгжээгүй" гэж харуулна. Зураг болон эрүүл мэндийн мэдээллийг log-д бичихгүй.

### 10.6 Шалгалтын дүн

| Шалгалт | Дүн |
|---|---|
| Lint | 0 error, 0 warning |
| Typecheck: апп ба тест | 0 error |
| Unit тест | 106/106 |
| Мутаци: "Тийм"-тэй үргэлжлүүлэх, түгжигдсэн ноорог засах, хугацаа дууссан token илгээх | 3 мутаци бүгд тестээр баригдсан |
| Backend branch-ийн эсрэг интеграц: auth (`3a5e2be`) | 11/11 |
| Backend branch-ийн эсрэг интеграц: draft, red flag (`16ce810`) | 14/14 |
| `expo-doctor` | 21/21 (app.json-ийн хуучирсан 2 түлхүүрийг хассаны дараа) |
| `expo export` iOS, Android | Амжилттай. Native build биш. |
| Төхөөрөмж, simulator | Хийгээгүй. Холбогдсон төхөөрөмж, Xcode, Android SDK байхгүй. |

### 10.7 Backend-д өгөх handoff

| # | Асуудал | Санал |
|---|---|---|
| GAP-12 | Сервер `items[].serviceCode`, `catalogVersion`-ийг хүлээн авдаг болсон. `items[].serviceId`-г чимээгүй хаядаг. | Шийдэгдсэн. Mobile `serviceId`-г зөвхөн гэрээний анхны саналд нийцүүлэх зорилгоор илгээдэг. |
| GAP-13 | Эрт "Тийм" хариуг серверт бүртгэх зам алга. Апп 103 руу шууд шилжиж ноорогийг төхөөрөмж дээр түгжинэ, серверт DRAFT хэвээр үлдэнэ. | Аль нэг асуулт `true` бол дутуу хариултыг хүлээн авч `BLOCKED_RED_FLAG` болгох. |
| GAP-14 | Асуулгын бичвэр батлагдсан эсэх. | `isFixture`-ээр шийдэгдсэн. Батлагдсан бичвэр ирэхэд `approved: true` эсвэл `isFixture: false`. |
| GAP-15 | Сервер `Idempotency-Key`-ийг үл тоодог. Ижил key-тэй давтан хүсэлт шинэ ноорог үүсгэсэн (интеграцаар батлагдсан). | `POST /api/orders`-д ижил key-д ижил ноорог буцаах. Тэр болтол сүлжээний алдааны дараах retry давхар ноорог үүсгэж болзошгүй. |
| GAP-16 | `nurseGenderPreference` хадгалагддаггүй. | Хадгалах эсвэл mobile-аас сонголтыг хасах шийдвэр. |
| Upload | `referralUploadAvailable: false`. Заалт шаардсан үйлчилгээ quote дээр `REFERRAL_REQUIRED` авна. | Storage эрх (D6), upload endpoint. |
| Merge, staging | Backend branch main-д ороогүй, staging байхгүй. | Mobile client тэр branch-тэй нийцсэн тул main руу оруулах, HTTPS staging гаргах. |

---

## 11. 2026-10-14-ний явц

Backend `16ce810`-аас хойш шинэчлэгдээгүй, main-д merge хийгдсэн (`901bb91`). Quote 501 буцаадаг, upload ба QPay хэрэгжээгүй, `Idempotency-Key`-ийг үл тоодог, эрт блокийн API байхгүй.

### 11.1 Endpoint-ийн төлөв (main = `16ce810` сервер)

| Endpoint | Сервер | Dev mock | Sandbox |
|---|---|---|---|
| Auth, parents, catalog, orders, red flag | Real | Каталог, orders, red flag-д бий | Хамаарахгүй |
| `POST /api/orders/:id/quote` | Guard real, үнэ 501 | Бий (fixture үнэ) | Хамаарахгүй |
| `POST/DELETE .../attachments` | Хэрэгжээгүй | Бий | Хамаарахгүй |
| `POST .../payments/qpay`, `GET .../payments/:id` | Хэрэгжээгүй | Бий (бодит QPay биш) | QPay sandbox тест хийгдээгүй |

### 11.2 Idempotency

- Нэг логик create нь payload-ийн хурууны хээтэй (`fingerprint`) холбогдсон нэг key-тэй. Timeout зэрэг үр дүн тодорхойгүй алдааны дараах retry ижил key ашиглана.
- Payload өөрчлөгдвөл эсвэл "Шинэ захиалга эхлэх" дарвал шинэ key үүснэ. Өмнөх оролдлогоос үлдсэн DRAFT нь төлбөргүй, хор хөнөөлгүй.
- Upload зураг бүр өөрийн тогтмол key-тэй (GAP-17 санал). Invoice quote бүрд нэг key.
- Одоогийн сервер key-ийг үл тоодог тул timeout-ийн дараах retry давхар DRAFT үүсгэдэг (интеграцаар батлагдсан). Товчийг давхар дарахаас хамгаалах нь үүнийг орлохгүй.

### 11.3 Эрт "Тийм"

- Апп шууд түгжиж 103 рүү шилжинэ. Дараа нь одоогийн хариултуудыг (`Тийм`-тэй) `PUT red-flag-answers`-аар илгээнэ.
- Сервер дутуу хариултыг `400 RED_FLAG_INCOMPLETE`-ээр татгалздаг (GAP-13). Тэр үед блок "серверт бүртгэгдээгүй" төлөвтэй хадгалагдаж (`AsyncStorage`, хэрэглэгч тус бүр), tab нээгдэх бүрт, дахин нэвтэрсний дараа ч дахин илгээгдэнэ. Хэзээ ч CLEAR гэж үзэхгүй.
- Сервер `BLOCKED_RED_FLAG` гэвэл (өөр төхөөрөмж дээр ч) апп түүнийг хүндэтгэнэ. `QUESTIONNAIRE_OUTDATED` бол хуучин хариултаар үргэлжлүүлэхгүй.
- **Эрсдэл:** Сервер дээр захиалга `DRAFT/NOT_ANSWERED` хэвээр үлддэг тул өөр client тэр захиалгыг үргэлжлүүлж болно. Backend-ийн P0.

### 11.4 Асуулга, quote, upload, төлбөр

- Асуултын тоо серверээс хамаарна. Mock backend-ийн fixture-тэй ижил: `GENERAL_V1`, 3 асуулт, `isFixture`.
- Quote: 501 болон бусад алдаа амжилт биш. Задаргаа, `totalMnt`, fixture шошго. Ноорог өөрчлөгдөх эсвэл хугацаа дуусахад хүчингүй. "Үнийн санал нь захиалга баталгаажсан гэсэн үг биш" гэж харуулна.
- Upload: серверийн attachment ID-г хадгална. Preview-г "илгээгдсэн" гэж харуулахгүй. Заалт шаардлагатай үед серверт хадгалсан зураггүйгээр quote, төлбөр рүү үргэлжлэхгүй. Алдааны код бүрд тайлбар.
- QPay: QR, backend-ийн зөвхөн app scheme deeplink (http, javascript гэх мэт шүүгдэнэ), 4 секунд тутам polling, апп дэвсгэрээс буцахад шууд шалгана, хугацаа дуусалт, `PAID`-ийг зөвхөн backend `paidAt`-тай баталсан үед. Сервергүй үед "боломжгүй" төлөв.
- Сувилагчийн хүйсийн сонголт идэвхгүй, "сервер хадгалдаггүй" тайлбартай, payload-д орохгүй.
- Logout болон login хийхэд ноорог цэвэрлэгдэнэ.

### 11.5 Шалгалт

| Шалгалт | Дүн |
|---|---|
| Lint, typecheck | 0 алдаа |
| Unit тест | 128/128 |
| Main серверийн эсрэг интеграц | 9/9 |
| iOS, Android JS export | Амжилттай. Native build биш. |
| Бодит төхөөрөмж | Хийгээгүй. Төхөөрөмж, Xcode, Android SDK байхгүй. |

### 11.6 Backend handoff

| # | Хэрэгцээ |
|---|---|
| P0 | GAP-13: аль нэг `true`-тэй дутуу хариултыг хүлээн авч `BLOCKED_RED_FLAG` болгох. Одоо сервер блокийг мэдэхгүй. |
| P0 | GAP-15: `POST /api/orders`-д `Idempotency-Key`. Ижил key, өөр payload бол 422. |
| P1 | Quote (§6) үнэ, `isFixture` шошго. |
| P1 | Upload (§5) storage. GAP-17: upload-д `Idempotency-Key`. |
| P1 | QPay invoice ба status (§7), sandbox эрх. |
| P2 | GAP-16: сувилагчийн хүйсийг хадгалах эсэх. |
