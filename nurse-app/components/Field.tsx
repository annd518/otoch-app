import { TextInput, View, type TextInputProps } from 'react-native'

import { theme } from '../design/theme'
import { AppText } from './AppText'

interface Props extends TextInputProps {
  label: string
  error?: string
  unit?: string
}

export function Field({ label, error, unit, style, ...rest }: Props) {
  return (
    <View style={{ gap: theme.space[0] }}>
      <AppText variant="label">
        {label}
        {unit ? <AppText variant="caption" color={theme.color.secondary}>{`  ${unit}`}</AppText> : null}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.disabled}
        {...rest}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? theme.color.error : theme.color.border,
            borderRadius: theme.radius.small,
            paddingHorizontal: theme.space[3],
            color: theme.color.text,
            ...theme.type.body,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" color={theme.color.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  )
}
