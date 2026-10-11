# L1-1 Mobile хүлээлгэн өгөх баримт

| Талбар | Утга |
|---|---|
| Огноо | 2026-10-17 |
| Branch | `work/mobile-l1-1` |
| Source commit (код) | `17cbfa9` |
| Pull request | [#4](https://github.com/annd518/otoch-app/pull/4) → `main`, merge хийгдээгүй |
| Хамааралтай backend | [PR #5](https://github.com/annd518/otoch-app/pull/5), `work/backend-l1-1` `8f6309f` |
| main | `901bb91` (backend-ийн хуучин `16ce810` кодтой) |

> **Товч дүгнэлт.** Mobile-ийн L1-1 урсгал код болон тестийн түвшинд бэлэн. Backend `8f6309f`-ийн тусгаарласан хуулбартай 13/13 интеграцийн шалгалт давсан. Native build, store-д байршуулах, бодит төхөөрөмж дээрх тест **хийгдээгүй**. Шалтгаан нь identifier, account эрх, staging, төхөөрөмж байхгүй. QPay-г зөвхөн backend-ийн mock горимд шалгасан, sandbox шалгагдаагүй.

---

## 1. Mobile урсгал

```
Нэвтрэх → Каталог → Өвчтөн, хаяг, цаг (DRAFT) → Red flag → [Тийм бол 103]
        → Заалтын зураг (шаардлагатай бол) → Үнийн санал → QPay төлбөр
```

| Алхам | Дэлгэц | Гол хамгаалалт |
|---|---|---|
| Нэвтрэх | `App/app/auth/*` | Token, user, role тусдаа хадгалагдана. Хугацаа дууссан token илгээгдэхгүй. 401 үед гарна, эрхийн 403 үед гарахгүй. |
| Каталог | `App/app/booking/catalog.tsx` | Үнэ серверээс ₮-өөр. Fixture үйлчилгээг "Туршилтын өгөгдөл" гэж шошгоно. |
| Ноорог | `App/app/(tabs)/bookappointment.tsx` | `+08:00` огноо. Нэг логик create-д нэг `Idempotency-Key`, retry ижил key. PATCH `version`-тэй. Сувилагчийн хүйс идэвхгүй, учир нь сервер хадгалдаггүй. |
| Red flag | `App/app/booking/red-flags.tsx` | Асуултын тоо серверээс. Нэг "Тийм" дармагц шууд түгжиж серверт илгээнэ. Ачаалах, илгээх алдаанд алгасахгүй. Fixture бичвэрийг "батлагдаагүй" гэж харуулна. |
| 103 | `App/app/booking/emergency.tsx` | `tel:103`. Захиалга үргэлжлүүлэх товч байхгүй. |
| Заалт | `App/app/booking/referral.tsx` | JPEG/PNG (iOS compatible горим), 10 MB, 5 файл. Зураг бүр тогтмол key-тэй. Preview-г upload гэж харуулахгүй. PDF дэмжигдэхгүй. |
| Үнийн санал | `App/app/booking/review.tsx` | `orderVersion`-той. `excludes`-д байгаа хураамжийг "тооцоогүй" гэж харуулна. "Захиалга баталгаажсан" гэж харуулахгүй. |
| Төлбөр | `App/app/booking/payment.tsx` | Key, quote, payment id-г хүсэлтээс өмнө хадгална. Серверийн `recovery` зааврыг дагана. PAID зөвхөн серверийн `paidAt`-тай. `isMock`-ийг "QPay биш" гэж харуулна. Нэг timer-тэй polling, дэлгэц хаагдахад зогсоно. |

Restart эсвэл re-login хийсний дараа "Захиалга" tab нь `AWAITING_PAYMENT` болон `BLOCKED_RED_FLAG` захиалгыг серверээс сэргээнэ.

## 2. Real, fixture, mock endpoint

| Endpoint | Backend `8f6309f` | Өгөгдөл | Dev mock |
|---|---|---|---|
| Auth, parents | Real | Бодит | Үгүй |
| `GET /api/catalog/services` | Real | **Fixture** үнэ (`isFixture`) | Бий |
| Orders, red flag | Real | **Fixture** асуулт, батлагдаагүй | Бий |
| Quote | Real | **Fixture** үнэ. Унаа, хөнгөлөлт, НӨАТ тооцоогүй. | Бий |
| Upload | Real | `local-dev` storage. Staging bucket байхгүй. | Бий |
| QPay | **Mock горим** (`QPAY_MODE=mock`) | Бодит QPay биш | Бий |

- Dev mock нь зөвхөн `__DEV__` build-д, `EXPO_PUBLIC_API_MODE=mock` эсвэл `EXPO_PUBLIC_MOCK_ENDPOINTS`-оор асна. Release build-д хэзээ ч асахгүй.
- Release build нь `https://` `EXPO_PUBLIC_API_URL` шаардана, LAN эсвэл localhost руу унахгүй.

## 3. Тест (source `17cbfa9`)

| Шалгалт | Дүн |
|---|---|
| `npm run lint` | 0 алдаа, 0 анхааруулга |
| `npm run typecheck` (апп + тест) | 0 алдаа. `any`, `ts-ignore`, `eslint-disable` ашиглаагүй. |
| `npm test` | 149/149 |
| Backend `8f6309f`-ийн эсрэг интеграц | 13/13 |
| `expo export` iOS, Android | Амжилттай. **Native build биш.** |

Интеграцийн орчин: `8f6309f`-ийг scratchpad-д хуулж, шинэ embedded DB-тэй ажиллуулсан. Тохиргоо нь `QPAY_MODE=mock`, `STORAGE_DRIVER=local-dev`, `JWT_EXPIRES_IN=20s`. Provider timeout болон rejection-ийг серверийн өөрийн `qpayMock.failNextCreate`-ээр scratch туслах файлаар өдөөсөн. Repo-ийн серверийн код өөрчлөгдөөгүй.

Шалгасан зүйлс: auth ба token дуусалт, draft replay, эрт "Тийм" блок, re-login хийсний дараах блок, quote version, upload-ийн алдагдсан хариу ба retry, унших, устгах, мөн төлбөрийн RESUME, DONE, WAIT (QR-гүй), CONTACT_SUPPORT, NEW_QUOTE. Өөр хэрэглэгч payment-д хандвал 404 буцаж, `paymentId` задрахгүй.

Дэлгэцийн түвшний polling, app resume, камер, deeplink-ийг бодит төхөөрөмж дээр **шалгаагүй**.

## 4. Build, config ба шаардлагатай эрх

| Зүйл | Төлөв |
|---|---|
| Expo SDK / React Native | 57.0.27 / 0.86.3. `expo-doctor` 21/21. |
| `App/app.json` | Камер, зургийн сангийн permission тайлбар, микрофон хаалттай. **Bundle ID, package байхгүй.** |
| `App/eas.json` | `preview` нь internal APK. `staging` нь store distribution (TestFlight, Play-д signed AAB). **Identifier, project ID, URL байхгүй тул build-ready биш.** |
| `App/.env.example` | Зөвхөн хувьсагчийн нэр, нууц утга байхгүй. |
| Хувилбар | `1.0.0`. Build number EAS remote-оор тохируулагдана (шалгагдаагүй). |

Шаардлагатай эрх ба утга:

1. Батлагдсан iOS bundle ID, Android package.
2. Expo account, EAS project (`eas init`).
3. Apple Developer, App Store Connect (App Manager эсвэл Admin).
4. Google Play Console, account-ийн төрөл, Play App Signing.
5. Staging HTTPS API URL.
6. Батлагдсан app icon ба splash.
7. Tester-ийн жагсаалт, нэг iPhone, нэг Android.

## 5. TestFlight, internal, closed testing-ийн бодит төлөв

| Алхам | Төлөв |
|---|---|
| Native iOS build | Эхлээгүй |
| Native Android build | Эхлээгүй |
| TestFlight upload | Хийгээгүй, холбоос байхгүй |
| Play internal testing | Хийгээгүй, холбоос байхгүй |
| Play closed testing | Хийгээгүй |
| Tester суулгалт | Хийгээгүй |

Шалтгаан нь 4-р хэсгийн эрх ба утга байхгүй. Төлбөртэй build болон store-ийн үйлдэлд тусгай зөвшөөрөл хэрэгтэй.

## 6. Дутуу зүйлс

- **Identifier:** iOS bundle ID, Android package батлагдаагүй.
- **Staging:** HTTPS backend байхгүй. Release blocker.
- **Төхөөрөмж:** Бодит iPhone, Android байхгүй. Камер, HEIC → JPEG, permission, `tel:103`, QR/deeplink, app resume шалгагдаагүй.
- **Icon:** Expo template хэвээр.

## 7. Биелээгүй L1-1 шалгуур

1. Staging болон бодит төхөөрөмж дээр бүтэн урсгал ажилласан байх.
2. Native build, TestFlight, Play internal testing.
3. QPay sandbox дээрх invoice, төлөлт, callback.
4. Private storage bucket дээр upload хийх (одоо `local-dev` л).
5. Батлагдсан каталог, үнэ, хураамж, red flag асуулт (одоо fixture).
6. Payment reconciliation-ийн operator хэрэгсэл (backend).
7. PR #4, #5-ийн review ба main-д merge.

## 8. Backend-тэй хамтарсан төлөв

- PR #4 нь PR #5 (`8f6309f`)-аас хамаарна. PR #5-ийг өмнө нь эсвэл хамт merge хийх хэрэгтэй.
- Backend-ийн H1–H5 handoff mobile `17cbfa9`-д хэрэгжсэн. Backend-ийн засвар шаардлагагүй.
- Нээлттэй: QPay sandbox credential, private bucket, staging hosting, тусламжийн суваг (reconciliation үед хэрэглэгчийг хаашаа чиглүүлэх).
