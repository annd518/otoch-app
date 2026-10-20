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
import { ScrollView } from "react-native";
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
        ? ["CANCELLED", "EXPIRED", "BLOCKED_RED_FLAG", "REFUSED"].includes(
            o.status,
          )
        : ![
            "COMPLETED",
            "CANCELLED",
            "EXPIRED",
            "BLOCKED_RED_FLAG",
            "REFUSED",
          ].includes(o.status),
  );
  return (
    <Screen
      title="Захиалга"
      back={false}
      sticky={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
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
        </ScrollView>
      }
      footer={
        <Button
          title="Шинэ захиалга"
          onPress={() => {
            dispatch({ type: "reset" });
            router.push("/booking/catalog");
          }}
        />
      }
    >
      <FeatureSummary
        compact
        icon={CalendarDays}
        title="Таны тусламжийн хуваарь"
        description="Идэвхтэй болон өмнөх захиалгаа нэг дороос хянаарай."
      />

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
