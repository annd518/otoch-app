import { useEffect, useState } from 'react'
import { Image, View } from 'react-native'

import { theme } from '../design/theme'
import { API_PATHS } from '../config/api'
import type { StaffOrder } from '../services/staffOrders'
import { apiConfig } from '../utils/env'
import { storage } from '../utils/storage'
import { AppText } from './AppText'

// Doctor's referral photos, fetched with the nurse's token (the server serves
// them only to the assigned nurse while the visit is open).
export function ReferralImages({ orderId, attachments }: { orderId: string; attachments: StaffOrder['attachments'] }) {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    void storage.getAuthToken().then(setToken)
  }, [])

  const baseUrl = apiConfig.ok ? apiConfig.baseUrl : null
  if (!baseUrl || !token) return null
  return (
    <View style={{ gap: theme.space[1] }}>
      {attachments.map((a, i) => (
        <View key={a.id} style={{ gap: theme.space[0] }}>
          <AppText variant="caption" color={theme.color.secondary}>
            Заалтын зураг {i + 1}
          </AppText>
          <Image
            accessibilityLabel={`Заалтын зураг ${i + 1}`}
            source={{
              uri: `${baseUrl}${API_PATHS.nurseOrders.attachment(orderId, a.id)}`,
              headers: { Authorization: `Bearer ${token}` },
            }}
            resizeMode="contain"
            style={{ width: '100%', height: 240, borderRadius: theme.radius.small, backgroundColor: theme.color.muted }}
          />
        </View>
      ))}
    </View>
  )
}
