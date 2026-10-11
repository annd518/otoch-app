# UI v2 шалгалтын бүртгэл

Тестэлсэн код: `feat/client-ui-v2` локал working tree, суурь `e432a8c`. Энэ шалгалтын бүртгэлийг commit/push-ийн өмнө үүсгэсэн. Node 22.23.3; Expo SDK 57; Prisma 6.18.0. Шалгалтын компьютерийн огноо 2026-10-11; өмнөх хөгжүүлэгчдийн 10.17 тайланг deploy болсон хугацааны нотолгоо гэж үзээгүй.

| Шалгалт | Дүн |
|---|---|
| Mobile typecheck (app + tests) | Давсан |
| Mobile lint | 0 error, 0 warning |
| Mobile unit/regression | 152/152 |
| Server build/typecheck | Давсан |
| Prisma validate | Давсан; DB-д холбогдоогүй placeholder URL |
| Server integration/regression | 114/114; шинэ тусгаарласан UTF8 DB |
| Migration | 5 migration-ийг хоосон түр UTF8 DB-д apply хийсэн |
| Expo doctor | 21/21 |
| iOS/Android JS export | Давсан, Hermes 6.1/6.3 MB; native/signed build биш |
| Browser flow | OTP mock → бүлэг/үйлчилгээ/бэлтгэл → 4 алхам → 6 negative хариулт → server quote → mock invoice → tracking |
| Browser emergency | Эрт positive → серверийн BLOCKED → 103 дэлгэц; runtime error 0 |
| Source checks | `git diff --check` давсан; өөрчлөлтийн candidate файлд .env/DB/log/keystore/private key ороогүй, шалгасан secret signature олдоогүй |

Шинэ серверийн тестэд consent, birthYear/гэр бүлийн нөхцөл, medication/first-dose/expiry, +2 цаг, цагийн цонх/capacity, 6 асуулт/positive blocking, OTP rate/lockout/refresh/replay/logout, production mock gate, record/PDF ownership хамрагдсан. Хуучин idempotency, red flag, attachment ownership, quote, payment recovery regression тестүүд давсан. Rate lockout нь гурав дахь алдаатай оролдлогоос хойш бүтэн 15 минут.

Браузерийн туршилт: Chrome headless, 390×844 болон 320×640 viewport, reduce-motion. API болон PostgreSQL нь зөвхөн `/private/tmp` дахь шинэ тест орчин. SMS/QPay mock, storage memory; screenshot-ийн бүх өгөгдөл зохиомол. Тестийн серверүүдийг дууссаны дараа зогсоосон. Бодит/хуучин DB-д migration, seed, reset хийгээгүй.

## Харагдах байдлын review

[Нүүр](screenshots/home.png), [үйлчилгээ](screenshots/service.png), [бэлтгэл](screenshots/preparation.png), [алхам 1](screenshots/booking-step-1.png), [алхам 2](screenshots/booking-step-2.png), [алхам 3](screenshots/booking-step-3.png), [6 асуулт](screenshots/red-flags.png), [алхам 4](screenshots/booking-step-4.png), [төлбөр](screenshots/payment.png), [tracking](screenshots/tracking.png), [emergency](screenshots/emergency.png), [empty](screenshots/records-empty.png), [offline](screenshots/offline.png), [жижиг дэлгэц](screenshots/booking-small-screen.png), [onboarding](screenshots/onboarding.png).

Зураг нь браузерийн scroll байрлалыг харуулна. Mobile гар, keyboard, safe area, OS-ийн dynamic type-ийн нотолгоо биш. Skeleton/offline нь static, хөдөлгөөнт effect оруулаагүй. Native VoiceOver/TalkBack, бүх өнгөний contrast, 200% font scaling, камер/HEIC/permission/QR/deeplink/resume-ийг төхөөрөмж дээр acceptance хийх шаардлагатай.

## Давтан шалгах

- `App`: `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`.
- `server`: `npm run build`, `npm run typecheck`, `npm test`. `npm test` тусдаа түр PostgreSQL ашиглана; бодит DB-ийн URL бүү ашигла.
- JS export: HTTPS тест URL тохируулж `npx expo export --platform ios --platform android --output-dir <temporary-output>`.
- Төхөөрөмжийн шалгалтыг батлагдсан staging/access гарсны дараа тусдаа бүртгэнэ.

Бүрэн дууссан гэж үзэхгүй үлдсэн зүйлс болон ажиллуулах дараалал: [implementation.md](implementation.md).
