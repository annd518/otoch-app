// Test-only clock shift. Usage (from server/):
//   FAKE_UB_TIME=19:30 NODE_OPTIONS="--require ./scripts/fake-now.cjs" npm test
// Makes "now" read as HH:MM Ulaanbaatar time today, so time-of-day bugs (a slot over
// midnight, a 2-hour rule near a boundary) reproduce on any machine at any hour. Database
// defaults (createdAt) still use the real clock, so OTP rate-limit tests can differ when
// the faked time is far from the real one; use times within a couple of hours of real time
// for those, or run tests/client-v2.test.ts only.
const Real = Date;
const [h, m] = (process.env.FAKE_UB_TIME || '').split(':').map(Number);
if (Number.isFinite(h)) {
  const real = Real.now();
  const ub = new Real(real + 8 * 3600e3);
  const target = Real.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate(), h, m || 0) - 8 * 3600e3;
  const offset = target - real;
  global.Date = class extends Real {
    constructor(...a) { if (a.length === 0) super(Real.now() + offset); else super(...a); }
    static now() { return Real.now() + offset; }
  };
}
