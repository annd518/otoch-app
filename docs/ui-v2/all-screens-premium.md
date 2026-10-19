# Хэрэглэгчийн апп — premium visual pass

Onboarding болон Home-ийг benchmark болгон одоо байгаа хэрэглэгчийн `App/` дэлгэцүүдийг нийцүүлэв. Бүх дэлгэцэд том hero нэмээгүй: discovery дээр depth илүү, form/clinical/payment дээр текст, төлөв, үйлдэл илүү тод байна.

## Хамрах хүрээ

| Дэлгэц | Хэрэгжүүлсэн visual treatment |
|---|---|
| Splash/onboarding/Home | Өмнөх benchmark хадгалсан; shared header/CTA өнгө нийцсэн |
| Утас/OTP | Shield summary, focus/error input, readable code field, gradient primary CTA |
| Email login/register | Brand shield, rounded forms, shared legacy CTA treatment |
| Анхны профайл | Хувийн мэдээллийн жижиг summary; өмнөх хадгалах flow хэвээр |
| Каталог/бүлэг | Бүлэгтэй нийцэх Lucide icon, бодит үнэ/хугацааны ялгаатай hierarchy |
| Үйлчилгээ | Нэр/тайлбар, багтана/бэлдэнэ/хийхгүй, үнэ тусдаа цэгцтэй хэсгүүд |
| Бэлтгэл | Checklist, сонгогдсон check icon, supplies section |
| Захиалга 1–3 | Compact step progress, тухайн алхмын context/icon, focus/error inputs, selected chips |
| Calendar/time modal | Ижил radius, shared CTA; огноо/+2h/capacity дүрэм хэвээр |
| Өвчтөн/гэр бүлийн form | Account icon, shared inputs, visible check selections |
| Заалт/зураг | Заалтын context, upload permission/error/progress, shared radius/actions |
| Red flag | Calm question cards, илэрхий yes/no сонголт, шинэ header/actions; blocking guard хэвээр |
| Review/quote | Step 4, structured summary, server quote-ийн дүнгийн hierarchy |
| QPay/recovery | Server-derived amount panel, payment safety summary, bank/status/retry states; QR white background |
| Emergency | Danger phone icon/action давамгай, readable warning; blocked draft үргэлжлэхгүй |
| Захиалгын жагсаалт | Status pills, compact filters, real date labels, new-order CTA |
| Tracking/active/completed order | Бодит status pill, nurse/ETA section, зөвхөн серверийн event-үүдийн vertical timeline |
| Тэмдэглэл/PDF | File icon, patient/date/note hierarchy; PDF ownership flow өөрчлөгдөөгүй |
| Профайл | Raised avatar, action hierarchy; legal links ghost, deletion explicit danger |
| Notifications/loading/empty/error/offline | Shared StateView/skeleton/banner, explanatory text and existing retry |
| Settings/rating/standalone completion | Тусдаа одоо байгаа route байхгүй; зохиож нэмээгүй. Completion нь Order detail-ийн төлөв |
| Legacy redirects | Parent/report/add-parent routes өмнөх destination руугаа шилжинэ |

## Нийтлэг код

- `components/ui/Presentation.tsx`: SectionHeading, FeatureSummary, service-group icon mapping, StatusPill, actual-event timeline.
- `components/ui/index.tsx`: shared gradient primary CTA, readable labels, compact stepper, selected/check chips, refined empty states, consistent screen header/spacing.
- `components/ui/TouchTarget.tsx`: хуучин flow-ийн onPress/disabled болон callback-ийг хадгалж blue CTA-д gradient/pressed depth хэрэглэнэ.
- `design/dateLabels.ts`: зөвхөн display format; UTC+8, 24 цагийн огноо/цаг. API-д илгээх утгыг өөрчлөөгүй. Midnight/offset/invalid date тест нэмсэн.

## Хадгалсан зүйлс

API calls, models, authentication, consent/medication/red-flag guards, idempotency, upload ownership, quote/amount computation, payment recovery, route destinations болон 10-second order polling өөрчлөгдөөгүй. Хэрэглэгчийн мэдээлэл, үнэ, ETA, клиник өгөгдөл зохиогоогүй. `server/`, `nurse-app/`, `wclient/` өөрчлөгдөөгүй. Нэмэлт dependency, lockfile өөрчлөлт байхгүй.

## Шалгалт ба хязгаар

Typecheck болон cache-free lint PASS; 222/222 unit/regression PASS; web static/SSR, iOS/Android Hermes export PASS. Browser review нь synthetic session + mock HTTP ашигласан; бодит backend/QPay/SMS/bucket integration-ийн баталгаа биш. Төхөөрөмж дээр camera/HEIC/keyboard/VoiceOver/TalkBack/200% text scaling, хуучин Android-ийн shadow fallback-ийг тусад нь хүлээн авна.

Гурван хэмжээтэй layout, filled/empty/error, OTP, каталог/үйлчилгээ, booking 1–4, асуулга, mock төлбөр болон tracking-ийн screenshots/results `validation.md`-д бүртгэгдэнэ. Тусдаа referral route-ийг context-гүй нээсэн screenshot нь guard/empty төлөв; native camera/upload acceptance гэж үзэхгүй.

Энэ ажил commit/push/merge/deploy хийгдээгүй локал UI өөрчлөлт.
