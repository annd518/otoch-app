import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Button, Card, Copy, Input } from "@/components/ui";
import { theme } from "@/design/theme";
import {
  calendarDays,
  earliestStartOn,
  isSelectableDay,
  startAllowed,
  timeWindow,
} from "@/utils/calendar";
import { isValidCalendarDate, ulaanbaatarDate } from "@/utils/datetime";

export function BookingCalendar({
  date,
  slot,
  durationMin,
  onDate,
  onTime,
}: {
  date: string;
  slot: string;
  durationMin: number;
  onDate: (date: string) => void;
  onTime: (slot: string) => void;
}) {
  const now = new Date();
  const today = ulaanbaatarDate(now);
  // Starts must be at least 2 hours from now: "HH:MM", null (any) or "24:00" (none left)
  const earliest = date ? earliestStartOn(date, now) : null;
  const [page, setPage] = useState(() =>
    (isValidCalendarDate(date) ? date : today).slice(0, 7),
  );
  const [year, month] = page.split("-").map(Number);
  const [chooser, setChooser] = useState<"month" | "time" | null>(null);
  const [yearText, setYearText] = useState(String(year));
  const [hour, setHour] = useState("09"),
    [minute, setMinute] = useState("00");
  const yearValid =
    /^\d{4}$/.test(yearText) && Number(yearText) >= Number(today.slice(0, 4));
  const start = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  const selectedTime =
    /^\d{1,2}$/.test(hour) &&
    /^\d{1,2}$/.test(minute) &&
    startAllowed(date, start, now)
      ? timeWindow(start, durationMin)
      : null;
  const move = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    if (
      next.getUTCFullYear() < Number(today.slice(0, 4)) ||
      next.getUTCFullYear() > 9999
    )
      return;
    setPage(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  };
  const cell = {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 12,
  };
  return (
    <>
      <Card>
        <Copy variant="heading">Өдөр сонгох</Copy>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Өмнөх сар"
            onPress={() => move(-1)}
            style={cell}
          >
            <Copy>‹</Copy>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Он, сар сонгох"
            style={{ minHeight: 48, justifyContent: "center" }}
            onPress={() => {
              setYearText(String(year));
              setChooser("month");
            }}
          >
            <Copy variant="label">
              {year} он · {month} сар ▾
            </Copy>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Дараах сар"
            onPress={() => move(1)}
            style={cell}
          >
            <Copy>›</Copy>
          </Pressable>
        </View>
        <ScrollView horizontal>
          <View style={{ width: 336 }}>
            <View style={{ flexDirection: "row" }}>
              {["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map((d) => (
                <View key={d} style={cell}>
                  <Copy variant="caption">{d}</Copy>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {calendarDays(year, month).map((day, i) => {
                const enabled =
                    !!day &&
                    isSelectableDay(day, today) &&
                    earliestStartOn(day, now) !== "24:00",
                  selected = day === date;
                return (
                  <Pressable
                    key={day ?? `blank-${i}`}
                    disabled={!enabled}
                    accessibilityRole="button"
                    accessibilityLabel={day ?? "Хоосон"}
                    accessibilityState={{ disabled: !enabled, selected }}
                    onPress={() => day && onDate(day)}
                    style={[
                      cell,
                      {
                        width: 48,
                        backgroundColor: selected
                          ? theme.color.brand
                          : "transparent",
                        opacity: enabled ? 1 : 0.35,
                      },
                    ]}
                  >
                    <Copy
                      style={{ color: selected ? "#FFFFFF" : theme.color.text }}
                    >
                      {day ? Number(day.slice(-2)) : ""}
                    </Copy>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <Copy>
          {date
            ? `Сонгосон өдөр: ${date}`
            : "Он, сараа сонгоод өдрөө дарна уу."}
        </Copy>
      </Card>
      <Button
        secondary
        title={
          slot ? `Цаг: ${slot.slice(0, 5)} · Өөрчлөх` : "Цаг сонгох · 24 цаг"
        }
        disabled={!date}
        onPress={() => {
          const first =
            earliest && earliest !== "24:00" && earliest > "09:00"
              ? earliest
              : "09:00";
          setHour(slot ? slot.slice(0, 2) : first.slice(0, 2));
          setMinute(slot ? slot.slice(3, 5) : first.slice(3, 5));
          setChooser("time");
        }}
      />
      {!!slot && (
        <Copy>
          Үйлчилгээний цонх: {slot.replace("-", "–")}
          {slot.slice(6) < slot.slice(0, 5) ? " (дараагийн өдөр дуусна)" : ""}
        </Copy>
      )}
      <Modal
        visible={chooser !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setChooser(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <ScrollView
            style={{
              flexGrow: 0,
              maxHeight: "85%",
              backgroundColor: theme.color.background,
              borderRadius: 16,
            }}
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            <Copy variant="heading">
              {chooser === "month" ? "Он, сар сонгох" : "Цаг сонгох · 24 цаг"}
            </Copy>
            {chooser === "month" ? (
              <>
                <Input
                  label="Он"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={yearText}
                  onChangeText={setYearText}
                />
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="button"
                      disabled={!yearValid}
                      onPress={() => {
                        setPage(`${yearText}-${String(m).padStart(2, "0")}`);
                        setChooser(null);
                      }}
                      style={[
                        cell,
                        {
                          minWidth: 72,
                          borderWidth: 1,
                          borderColor: theme.color.border,
                          opacity: yearValid ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Copy>{m} сар</Copy>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Copy>{date} · Улаанбаатарын цаг</Copy>
                {earliest === "24:00" ? (
                  <Copy>
                    Энэ өдөр захиалах боломжтой цаг үлдээгүй. Дараагийн өдрийг
                    сонгоно уу.
                  </Copy>
                ) : earliest ? (
                  <Copy>
                    Одоогоос 2 цагийн дараа буюу {earliest}-аас хойш эхлэх цаг
                    сонгоно уу.
                  </Copy>
                ) : null}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Цаг (00–23)"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={hour}
                      onChangeText={setHour}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Минут (00–59)"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={minute}
                      onChangeText={setMinute}
                    />
                  </View>
                </View>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {Array.from({ length: 24 }, (_, h) =>
                    String(h).padStart(2, "0"),
                  ).map((h) => {
                    // the whole hour is before the earliest allowed start
                    const tooEarly = !!earliest && `${h}:59` < earliest;
                    return (
                    <Pressable
                      key={h}
                      accessibilityRole="button"
                      accessibilityLabel={`${h} цаг`}
                      accessibilityState={{
                        selected: hour === h,
                        disabled: tooEarly,
                      }}
                      disabled={tooEarly}
                      onPress={() => {
                        setHour(h);
                        if (
                          earliest &&
                          `${h}:${minute.padStart(2, "0")}` < earliest
                        )
                          setMinute(earliest.slice(3, 5));
                      }}
                      style={[
                        cell,
                        {
                          borderWidth: 1,
                          borderColor: theme.color.border,
                          backgroundColor:
                            hour === h
                              ? theme.color.info
                              : theme.color.background,
                          opacity: tooEarly ? 0.35 : 1,
                        },
                      ]}
                    >
                      <Copy>{h}</Copy>
                    </Pressable>
                    );
                  })}
                </View>
                <Button
                  title="Цаг сонгох"
                  disabled={!selectedTime}
                  onPress={() => {
                    if (selectedTime) {
                      onTime(selectedTime);
                      setChooser(null);
                    }
                  }}
                />
              </>
            )}
            <Button secondary title="Хаах" onPress={() => setChooser(null)} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
