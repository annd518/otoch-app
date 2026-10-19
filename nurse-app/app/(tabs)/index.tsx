import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { useSession } from '../../context/SessionContext'
import { theme } from '../../design/theme'

// Phase 1 replaces this with the assigned-orders list (docs/nurse-app-plan.md).
export default function CallsScreen() {
  const { user } = useSession()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <View style={{ flex: 1, padding: theme.space[5], gap: theme.space[2], justifyContent: 'center' }}>
        <AppText variant="heading" color={theme.color.navy}>
          Сайн байна уу, {user?.name}
        </AppText>
        <AppText color={theme.color.secondary}>Танд томилогдсон дуудлага одоогоор алга.</AppText>
      </View>
    </SafeAreaView>
  )
}
