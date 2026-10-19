// Splash screen geometry (pure, unit tested).
//
// The artwork in assets/splash/ was split from the designer's full-screen
// splash (1284×2778): gradient, logo block (mark + ОТОЧ + tagline) and the
// company line. All ratios below were measured on that image.
//
// The native splash (expo-splash-screen, app.json) can only draw one centered
// image on a solid color:
//   - iOS:     the logo block, NATIVE_IOS_LOGO_WIDTH pt wide, at screen center
//   - Android: the mark only, contained in a NATIVE_ANDROID_MARK_SIZE dp square
//              at screen center (Android 12+ shows nothing else)
// The JS overlay starts exactly there, then moves the logo to the designed
// position, so the hand-off from native to JS is invisible.

export const SPLASH = {
  backgroundColor: '#0F4075',
  // logo block (splash-logo.png)
  logoAspect: 672 / 854,
  logoCenterY: 0.3611,
  logoWidthRatio: 0.5234,
  logoMaxWidth: 300,
  // company line (splash-brand.png)
  brandAspect: 952 / 66,
  brandWidthRatio: 0.7414,
  brandMaxWidth: 420,
  brandBottom: 28,
  // where the mark sits inside the logo block (splash-mark.png crop)
  markCenterX: 335 / 672,
  markCenterY: 248 / 854,
  markHeightRatio: 496 / 854,
  markAspect: 400 / 496,
  // must match app.json expo-splash-screen imageWidth (ios / root)
  nativeIosLogoWidth: 200,
  nativeAndroidMarkSize: 128,
} as const

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface SplashLayout {
  logo: Rect
  brand: Rect
  // native-identical mark (Android only, cross-faded into the logo block)
  mark: Rect
  // transform that puts the logo block where the native splash drew it
  start: { scale: number; translateX: number; translateY: number }
  // the same start pose for the mark image, as a transform reaching the final pose
  markEnd: { scale: number; translateX: number; translateY: number }
}

export function splashLayout(
  width: number,
  height: number,
  bottomInset: number,
  platform: 'ios' | 'android',
): SplashLayout {
  const logoW = Math.min(width * SPLASH.logoWidthRatio, SPLASH.logoMaxWidth)
  const logoH = logoW / SPLASH.logoAspect
  const logo = { left: (width - logoW) / 2, top: height * SPLASH.logoCenterY - logoH / 2, width: logoW, height: logoH }

  const brandW = Math.min(width * SPLASH.brandWidthRatio, SPLASH.brandMaxWidth)
  const brandH = brandW / SPLASH.brandAspect
  const brand = {
    left: (width - brandW) / 2,
    top: height - bottomInset - SPLASH.brandBottom - brandH,
    width: brandW,
    height: brandH,
  }

  const markH = SPLASH.nativeAndroidMarkSize
  const markW = markH * SPLASH.markAspect
  const mark = { left: (width - markW) / 2, top: (height - markH) / 2, width: markW, height: markH }

  // RN transform [translate, scale] maps a point at offset d from the view
  // center to: center + translate + scale·d
  const cx = logo.left + logoW / 2
  const cy = logo.top + logoH / 2
  const anchor = platform === 'ios'
    ? { dx: 0, dy: 0, scale: SPLASH.nativeIosLogoWidth / logoW }
    : {
        dx: (SPLASH.markCenterX - 0.5) * logoW,
        dy: (SPLASH.markCenterY - 0.5) * logoH,
        scale: SPLASH.nativeAndroidMarkSize / (logoH * SPLASH.markHeightRatio),
      }
  const start = {
    scale: anchor.scale,
    translateX: width / 2 - cx - anchor.scale * anchor.dx,
    translateY: height / 2 - cy - anchor.scale * anchor.dy,
  }
  // final mark pose = the mark region of the logo block at rest
  const markEnd = {
    scale: 1 / anchor.scale,
    translateX: cx + anchor.dx - width / 2,
    translateY: cy + anchor.dy - height / 2,
  }
  return { logo, brand, mark, start, markEnd }
}
