import { dateTimeLabel } from "@/design/dateLabels";
import { CalendarDays } from "lucide-react-native";
import {
  FeatureSummary,
  StatusPill,
  Button,
  Card,
  Chip,
  Copy,
  Screen,
  StateView,
} from "@/components/ui";
import { useBookingDraft } from "@/context/BookingDraftContext";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
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
      <FeatureSummary
        icon={CalendarDays}
        title="Таны тусламжийн хуваарь"
        description="Идэвхтэй болон өмнөх захиалгаа нэг дороос хянаарай."
      />
      <Button
        title="Шинэ захиалга"
        onPress={() => {
          dispatch({ type: "reset" });
          router.push("/booking/catalog");
        }}
      />
      <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
        {[
          ["active", "Идэвхтэй"],
          ["past", "Өмнөх"],
          ["cancelled", "Цуцалсан / зогссон"],
        ].map(([key, label]) => (
          <Chip
            key={key}
            style={key === "cancelled" ? { width: "100%" } : { flex: 1 }}
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
            <StatusPill status={o.status} />
            <Copy>
              {o.scheduledFor ? dateTimeLabel(o.scheduledFor) : "Цаг сонгоогүй"}
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
