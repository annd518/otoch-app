import { dateTimeLabel, timeLabel } from "@/design/dateLabels";
import { UserRound, CalendarDays } from "lucide-react-native";
import {
  SectionHeading,
  StatusPill,
  EventTimeline,
  FormSection,
  Banner,
  Button,
  Card,
  Copy,
  Screen,
  StateView,
} from "@/components/ui";
import React, { useCallback, useState } from "react";
import { Alert, AppState } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiService } from "@/services/api";
import type { CancelTerms, Order } from "@/services/apiTypes";
import { useBookingDraft } from "@/context/BookingDraftContext";
import { ulaanbaatarDate } from "@/utils/datetime";
import { formatMnt } from "@/utils/money";

// Statuses the customer may cancel (server: services/cancellation.ts).
const CANCELLABLE = ["DRAFT", "AWAITING_PAYMENT", "PAID", "ASSIGNED", "EN_ROUTE"];

/** The cancellation terms in plain words (spec slide 25). */
function termsText(t: Extract<CancelTerms, { allowed: true }>): string {
  if (t.rule === "UNPAID") return "Төлбөр төлөгдөөгүй тул буцаах мөнгө байхгүй.";
  if (t.refundPercent === 100)
    return `Төлсөн ${formatMnt(t.paidMnt)} бүрэн буцаагдана (QPay-ээр, 1–3 ажлын өдөрт).`;
  return `Үйлчилгээ эхлэхэд 2 цагаас бага хугацаа үлдсэн тул ${formatMnt(t.feeMnt)} (${100 - t.refundPercent}%) хураамж суутгаж, ${formatMnt(t.refundMnt)} (${t.refundPercent}%) буцаана.`;
}

const REFUND_TEXT = {
  PENDING: "буцаалт хийгдэж байна",
  REFUNDED: "буцаагдсан",
  MANUAL_REQUIRED: "буцаалтыг ажилтан 1–3 ажлын өдөрт хийнэ",
} as const;
export default function OrderDetail() {
  const { dispatch } = useBookingDraft();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null),
    [cancelling, setCancelling] = useState(false);
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
              setLastUpdatedAt(new Date());
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
  // Terms first (they depend on the time left), then the customer confirms them.
  const startCancel = async () => {
    if (!order || cancelling) return;
    setCancelling(true);
    const terms = await apiService.getCancelTerms(order.id);
    setCancelling(false);
    if (!terms.ok) return setError(terms.message);
    if (!terms.data.allowed)
      return Alert.alert("Цуцлах боломжгүй", terms.data.reason);
    const t = terms.data;
    Alert.alert("Захиалга цуцлах уу?", termsText(t), [
      { text: "Болих", style: "cancel" },
      {
        text: "Цуцлах",
        style: "destructive",
        onPress: () => void confirmCancel(t.refundPercent),
      },
    ]);
  };
  const confirmCancel = async (refundPercent: number) => {
    if (!order) return;
    setCancelling(true);
    const r = await apiService.cancelOrder(order.id, refundPercent);
    setCancelling(false);
    if (r.ok) {
      setOrder(r.data);
      setError("");
      return;
    }
    // e.g. the 2-hour line passed while the terms were open: show the new ones
    if (r.code === "CANCEL_TERMS_CHANGED")
      return Alert.alert("Нөхцөл өөрчлөгдлөө", r.message, [
        { text: "Болих", style: "cancel" },
        { text: "Дахин харах", onPress: () => void startCancel() },
      ]);
    setError(r.message);
  };
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
        ...(order.bookingForm && {
          bookingForm:
            order.catalogVersion !== catalog.data.catalogVersion
              ? {
                  ...order.bookingForm,
                  consent: {
                    ...order.bookingForm.consent,
                    service: false,
                    sensitiveData: false,
                    catalogVersion: null,
                  },
                }
              : order.bookingForm,
        }),
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
    <Screen
      title="Захиалгын дэлгэрэнгүй"
      footer={
        order && CANCELLABLE.includes(order.status) ? (
          <>
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
            <Button
              variant="ghost"
              title="Захиалга цуцлах"
              busy={cancelling}
              disabled={cancelling}
              onPress={() => void startCancel()}
            />
          </>
        ) : undefined
      }
    >
      {!!error && (
        <Banner error>
          {error}
          {order ? " Өмнөх мэдээлэл харагдаж байна; шинэчлэгдээгүй." : ""}
        </Banner>
      )}
      {lastUpdatedAt && (
        <Copy>Сүүлд шинэчилсэн: {timeLabel(lastUpdatedAt)}</Copy>
      )}
      {!order ? (
        <StateView title="Захиалга ачаалж байна" loading={!error} />
      ) : (
        <>
          {order.isMock && (
            <Banner>Туршилтын захиалга · бодит төлбөр биш.</Banner>
          )}
          <Card>
            <SectionHeading icon={CalendarDays} title="Үйлчилгээний төлөв" />
            <StatusPill status={order.status} />
            <Copy>
              {order.scheduledFor
                ? dateTimeLabel(order.scheduledFor)
                : "Цаг сонгоогүй"}
            </Copy>
          </Card>
          <Card>
            <SectionHeading icon={UserRound} title="Таны сувилагч" />
            <Copy>{order.nurse?.name ?? "Томилогдоогүй"}</Copy>
            <Copy>
              {order.eta
                ? `Ирэх хугацаа: ${timeLabel(order.eta)}`
                : "Ирэх хугацаа хараахан тодорхойгүй"}
            </Copy>
          </Card>
          {(order.status === "CANCELLED" || order.status === "EXPIRED") &&
            order.cancellation && (
            <Banner>
              {order.cancellation.by === "SYSTEM"
                ? "Захиалсан цагт сувилагч олдоогүй тул захиалга цуцлагдсан."
                : order.cancellation.by === "ADMIN"
                  ? "Захиалгыг компани цуцалсан."
                  : "Та захиалгаа цуцалсан."}
              {order.cancellation.by === "ADMIN" && order.cancellation.reason
                ? ` Шалтгаан: ${order.cancellation.reason}.`
                : ""}
              {order.cancellation.refund
                ? ` ${formatMnt(order.cancellation.refund.amountMnt)} (${order.cancellation.refund.percent}%) ${REFUND_TEXT[order.cancellation.refund.status]}.`
                : " Буцаах мөнгө байхгүй."}
            </Banner>
          )}
          {order.status === "NO_SHOW" && (
            <Banner>
              Сувилагч товлосон цагт хаяг дээр ирж хүлээсэн боловч таныг
              олсонгүй. Цуцлалтын нөхцлийн дагуу төлбөр буцаагдахгүй. Алдаа
              гарсан гэж үзвэл компанитай холбогдоно уу.
            </Banner>
          )}
          {order.status === "REFUSED" && (
            <Banner>
              Сувилагч үйлчилгээнээс татгалзсан. Энэ захиалгыг үргэлжлүүлэх
              боломжгүй. Дахин томилолт, төлбөрийн шийдвэр хараахан гараагүй.
            </Banner>
          )}
          {order.status === "INCIDENT" && (
            <Banner error>
              Үйлчилгээний үеэр осол, хүндрэл бүртгэгдсэн. Шийдвэр хараахан
              гараагүй. Яаралтай тусламж шаардлагатай бол 103 руу залгана уу.
            </Banner>
          )}
          {order.status === "COMPLETED" && (
            <Button
              secondary
              title="Үйлчилгээний тэмдэглэл харах"
              onPress={() => router.push("/(tabs)/records")}
            />
          )}
          <FormSection title="Захиалгын явц">
            {order.timeline?.length ? (
              <EventTimeline events={order.timeline} />
            ) : (
              <Copy>Явцын мэдээлэл одоогоор алга.</Copy>
            )}
          </FormSection>
          <Copy>Мэдээллийг 10 секунд тутам шинэчилнэ.</Copy>
        </>
      )}
    </Screen>
  );
}
