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
import { Button, Banner, Card, Copy, Screen } from "@/components/ui";
export default function Home() {
  const { dispatch } = useBookingDraft();
  const { width, fontScale } = useWindowDimensions();
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
      <Copy variant="heading">Таны гэрт сувилахуйн тусламж</Copy>
      <Button
        title="Сувилагч дуудах"
        onPress={() => {
          dispatch({ type: "reset" });
          router.push("/booking/catalog");
        }}
      />
      {error ? (
        <Banner error>{error}</Banner>
      ) : current ? (
        <Card style={{ backgroundColor: theme.color.navy }}>
          <Copy variant="heading" style={{ color: theme.color.background }}>
            Идэвхтэй захиалга
          </Copy>
          <Copy style={{ color: theme.color.background }}>
            {orderStatus(current.status)}
          </Copy>
          <Button
            secondary
            title="Захиалгаа харах"
            onPress={() =>
              router.push({
                pathname: "/orders/[id]",
                params: { id: current.id },
              })
            }
          />
        </Card>
      ) : (
        <Card style={{ backgroundColor: theme.color.muted, padding: 16 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <CalendarDays color={theme.color.secondary} size={24} />
            <View style={{ flex: 1, gap: 4 }}>
              <Copy variant="label">Идэвхтэй захиалга алга</Copy>
              <Copy style={styles.description}>
                Шинэ захиалгаа эндээс хянах боломжтой.
              </Copy>
            </View>
          </View>
        </Card>
      )}
      <View style={{ gap: 4 }}>
        <Copy variant="heading" style={styles.sectionTitle}>
          Үйлчилгээнүүд
        </Copy>
        <Copy style={styles.description}>
          Өөрт тохирох үйлчилгээг сонгоорой.
        </Copy>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
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
                {
                  width: columns === 2 ? "48%" : "100%",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: stacked ? "column" : "row",
                  gap: 14,
                  alignItems: stacked ? "flex-start" : "center",
                }}
              >
                <View style={styles.iconBadge}>
                  <Icon color={theme.color.brand} size={26} strokeWidth={1.8} />
                </View>
                <View
                  style={{ flex: stacked ? undefined : 1, gap: 6, minWidth: 0 }}
                >
                  <Copy variant="label" style={styles.categoryTitle}>
                    {group.title}
                  </Copy>
                  <Copy style={styles.description}>{group.description}</Copy>
                  <Copy variant="label" style={styles.viewLink}>
                    Үйлчилгээ үзэх
                  </Copy>
                </View>
                {!stacked && (
                  <ChevronRight color={theme.color.brand} size={20} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Banner>
        OTOCH нь яаралтай тусламжийн үйлчилгээ биш. Яаралтай үед 103 руу
        залгаарай.
      </Banner>
      <Button
        secondary
        title="103 руу залгах"
        onPress={() => {
          void Linking.openURL("tel:103");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 20,
    lineHeight: 28,
  },
  categoryTitle: {
    fontFamily: "NotoSans_600SemiBold",
    fontSize: 18,
    lineHeight: 26,
    color: theme.color.navy,
  },
  description: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme.color.secondary,
  },
  viewLink: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.color.brand,
    marginTop: 2,
  },
  serviceCard: {
    backgroundColor: theme.color.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 18,
    minHeight: 112,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.color.info,
    alignItems: "center",
    justifyContent: "center",
  },
});
