## Main integration review

- Main `ab70535` дээр UI-ийн `7a35ffa`, `f030964`, `be69d3d`, `16f2c78` commit-уудыг cherry-pick хийсэн. `feat/nurse-app` суурийн зургаан commit-ийг UI merge-д оруулаагүй.
- Нэгтгэх App tree нь `16f2c78`-ийн App tree-тэй diff-гүй. Тусдаа worktree дээр typecheck, cache-free lint, 222/222 regression дахин PASS. Dependency lockfile өөрчлөгдөөгүй; local node_modules-ийг шалгалтад symlink хийсэн.
- PR-ийн өөрчлөлт зөвхөн App болон UI review docs/screenshots; server/nurse-app/wclient өөрчлөлт байхгүй. Native/device acceptance-ийн өмнөх хязгаар хэвээр.

## Бүх хэрэглэгчийн дэлгэц — premium pass

- [Хамрах хүрээ, дэлгэц бүрийн бүртгэл](all-screens-premium.md). Onboarding/Home benchmark; discovery-д илүү depth, forms/clinical/payment-д тайван hierarchy. Нэмэлт dependency, backend/nurse-app/wclient өөрчлөлт байхгүй.
- Typecheck/cache-free lint PASS; **222/222** unit/regression PASS (3 шинэ UTC+8 display-date тест орсон). iOS/Android Hermes + web static/SSR export PASS. Native/signed build биш.
- Chrome synthetic session + mock HTTP: 28 screenshot; onboarding, Home, каталог/бүлэг, үйлчилгээ/бэлтгэл, phone/OTP/email/register, initial profile, booking 1–3 → 6 negative red flag → review/quote, mock pending/paid, emergency, orders/tracking/records/profile/patient, notifications, small/error. Runtime errors **0**, шалгасан viewport бүрт horizontal overflow **0**. Энэ нь бодит backend/SMS/QPay/bucket integration биш.
- Static catalog query гарчгийн hydration mismatch-ийг query title hydration-ийн дараа үзүүлэхээр зассан. Серверийн каталог шүүх болон navigation өөрчлөгдөөгүй. Date labels UTC+8/24h; API payload огноо өөрчлөгдөөгүй.
- [Бүх зурагтай gallery](screenshots/all-premium/index.html), [каталог](screenshots/all-premium/catalog.png), [алхам 2](screenshots/all-premium/booking-2.png), [асуулга](screenshots/all-premium/red-flags.png), [review](screenshots/all-premium/review.png), [төлбөр](screenshots/all-premium/payment.png), [tracking](screenshots/all-premium/tracking.png), [профайл](screenshots/all-premium/profile.png).
- Зургууд нь viewport/scroll байрлалын review. Context-гүй referral route зураг нь guard/empty төлөв. Upload permission/HEIC, camera, native keyboard/safe area/VoiceOver/TalkBack/200% fontScale, хуучин Android shadow fallback төхөөрөмж дээр хүлээгдэнэ. Бодит/локал DB-д хүрээгүй.
- UI хэрэгжүүлэлт локал; visual review хүлээн авсан гэсэн үг биш. Commit/push/merge/deploy хийгээгүй.

## Home only — onboarding benchmark, 2026-10-19

- Зөвхөн `App/app/(tabs)/index.tsx` өөрчлөгдсөн. Onboarding-ийн existing palette/hero/vector, 24–28 radius, headline hierarchy, gradient CTA/depth хэлийг Home-д хэрэглэсэн. Нэг гол raised care card; үйлчилгээний depth бага, хоосон status flat; 103 хэсэг neutral жижиг yellow accent-тай. Бусад дэлгэц, shared theme, tabs/navigation, API/services өөрчлөгдөөгүй.
- Одоогийн draft reset → catalog, category group param, active order detail, tel:103 handlers хадгалагдсан. Үнэ/ETA/хэрэглэгчийн нэр/захиалга зохиогоогүй.
- Typecheck, cache-free lint PASS; 219/219 regression PASS; iOS/Android/web export PASS. Chrome mock HTTP/session: 320/390/768px horizontal overflow 0, runtime errors 0; CTA/category/active-order navigation болон error state PASS.
- Review: [Home 390](screenshots/home-benchmark/home-benchmark-390.png), [320](screenshots/home-benchmark/home-benchmark-320.png), [768](screenshots/home-benchmark/home-benchmark-768.png), [идэвхтэй захиалга](screenshots/home-benchmark/home-benchmark-active.png), [алдаа](screenshots/home-benchmark/home-benchmark-error.png).
- Native/device/200% font acceptance хийгдээгүй. Home-ийг харуулж review хүлээнэ; бусад дэлгэц дээр үргэлжлүүлээгүй. Commit/push хийгээгүй.

## Premium onboarding refinement — 2026-10-19

- Хэрэглэгчийн шинэ лавлах зураг/даалгавраар зөвхөн onboarding visual execution-ийг шинэчилсэн. Header → hero → headline/body → pager → 103 card → CTA бүтэц болон гурван slide/skip/auth navigation хэвээр.
- `OnboardingHero.tsx`: 232px хоёр талын shadow бүхий disc, recessed circle, gradient SVG house/roof/door, overlapping yellow medical badge, abstract glow circles. Shield/clipboard slide өөрийн icon-оо хадгална. 740px-ээс намхан дэлгэцэд compact hero; дунд хэсэг scroll боломжтой.
- `onboardingVisual.ts`: scoped palette/depth token; бусад дэлгэцийн theme өөрчлөгдөөгүй. Neutral raised emergency card, yellow phone badge, bold blue 103. Blue/deep gradient CTA, 24px radius, pressed scale/shadow, arrow. Pager touch target 44px, headline 30/37 (compact 26/32), body 16/26.
- Typecheck/cache-free lint PASS; 219/219 regression PASS; web + iOS/Android bundle export PASS. Шинэ dependency нэмээгүй. Chrome screenshot 320/390/768px, pageerror 0, horizontal overflow 0; pager болон Continue→Start→`/auth/phone` destination шалгасан.
- [390px](screenshots/premium-onboarding/onboarding-390.png), [320px](screenshots/premium-onboarding/onboarding-320.png), [768px](screenshots/premium-onboarding/onboarding-768.png), [slide 2](screenshots/premium-onboarding/slide-2.png). Native төхөөрөмж, native shadow/200% text acceptance хүлээгдэнэ. Commit/push хийгээгүй.

## Medical neumorphism — 2026-10-19

- `feat/medical-neumorphism`: [хамрах хүрээ/дэлгэцийн бүртгэл](neumorphism.md). Одоогийн `feat/nurse-app` сууриас зөвхөн хэрэглэгчийн App visual layer. Энэ checkout-ийн 4 таб, auth/order/payment/API урсгал хэвээр; өмнөх тусдаа Blob Tab Bar branch-ийг merge хийгээгүй.
- Нэг #ECF0F3 canvas, брэндийн #11589F CTA, Noto Sans/Montserrat, centralized spacing/radius/depth; shared Card/Button/Input/Screen/StateView болон NeuSurface/NeuIconButton. Native Fabric boxShadow; unsupported OS дээр border/fill нь төлөвийг ялгана. Splash logo/timing asset хадгалсан.
- Typecheck PASS; cache-free lint PASS; 219/219 regression PASS; iOS/Android Hermes + web static/SSR export PASS. Dependencies/lockfile болон backend өөрчлөгдөөгүй.
- Chrome synthetic session/mock HTTP: onboarding, phone, login, register, home, orders, profile, records, booking, patient editor, payment empty, emergency, notifications болон 320px patient editor — 14 зураг, runtime errors 0, horizontal overflow 0. Input focus border #11589F баталгаажсан. Web onboarding SSR width=0 асуудлыг бодит layout width-ээр зассан.
- Review: [onboarding](screenshots/neumorphism/neu-onboarding.png), [нүүр](screenshots/neumorphism/neu-home.png), [OTP](screenshots/neumorphism/neu-phone.png), [өвчтөн](screenshots/neumorphism/neu-patient.png), [жижиг дэлгэц](screenshots/neumorphism/neu-small.png), [профайл](screenshots/neumorphism/neu-profile.png).
- Native төхөөрөмж/VoiceOver/TalkBack/200% fontScale/keyboard болон бодит QPay, камераар acceptance хийгдээгүй. Зурагт байхгүй үйлдэл, ETA, үнэ, эмнэлзүйн өгөгдөл зохиогоогүй. Commit/push/merge энэ ажлаар хийгээгүй.

## Монгол жишээ хүний мэдээлэл

- Mobile-ийн хуучин `child@demo.com` demo өвчтөнүүдийн нэр, хаяг, холбоо барих утсыг Монгол жишээгээр харуулна. Бодит аккаунтад энэ хөрвүүлэлт үйлчлэхгүй.
- Seed-ийн үзлэгийн жишээ тэмдэглэл болон вэбийн жишээ хүний нэр, байршил шинэчлэгдсэн. Гаднын хүний зураг оронд ерөнхий аватар ашиглав. Сэтгэгдлийг жишээ гэж тэмдэглэв.
- Бодит/локал DB-д seed, update, migration ажиллуулаагүй.

> Нүүрийн UI/UX шинэчлэл: утсан дээр бүтэн өргөнтэй дарагдах үйлчилгээний карт, таблет дээр хоёр багана; Noto Sans 18/16px гарчиг/тайлбар, давтагдсан том товчийн оронд карт бүхэлдээ дарагдана. Жижиг дэлгэцийн табын нэр тайрагдахгүй, safe area/үсгийн хэмжээнд табын өндөр зохицоно. Web native map импортын алдааг `LocationPicker.web.tsx`-ийн гараар координат оруулах fallback-аар тусгаарласан; native газрын зургийн код хэвээр.
> Шалгалт: mobile178/178, lint/typecheck, static web/SSR export давсан. Mock API-тай browser 320/390/768px дээр runtime error/хөндлөн overflow 0. Зураг: [320px](screenshots/home-refresh/home-320.png), [390px](screenshots/home-refresh/home-390.png), [768px](screenshots/home-refresh/home-768.png). Browser зураг нь native iPhone/Android болон native 200% font acceptance биш.

> Нүүр хуудас/аватарын эцсийн шалгалт: main `d08d254`-тай нэгтгэсэн. Mobile178/178, lint/typecheck, server typecheck, iOS/Android JS export давсан. Газрын зургийн шинэ код дахь хуучин slot setter дуудлагыг одоогийн keyed slot state-тэй нийцүүлсэн. Native галерей/permission acceptance болон DB seed хийгдээгүй.

> Нүүр хуудас/аватар: “Профайл” таб, гарчгийг “Нүүр хуудас” болгосон. Галерейгээс 1:1 зураг сонгох, солих/хасах, бүртгэл тус бүрээр төхөөрөмжид хадгалах боломж нэмсэн; native cache URI-г documents дахь өөрийн avatar хавтсанд хуулна. Demo seed Монгол нэр/Улаанбаатарын хаяг/8 оронтой жишээ утас ашиглана; хуучин demo account-ийн нэрийг зөвхөн тухайн test account-д Монгол жишээгээр харуулна. Seed/бодит DB-д ажиллуулаагүй. Mobile173/173, lint/typecheck болон server typecheck давсан; native gallery permission/device acceptance хүлээгдэнэ.

> Фонт/календарийн эцсийн шалгалт (main `3e03c4d`-тай нэгтгэсэн): mobile 173/173, lint/typecheck, iOS/Android JS export давсан. JS export нь native/device acceptance биш.

> Фонт/календарийн шинэчлэл: Noto Sans/Montserrat face-ийг нэг AppText компонентод зөв сонгож, Монгол Ө/Ү glyph дэмжлэгийг шалгасан. Он/сар/өдрийн календарь болон 00:00–23:59 цаг/минут сонголт нэмсэн; өдрийн 14 хоногийн UI жагсаалтыг хассан. Шөнө дундаас давсан 60/120 минутын цонх зөв тооцно. Серверийн +2 цаг, бүс/slot/capacity хамгаалалтыг хадгалсан; 24 цагийн сонголт нь бүх цагийн багтаамж автоматаар нийтлэгдсэн гэсэн үг биш. Native төхөөрөмж дээр энэ өөрчлөлтийг шалгаагүй.

> L1-1 1–5-ын шинэ хэрэгжүүлэлт ба үлдсэн acceptance: [тайлан](../l1-1-acceptance/validation.md). Доорх нь өмнөх UI үе шатны шалгалт.

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
