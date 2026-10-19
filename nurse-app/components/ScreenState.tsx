import { View } from "react-native";

import { theme } from "../design/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

// Loading placeholder: skeleton blocks, not a spinner (spec p.81).
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Ачаалж байна" style={{ gap: theme.space[2] }}>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            height: 96,
            borderRadius: theme.radius.card,
            backgroundColor: theme.color.muted,
          }}
        />
      ))}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: theme.space[1],
        padding: theme.space[5],
        backgroundColor: theme.color.surface,
        borderRadius: theme.radius.large,
      }}
    >
      <AppText variant="label">{title}</AppText>
      {hint ? (
        <AppText
          variant="caption"
          color={theme.color.secondary}
          style={{ textAlign: "center" }}
        >
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        gap: theme.space[2],
        padding: theme.space[5],
        backgroundColor: theme.color.surface,
        borderRadius: theme.radius.large,
      }}
    >
      <AppText variant="label" color={theme.color.error}>
        Ачаалж чадсангүй
      </AppText>
      <AppText color={theme.color.secondary}>{message}</AppText>
      <Button label="Дахин оролдох" variant="secondary" onPress={onRetry} />
    </View>
  );
}

// Shown above stale data when a refresh failed (offline state).
export function OfflineBanner({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.color.warningBg,
        borderRadius: theme.radius.small,
        padding: theme.space[2],
      }}
    >
      <AppText variant="caption" color={theme.color.warning}>
        {message}
      </AppText>
    </View>
  );
}
