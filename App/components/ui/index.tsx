import React, { useSyncExternalStore, useState } from "react";
import { connectivity } from "@/services/connectivity";
import { apiService } from "@/services/api";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  type TextProps,
  type ViewProps,
} from "react-native";
import { AppText as Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Inbox } from "lucide-react-native";
import { NeuIconButton } from "./NeuIconButton";
import { NeuSurface } from "./NeuSurface";
import { theme as t } from "@/design/theme";

export { NeuSurface, NeuIconButton };

export function Copy({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: keyof typeof t.type }) {
  return (
    <Text
      {...props}
      style={[t.type[variant], { color: t.color.text }, style]}
    />
  );
}
export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary = false,
  network = false,
  variant,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  network?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const offline = useSyncExternalStore(
    connectivity.subscribe,
    connectivity.get,
    () => false,
  );
  const unavailable = disabled || busy || (network && offline);
  const kind = variant ?? (secondary ? "secondary" : "primary");
  const light = kind === "secondary" || kind === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!unavailable || !!busy, busy: !!busy }}
      disabled={unavailable || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        unavailable || kind === "ghost"
          ? t.depth.flat
          : light
            ? t.depth.soft
            : t.depth.action,
        pressed && { ...t.depth.flat, transform: [{ scale: 0.98 }] },
        {
          backgroundColor: unavailable
            ? t.color.muted
            : light
              ? kind === "ghost"
                ? "transparent"
                : pressed
                  ? t.color.inset
                  : t.color.surface
              : kind === "danger"
                ? t.color.error
                : pressed
                  ? t.color.pressed
                  : t.color.brand,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={light || unavailable ? t.color.brand : t.color.onBrand}
        />
      ) : (
        <Copy
          variant="label"
          style={{
            fontSize: 16,
            color: unavailable
              ? t.color.disabled
              : light
                ? t.color.brand
                : t.color.background,
            textAlign: "center",
          }}
        >
          {title}
        </Copy>
      )}
    </Pressable>
  );
}
export function Card({ style, ...props }: ViewProps) {
  return <NeuSurface {...props} style={[styles.card, style]} />;
}
export function Banner({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { backgroundColor: error ? t.color.errorBg : t.color.info },
      ]}
    >
      {React.Children.toArray(children).map((child, i) =>
        typeof child === "string" || typeof child === "number" ? (
          <Copy
            key={i}
            style={{ color: error ? t.color.error : t.color.brand }}
          >
            {child}
          </Copy>
        ) : (
          child
        ),
      )}
    </View>
  );
}
export function Input({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Copy variant="label">{label}</Copy>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={t.color.secondary}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          t.depth.inset,
          {
            borderColor: error
              ? t.color.error
              : focused
                ? t.color.brand
                : t.color.border,
            borderWidth: error || focused ? 2 : 1,
          },
          props.style,
        ]}
      />
      {!!error && <Banner error>{error}</Banner>}
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected && {
          ...t.depth.inset,
          backgroundColor: t.color.info,
          borderColor: t.color.brand,
        },
        style,
      ]}
    >
      <Copy variant="label">{label}</Copy>
    </Pressable>
  );
}
export function Stepper({ step }: { step: number }) {
  return (
    <View accessibilityLabel={`Захиалгын ${step} / 4 алхам`} style={{ gap: 8 }}>
      <Copy variant="label">Алхам {step} / 4</Copy>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              backgroundColor: i <= step ? t.color.brand : t.color.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}
export function StateView({
  title,
  message,
  loading,
  action,
  onAction,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      {!loading && <Inbox size={28} color={t.color.brand} accessible={false} />}
      <Copy variant="heading">{title}</Copy>
      {loading ? (
        <View accessibilityLabel="Агуулга ачаалж байна" style={{ gap: 12 }}>
          {[90, 70, 100].map((width, i) => (
            <View
              key={i}
              style={{
                height: 24,
                width: `${width}%`,
                backgroundColor: t.color.muted,
                borderRadius: 8,
              }}
            />
          ))}
        </View>
      ) : (
        message && <Copy>{message}</Copy>
      )}
      {action && onAction && <Button title={action} onPress={onAction} />}
    </Card>
  );
}
function OfflineBanner() {
  const offline = useSyncExternalStore(
    connectivity.subscribe,
    connectivity.get,
    () => false,
  );
  return offline ? (
    <Banner>
      <Copy>
        Сүлжээгүй байна. Хадгалсан мэдээлэл шинэчлэгдээгүй. Төлбөр болон илгээх
        үйлдлийг түр хаасан.
      </Copy>
      <Button
        secondary
        title="Холболтыг дахин шалгах"
        onPress={() => {
          void apiService.retryConnection();
        }}
      />
    </Banner>
  ) : null;
}
// The designer's "ОТОЧ" wordmark (cut from the splash logo, white); tinted
// with the theme colour. 654x183 @3x.
const WORDMARK = require("../../assets/brand/otoch-wordmark.png");
const WORDMARK_HEIGHT = 40;
const WORDMARK_WIDTH = Math.round((WORDMARK_HEIGHT * 654) / 183);

export function Screen({
  title,
  back = true,
  logo = false,
  children,
}: {
  title: string;
  back?: boolean;
  // show the ОТОЧ wordmark instead of the title text (still read out as `title`)
  logo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.color.subtle }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {back && (
            <NeuIconButton
              label="Буцах"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              accessibilityRole="button"
              accessibilityLabel="Буцах"
              style={{
                minWidth: 48,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft color={t.color.brand} size={24} />
            </NeuIconButton>
          )}
          {logo ? (
            <View
              style={{ flex: 1 }}
              accessible
              accessibilityRole="header"
              accessibilityLabel={title}
            >
              <Image
                source={WORDMARK}
                resizeMode="contain"
                style={{
                  width: WORDMARK_WIDTH,
                  height: WORDMARK_HEIGHT,
                  tintColor: t.color.navy,
                }}
              />
            </View>
          ) : (
            <Copy
              variant="title"
              accessibilityRole="header"
              style={{ flex: 1 }}
            >
              {title}
            </Copy>
          )}
        </View>
        {process.env.EXPO_PUBLIC_APP_ENV === "staging-test" && (
          <Banner>
            Туршилтын орчин · бодит төлбөр биш. Зөвхөн зохиомол мэдээлэл
            ашиглана.
          </Banner>
        )}
        <OfflineBanner />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: t.radius.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: t.color.surface,
    padding: 20,
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 12,
  },
  banner: { padding: 16, borderRadius: 12 },
  input: {
    ...t.type.body,
    minHeight: 56,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    color: t.color.text,
  },
  chip: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
  },
});
