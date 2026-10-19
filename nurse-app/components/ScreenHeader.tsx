import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

interface Props {
  title?: string
  // Where "back" goes when there is no history (a deep link or a restart).
  fallback?: '/welcome' | '/login' | '/register'
  action?: { label: string; onPress: () => void }
  color?: string
}

export function ScreenHeader({ title, fallback = '/welcome', action, color = theme.color.navy }: Props) {
  const router = useRouter()
  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Буцах"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <ArrowLeft color={color} size={24} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <AppText variant="label" color={color} accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
      </View>
      <View style={{ minWidth: 48, alignItems: 'flex-end' }}>
        {action ? (
          <Pressable
            accessibilityRole="link"
            onPress={action.onPress}
            hitSlop={8}
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.space[1] }}
          >
            <AppText variant="label" color={theme.color.brand}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
