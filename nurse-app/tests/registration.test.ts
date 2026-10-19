import assert from 'node:assert/strict'
import test from 'node:test'

import { createHttpClient, type FetchLike } from '../services/httpClient'
import { submitApplication } from '../services/applications'
import { resolveApiConfig } from '../utils/apiConfig'
import { DECLARATIONS, MIN_EXPERIENCE_YEARS, validateApplication, type ApplicationInput } from '../utils/registration'

const good: ApplicationInput = {
  name: '  Б.Номин   Гэрэл ',
  phoneDigits: '99112233',
  licenseNo: ' 10387 ',
  experience: '5',
  declarations: { license: true, experience: true, scope: true },
}

test('a complete form is valid and normalised', () => {
  const r = validateApplication(good)
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.value, { name: 'Б.Номин Гэрэл', phone: '+97699112233', licenseNo: '10387', experienceYears: 5 })
})

test('each field reports its own problem', () => {
  const bad = validateApplication({
    name: 'Номин',
    phoneDigits: '9911',
    licenseNo: '  ',
    experience: '',
    declarations: { license: true, experience: false, scope: true },
  })
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ['declarations', 'experience', 'licenseNo', 'name', 'phone'])
})

test('experience below the minimum is refused with the rule in the message', () => {
  const r = validateApplication({ ...good, experience: String(MIN_EXPERIENCE_YEARS - 1) })
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.errors.experience ?? '', /3-аас дээш/)
  assert.equal(validateApplication({ ...good, experience: String(MIN_EXPERIENCE_YEARS) }).ok, true)
  assert.equal(validateApplication({ ...good, experience: '61' }).ok, false)
  assert.equal(validateApplication({ ...good, experience: '2.5' }).ok, false)
})

test('all three statements are required, and none may be dropped from the form', () => {
  assert.deepEqual(DECLARATIONS.map((d) => d.key), ['license', 'experience', 'scope'])
  for (const key of ['license', 'experience', 'scope'] as const) {
    const r = validateApplication({ ...good, declarations: { ...good.declarations, [key]: false } })
    assert.equal(r.ok, false, key)
  }
})

const config = resolveApiConfig({ isDev: true, platform: 'ios', explicitUrl: 'http://api.test' })

test('the application is sent without a token, with the three declarations', async () => {
  const seen: { url: string; headers: Record<string, string>; body: unknown }[] = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, headers: init.headers, body: JSON.parse(init.body!) })
    return { status: 202, text: async () => JSON.stringify({ success: true, data: { received: true } }) }
  }
  const client = createHttpClient({ config, fetch, getToken: async () => 'should-not-be-sent' })
  const r = await submitApplication(client, { name: 'Б.Номин Гэрэл', phone: '+97699112233', licenseNo: '10387', experienceYears: 5 })
  assert.equal(r.ok, true)
  assert.equal(seen[0].url, 'http://api.test/api/nurse-applications')
  assert.equal(seen[0].headers.Authorization, undefined)
  assert.deepEqual(seen[0].body, {
    name: 'Б.Номин Гэрэл',
    phone: '+97699112233',
    licenseNo: '10387',
    experienceYears: 5,
    declarations: { license: true, experience: true, scope: true },
  })
})

test('a rate-limit answer surfaces its message', async () => {
  const fetch: FetchLike = async () => ({
    status: 429,
    text: async () => JSON.stringify({ success: false, message: 'Өргөдлийг хэт олон илгээлээ', error: { code: 'APPLICATION_RATE_LIMIT' } }),
  })
  const client = createHttpClient({ config, fetch, getToken: async () => null })
  const r = await submitApplication(client, { name: 'А Б', phone: '+97699112233', licenseNo: '1', experienceYears: 5 })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, 'APPLICATION_RATE_LIMIT')
})
