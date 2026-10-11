import React, { useCallback, useEffect, useState } from "react";
import { router, Redirect, useFocusEffect } from "expo-router";
import { syncPendingBlocks } from "@/services/blockSync";
import { apiService } from "@/services/api";
import { useBookingDraft } from "@/context/BookingDraftContext";
import {
  isBlocked,
  planDraftSave,
  nextStepAfterDetails,
  validateDetails,
} from "@/services/bookingDraft";
import type { BookingForm, Parent } from "@/services/apiTypes";
import type { Slot, Zone } from "@/services/clientV2";
import { createIdempotencyKey } from "@/utils/id";
import { ulaanbaatarDate } from "@/utils/datetime";
import { useSingleFlight } from "@/components/useSingleFlight";
import {
  Banner,
  Button,
  Card,
  Chip,
  Copy,
  Input,
  Screen,
  Stepper,
  StateView,
} from "@/components/ui";
const initialForm = (acceptedAt: string): BookingForm => ({
  consent: {
    service: false,
    sensitiveData: false,
    signer: "RECIPIENT",
    version: "V2_2026_10",
    acceptedAt,
  },
  familyPresent: false,
  postoperative: false,
  medication: null,
});
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date(iso));
export default function Booking() {
  const { state, dispatch } = useBookingDraft();
  const { details, service } = state;
  const [step, setStep] = useState(1),
    [parents, setParents] = useState<Parent[]>([]),
    [zones, setZones] = useState<Zone[]>([]),
    [slots, setSlots] = useState<Slot[]>([]),
    [error, setError] = useState(""),
    [slotsLoading, setSlotsLoading] = useState(false);
  const [acceptedAt] = useState(() => new Date().toISOString());
  const form = details.bookingForm ?? initialForm(acceptedAt);
  const setForm = (patch: Partial<BookingForm>) =>
    dispatch({
      type: "updateDetails",
      patch: { bookingForm: { ...form, ...patch } },
    });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void syncPendingBlocks();
      void apiService.getParents().then((r) => {
        if (active) {
          if (r.ok) setParents(r.data);
          else setError(r.message);
        }
      });
      void apiService.zones().then((r) => {
        if (active) {
          if (r.ok) setZones(r.data);
          else setError(r.message);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );
  useEffect(() => {
    let active = true;
    if (!details.zoneId || !details.date || !service) return;
    void apiService
      .availability(details.zoneId, details.date, service.code)
      .then((r) => {
        if (!active) return;
        setSlotsLoading(false);
        if (r.ok) setSlots(r.data);
        else setError(r.message);
      });
    return () => {
      active = false;
    };
  }, [details.zoneId, details.date, service]);
  const save = useSingleFlight(
    useCallback(async () => {
      setError("");
      const errors = validateDetails(state, new Date());
      if (Object.keys(errors).length) {
        setError(Object.values(errors).join("\n"));
        return;
      }
      const plan = planDraftSave(state, createIdempotencyKey);
      if (plan.kind === "invalid") {
        setError("Мэдээллээ бүрэн бөглөнө үү");
        return;
      }
      if (plan.kind === "none") {
        router.push(nextStepAfterDetails(state));
        return;
      }
      if (plan.kind === "create")
        dispatch({
          type: "createStarted",
          key: plan.key,
          fingerprint: plan.fingerprint,
        });
      const r =
        plan.kind === "create"
          ? await apiService.createDraftOrder(plan.input, plan.key)
          : await apiService.updateDraftOrder(plan.orderId, plan.patch);
      if (!r.ok) {
        if (r.code === "RED_FLAG_BLOCKED") {
          dispatch({ type: "redFlagBlocked", advice: null });
          router.replace("/booking/emergency");
        } else setError(r.message);
        return;
      }
      dispatch({
        type: "draftSaved",
        order: r.data,
        source: apiService.sourceOf("orders"),
      });
      router.push(nextStepAfterDetails(state, r.data.requiresReferral));
    }, [state, dispatch]),
  );
  const [dates] = useState(() =>
    Array.from({ length: 14 }, (_, i) =>
      ulaanbaatarDate(new Date(Date.now() + i * 86400000)),
    ),
  );
  if (isBlocked(state)) return <Redirect href="/booking/emergency" />;
  if (!service)
    return (
      <Screen title="Шинэ захиалга">
        <StateView
          title="Үйлчилгээгээ сонгоно уу"
          action="Каталог үзэх"
          onAction={() => router.push("/booking/catalog")}
        />
      </Screen>
    );
  const patient = parents.find((p) => p.id === details.parentId);
  const familyRequired =
    !!patient &&
    ((patient.birthYear !== undefined &&
      patient.birthYear !== null &&
      Number(
        new Intl.DateTimeFormat("en", {
          year: "numeric",
          timeZone: "Asia/Ulaanbaatar",
        }).format(new Date()),
      ) -
        patient.birthYear <
        18) ||
      patient.needsRepresentative);
  const presenceRequired =
    familyRequired || service.formConfig?.familyPresence === "required";
  const medicationRequired = service.formConfig?.medicationRequired ?? false;
  const firstDoseCheck = service.formConfig?.firstDoseCheck ?? false;
  const scheduledAt = Date.parse(
    `${details.date}T${details.timeSlot.slice(0, 5)}:00+08:00`,
  );
  const medication = form.medication ?? {
    name: "",
    dose: "",
    route: "",
    expiresAt: "",
    doseNumber: 1,
  };
  return (
    <Screen title="Сувилагч дуудах">
      <Stepper step={step} />
      <Copy variant="heading">{service.name}</Copy>
      {!!error && <Banner error>{error}</Banner>}
      {step === 1 && (
        <>
          <Input
            label="Дэлгэрэнгүй хаяг"
            value={details.addressText}
            onChangeText={(addressText) =>
              dispatch({ type: "updateDetails", patch: { addressText } })
            }
          />
          <Copy variant="heading">Үйлчлэх бүс</Copy>
          {zones.map((z) => (
            <Chip
              key={z.id}
              label={z.name}
              selected={details.zoneId === z.id}
              onPress={() => {
                setSlots([]);
                setSlotsLoading(Boolean(details.zoneId && details.date));
                dispatch({
                  type: "updateDetails",
                  patch: { zoneId: z.id, timeSlot: "" },
                });
              }}
            />
          ))}
          {!zones.length && (
            <StateView
              title="Үйлчлэх бүс тохируулагдаагүй"
              message="Серверт батлагдсан бүс нэмэгдэх хүртэл цаг захиалах боломжгүй."
            />
          )}
          <Input
            label="Өргөрөг"
            keyboardType="decimal-pad"
            value={details.lat?.toString() ?? ""}
            onChangeText={(value) =>
              dispatch({
                type: "updateDetails",
                patch: {
                  lat:
                    value.trim() && Number.isFinite(Number(value))
                      ? Number(value)
                      : undefined,
                },
              })
            }
          />
          <Input
            label="Уртраг"
            keyboardType="decimal-pad"
            value={details.lng?.toString() ?? ""}
            onChangeText={(value) =>
              dispatch({
                type: "updateDetails",
                patch: {
                  lng:
                    value.trim() && Number.isFinite(Number(value))
                      ? Number(value)
                      : undefined,
                },
              })
            }
          />
          <Copy>Цагууд Улаанбаатарын цагаар. Хамгийн эрт 2 цагийн дараа.</Copy>
          {dates.map((date) => (
            <Chip
              key={date}
              label={date}
              selected={details.date === date}
              onPress={() => {
                setSlots([]);
                setSlotsLoading(Boolean(details.zoneId && details.date));
                dispatch({
                  type: "updateDetails",
                  patch: { date, timeSlot: "" },
                });
              }}
            />
          ))}
          {slotsLoading ? (
            <StateView title="Сул цаг шалгаж байна" loading />
          ) : (
            slots.map((slot) => (
              <Chip
                key={slot.id}
                label={`${time(slot.startsAt)}–${time(slot.endsAt)}`}
                selected={
                  details.timeSlot ===
                  `${time(slot.startsAt)}-${time(slot.endsAt)}`
                }
                onPress={() =>
                  dispatch({
                    type: "updateDetails",
                    patch: {
                      timeSlot: `${time(slot.startsAt)}-${time(slot.endsAt)}`,
                    },
                  })
                }
              />
            ))
          )}
          {details.zoneId && details.date && !slotsLoading && !slots.length && (
            <StateView
              title="Сул цаг алга"
              message="Өөр өдөр эсвэл бүс сонгоно уу."
            />
          )}
          <Button
            title="Үргэлжлүүлэх"
            disabled={
              !details.timeSlot ||
              !details.zoneId ||
              details.lat === undefined ||
              details.lng === undefined ||
              details.addressText.trim().length < 5
            }
            onPress={() => setStep(2)}
          />
        </>
      )}
      {step === 2 && (
        <>
          <Copy variant="heading">Үйлчлүүлэгч</Copy>
          {parents.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              selected={details.parentId === p.id}
              onPress={() =>
                dispatch({
                  type: "updateDetails",
                  patch: { parentId: p.id, parentName: p.name },
                })
              }
            />
          ))}
          <Button
            secondary
            title="Шинэ үйлчлүүлэгч"
            onPress={() => router.push("/patients/edit")}
          />
          {patient && !patient.birthYear && (
            <Banner error>
              Төрсөн он дутуу байна. Үйлчлүүлэгчийн мэдээллийг шинэчилнэ үү.
            </Banner>
          )}
          <Chip
            label="Үйлчлүүлэгч өөрөө зөвшөөрөл өгч байна"
            selected={form.consent.signer !== "REPRESENTATIVE"}
            onPress={() =>
              setForm({ consent: { ...form.consent, signer: "RECIPIENT" } })
            }
          />
          <Chip
            label="Төлөөлөгч зөвшөөрөл өгч байна"
            selected={form.consent.signer === "REPRESENTATIVE"}
            onPress={() =>
              setForm({
                consent: { ...form.consent, signer: "REPRESENTATIVE" },
              })
            }
          />
          <Chip
            label="Үйлчилгээ авахыг зөвшөөрч байна"
            selected={form.consent.service}
            onPress={() =>
              setForm({
                consent: {
                  ...form.consent,
                  service: !form.consent.service,
                  catalogVersion: service.catalogVersion,
                  acceptedAt: new Date().toISOString(),
                },
              })
            }
          />
          <Chip
            label="Эрүүл мэндийн мэдээллийг боловсруулахыг зөвшөөрч байна"
            selected={form.consent.sensitiveData}
            onPress={() =>
              setForm({
                consent: {
                  ...form.consent,
                  sensitiveData: !form.consent.sensitiveData,
                  catalogVersion: service.catalogVersion,
                  acceptedAt: new Date().toISOString(),
                },
              })
            }
          />
          {presenceRequired && (
            <Banner>
              Насанд хүрсэн гэр бүлийн гишүүн байлцах шаардлагатай.
            </Banner>
          )}
          <Chip
            label="Насанд хүрсэн гэр бүлийн гишүүн байлцана"
            selected={form.familyPresent}
            onPress={() => setForm({ familyPresent: !form.familyPresent })}
          />
          <Button
            title="Үргэлжлүүлэх"
            disabled={
              !patient?.birthYear ||
              !form.consent.service ||
              !form.consent.sensitiveData ||
              (presenceRequired && !form.familyPresent) ||
              (familyRequired && form.consent.signer !== "REPRESENTATIVE")
            }
            onPress={() => {
              if (!details.bookingForm) setForm({});
              setStep(3);
            }}
          />
        </>
      )}
      {step === 3 && (
        <>
          <Card>
            <Copy variant="heading">Заалт, эм, аюулын шинж</Copy>
            <Copy>
              Эмчийн заалтын зураг болон аюулын шинжийн асуулгыг дараагийн дэд
              дэлгэцүүдэд бөглөнө.
            </Copy>
          </Card>
          {service.formConfig?.referral === "partial" && (
            <Chip
              label="Мэс заслын дараах шарх"
              selected={form.postoperative}
              onPress={() => setForm({ postoperative: !form.postoperative })}
            />
          )}
          {medicationRequired && (
            <>
              {(["name", "dose", "route", "expiresAt"] as const).map(
                (key, i) => (
                  <Input
                    key={key}
                    label={
                      [
                        "Эмийн нэр",
                        "Тун",
                        "Хэрэглэх арга",
                        "Хугацаа дуусах огноо (YYYY-MM-DD)",
                      ][i]
                    }
                    value={
                      key === "expiresAt"
                        ? medication.expiresAt.slice(0, 10)
                        : medication[key]
                    }
                    onChangeText={(value) =>
                      setForm({
                        medication: {
                          ...medication,
                          [key]:
                            key === "expiresAt"
                              ? `${value}T23:59:59+08:00`
                              : value,
                        },
                      })
                    }
                  />
                ),
              )}
              <Input
                label="Хэд дэх тун"
                keyboardType="number-pad"
                value={String(medication.doseNumber)}
                onChangeText={(value) =>
                  setForm({
                    medication: {
                      ...medication,
                      doseNumber: Number(value) || 1,
                    },
                  })
                }
              />
              <Banner>
                Эхний тунг гэрт хийхгүй. Эмийн нэр, тун, аргыг заалттайгаа
                тулган оруулна уу.
              </Banner>
            </>
          )}
          <Button
            network
            title="Заалт, асуулгыг бөглөх"
            busy={save.running}
            disabled={
              medicationRequired &&
              (!form.medication?.name ||
                !form.medication.dose ||
                !form.medication.route ||
                !Number.isFinite(Date.parse(form.medication.expiresAt)) ||
                (firstDoseCheck && form.medication.doseNumber < 2) ||
                Date.parse(form.medication.expiresAt) <= scheduledAt)
            }
            onPress={() => {
              void save.run();
            }}
          />
        </>
      )}
      {step > 1 && (
        <Button
          secondary
          title="Өмнөх алхам"
          onPress={() => setStep((s) => s - 1)}
        />
      )}
    </Screen>
  );
}
