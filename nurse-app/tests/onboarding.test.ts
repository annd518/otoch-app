import assert from 'node:assert/strict'
import test from 'node:test'

import { JOIN_BENEFITS, JOIN_INTRO, JOIN_STEPS, WELCOME_SLIDES, pageAt } from '../design/onboarding'

const allText = [
  ...WELCOME_SLIDES.flatMap((s) => [s.title, s.text]),
  JOIN_INTRO.title,
  JOIN_INTRO.text,
  ...JOIN_BENEFITS.flatMap((b) => [b.title, b.text]),
  ...JOIN_STEPS.flatMap((s) => [s.title, s.text]),
].join('\n')

test('wording rules: not a hospital, not an emergency service, no contract terms (spec slide 10)', () => {
  // 103 appears only in the fixed notice on the welcome screen, never in the pitch.
  for (const word of ['эмнэлэг', 'эмчлэх', 'эмчилгээ', 'онош', '24 цаг', 'шууд', 'SOS', 'яаралтай']) {
    assert.equal(allText.toLowerCase().includes(word.toLowerCase()), false, word)
  }
  // No pay share, price or timing promises: those are contract terms.
  assert.equal(/\d\s*%|₮|хоногт|цагийн дотор|долоо хоног/.test(allText), false)
})

test('the pitch says only what the app does: three slides, four benefits, five steps', () => {
  assert.equal(WELCOME_SLIDES.length, 3)
  assert.equal(JOIN_BENEFITS.length, 4)
  assert.equal(JOIN_STEPS.length, 5)
  assert.equal(new Set(WELCOME_SLIDES.map((s) => s.title)).size, 3)
  // the scope rule is part of the pitch
  assert.match(JOIN_BENEFITS.map((b) => b.text).join(' '), /Эмчийн заалтгүй тарилга, дусал хийхгүй/)
  // verification by the company comes before work starts
  const order = JOIN_STEPS.map((s) => s.title)
  assert.ok(order.indexOf('Админ шалгах') < order.indexOf('Баталгаажиж, ажиллаж эхлэх'))
  // the interview step is conditional because the system does not run it yet
  assert.match(JOIN_STEPS.find((s) => s.title === 'Ярилцлага, сургалт')!.text, /Шаардлагатай бол/)
})

test('every slide names an icon and a badge the hero can draw', () => {
  for (const s of WELCOME_SLIDES) {
    assert.ok(['shield', 'wallet', 'clipboard'].includes(s.icon))
    assert.ok(['heart', 'check', 'clock'].includes(s.badge))
  }
  for (const b of JOIN_BENEFITS) assert.ok(['calendar', 'wallet', 'clipboard', 'shield'].includes(b.icon))
})

test('pageAt rounds to the nearest page and clamps', () => {
  assert.equal(pageAt(0, 390, 3), 0)
  assert.equal(pageAt(200, 390, 3), 1)
  assert.equal(pageAt(780, 390, 3), 2)
  assert.equal(pageAt(5000, 390, 3), 2)
  assert.equal(pageAt(-40, 390, 3), 0)
  assert.equal(pageAt(100, 0, 3), 0)
})
