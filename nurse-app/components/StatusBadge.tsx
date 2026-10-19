import { View } from 'react-native'

import { theme } from '../design/theme'
import { statusLabel, statusTone, type StatusTone } from '../utils/orderView'
import { AppText } from './AppText'

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  info: { bg: theme.color.info, fg: theme.color.brand },
  warning: { bg: theme.color.warningBg, fg: theme.color.warning },
  success: { bg: theme.color.successBg, fg: theme.color.success },
  danger: { bg: theme.color.errorBg, fg: theme.color.error },
  neutral: { bg: theme.color.muted, fg: theme.color.secondary },
}

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[statusTone(status)]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: tone.bg,
        borderRadius: theme.radius.small,
        paddingHorizontal: theme.space[2],
        paddingVertical: theme.space[0],
      }}
    >
      <AppText variant="caption" color={tone.fg} style={{ fontFamily: 'NotoSans_600SemiBold' }}>
        {statusLabel(status)}
      </AppText>
    </View>
  )
}
