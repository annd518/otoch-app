import { useBookingDraft } from "@/context/BookingDraftContext";
import React, { useCallback, useState } from "react";
import { theme } from "@/design/theme";
import { Syringe, Bandage, HeartPulse, HandHeart } from "lucide-react-native";
import { Linking, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
import { groups, orderStatus } from "@/design/catalog";
import { Button, Banner, Card, Copy, Screen, StateView } from "@/components/ui";
export default function Home() {
  const { dispatch } = useBookingDraft();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 380 && fontScale < 1.4 ? 2 : 1;
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
    <Screen title="OTOCH" back={false}>
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
        <StateView
          title="Идэвхтэй захиалга алга"
          message="Өөрт тохирох үйлчилгээг доороос сонгоорой."
        />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {groups.map((group, index) => {
          const Icon = icons[index];
          return (
            <Card
              key={group.code}
              style={{ width: columns === 2 ? "48%" : "100%" }}
            >
              <Icon color={theme.color.brand} size={32} />
              <Copy variant="heading" style={{ fontSize: 20, lineHeight: 28 }}>
                {group.title}
              </Copy>
              <Copy>{group.description}</Copy>
              <Button
                secondary
                title="Үйлчилгээ үзэх"
                onPress={() =>
                  router.push({
                    pathname: "/booking/catalog",
                    params: { group: group.code },
                  })
                }
              />
            </Card>
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
