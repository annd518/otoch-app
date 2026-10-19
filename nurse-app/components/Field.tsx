import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { theme } from "../design/theme";
import { AppText } from "./AppText";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  unit?: string;
}

export function Field({ label, error, unit, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: theme.space[0] }}>
      <AppText variant="label">
        {label}
        {unit ? (
          <AppText
            variant="caption"
            color={theme.color.secondary}
          >{`  ${unit}`}</AppText>
        ) : null}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.disabled}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          {
            minHeight: 56,
            paddingVertical: 14,
            backgroundColor: theme.color.inset,
            ...theme.depth.inset,
            borderWidth: 1,
            borderColor: error
              ? theme.color.error
              : focused
                ? theme.color.brand
                : theme.color.border,
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
  );
}
