import type { ComponentType } from 'react'
import { View } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

export interface Step {
  icon: ComponentType<{ color?: string; size?: number }>
  title: string
  text: string
}

// Numbered steps joined by a line (the "how to register" path).
export function StepTimeline({ steps }: { steps: readonly Step[] }) {
  return (
    <View>
      {steps.map((step, i) => (
        <View key={step.title} style={{ flexDirection: 'row', gap: theme.space[2] }}>
          <View style={{ alignItems: 'center', width: 48 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.color.navy,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <step.icon color="#FFFFFF" size={22} />
            </View>
            {i < steps.length - 1 ? <View style={{ flex: 1, width: 2, minHeight: 20, backgroundColor: theme.color.navy }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? theme.space[3] : 0, gap: theme.space[0] }}>
            <AppText variant="label">{`Алхам ${i + 1}: ${step.title}`}</AppText>
            <AppText variant="caption" color={theme.color.secondary} style={{ fontSize: 15, lineHeight: 22 }}>
              {step.text}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  )
}
