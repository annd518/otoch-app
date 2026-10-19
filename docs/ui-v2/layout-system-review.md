# Customer layout system — 2026-10-19

The user expanded the previous Home-only review to all existing customer screens. This is a visual/layout pass on the existing onboarding benchmark, not a new product or API implementation. The earlier Home-only notes remain historical.

## Screen decisions

| Existing screen / flow | Layout treatment |
| --- | --- |
| Onboarding | Retain the existing benchmark and its illustration, palette, typography, radius and primary CTA treatment. |
| Home | Compact care hero and stored-user greeting, direct 103 guidance, actual current-order state, responsive four-group bento, fixed care CTA. |
| Catalog | Vertical service cards with actual server price/duration. Existing group filtering is always available in a horizontally scrolling sticky row; All clears the group filter. No new unsupported filters. |
| Service / preparation | Separate readable information sections; the original preparation/start action stays visible in the footer, with checklist validation intact. |
| Booking 1–3 | Existing four-step model, sticky progress, scrollable single-column fields and pinned original next/back actions. No added booking steps or new payload fields. |
| Red flag / referral | Progress below the header, existing question/upload content and guarded footer actions. Positive answer still terminates the booking. |
| Review, step 4 | Visible progress and pinned existing payment CTA; quote refresh, server total, expiry/error and referral guards retained. |
| Payment | Calmer introduction, existing amount/QR/bank/payment-state content; pending payment check pinned below the scrolling content. Other recovery actions and timers retained. |
| Orders | Existing active/past/cancelled filters in a sticky horizontal row; pinned original new-order action. |
| Tracking / order detail | Actual status and nurse/ETA cards followed by a flatter event timeline. Draft/payment actions pinned only for the same existing statuses. No fabricated route or live nurse location. |
| Records | Calmer header and existing patient/date/note/PDF cards, with actual empty/error states. |
| Phone / OTP / email / register | Calmer authentication layout and fixed original submit action. OTP expiry/resend/change-number and email/register links retained. |
| Initial profile / patient editor | Fixed save action; patient identity, contact/address and representation grouped with flat section headings. Existing fields/validation retained. |
| Profile | Existing avatar and personal information retained; patients, service/help and account actions grouped. Legal/support/delete/logout handlers unchanged. |
| Emergency | Single emergency visual, scrollable advice and pinned original 103 / Home actions. No resume action. |
| Notifications / legacy redirects | Retain existing honest empty state and redirects; no invented messages or alternate product flow. |

Shared `Screen` supports optional sticky content and a footer. iOS keyboard avoidance surrounds the body/footer; bottom safe-area padding is applied outside tab screens without duplicating the tab bar inset. `FeatureSummary.compact` lowers visual intensity on task-oriented screens. Form sections use dividers rather than wrapping every field in a raised card.

The existing four real tabs are preserved. There is no Chat destination, nurse-selection dataset or live nurse coordinates/route in this customer flow, so no chat, matching, fake map or carousel content was created. Existing services, models, backend and nurse app are untouched.

## Verification and limits

- Typecheck, cache-free lint, 222/222 unit/regression tests and iOS/Android/web export pass. Export is not a native signed build.
- TypeScript AST comparison against HEAD confirms that non-render screen statements, existing interaction callbacks and disabled/busy conditions remain unchanged across 18 non-Home screens. Catalog adds only the supported All filter; Home additionally reads the stored user name for its greeting.
- Browser review uses synthetic users/orders and intercepted HTTP responses. It is UI verification, not live backend, SMS, QPay or private bucket acceptance. Screenshots are labeled as test data where relevant.
- Device keyboard, safe area, actual 200% native fontScale, VoiceOver/TalkBack, HEIC, camera/permissions, phone and bank deeplinks remain device checks. No real emergency call or payment is executed.
- No commit, push, merge or deployment is performed in this pass.

See [the screenshot gallery](screenshots/layout-system/index.html). The screenshot positions are viewports of scrollable screens; lower fields and secondary actions remain reachable by scrolling.
