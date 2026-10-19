import { Text, type TextProps } from 'react-native'

import { theme } from '../design/theme'

type Variant = keyof typeof theme.type

interface Props extends TextProps {
  variant?: Variant
  color?: string
}

// Font scaling is never capped (spec p.93, text up to 200%).
export function AppText({ variant = 'body', color = theme.color.text, style, ...rest }: Props) {
  return <Text {...rest} style={[theme.type[variant], { color }, style]} />
}
