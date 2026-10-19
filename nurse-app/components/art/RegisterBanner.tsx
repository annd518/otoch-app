import { View } from 'react-native'
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { theme } from '../../design/theme'

// Night over Ulaanbaatar: a ger with a care cross, and a nurse waving. Drawn with shapes only.
const star = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`

export function RegisterBanner({ width }: { width: number }) {
  const height = width * 0.42
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: theme.radius.card, overflow: 'hidden' }}
    >
      <Svg width={width} height={height} viewBox="0 0 342 144" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B2F5C" />
            <Stop offset="1" stopColor="#2F7FCB" />
          </LinearGradient>
        </Defs>
        <Rect width="342" height="144" fill="url(#sky)" />
        <Path d={star(36, 28, 7)} fill="#FFB82B" />
        <Path d={star(300, 22, 5)} fill="#FFFFFF" opacity={0.8} />
        <Path d={star(188, 18, 4)} fill="#FFFFFF" opacity={0.6} />
        <Path d={star(120, 44, 3)} fill="#FFFFFF" opacity={0.5} />
        {/* hills and a few city blocks */}
        <Path d="M0 104 L60 70 L110 100 L170 62 L240 104 L342 76 L342 144 L0 144 Z" fill="#3E86CF" opacity={0.65} />
        <Rect x="70" y="82" width="14" height="40" fill="#5A9BD8" opacity={0.7} />
        <Rect x="88" y="72" width="12" height="50" fill="#6BA8E0" opacity={0.7} />
        <Rect x="104" y="88" width="16" height="34" fill="#5A9BD8" opacity={0.7} />
        <Rect x="0" y="112" width="342" height="32" fill="#CFE3F7" />
        {/* ger with a cross on the door */}
        <G>
          <Path d="M30 112 L30 96 Q56 66 82 96 L82 112 Z" fill="#FFFFFF" />
          <Path d="M24 98 Q56 62 88 98 Z" fill="#E8F1FB" />
          <Rect x="49" y="98" width="14" height="14" rx="2" fill="#11589F" />
          <Rect x="54.5" y="100.5" width="3" height="9" fill="#FFFFFF" />
          <Rect x="51.5" y="103.5" width="9" height="3" fill="#FFFFFF" />
          <Circle cx="56" cy="76" r="2.4" fill="#FFB82B" />
        </G>
        {/* nurse */}
        <G>
          <Path d="M232 144 L236 100 Q250 92 264 100 L268 144 Z" fill="#11589F" />
          <Rect x="245" y="108" width="10" height="3" fill="#FFFFFF" />
          <Rect x="248.5" y="104.5" width="3" height="10" fill="#FFFFFF" />
          <Path d="M262 102 L284 84 Q289 86 286 91 L268 112 Z" fill="#11589F" />
          <Circle cx="283" cy="86" r="4.4" fill="#FFFFFF" />
          <Circle cx="250" cy="82" r="14" fill="#FFFFFF" />
          <Path d="M236 79 Q250 60 264 79 Q250 72 236 79 Z" fill="#FFB82B" />
          <Path d="M243 88 Q250 93 257 88" stroke="#0F4075" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </G>
      </Svg>
    </View>
  )
}
