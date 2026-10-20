# Customer ↔ Nurse link (no admin website)

Base: main 6170b73. Scope: customer App, nurse app integration and required backend. Do not change wclient or introduce a public assignment/role bypass.

1. Verify the existing paid-order → eligible nurse offer → accept flow through the dispatch service. Test accounts/profiles exist only in the isolated test DB; no admin web/API is required for the journey.
2. Customer tracking must label EN_ROUTE, REFUSED and INCIDENT honestly and classify stopped visits correctly. Show signed completed nurse visit records in customer Records/PDF, clearly distinguished from clinician-approved legacy notes. Draft/unsigned records, signature image and third-party records remain private.
3. Add an executable isolated cross-app API journey using the actual pure service clients from both apps: draft/retry → negative questionnaire → quote → mock payment → dispatch offer/accept → ETA/en-route/check-in → autosave/sign/complete → customer status/record/PDF. Add owner, role, stale-version, incomplete-signature/record and red-flag negatives.
4. Diagnose the time-of-day CI failure and add this journey to CI. Run backend/customer/nurse regression, typechecks and relevant exports. Record limits; native two-device/staging checks stay pending.

No real DB, public account provisioning, real payment, deployment, admin website or automatic approval policy changes. Existing verified nurse eligibility is retained. Run via `npm run test:app-link` in server; the command always starts a disposable UTF8 DB.

## Implemented and verified — 2026-10-20

- Existing dispatch/eligible verified-nurse offer acceptance provides the no-admin assignment path. No public assignment endpoint, nurse self-verification, web admin change or role bypass added. Production requires already provisioned/verified nurses, published catalog, region/capacity and running dispatch. Push/SMS acceptance remains separate; foreground polling is already implemented.
- Customer labels EN_ROUTE/REFUSED/INCIDENT, keeps INCIDENT visible, moves REFUSED out of active lists, shows honest stopped/incident guidance and links completed orders to Records. No automatic refund/reassignment promise.
- `/api/client/records` now includes only COMPLETED signed nurse VisitRecords owned by the booking user, alongside existing approved legacy Visit records. New source/orderId/nurseName fields are additive. IDs use `order:<orderId>` and the existing authenticated PDF endpoint. Draft/unsigned records, raw signatures, checklist and unrelated users are not disclosed. The note is labeled nurse-signed, not physician/medical-admin approved. No migration required.
- Main's 19:30 CI failure reproduced during initial implementation: JS fake Date and PostgreSQL `createdAt` defaults were different clocks, causing OTP resend to return 200 instead of expected 429. Corrected only the test fixture timestamp; production OTP code unchanged.
- `npm run test:app-link` runs its own disposable UTF8 DB and uses actual pure service clients from both apps. Complete fixture catalog is isolated from the older five-item catalog tests. CI runs this explicit journey plus normal server/nurse checks and now customer typecheck/lint/unit.

### Results

| Check | Result | Boundary |
| --- | --- | --- |
| Backend build/typecheck | PASS | No production deploy |
| Backend regression | 200/200 | Fresh temporary UTF8 DB, 8 migrations |
| Cross-app no-admin journey | 2/2 | Real API + actual client functions; synthetic accounts, mock payment |
| 19:30 UB regression | 55/55 | Fake JS clock, test fixture aligned |
| Customer typecheck/lint/unit | PASS, 231/231 | Current main already had additional address tests |
| Nurse typecheck/lint/unit | PASS, 61/61 | Nurse source unchanged |
| Customer iOS/Android/web export | PASS | JS/Hermes export, not native signed build |
| Browser new states/records | 6 captures, runtime errors 0, horizontal overflow 0 | Mock HTTP, 390/320px |

Journey: draft replay → six negatives → quote → mock invoice/payment → dispatch cycle → nurse offer/accept → customer ASSIGNED → ETA → EN_ROUTE → check-in → IN_PROGRESS → autosave → signed COMPLETED → customer record/PDF. Checks stale version, wrong nurse/user, private address before accept, hidden unsigned records, locked signed notes, PDF ownership and positive red-flag inability to quote/dispatch.

The test advances only isolated fixture dispatch/check-in timing deterministically; GPS/time guards remain unchanged. No ADMIN user or admin endpoint is used. The simulator is not two real devices and mock PAID is not QPay sandbox.

[Customer state/record screenshots](ui-v2/screenshots/app-link/index.html).

Code is in branch `feat/client-nurse-link`, worktree `/private/tmp/otoch-app-link`. No real DB, migration/seed, credentials, admin website, deployment, commit/push/merge changed in this pass. Staging and two-device foreground/polling/GPS/signature/PDF-sharing acceptance remain pending.

## Integration update

Before merge, main advanced to `8b0ca06` (address dropdowns and PR #40 OTP single-clock fix). Retained those changes. Removed our redundant OTP fixture workaround in favor of main's production single-clock fix; the prior fixture diagnosis above is historical. Revalidate on the combined tree before merging.
