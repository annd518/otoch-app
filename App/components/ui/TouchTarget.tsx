import { useState } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  type TouchableOpacityProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme as t } from "@/design/theme";
import { onboardingVisual as v } from "@/design/onboardingVisual";
// Legacy flow actions retain their event handlers, disabled state and content.
export function TouchTarget({
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: TouchableOpacityProps) {
  const [pressed, setPressed] = useState(false);
  const surface = StyleSheet.flatten(style);
  const primary = !props.disabled && surface?.backgroundColor === t.color.brand;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      {...props}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        { minWidth: 48, minHeight: 48, justifyContent: "center" },
        style,
        primary && { borderRadius: 24, boxShadow: v.buttonShadow },
        pressed && primary && { transform: [{ scale: 0.98 }], ...t.depth.flat },
      ]}
    >
      {primary && (
        <LinearGradient
          pointerEvents="none"
          colors={pressed ? [v.deep, v.deep] : [v.blue, v.deep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />
      )}
      {children}
    </TouchableOpacity>
  );
}
