import { ActivityIndicator, Pressable, type PressableProps } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

interface Props extends Omit<PressableProps, 'children'> {
  label: string
  loading?: boolean
  variant?: 'primary' | 'secondary'
}

// Minimum 48 px touch target, grows with text (spec p.88).
export function Button({ label, loading = false, variant = 'primary', disabled, style, ...rest }: Props) {
  const inactive = disabled || loading
  const primary = variant === 'primary'
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        {
          minHeight: 48,
          paddingHorizontal: theme.space[3],
          paddingVertical: theme.space[2],
          borderRadius: theme.radius.small,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: primary ? 0 : 1,
          borderColor: theme.color.border,
          backgroundColor: inactive
            ? theme.color.muted
            : primary
              ? state.pressed
                ? theme.color.pressed
                : theme.color.brand
              : theme.color.background,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : theme.color.brand} />
      ) : (
        <AppText
          variant="label"
          color={inactive ? theme.color.disabled : primary ? '#FFFFFF' : theme.color.brand}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  )
}
