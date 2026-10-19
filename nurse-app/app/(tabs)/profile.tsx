import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { useSession } from '../../context/SessionContext'
import { theme } from '../../design/theme'

export default function ProfileScreen() {
  const { user, signOut } = useSession()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <View style={{ flex: 1, padding: theme.space[5], gap: theme.space[3] }}>
        <AppText variant="heading" color={theme.color.navy}>
          Профайл
        </AppText>
        <View style={{ gap: theme.space[1] }}>
          <AppText variant="label">{user?.name}</AppText>
          <AppText color={theme.color.secondary}>{user?.email}</AppText>
        </View>
        <Button label="Гарах" variant="secondary" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  )
}
