// Another time for a paid order (spec slide 25: "өөр цаг"). Only the server's
// free slots in the order's zone can be picked; the price does not change.
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Banner, Button, Chip, Copy, Screen, StateView } from "@/components/ui";
import { BookingCalendar } from "@/components/BookingCalendar";
import { dateTimeLabel } from "@/design/dateLabels";
import { apiService } from "@/services/api";
import type { Order } from "@/services/apiTypes";
import type { Slot } from "@/services/clientV2";
import { RESCHEDULABLE } from "@/services/orders";
import { ulaanbaatarDate } from "@/utils/datetime";

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date(iso));
const windowOf = (s: Slot) => `${time(s.startsAt)}-${time(s.endsAt)}`;

export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null),
    [date, setDate] = useState(""),
    [slots, setSlots] = useState<{ key: string; slots: Slot[] } | null>(null),
    [chosen, setChosen] = useState<Slot | null>(null),
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
  const key = `${zoneId}|${date}|${serviceCode}`;
  useEffect(() => {
    let active = true;
    if (!zoneId || !date || !serviceCode) return;
    void apiService.availability(zoneId, date, serviceCode).then((r) => {
      if (!active) return;
      setSlots({ key, slots: r.ok ? r.data : [] });
      if (!r.ok) setError(r.message);
    });
    return () => {
      active = false;
    };
  }, [zoneId, date, serviceCode, key]);
  const daySlots = slots?.key === key ? slots.slots : null;
  // the order's own current slot is not a "new" time
  const choices = (daySlots ?? []).filter((s) => s.startsAt !== order?.scheduledFor);

  const confirm = () => {
    if (!order || !chosen) return;
    Alert.alert(
      "Цаг өөрчлөх үү?",
      `Шинэ цаг: ${dateTimeLabel(chosen.startsAt)}.` +
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
    if (!order || !chosen) return;
    setBusy(true);
    setError("");
    const r = await apiService.rescheduleOrder(order.id, {
      version: order.version,
      scheduledFor: chosen.startsAt,
      timeSlot: windowOf(chosen),
    });
    setBusy(false);
    if (r.ok) {
      router.back();
      return;
    }
    setError(r.message);
    // a newer version or a slot taken meanwhile: show the current state
    const fresh = await apiService.getOrder(order.id);
    if (fresh.ok) setOrder(fresh.data);
    setChosen(null);
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
          <Copy>Цагууд Улаанбаатарын цагаар. Хамгийн эрт 2 цагийн дараа.</Copy>
          <BookingCalendar
            date={date}
            slot={chosen ? windowOf(chosen) : ""}
            durationMin={60}
            onDate={(d) => {
              setDate(d);
              setChosen(null);
            }}
            onTime={(slot) => setChosen(choices.find((s) => time(s.startsAt) === slot.slice(0, 5)) ?? null)}
          />
          {!date ? (
            <Copy>Өдрөө сонгоно уу.</Copy>
          ) : daySlots === null ? (
            <StateView title="Сул цаг шалгаж байна" loading />
          ) : choices.length === 0 ? (
            <Copy>Энэ өдөр сул цаг алга. Өөр өдөр сонгоно уу.</Copy>
          ) : (
            <>
              <Copy>Тухайн өдрийн сул цагууд:</Copy>
              {choices.map((s) => (
                <Chip
                  key={s.id}
                  label={`${time(s.startsAt)}–${time(s.endsAt)}`}
                  selected={chosen?.id === s.id}
                  onPress={() => setChosen(s)}
                />
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
