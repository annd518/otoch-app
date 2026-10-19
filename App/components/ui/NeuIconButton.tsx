import React from "react";
import { Pressable, type PressableProps } from "react-native";
import { theme as t } from "@/design/theme";

export function NeuIconButton({
  label,
  children,
  style,
  ...props
}: PressableProps & { label: string }) {
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(state) => [
        {
          minWidth: 48,
          minHeight: 48,
          padding: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.color.surface,
          borderRadius: t.radius.round,
          borderWidth: 1,
          borderColor: t.color.border,
        },
        state.pressed ? t.depth.inset : t.depth.soft,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {children}
    </Pressable>
  );
}
