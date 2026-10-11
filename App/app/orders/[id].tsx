import React, { useCallback, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
import { orderStatus } from "@/design/catalog";
import { Banner, Button, Card, Copy, Screen, StateView } from "@/components/ui";
import { useBookingDraft } from "@/context/BookingDraftContext";
import { ulaanbaatarDate } from "@/utils/datetime";
export default function OrderDetail() {
  const { dispatch } = useBookingDraft();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let active = true,
        busy = false;
      const load = async () => {
        if (busy || AppState.currentState !== "active") return;
        busy = true;
        try {
          const r = await apiService.getOrder(id);
          if (active) {
            if (r.ok) {
              setOrder(r.data);
              setError("");
            } else setError(r.message);
          }
        } finally {
          busy = false;
        }
      };
      void load();
      const timer = setInterval(() => {
        void load();
      }, 10000);
      const listener = AppState.addEventListener("change", (s) => {
        if (s === "active") void load();
      });

      return () => {
        active = false;
        clearInterval(timer);
        listener.remove();
      };
    }, [id]),
  );
  const resume = async () => {
    if (!order) return;
    const [catalog, parent] = await Promise.all([
      apiService.getCatalog(),
      apiService.getParent(order.parentId),
    ]);
    if (!catalog.ok || !parent.ok) {
      setError(
        !catalog.ok
          ? catalog.message
          : !parent.ok
            ? parent.message
            : "Мэдээлэл дутуу",
      );
      return;
    }
    const service = catalog.data.services.find(
      (s) => s.code === order.serviceCodes[0],
    );
    if (!service) {
      setError("Үйлчилгээ каталогоос хасагдсан байна.");
      return;
    }
    dispatch({ type: "reset" });
    dispatch({
      type: "selectService",
      service,
      catalogVersion: catalog.data.catalogVersion,
      source: apiService.sourceOf("catalog"),
    });
    dispatch({
      type: "updateDetails",
      patch: {
        parentId: order.parentId,
        parentName: parent.data.name,
        addressText: order.address?.text ?? "",
        lat: order.address?.lat,
        lng: order.address?.lng,
        zoneId: order.zoneId ?? undefined,
        date: order.scheduledFor
          ? ulaanbaatarDate(new Date(order.scheduledFor))
          : "",
        timeSlot: order.timeSlot ?? "",
        ...(order.bookingForm && { bookingForm: order.bookingForm }),
      },
    });
    dispatch({
      type: "draftSaved",
      order,
      source: apiService.sourceOf("orders"),
    });
    for (const attachment of order.attachments ?? [])
      dispatch({
        type: "attachmentAdded",
        attachment: {
          localId: attachment.id,
          uri: "",
          name: "Серверт хадгалсан заалт",
          mimeType:
            attachment.mimeType === "image/png" ? "image/png" : "image/jpeg",
          sizeBytes: attachment.sizeBytes,
          status: "uploaded",
          progress: 1,
          serverId: attachment.id,
          error: null,
        },
      });
    router.push("/(tabs)/bookappointment");
  };
  return (
    <Screen title="Захиалгын дэлгэрэнгүй">
      {!!error && <Banner error>{error}</Banner>}
      {!order ? (
        <StateView title="Захиалга ачаалж байна" loading={!error} />
      ) : (
        <>
          <Card>
            <Copy variant="heading">{orderStatus(order.status)}</Copy>
            <Copy>
              {order.scheduledFor
                ? new Date(order.scheduledFor).toLocaleString("mn-MN", {
                    timeZone: "Asia/Ulaanbaatar",
                  })
                : "Цаг сонгоогүй"}
            </Copy>
          </Card>
          <Card>
            <Copy variant="heading">Сувилагч</Copy>
            <Copy>{order.nurse?.name ?? "Томилогдоогүй"}</Copy>
            <Copy>
              {order.eta
                ? `Ирэх хугацаа: ${new Date(order.eta).toLocaleTimeString("mn-MN")}`
                : "Ирэх хугацаа хараахан тодорхойгүй"}
            </Copy>
          </Card>
          <Card>
            <Copy variant="heading">Захиалгын явц</Copy>
            {order.timeline?.length ? (
              order.timeline.map((e) => (
                <Copy key={e.id}>
                  {orderStatus(e.status)} ·{" "}
                  {new Date(e.at).toLocaleString("mn-MN", {
                    timeZone: "Asia/Ulaanbaatar",
                  })}
                </Copy>
              ))
            ) : (
              <Copy>Явцын мэдээлэл одоогоор алга.</Copy>
            )}
          </Card>
          {order.status === "DRAFT" && (
            <Button
              title="Ноорог үргэлжлүүлэх"
              onPress={() => {
                void resume();
              }}
            />
          )}
          {["AWAITING_PAYMENT", "PAID"].includes(order.status) && (
            <Button
              title="Төлбөрийн мэдээлэл"
              onPress={() =>
                router.push({
                  pathname: "/booking/payment",
                  params: { orderId: order.id },
                })
              }
            />
          )}
          <Copy>Мэдээллийг 10 секунд тутам шинэчилнэ.</Copy>
        </>
      )}
    </Screen>
  );
}
