import { useBookingDraft } from "@/context/BookingDraftContext";
import React, { useCallback, useState } from "react";
import { theme } from "@/design/theme";
import {
  Syringe,
  Bandage,
  HeartPulse,
  HandHeart,
  ChevronRight,
  CalendarDays,
  ArrowRight,
  Phone,
} from "lucide-react-native";
import {
  Linking,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
import { groups, orderStatus } from "@/design/catalog";
import { Banner, Copy, Screen } from "@/components/ui";
import { LinearGradient } from "expo-linear-gradient";
import { OnboardingHero } from "@/components/OnboardingHero";
import { ONBOARDING_SLIDES } from "@/design/onboarding";
import { onboardingVisual as v } from "@/design/onboardingVisual";

export default function Home() {
  const { dispatch } = useBookingDraft();
  const { width: measuredWidth, fontScale } = useWindowDimensions();
  const width = measuredWidth || 390;
  const columns = width >= 720 && fontScale < 1.3 ? 2 : 1;
  const stacked = fontScale >= 1.8;
  const icons = [Syringe, Bandage, HeartPulse, HandHeart];
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void apiService.listOrders().then((result) => {
        if (!active) return;
        if (result.ok) {
          setOrders(result.data);
          setError("");
        } else setError(result.message);
      });
      return () => {
        active = false;
      };
    }, []),
  );
  const current = orders.find(
    (o) =>
      !["COMPLETED", "CANCELLED", "EXPIRED", "BLOCKED_RED_FLAG"].includes(
        o.status,
      ),
  );
  return (
    <Screen title="OTOCH" back={false} logo>
      <View style={styles.hero}>
        <LinearGradient
          colors={[v.ice, v.surface, v.glow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroFill}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Copy style={styles.eyebrow}>ГЭРИЙН СУВИЛАХУЙ</Copy>
              <Copy style={styles.headline}>Сувилахуйн тусламжийг гэртээ</Copy>
            </View>
            {width >= 360 && fontScale < 1.3 && (
              <View
                pointerEvents="none"
                style={styles.heroArt}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.heroArtInner}>
                  <OnboardingHero slide={ONBOARDING_SLIDES[0]} />
                </View>
              </View>
            )}
          </View>
          <Copy style={styles.heroDescription}>
            Өөрт тохирох үйлчилгээг сонгож, хаяг болон цагаа захиалаарай.
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Сувилагч дуудах"
            onPress={() => {
              dispatch({ type: "reset" });
              router.push("/booking/catalog");
            }}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            {({ pressed }) => (
              <LinearGradient
                colors={pressed ? [v.deep, v.deep] : [v.blue, v.deep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaFill}
              >
                <Copy style={styles.ctaText}>Сувилагч дуудах</Copy>
                <ArrowRight color={v.white} size={22} />
              </LinearGradient>
            )}
          </Pressable>
        </LinearGradient>
      </View>

      {error ? (
        <Banner error>{error}</Banner>
      ) : current ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Идэвхтэй захиалга. ${orderStatus(current.status)}. Захиалгаа харах`}
          onPress={() =>
            router.push({
              pathname: "/orders/[id]",
              params: { id: current.id },
            })
          }
          style={({ pressed }) => [
            styles.status,
            styles.activeStatus,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.statusHeader}>
            <View style={styles.statusDot} />
            <Copy style={styles.statusEyebrow}>ИДЭВХТЭЙ ЗАХИАЛГА</Copy>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Copy style={styles.statusTitle}>
                {orderStatus(current.status)}
              </Copy>
              <Copy style={styles.viewLink}>Захиалгаа харах</Copy>
            </View>
            <ChevronRight size={22} color={v.deep} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.emptyStatus}>
          <CalendarDays color={v.muted} size={22} />
          <View style={styles.flex}>
            <Copy style={styles.emptyTitle}>Идэвхтэй захиалга алга</Copy>
            <Copy style={styles.description}>
              Шинэ захиалгын явцаа эндээс хянаарай.
            </Copy>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Copy style={styles.sectionTitle}>Үйлчилгээнүүд</Copy>
        <Copy style={styles.description}>Өөрт тохирох төрлөө сонгоорой.</Copy>
      </View>
      <View style={styles.serviceGrid}>
        {groups.map((group, index) => {
          const Icon = icons[index];
          return (
            <Pressable
              key={group.code}
              accessibilityRole="button"
              accessibilityLabel={`${group.title}. ${group.description}. Үйлчилгээ үзэх`}
              onPress={() =>
                router.push({
                  pathname: "/booking/catalog",
                  params: { group: group.code },
                })
              }
              style={({ pressed }) => [
                styles.serviceCard,
                { width: columns === 2 ? "48%" : "100%" },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.serviceRow, stacked && styles.stacked]}>
                <View style={styles.iconBadge}>
                  <Icon size={25} strokeWidth={1.7} color={v.deep} />
                </View>
                <View style={styles.flex}>
                  <Copy style={styles.categoryTitle}>{group.title}</Copy>
                  <Copy style={styles.description}>{group.description}</Copy>
                </View>
                {!stacked && <ChevronRight color={v.blue} size={20} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.emergency}>
        <View style={styles.emergencyTop}>
          <View style={styles.phoneBadge}>
            <Phone color={v.deep} size={22} />
          </View>
          <View style={styles.flex}>
            <Copy style={styles.emergencyTitle}>
              Яаралтай тусламж хэрэгтэй юу?
            </Copy>
            <Copy style={styles.description}>
              OTOCH нь яаралтай тусламжийн үйлчилгээ биш.
            </Copy>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="103 руу залгах"
          onPress={() => {
            void Linking.openURL("tel:103");
          }}
          style={({ pressed }) => [
            styles.emergencyAction,
            pressed && styles.pressed,
          ]}
        >
          <Copy style={styles.emergencyActionText}>103 руу залгах</Copy>
          <ArrowRight color={v.deep} size={18} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, boxShadow: v.cardShadow },
  heroFill: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: v.ice,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroText: { flex: 1, gap: 10, minWidth: 0 },
  eyebrow: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.2,
    color: v.deep,
  },
  headline: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 25,
    lineHeight: 33,
    color: v.navy,
  },
  heroDescription: { fontSize: 15, lineHeight: 24, color: v.muted },
  heroArt: { width: 104, height: 112 },
  heroArtInner: {
    position: "absolute",
    width: 272,
    height: 256,
    left: -84,
    top: -72,
    transform: [{ scale: 0.44 }],
  },
  cta: { borderRadius: 24, backgroundColor: v.deep, boxShadow: v.buttonShadow },
  ctaFill: {
    minHeight: 58,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  ctaText: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    color: v.white,
    flexShrink: 1,
    textAlign: "center",
  },
  ctaPressed: { transform: [{ scale: 0.98 }], ...theme.depth.flat },
  status: { padding: 18, borderRadius: 24, gap: 12 },
  activeStatus: {
    backgroundColor: v.glow,
    borderWidth: 1,
    borderColor: v.dot,
    ...theme.depth.soft,
  },
  statusHeader: { flexDirection: "row", gap: 8, alignItems: "center" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: v.blue },
  statusEyebrow: {
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "NotoSans_600SemiBold",
    color: v.deep,
    letterSpacing: 0.8,
  },
  statusTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 18,
    lineHeight: 26,
    color: v.navy,
  },
  viewLink: { fontSize: 13, lineHeight: 21, color: v.deep },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  emptyStatus: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  emptyTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 14,
    lineHeight: 22,
    color: v.navy,
  },
  sectionHeader: { gap: 4, paddingTop: 4 },
  sectionTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 20,
    lineHeight: 28,
    color: v.navy,
  },
  description: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: v.muted,
  },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  serviceCard: {
    padding: 16,
    minHeight: 100,
    borderRadius: 22,
    backgroundColor: v.surface,
    borderWidth: 1,
    borderColor: v.ice,
    ...theme.depth.soft,
  },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stacked: { flexDirection: "column", alignItems: "flex-start" },
  categoryTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 17,
    lineHeight: 25,
    color: v.navy,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: v.surface,
    alignItems: "center",
    justifyContent: "center",
    ...theme.depth.inset,
  },
  pressed: { backgroundColor: theme.color.inset, ...theme.depth.inset },
  emergency: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: v.surface,
    borderWidth: 1,
    borderColor: v.ice,
    gap: 14,
  },
  emergencyTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  phoneBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: v.badgeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 15,
    lineHeight: 23,
    color: v.navy,
  },
  emergencyAction: {
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: v.dot,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  emergencyActionText: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    color: v.deep,
  },
});
