import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import { Stethoscope, type LucideIcon } from "lucide-react-native";
import { AppText } from "./AppText";
import { theme as t } from "../design/theme";
import { onboardingVisual as v } from "../design/onboardingVisual";

export function Surface({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: t.color.surface,
          borderRadius: 28,
          padding: 20,
          gap: 16,
          borderWidth: 1,
          borderColor: v.white,
          ...t.depth.soft,
        },
        style,
      ]}
    />
  );
}
export function Intro({
  title,
  description,
  icon: Icon = Stethoscope,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.color.surface,
          ...t.depth.inset,
        }}
      >
        <Icon size={25} color={v.deep} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {description ? (
          <AppText variant="caption" color={t.color.secondary}>
            {description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
export function BrandHeader() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 8,
      }}
    >
      <Image
        source={require("../assets/images/otoch-wordmark.png")}
        accessibilityLabel="ОТОЧ"
        resizeMode="contain"
        style={{ width: 138, height: 40, tintColor: v.deep }}
      />
      <View
        style={{
          backgroundColor: v.glow,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 16,
        }}
      >
        <AppText variant="caption" color={v.deep}>
          Сувилагч
        </AppText>
      </View>
    </View>
  );
}
export function Hero({ name }: { name?: string }) {
  return (
    <Surface style={{ backgroundColor: v.ice, ...t.depth.raised }}>
      <Intro
        title={name ? `Сайн байна уу, ${name}` : "Таны дуудлагууд"}
        description="Танд томилогдсон тусламж, шинэ дуудлагуудаа эндээс хянаарай."
      />
    </Surface>
  );
}
export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        gap: 16,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: t.color.border,
      }}
    >
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}
// Existing action handlers and guards are supplied by each screen without modification.
export function TaskBody({
  children,
  footer,
  ...props
}: ScrollViewProps & { footer?: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        {...props}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            padding: 20,
            gap: 10,
            borderTopWidth: 1,
            borderTopColor: t.color.border,
            backgroundColor: t.color.surface,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
