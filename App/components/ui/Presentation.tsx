import { dateTimeLabel } from "@/design/dateLabels";
import React from "react";
import { View, StyleSheet } from "react-native";
import {
  Check,
  Syringe,
  Bandage,
  HeartPulse,
  HandHeart,
  type LucideIcon,
} from "lucide-react-native";
import { AppText } from "@/components/AppText";
import { theme as t } from "@/design/theme";
import { onboardingVisual as v } from "@/design/onboardingVisual";
import { orderStatus } from "@/design/catalog";

export function careIcon(group?: string): LucideIcon {
  return (
    (
      {
        GROUP_A: Syringe,
        GROUP_B: Bandage,
        GROUP_C: HeartPulse,
        GROUP_D: HandHeart,
      } as Record<string, LucideIcon>
    )[group ?? ""] ?? HeartPulse
  );
}

export function SectionHeading({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={s.headingRow}>
      {Icon && (
        <View style={s.icon}>
          <Icon size={23} color={v.deep} strokeWidth={1.7} />
        </View>
      )}
      <View style={s.flex}>
        <AppText style={s.heading}>{title}</AppText>
        {subtitle && <AppText style={s.body}>{subtitle}</AppText>}
      </View>
    </View>
  );
}
export function FeatureSummary({
  title,
  description,
  icon,
  children,
  compact = false,
}: {
  title: string;
  compact?: boolean;
  description?: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <View style={compact ? { gap: 12, paddingVertical: 4 } : s.feature}>
      <SectionHeading title={title} subtitle={description} icon={icon} />
      {children}
    </View>
  );
}
export function StatusPill({ status }: { status: string }) {
  const good = status === "COMPLETED" || status === "PAID";
  const blocked = ["BLOCKED_RED_FLAG", "CANCELLED", "EXPIRED"].includes(status);
  const color = blocked ? t.color.error : good ? t.color.success : v.deep;
  return (
    <View
      style={[
        s.pill,
        {
          backgroundColor: blocked
            ? t.color.errorBg
            : good
              ? t.color.successBg
              : v.glow,
        },
      ]}
    >
      <View style={[s.dot, { backgroundColor: color }]} />
      <AppText style={[s.pillText, { color }]}>{orderStatus(status)}</AppText>
    </View>
  );
}
export function EventTimeline({
  events,
}: {
  events: { id: string; status: string; at: string }[];
}) {
  return (
    <View>
      {events.map((event, index) => (
        <View key={event.id} style={s.event}>
          <View style={s.rail}>
            <View style={s.eventDot}>
              <Check size={13} color={v.white} />
            </View>
            {index < events.length - 1 && <View style={s.line} />}
          </View>
          <View style={s.eventText}>
            <AppText style={s.eventTitle}>{orderStatus(event.status)}</AppText>
            <AppText style={s.body}>{dateTimeLabel(event.at)}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1, gap: 4, minWidth: 0 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: v.navy,
  },
  body: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 14,
    lineHeight: 23,
    color: t.color.secondary,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: v.surface,
    alignItems: "center",
    justifyContent: "center",
    ...t.depth.inset,
  },
  feature: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: v.ice,
    borderWidth: 1,
    borderColor: v.white,
    gap: 16,
    ...t.depth.soft,
  },
  pill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillText: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 13,
    lineHeight: 21,
    flexShrink: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  event: { flexDirection: "row", gap: 12 },
  rail: { width: 22, alignItems: "center" },
  eventDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: v.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { width: 2, backgroundColor: v.dot, flex: 1, minHeight: 18 },
  eventText: { flex: 1, gap: 4, paddingBottom: 22 },
  eventTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 15,
    lineHeight: 23,
    color: v.navy,
  },
});
