import { View } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

export function ErrorBox({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: theme.color.errorBg, borderRadius: theme.radius.small, padding: theme.space[3] }}
    >
      <AppText variant="caption" color={theme.color.error}>
        {message}
      </AppText>
    </View>
  )
}
