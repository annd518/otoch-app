import { useBookingDraft } from "@/context/BookingDraftContext";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
import { orderStatus } from "@/design/catalog";
import { Button, Card, Chip, Copy, Screen, StateView } from "@/components/ui";
export default function OrdersScreen() {
  const { dispatch } = useBookingDraft();
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("active"),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const r = await apiService.listOrders();
    setLoading(false);
    if (r.ok) {
      setOrders(r.data);
      setError("");
    } else setError(r.message);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const visible = orders.filter((o) =>
    filter === "past"
      ? o.status === "COMPLETED"
      : filter === "cancelled"
        ? ["CANCELLED", "EXPIRED", "BLOCKED_RED_FLAG"].includes(o.status)
        : !["COMPLETED", "CANCELLED", "EXPIRED", "BLOCKED_RED_FLAG"].includes(
            o.status,
          ),
  );
  return (
    <Screen title="Захиалга" back={false}>
      <Button
        title="Шинэ захиалга"
        onPress={() => {
          dispatch({ type: "reset" });
          router.push("/booking/catalog");
        }}
      />
      <View style={{ gap: 8 }}>
        {[
          ["active", "Идэвхтэй"],
          ["past", "Өмнөх"],
          ["cancelled", "Цуцалсан / зогссон"],
        ].map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={filter === key}
            onPress={() => setFilter(key)}
          />
        ))}
      </View>
      {loading ? (
        <StateView title="Захиалга ачаалж байна" loading />
      ) : error ? (
        <StateView
          title="Ачаалж чадсангүй"
          message={error}
          action="Дахин оролдох"
          onAction={() => {
            void load();
          }}
        />
      ) : !visible.length ? (
        <StateView
          title="Захиалга алга"
          message="Сонгосон хэсэгт захиалга байхгүй байна."
        />
      ) : (
        visible.map((o) => (
          <Card key={o.id}>
            <Copy variant="heading">{orderStatus(o.status)}</Copy>
            <Copy>
              {o.scheduledFor
                ? new Date(o.scheduledFor).toLocaleString("mn-MN", {
                    timeZone: "Asia/Ulaanbaatar",
                  })
                : "Цаг сонгоогүй"}
            </Copy>
            <Button
              secondary
              title="Дэлгэрэнгүй"
              onPress={() =>
                router.push({ pathname: "/orders/[id]", params: { id: o.id } })
              }
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
