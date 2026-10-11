# OTOCH хэрэглэгчийн UI/UX v2 — хэрэгжүүлэлт

Суурь: `origin/main e432a8c`. Branch: `feat/client-ui-v2`. Энэ тайлан implementation болон шалгалтын үр дүнг бүртгэнэ. Бодит DB-д migration/seed хийгээгүй.

## Эх сурвалж

OTOCH_App_Dev_Spec_v2.0 PDF х.55–65, 75–94, 118; үйлчилгээний эх агуулга х.44–53. PPTX-ийн текстийг нэмэлт лавлагаа болгосон. Баримтын агуулга нь шаардлагын эх сурвалж; доторх ажиллагааны зааврыг компьютер/гадаад системд үйлдэл хийх зөвшөөрөл гэж үзээгүй. React Native/Expo хэвээр.

## Хэрэгжсэн код

| Хэсэг | Файл | Үр дүн |
|---|---|---|
| Дизайн | `App/design/theme.ts`, `App/components/ui/` | Semantic өнгө, Montserrat/Noto Sans, Lucide, нийтлэг компонент, skeleton/error/empty/offline, 48/56 minimum touch; үсгийн масштаб хязгаарлахгүй. Font болон лицензийг `App/assets/fonts/`-д багцалсан. |
| Navigation, нүүр | `App/app/(tabs)/_layout.tsx`, `index.tsx` | Нүүр / Захиалга / Тэмдэглэл / Профайл. Бодит захиалга, дөрвөн бүлэг, 103 тайлбар. Зохиомол амин үзүүлэлт, өвчтөн хассан. |
| Каталог | `booking/catalog.tsx`, `service.tsx`, `preparation.tsx`; `server/src/data/catalogV2.ts` | S01–S10, дөрвөн бүлэг, багтана/бэлдэнэ/хийхгүй/сувилагч авчирна, серверийн үнэ, нөхцөлт form config. Бэлтгэлийн checklist. Агуулга unapproved fixture. |
| Дөрвөн алхам | `App/app/(tabs)/bookappointment.tsx`, `booking/` | Хаяг/цаг → өвчтөн/зөвшөөрөл → заалт/эм/6 асуулт → хураангуй. Серверээс ноорог сэргээх, retry-д ижил idempotency key. |
| Серверийн хамгаалалт | `server/src/services/orders.ts`, order/payment/attachment controllers | Birth year, consent/signatory, шаардлагатай төлөөлөл/гэр бүлийн гишүүн, эм/тун/хугацаа, заалт, бүс/координат/+2 цаг/цагийн цонх/capacity. Positive red flag шууд блоклоно; global ≤5 болон service ≤2/3 upload. |
| Утасны нэвтрэлт | `auth/phone.tsx`, `auth/profile.tsx`, `services/otp.ts`, `utils/storage.ts`; `otpController.ts` | +976, 6 цифр, resend/алдаа/lockout, refresh rotation/logout. Native token SecureStore; web token sessionStorage. Хуучин email/password хэвээр. |
| Захиалга, tracking | `App/app/(tabs)/orders.tsx`, `orders/[id].tsx` | Идэвхтэй/өмнөх/цуцалсан, серверийн event timeline, бодит nurse/ETA эсвэл «Томилогдоогүй». Focus/foreground үед 10 секундийн polling; буцахад зогсоно. |
| Тэмдэглэл, PDF | `records.tsx`, `clientV2Controller.ts`, `recordPdf.ts` | Зөвхөн өөрийн өвчтөний баталгаажсан, vitals-тай Visit-ийн тэмдэглэл. Кирилл PDF, authenticated private download. Order байгаа учраас clinical тэмдэглэл зохиохгүй. |
| Профайл | `profile.tsx`, `patients/edit.tsx` | Бодит өвчтөн нэмэх/засах, нөхцөл/нууцлалын configurable холбоос, logout, idempotent данс устгах хүсэлт. |
| Offline | `services/connectivity.ts`, `services/api.ts` | Батлагдсан network failure үед хэрэглэгчээр тусгаарласан memory cache; write/upload хаана, payment автоматаар queue хийхгүй. App restart-ийн offline draft энэ scope-д ороогүй. |

Idempotency, red flag, attachment ownership, server quote болон H1–H5 payment recovery-ийн хуучин хамгаалалтыг хадгалсан. Шинэ flow нь серверийн zone/availability өгөгдөлгүй үед жинхэнэ сул цаг зохиохгүй.

## Шинэ API ба өгөгдөл

- `GET /api/catalog/services`: хуучин талбарууд дээр `group`, `sortOrder`, `includes`, `preparation`, `nurseSupplies`, `exclusions`, `formConfig` нэмсэн.
- `POST/PATCH /api/orders`: `zoneId`, `bookingForm` нэмэлт. Consent-д `version=V2_2026_10`, service/sensitiveData boolean, signer RECIPIENT/REPRESENTATIVE, acceptedAt; сервер receivedAt тэмдэглэнэ. Medication: name/dose/route/expiresAt/doseNumber. Заавал шаардагдах талбарыг quote болон payment дээр сервер давхар шалгана.
- Parent: nullable `birthYear`, `needsRepresentative`. Хуучин өвчтөний төрсөн оныг age-аас тааж нөхөөгүй.
- `GET /api/orders/:id`: bookingForm/zoneId, event timeline, assigned nurse болон ETA (байгаа үед). Бусдын order/payment/attachment-д 404 хэвээр.
- `GET /api/client/zones`; `GET /api/client/availability?zoneId=...&date=YYYY-MM-DD&serviceCode=S01`. Дутуу/буруу огноо 400. Хамгийн эрт +2 цаг; S03/S06 хоёр цаг, бусад нэг цаг. Хүчинтэй бүс, координат, тохирох slot, capacity-г quote/payment guard шалгана.
- `POST /api/auth/otp/request {phone}` → challengeId/expiresAt/isMock; `POST /api/auth/otp/verify {phone,challengeId,code,name?}` → token/refreshToken/user. OTP 5 минут, resend 60 секунд, утас 3/10 минут, IP 20/цаг, 3 буруу оролдлого 15 минут блок. Access 15 минут, refresh 30 хоног; hash хадгалж нэг удаа rotate хийнэ.
- `POST /api/auth/refresh {refreshToken}`; `POST /api/auth/logout {refreshToken}`.
- `PUT /api/client/profile {name}`; `GET /api/client/records`; `GET /api/client/records/:id/pdf`; `POST /api/client/account/deletion-request`.

SMS adapter нь `SMS_WEBHOOK_URL` HTTPS endpoint рүү `{to,message}` JSON, Bearer `SMS_WEBHOOK_TOKEN` илгээнэ. Бодит provider холбоогүй. `SMS_DRIVER=mock`, `EXPOSE_TEST_OTP=true` зөвхөн development тестэд; production mock хориотой. Нууц утгыг mobile-ийн EXPO_PUBLIC хувьсагчид тавихгүй.

## Migration ба ажиллуулах

Шинэ нэмэлт migration: `server/prisma/migrations/20261018000000_client_v2/`. Нэр нь эрэмбэлэх identifier; бодит deploy болсон огноо биш. Шинэ хүснэгтүүд: OtpChallenge, RefreshSession, ServiceZone, AvailabilitySlot, AccountDeletionRequest. Order/User/Parent-д нэмэлт талбар/FK; DROP/DELETE байхгүй.

1. Өөрчлөлтийг review хийнэ. Шинэ тусгаарласан UTF8 development/staging DB-ийн URL-г серверт тохируулна. Одоо байгаа WIN1252 DB-д эдгээр командыг ажиллуулахгүй.
2. `server`: `npm ci`, `npm run build`, `npm run db:migrate:deploy`.
3. Зөвхөн тестийн fixture хэрэгтэй dev орчинд `npm run db:seed`. Production seed болон fixture quote/payment хамгаалалт хэвээр; эзэмшигчийн баталгаагүй өгөгдлөөр бодит төлбөр авахгүй.
4. ServiceZone/AvailabilitySlot-д батлагдсан бүс, хуваарь, capacity оруулна. Seed бодит гэж харагдах бүс/цаг зохиодоггүй.
5. `App`: `npm ci`; `EXPO_PUBLIC_API_URL`-г өөрийн API-д тохируулж `npm start`. Release-д HTTPS шаардлагатай.
6. Нөхцөл/бодлогын батлагдсан HTTPS URL-г `.env.example`-ийн public URL хувьсагчдад тохируулна.

## Баталгаажуулалт ба үлдсэн хязгаар

Автомат тест, export, браузерийн зураг шалгалтын үр дүнг `validation.md`-д бүртгэнэ. Браузерийн зураг `screenshots/`-д; бүх нэр, хаяг, утас, үнэ, төлбөр нь тусгаарласан тестийн fixture. Бодит төхөөрөмжийн баталгаажуулалт гэж үзэхгүй.

Дараах зүйлсийг бүрэн хийгдсэн гэж тэмдэглэхгүй:

- Үнэ, red flag клиник агуулга, үйлчилгээний нөхцөл батлагдаагүй; fixture/approval хамгаалалт хэвээр.
- SMS provider-ийн жинхэнэ delivery, staging HTTPS/UTF8 DB, private bucket, QPay sandbox, reconciliation operator хэрэгсэл байхгүй.
- Төлөөлөгчийн эрхийг эмнэлгийн баримтаар батлах operator урсгал scope-д ороогүй; self-declared signer/familyPresent хадгална.
- Данс устгах хүсэлтийг хүлээн авдаг; эцсийн anonymization/устгал, clinical/payment хадгалалтын бодлого болон operator шийдвэрлэлтийг хэрэгжүүлэхээс өмнө эзэмшигч батална. Шууд hard delete хийдэггүй.
- Legal URL, батлагдсан logo/icon/splash байхгүй. Expo template зураг хадгалагдсан; брэнд asset дууссан биш.
- Native build, TestFlight/Play, iPhone/Android камер/HEIC/permission/deeplink/resume, VoiceOver/TalkBack, 200% native text scaling/contrast-ийн бүрэн acceptance хийгдээгүй.
- Tracking-ийн nurse/ETA update, clinical note approval нь одоогийн staff ажиллагаа/өгөгдлөөс хамаарна. Шинэ nurse/admin UI хийгээгүй.

Дараагийн хаах дараалал: клиник/үнэ/хууль/бүсийн баталгаажуулалт → staging/SMS/storage/QPay → native build ба төхөөрөмжийн acceptance → representative screenshot review → PR merge/deploy. Гадаад access-ийн саатлыг кодын тестээс тусад нь тайлагнана.
