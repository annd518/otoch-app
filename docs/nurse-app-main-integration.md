# Nurse app main integration — 2026-10-19

Integrated Claude's remote `feat/nurse-app` (`087830a`) into main `8688aa9` in an isolated worktree. This preserves the customer layout merge and the newer ADMIN-only web / nurse-app role boundary from PR #35. Git merged without conflicts; no customer App or wclient changes are introduced by this integration.

## Validation

- All four packages installed with `npm ci` from committed lockfiles. No dependency or lockfile changes were made.
- Backend build/typecheck pass. **200/200** API/regression tests pass against fresh temporary UTF8 PostgreSQL; all **8 migrations** applied there.
- Nurse app typecheck, cache-free lint, **61/61** tests and iOS/Android Hermes exports pass. Export is not a signed/native build.
- Customer app typecheck, cache-free lint and **222/222** regression tests pass.
- Admin web production build passes.
- GitHub CI is included from the nurse branch and runs for this integration PR. It covers server and nurse app; customer/web checks above were run locally.

The original Claude worktree and user checkout are preserved. No real/local DB migration, seed, reset, provisioning, deployment or payment was performed.

## Remaining acceptance

Native-device, staging, notifications, private bucket and QPay acceptance remain separate. Existing issues in `nurse-app-plan.md` remain, particularly admin nurse-profile verification, REFUSED/INCIDENT/reassignment, customer labels for nurse states and device checks. Dispatch currently defaults to 15 seconds when unset; use `DISPATCH_INTERVAL_MS=0` for a manual-assignment pilot until notifications/dispatch acceptance are complete. No operational environment was changed here.
