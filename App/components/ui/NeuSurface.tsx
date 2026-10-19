import React from "react";
import { View, type ViewProps } from "react-native";
import { theme as t } from "@/design/theme";

export type SurfaceTone = "raised" | "flat" | "inset" | "pressed" | "selected";
export function NeuSurface({
  tone = "raised",
  style,
  ...props
}: ViewProps & { tone?: SurfaceTone }) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: tone === "selected" ? t.color.info : t.color.surface,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: tone === "selected" ? t.color.brand : t.color.border,
        },
        tone === "raised"
          ? t.depth.soft
          : tone === "inset" || tone === "pressed" || tone === "selected"
            ? t.depth.inset
            : t.depth.flat,
        style,
      ]}
    />
  );
}
