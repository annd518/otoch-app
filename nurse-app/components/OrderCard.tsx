import { Pressable, View } from 'react-native'

import { theme } from '../design/theme'
import type { StaffOrder } from '../services/staffOrders'
import { formatSchedule, serviceSummary } from '../utils/orderView'
import { AppText } from './AppText'
import { StatusBadge } from './StatusBadge'

export function OrderCard({ order, onPress }: { order: StaffOrder; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${serviceSummary(order)}, ${order.patientName}, ${formatSchedule(order)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        gap: theme.space[1],
        padding: theme.space[3],
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: pressed ? theme.color.subtle : theme.color.background,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.space[2] }}>
        <AppText variant="label" style={{ flexShrink: 1 }}>
          {serviceSummary(order)}
        </AppText>
        <StatusBadge status={order.status} />
      </View>
      <AppText variant="caption" color={theme.color.secondary}>
        {formatSchedule(order)}
      </AppText>
      <AppText variant="caption">{order.patientName}</AppText>
      {order.address ? (
        <AppText variant="caption" color={theme.color.secondary} numberOfLines={2}>
          {order.address.text}
        </AppText>
      ) : null}
    </Pressable>
  )
}
