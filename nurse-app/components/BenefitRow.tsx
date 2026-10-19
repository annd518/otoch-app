import type { ComponentType } from 'react'
import { View } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

export function BenefitRow({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ color?: string; size?: number }>
  title: string
  text: string
}) {
  return (
    <View style={{ gap: theme.space[1] }}>
      <Icon color={theme.color.navy} size={28} />
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" color={theme.color.secondary} style={{ fontSize: 15, lineHeight: 22 }}>
        {text}
      </AppText>
    </View>
  )
}
