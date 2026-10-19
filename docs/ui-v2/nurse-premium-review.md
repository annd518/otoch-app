# Nurse app — OTOCH visual alignment

Base: main `1a2e4a3`. Worktree: `/private/tmp/otoch-nurse-ui`, branch `feat/nurse-premium-ui`.

This pass changes the nurse app presentation only. Customer App, backend, admin web, native storage, request services, polling hooks and visit validation are unchanged.

## Screens

- Calls: OTOCH wordmark, nurse badge, compact greeting hero, readable offer countdown/earnings, existing accept/decline, assigned-visit cards and pull-to-refresh/pagination.
- Profile: identity surface, existing online switch and blocker, grouped professional status/license/skills, existing logout.
- Phone/email login: OTOCH header, calmer authentication card, inset focus fields and gradient submit. OTP/resend and email behavior retained.
- Visit detail: status and actual patient/schedule/address/medication data on calm cards. Main visit actions pinned below scrolling content; rejection/incident remain in a separate secondary section. Map/phone/ETA actions preserved.
- Check-in: readable confirmation rows and pinned original start action. GPS permission, distance/time checks and all three checkbox requirements preserved.
- Visit record: flat sections for vitals/procedures/medication/notes/signature and pinned guarded finish action. Autosave, flush, signature drawing/scroll lock and confirmation preserved.
- Rejection/incident: original reason/comment validation, confirmation and emergency phone handlers, with pinned guarded submit.
- Two existing tabs retained. Tab height now responds to fontScale with safe-area inset. Existing splash art/animation and signature pad unchanged.

## Visual system

Matches customer OTOCH tokens: #ECF0F3 canvas, navy typography, Montserrat headings/Noto Sans body, blue/deep gradient CTA, 22–28 radius, shallow raised/inset surfaces and Lucide icons. Task forms remain calmer than the hero. Added `expo-linear-gradient ~57.0.2`, matching the customer's Expo SDK; no existing package version changed.

## Evidence and limits

- Typecheck/cache-free lint pass; 61/61 unit/regression pass; iOS/Android Hermes export passes. Export is not a signed/native build.
- AST audit confirms non-render logic and existing callbacks/disabled/loading guards unchanged on all 8 content/auth screens. Services/hooks/backend/customer/web remain unchanged.
- Browser screenshots use an isolated disposable copy, a synthetic nurse session and mocked HTTP data. The copy substitutes storage solely to render native-only authenticated screens on web; production SecureStore is unchanged. Browser tooling uses the customer app's web dependencies; this does not add or claim production web support for the nurse app.
- Browser guards cover check-in checklist, incomplete record finish, rejection reason and incident description; small 320px views and error state. No real GPS, call, payment, incident, rejection or signature submission executed.
- Real-device keyboard/safe area/large font/VoiceOver/TalkBack, native gradients/shadows, GPS, map/phone and signature PNG behavior still need device acceptance.
- No commit/push/merge/deploy in this pass. Original user/Claude worktrees remain unchanged.

[Browser screenshot gallery](screenshots/nurse-premium/index.html)
