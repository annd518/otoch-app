// Another time for a paid order (spec slide 25: "өөр цаг"). Any time 24/7 can
// be picked (at least 2 hours ahead); the price does not change.
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Banner, Button, Copy, Screen, StateView } from "@/components/ui";
import { BookingCalendar } from "@/components/BookingCalendar";
import { dateTimeLabel } from "@/design/dateLabels";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
import { RESCHEDULABLE } from "@/services/orders";
import { ulaanbaatarDate } from "@/utils/datetime";

const minutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// The new window keeps the order's current length ("09:00-11:00" -> 120)
const windowLength = (timeSlot: string | null | undefined) => {
  const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(timeSlot ?? "");
  const length = m ? (minutes(m[2]) - minutes(m[1]) + 1440) % 1440 : 0;
  return length > 0 ? length : 60;
};

export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null),
    [date, setDate] = useState(""),
    [chosen, setChosen] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiService.getOrder(id).then((r) => {
      if (!active) return;
      if (r.ok) {
        setOrder(r.data);
        setDate(r.data.scheduledFor ? ulaanbaatarDate(new Date(r.data.scheduledFor)) : "");
      } else setError(r.message);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const zoneId = order?.zoneId ?? null;
  const serviceCode = order?.serviceCodes[0] ?? null;
  const startsAt = date && chosen ? `${date}T${chosen.slice(0, 5)}:00+08:00` : "";

  const confirm = () => {
    if (!order || !startsAt) return;
    Alert.alert(
      "Цаг өөрчлөх үү?",
      `Шинэ цаг: ${dateTimeLabel(startsAt)}.` +
        (order.status === "ASSIGNED"
          ? " Одоогийн сувилагч энэ цагт ирэх эсэх тодорхойгүй тул сувилагчийг дахин хайна."
          : " Сувилагчийг шинэ цагт хайна.") +
        " Төлбөр өөрчлөгдөхгүй.",
      [
        { text: "Болих", style: "cancel" },
        { text: "Өөрчлөх", onPress: () => void save() },
      ],
    );
  };
  const save = async () => {
    if (!order || !startsAt) return;
    setBusy(true);
    setError("");
    const r = await apiService.rescheduleOrder(order.id, {
      version: order.version,
      scheduledFor: startsAt,
      timeSlot: chosen,
    });
    setBusy(false);
    if (r.ok) {
      router.back();
      return;
    }
    setError(r.message);
    // a newer version meanwhile: show the current state
    const fresh = await apiService.getOrder(order.id);
    if (fresh.ok) setOrder(fresh.data);
    setChosen("");
  };

  return (
    <Screen
      title="Өөр цаг сонгох"
      footer={
        order && RESCHEDULABLE.includes(order.status) && zoneId ? (
          <Button title="Цаг өөрчлөх" busy={busy} disabled={!chosen || busy} network onPress={confirm} />
        ) : undefined
      }
    >
      {!!error && <Banner error>{error}</Banner>}
      {!order ? (
        <StateView title="Захиалга ачаалж байна" loading={!error} />
      ) : !RESCHEDULABLE.includes(order.status) ? (
        <Banner>Энэ захиалгын цагийг одоо өөрчлөх боломжгүй.</Banner>
      ) : !zoneId || !serviceCode ? (
        <Banner>Энэ захиалгын цагийг аппаас өөрчлөх боломжгүй. Компанитай холбогдоно уу.</Banner>
      ) : (
        <>
          <Copy>
            Одоогийн цаг: {order.scheduledFor ? dateTimeLabel(order.scheduledFor) : "сонгоогүй"}
          </Copy>
          {order.status === "ASSIGNED" && (
            <Banner>
              Сувилагч томилогдсон байна. Цагаа өөрчилбөл шинэ цагт сувилагчийг дахин хайна.
            </Banner>
          )}
          <Copy>24 цагийн аль ч цагт. Цагууд Улаанбаатарын цагаар, хамгийн эрт 2 цагийн дараа.</Copy>
          <BookingCalendar
            date={date}
            slot={chosen}
            durationMin={windowLength(order.timeSlot)}
            onDate={(d) => {
              setDate(d);
              setChosen("");
            }}
            onTime={setChosen}
          />
          {!date && <Copy>Өдрөө сонгоно уу.</Copy>}
        </>
      )}
    </Screen>
  );
}
