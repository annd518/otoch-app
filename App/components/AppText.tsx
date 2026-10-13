import React, { forwardRef } from "react";
import { Text as NativeText, StyleSheet, type TextProps } from "react-native";

// Expo registers each bundled face under its own name. Applying a second
// native fontWeight can select a system fallback instead of that face.
export const AppText = forwardRef<
  React.ComponentRef<typeof NativeText>,
  TextProps
>(function AppText({ style, ...props }, ref) {
  const resolved = StyleSheet.flatten(style);
  const family = resolved?.fontFamily ?? "NotoSans_400Regular";
  const bold = ["500", "600", "700", "800", "900", "bold"].includes(
    String(resolved?.fontWeight ?? "normal"),
  );
  const bundled =
    family.startsWith("NotoSans_") || family.startsWith("Montserrat_");
  const face =
    bold && bundled
      ? family.startsWith("Montserrat_")
        ? "Montserrat_700Bold"
        : "NotoSans_600SemiBold"
      : family;
  return (
    <NativeText
      {...props}
      ref={ref}
      style={[
        { fontFamily: "NotoSans_400Regular", fontSize: 18 },
        style,
        bundled ? { fontFamily: face, fontWeight: "normal" } : undefined,
      ]}
    />
  );
});
