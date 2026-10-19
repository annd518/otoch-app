import type { ComponentType } from 'react'
import { Image, View } from 'react-native'
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg'

import { theme } from '../../design/theme'

// Nested arches in perspective around the ОТОЧ mark: the care "tunnel" of the welcome screen.
const ARCHES = [
  { r: 120, cy: 160, base: 250, width: 16, color: '#FFB82B', opacity: 1 },
  { r: 85, cy: 150, base: 228, width: 12, color: '#4F8FD0', opacity: 0.95 },
  { r: 55, cy: 142, base: 210, width: 8, color: '#3B7BBE', opacity: 0.8 },
  { r: 32, cy: 137, base: 196, width: 5, color: '#2F68A6', opacity: 0.6 },
]

type IconType = ComponentType<{ color?: string; size?: number }>

interface Props {
  width: number
  // Two small chips beside the mark, one per side: what this slide is about.
  left: IconType
  right: IconType
}

const MARK = require('../../assets/splash/splash-mark.png')

export function ArchArt({ width, left: Left, right: Right }: Props) {
  const scale = width / 300
  const chip = {
    position: 'absolute' as const,
    width: 44 * scale,
    height: 44 * scale,
    borderRadius: 22 * scale,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height: 280 * scale }}>
      <Svg width={width} height={280 * scale} viewBox="0 0 300 280">
        <Defs>
          <LinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="150" cy="252" rx="138" ry="16" fill="url(#glow)" />
        {ARCHES.map((a, i) => (
          <Path
            key={i}
            d={`M${150 - a.r} ${a.base} L${150 - a.r} ${a.cy} A${a.r} ${a.r} 0 0 1 ${150 + a.r} ${a.cy} L${150 + a.r} ${a.base}`}
            stroke={a.color}
            strokeWidth={a.width}
            strokeOpacity={a.opacity}
            strokeLinecap="butt"
            fill="none"
          />
        ))}
      </Svg>
      <Image
        source={MARK}
        resizeMode="contain"
        style={{ position: 'absolute', left: 108 * scale, top: 108 * scale, width: 84 * scale, height: 96 * scale }}
      />
      <View style={{ ...chip, left: 56 * scale, top: 196 * scale }}>
        <Left color={theme.color.brand} size={22 * scale} />
      </View>
      <View style={{ ...chip, right: 56 * scale, top: 176 * scale }}>
        <Right color={theme.color.brand} size={22 * scale} />
      </View>
    </View>
  )
}
