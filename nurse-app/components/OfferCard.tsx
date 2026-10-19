import { View } from 'react-native'

import { theme } from '../design/theme'
import { formatCountdown, type Offer } from '../services/offers'
import { formatMnt } from '../utils/money'
import { formatSchedule, serviceSummary } from '../utils/orderView'
import { AppText } from './AppText'
import { Button } from './Button'

interface Props {
  offer: Offer
  seconds: number
  busy: boolean
  disabled: boolean
  onAccept: () => void
  onDecline: () => void
}

// A new call from dispatch: first to accept gets it. The exact address is shown after accepting.
export function OfferCard({ offer, seconds, busy, disabled, onAccept, onDecline }: Props) {
  return (
    <View
      accessibilityLabel={`Шинэ дуудлага, ${serviceSummary(offer)}, ${seconds} секунд үлдсэн`}
      style={{
        gap: theme.space[1],
        padding: theme.space[3],
        borderRadius: theme.radius.card,
        borderWidth: 2,
        borderColor: seconds <= 20 ? theme.color.warning : theme.color.brand,
        backgroundColor: theme.color.info,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.space[2] }}>
        <AppText variant="label" style={{ flexShrink: 1 }}>
          {serviceSummary(offer)}
        </AppText>
        <AppText variant="label" color={seconds <= 20 ? theme.color.warning : theme.color.brand}>
          {formatCountdown(seconds)}
        </AppText>
      </View>
      <AppText variant="caption">
        {formatSchedule(offer)}
        {offer.area ? ` · ${offer.area}` : ''}
      </AppText>
      {offer.earnings ? (
        <AppText variant="caption" color={theme.color.secondary}>
          Таны орлого ≈ {formatMnt(offer.earnings.nurseShareMnt)} ({offer.earnings.sharePercent}%)
          {offer.earnings.isFixture ? ' · туршилтын үнэ' : ''}
        </AppText>
      ) : null}
      <View style={{ gap: theme.space[1], paddingTop: theme.space[1] }}>
        <Button label="Хүлээн авах" loading={busy} disabled={disabled} onPress={onAccept} />
        <Button label="Татгалзах" variant="secondary" disabled={disabled || busy} onPress={onDecline} />
      </View>
    </View>
  )
}
