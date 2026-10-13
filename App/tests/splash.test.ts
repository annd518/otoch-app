import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SPLASH, splashLayout, type Rect } from '../utils/splashLayout'

// Screens in points/dp: small phone, tall phone, Android 20:9, iPad, Android tablet
const SCREENS = [
  { name: 'iPhone SE', w: 375, h: 667, inset: 0 },
  { name: 'iPhone 16 Pro Max', w: 440, h: 956, inset: 34 },
  { name: 'Android 20:9', w: 411, h: 914, inset: 24 },
  { name: 'iPad Pro 12.9', w: 1024, h: 1366, inset: 20 },
  { name: 'Android tablet', w: 800, h: 1280, inset: 24 },
]

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`)
// point at offset (dx, dy) from the rect center, after RN transform [translate, scale]
const mapped = (r: Rect, t: { scale: number; translateX: number; translateY: number }, dx: number, dy: number) => ({
  x: r.left + r.width / 2 + t.translateX + t.scale * dx,
  y: r.top + r.height / 2 + t.translateY + t.scale * dy,
})

describe('splash hand-off from the native splash is pixel-aligned', () => {
  for (const s of SCREENS) {
    it(`${s.name}: iOS start pose = native logo (centered, ${SPLASH.nativeIosLogoWidth}pt wide)`, () => {
      const l = splashLayout(s.w, s.h, s.inset, 'ios')
      const c = mapped(l.logo, l.start, 0, 0)
      near(c.x, s.w / 2, 'center x')
      near(c.y, s.h / 2, 'center y')
      near(l.logo.width * l.start.scale, SPLASH.nativeIosLogoWidth, 'width')
    })

    it(`${s.name}: Android start pose = native mark (centered, ${SPLASH.nativeAndroidMarkSize}dp tall)`, () => {
      const l = splashLayout(s.w, s.h, s.inset, 'android')
      const dx = (SPLASH.markCenterX - 0.5) * l.logo.width
      const dy = (SPLASH.markCenterY - 0.5) * l.logo.height
      const m = mapped(l.logo, l.start, dx, dy)
      near(m.x, s.w / 2, 'mark x')
      near(m.y, s.h / 2, 'mark y')
      near(l.logo.height * SPLASH.markHeightRatio * l.start.scale, SPLASH.nativeAndroidMarkSize, 'mark height')
      // the separate mark image starts exactly on the native one ...
      near(l.mark.left + l.mark.width / 2, s.w / 2, 'mark image x')
      near(l.mark.top + l.mark.height / 2, s.h / 2, 'mark image y')
      // ... and ends exactly on the mark region of the logo at rest
      const end = mapped(l.mark, l.markEnd, 0, 0)
      near(end.x, l.logo.left + l.logo.width * SPLASH.markCenterX, 'mark end x')
      near(end.y, l.logo.top + l.logo.height * SPLASH.markCenterY, 'mark end y')
      near(l.mark.height * l.markEnd.scale, l.logo.height * SPLASH.markHeightRatio, 'mark end height')
    })

    it(`${s.name}: final layout keeps logo and company line on screen, apart, above the safe area`, () => {
      const l = splashLayout(s.w, s.h, s.inset, 'ios')
      assert.ok(l.logo.top > 0 && l.logo.left > 0 && l.logo.left + l.logo.width < s.w)
      assert.ok(l.logo.width <= SPLASH.logoMaxWidth)
      assert.ok(l.brand.width <= SPLASH.brandMaxWidth && l.brand.left > 0)
      near(s.h - (l.brand.top + l.brand.height), s.inset + SPLASH.brandBottom, 'brand bottom gap')
      assert.ok(l.logo.top + l.logo.height < l.brand.top - 40, 'logo and company line do not touch')
    })
  }

  it('Android 12+ icon: the mark fits the 192dp visible circle of the 288dp splash icon', () => {
    const h = SPLASH.nativeAndroidMarkSize
    assert.ok(Math.hypot(h, h * SPLASH.markAspect) <= 192)
  })

  it('phones keep the designed proportions; tablets are capped', () => {
    const phone = splashLayout(428, 926, 34, 'ios')
    near(phone.logo.width, 428 * SPLASH.logoWidthRatio, 'phone logo width')
    near(phone.logo.top + phone.logo.height / 2, 926 * SPLASH.logoCenterY, 'phone logo center')
    const ipad = splashLayout(1024, 1366, 20, 'ios')
    assert.equal(ipad.logo.width, SPLASH.logoMaxWidth)
    assert.equal(ipad.brand.width, SPLASH.brandMaxWidth)
  })
})
