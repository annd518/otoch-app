import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { theme } from "../design/theme";
import { onboardingVisual as v } from "../design/onboardingVisual";
import { AppText } from "./AppText";
interface Props extends Omit<PressableProps, "children"> {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary";
}
export function Button({
  label,
  loading = false,
  variant = "primary",
  disabled,
  style,
  ...rest
}: Props) {
  const inactive = disabled || loading,
    primary = variant === "primary";
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        {
          minHeight: 60,
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: primary ? 0 : 1,
          borderColor: theme.color.border,
          backgroundColor: inactive ? theme.color.muted : theme.color.surface,
          ...(inactive
            ? theme.depth.flat
            : primary
              ? theme.depth.action
              : theme.depth.soft),
          ...(state.pressed
            ? { ...theme.depth.inset, transform: [{ scale: 0.98 }] }
            : {}),
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {({ pressed }) => (
        <>
          {primary && !inactive && (
            <LinearGradient
              pointerEvents="none"
              colors={pressed ? [v.deep, v.deep] : [v.blue, v.deep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {loading ? (
              <ActivityIndicator
                color={
                  inactive
                    ? theme.color.brand
                    : primary
                      ? v.white
                      : theme.color.brand
                }
              />
            ) : (
              <>
                <AppText
                  variant="label"
                  color={
                    inactive ? theme.color.disabled : primary ? v.white : v.deep
                  }
                  style={{ textAlign: "center", flexShrink: 1 }}
                >
                  {label}
                </AppText>
                {primary && !inactive && (
                  <ArrowRight size={20} color={v.white} />
                )}
              </>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}
