import { Check } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

// A round tick box with a statement next to it (48 px tall at least).
export function CheckRow({ checked, text, onToggle }: { checked: boolean; text: string; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.space[2], paddingVertical: theme.space[1] }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: checked ? theme.color.brand : theme.color.disabled,
          backgroundColor: checked ? theme.color.brand : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}
      </View>
      <AppText style={{ flex: 1, fontSize: 16, lineHeight: 24 }}>{text}</AppText>
    </Pressable>
  )
}
