// HTTPS smoke test against a deployed STAGING API (no dependencies, Node 20+).
//
//   SMOKE_PHONE=+976XXXXXXXX SMOKE_CODE=NNNNNN node scripts/smoke-staging.mjs https://otoch-staging-api.onrender.com
//
// SMOKE_PHONE/SMOKE_CODE must be one entry of the server's OTP_TEST_ACCOUNTS. One run issues one
// OTP challenge (the server allows one per minute per number). Tokens and codes are never printed.
// Checks infrastructure only; the full booking flow is tested once catalog/order work (L1-1 #1-5) lands.
const base = (process.argv[2] ?? '').replace(/\/+$/, '')
// SMOKE_ALLOW_HTTP=1 only for trying the script against a local server
if (!base.startsWith('https://') && !(process.env.SMOKE_ALLOW_HTTP === '1' && base.startsWith('http://'))) {
    console.error('usage: node scripts/smoke-staging.mjs https://<staging-host>  (https only)')
    process.exit(2)
}
const phone = process.env.SMOKE_PHONE
const code = process.env.SMOKE_CODE
const results = []
const step = async (name, fn) => {
    try {
        const detail = await fn()
        results.push({ step: name, ok: true, ...(detail && { detail }) })
    } catch (err) {
        results.push({ step: name, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
}
const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }
    return { status: res.status, json }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }

let token = null
await step('health over HTTPS (valid certificate)', async () => {
    const r = await call('GET', '/api/health')
    expect(r.status === 200, `status ${r.status}`)
})
await step('protected route without token -> 401', async () => {
    const r = await call('GET', '/api/orders')
    expect(r.status === 401, `status ${r.status}`)
})
await step('QPay callback with a wrong secret -> 404', async () => {
    const r = await call('POST', '/api/payments/qpay/callback/not-the-secret?paymentId=x')
    expect(r.status === 404, `status ${r.status}`)
})
await step('phone login with a test account (OTP_TEST_ACCOUNTS)', async () => {
    expect(phone && code, 'set SMOKE_PHONE and SMOKE_CODE')
    const req = await call('POST', '/api/auth/otp/request', { body: { phone } })
    expect(req.status === 200, `otp/request ${req.status} ${req.json?.error?.code ?? ''}`)
    expect(!('testCode' in (req.json?.data ?? {})), 'server exposed a test code')
    const ver = await call('POST', '/api/auth/otp/verify', { body: { phone, code, challengeId: req.json.data.challengeId } })
    expect(ver.status === 200, `otp/verify ${ver.status} ${ver.json?.error?.code ?? ''}`)
    token = ver.json.data.token
    return { role: ver.json.data.user.role }
})
await step('catalog: data present and Mongolian text intact (UTF8 database)', async () => {
    expect(token, 'no session')
    const r = await call('GET', '/api/catalog/services', { token })
    expect(r.status === 200, `status ${r.status}`)
    const services = r.json?.data?.services ?? []
    expect(services.length > 0, 'no services (seed/import missing?)')
    expect(services.some((s) => /[Ѐ-ӿ]/.test(s.name ?? '')), 'no Cyrillic in service names: encoding or seed problem')
    return { services: services.length, containsFixtures: r.json.data.containsFixtures }
})
await step('orders list (migrations applied)', async () => {
    expect(token, 'no session')
    const r = await call('GET', '/api/orders', { token })
    expect(r.status === 200, `status ${r.status} ${r.json?.error?.code ?? ''}`)
})

for (const r of results) console.log(JSON.stringify(r))
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `FAILED: ${failed}/${results.length}` : `PASSED: ${results.length}/${results.length}`)
process.exit(failed ? 1 : 0)
