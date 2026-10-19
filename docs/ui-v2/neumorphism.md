# OTOCH medical neumorphism visual refactor

## Scope and compatibility

Branch: `feat/medical-neumorphism`, created from the clean `feat/nurse-app` checkout. This checkout uses Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router Tabs/Stack and React Navigation. Styles are React Native StyleSheet plus shared `components/ui`; local Montserrat/Noto Sans fonts, Lucide icons and approved splash/wordmark assets are retained.

This is a visual refactor of the existing customer `App/`, not a replacement application. `server/`, `nurse-app/`, API/service code, data models, auth/payment handlers and navigation destinations are unchanged. The current checkout has four tabs: this work preserves them rather than silently importing another branch's three-tab navigation.

## Foundations

- `App/design/theme.ts`: existing brand blue #11589F and navy, #ECF0F3 canvas/surface, high-contrast text, semantic error/success/warning colors, spacing, radius and typography.
- `App/design/depth.ts`: shared raised/soft/inset/action/flat treatments using React Native 0.86's native Fabric boxShadow parser. Multiple/inset strings also satisfy RN Web TextInput style types. Older Android OSes may omit inset rendering, so borders and fills always carry the state.
- `NeuSurface`: raised, flat, inset/pressed, selected. Existing `Card` delegates to it, preserving callers.
- Existing `Button` keeps `secondary`, `busy`, `network` and disabled semantics; also supports primary/secondary/ghost/danger. Brand fill, readable text, pressed scale/depth, minimum 56px height. No new animation dependency.
- Existing `Input` preserves callbacks and validation; adds focus border and error border plus inset depth. `NeuIconButton` supplies a 48px circular back action.
- StateView/skeleton, chips, banners and stepper use shared semantic tokens. Shadows are subtle on cards; status banners and content remain flat where appropriate.

## Existing screen coverage

| Existing surface | Visual integration |
|---|---|
| Native splash / JS splash | Approved assets and timing kept; no replacement logo |
| Onboarding | Soft canvas, circular house/shield/clipboard vectors, navy wordmark, blue CTA, emergency notice; actual measured page width fixes web SSR zero-width slides |
| Phone/OTP, first profile, patient editor | Shared Screen, Input, Button and Banner |
| Legacy email login/register | Theme colors/fonts, inset inputs, rounded branded CTA; auth handlers unchanged |
| Home | Care icon/header, soft service-category cards, inset icon badges, active/empty order hierarchy |
| Catalog, service detail, preparation | Shared themed Screen/Card/Button; dynamic catalog, prices and content kept |
| Booking/address/time/patient/medicine | Shared inputs/cards/chips/stepper/calendar; original guards and capacity/+2h rules retained |
| Red flag, referral, review, payment | Standalone styles normalized; semantic warnings, readable forms, soft quote/question/bank cards; QR stays on white |
| Emergency | Clear danger CTA and text; original block/retry/103 handlers kept |
| Order history/detail/tracking | Shared Screen/Card/StateView applies to real status timeline and assignment content |
| Records, profile/family profiles, notifications | Shared tokens/components; no invented clinical or personal data |
| Rating / separate settings / separate completion | No independent existing screen found; not invented. Completion remains order status/detail |
| Bottom navigation | Current destinations/labels unchanged; softly raised surface and existing active-blue contrast |

No fake language selector, settings action, search, ETA, price or rating was added. These require real supported behavior.

## Validation

- Mobile typecheck PASS, cache-free lint PASS, 219/219 regression tests PASS.
- iOS + Android Hermes and web static/SSR export PASS; export is not a signed/native device build.
- Browser preview uses only synthetic session/mock HTTP and a local static export server. Representative route screenshots and results are recorded in `validation.md`.
- Native iPhone/Android, actual fontScale 200%, VoiceOver/TalkBack, keyboard/camera/deeplink and old-Android shadow rendering still need device acceptance. Existing backend integration was not re-run: no backend or API implementation changed.
- No dependency/lockfile changes, DB mutation, deployment, GitHub push or merge performed in this task.
