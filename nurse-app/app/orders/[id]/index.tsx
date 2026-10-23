import { TaskBody, Intro, FormSection } from "../../../components/Presentation";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { ErrorBox } from "../../../components/ErrorBox";
import { ReferralImages } from "../../../components/ReferralImages";
import {
  ErrorState,
  OfflineBanner,
  Skeleton,
} from "../../../components/ScreenState";
import { StatusBadge } from "../../../components/StatusBadge";
import { theme } from "../../../design/theme";
import { useOrder } from "../../../hooks/useOrder";
import { http } from "../../../services/http";
import * as Location from "expo-location";
import {
  RELEASE_REASONS,
  enRoute,
  noShow,
  releaseOrder,
} from "../../../services/nurseVisit";
import { postEta } from "../../../services/staffOrders";
import {
  availableActions,
  ETA_CHOICES_MIN,
  etaFromNow,
  formatSchedule,
  formatUbDateTime,
  serviceSummary,
} from "../../../utils/orderView";
import { telUrl } from "../../../utils/visitRecord";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        gap: 16,
        padding: 20,
        backgroundColor: theme.color.surface,
        ...theme.depth.soft,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: "#FFFFFF",
      }}
    >
      <AppText variant="caption" color={theme.color.secondary}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function openMap(lat: number | null, lng: number | null, text: string) {
  const query = encodeURIComponent(text);
  const url =
    lat !== null && lng !== null
      ? Platform.OS === "ios"
        ? `maps:?ll=${lat},${lng}&q=${query}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${query})`
      : Platform.OS === "ios"
        ? `maps:?q=${query}`
        : `geo:0,0?q=${query}`;
  void Linking.openURL(url).catch(() =>
    Alert.alert("Газрын зураг нээж чадсангүй"),
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { order, state, error, busy, load, run } = useOrder(id);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function go(
    call: Parameters<typeof run>[0],
    options?: Parameters<typeof run>[1],
  ) {
    setActionError(null);
    const outcome = await run(call, options);
    if (!outcome.ok) setActionError(outcome.message);
  }

  // Nobody at the address after the wait: the server checks the time and the location.
  function confirmNoShow() {
    Alert.alert(
      "Үйлчлүүлэгч байхгүй юу?",
      "Товлосон цагаас 15 минут хүлээсний дараа хаяг дээрээс бүртгэнэ. Үйлчлүүлэгчид мэдэгдэл очиж, төлбөр буцаагдахгүй.",
      [
        { text: "Болих", style: "cancel" },
        { text: "Бүртгэх", style: "destructive", onPress: () => void reportNoShow() },
      ],
    );
  }
  async function reportNoShow() {
    setActionError(null);
    let position: Location.LocationObject;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setActionError("Байршлын зөвшөөрөл хэрэгтэй.");
        return;
      }
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    } catch {
      setActionError("Байршлыг тодорхойлж чадсангүй. GPS асаалттай эсэхийг шалгана уу.");
      return;
    }
    await go((o) =>
      noShow(http, o.id, {
        version: o.version,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }),
    );
  }

  // Withdraw before the visit: dispatch offers the call to another nurse.
  function confirmRelease() {
    Alert.alert(
      "Дуудлагаас гарах уу?",
      "Дуудлага өөр сувилагч руу шилжинэ. Шалтгаанаа сонгоно уу.",
      [
        ...RELEASE_REASONS.map((reason) => ({
          text: reason,
          onPress: () => void release(reason),
        })),
        { text: "Болих", style: "cancel" as const },
      ],
    );
  }
  async function release(reason: string) {
    if (!order) return;
    setActionError(null);
    const r = await releaseOrder(http, order.id, { version: order.version, reason });
    if (r.ok) router.replace("/");
    else {
      setActionError(r.message);
      void load();
    }
  }

  const open = (sub: "checkin" | "record" | "reject" | "incident") =>
    router.push({ pathname: `/orders/[id]/${sub}`, params: { id } });

  const actions = order ? availableActions(order.status) : null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.color.background }}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Дуудлага",
          headerBackTitle: "Буцах",
        }}
      />
      <TaskBody
        footer={
          order ? (
            <>
              {actions?.enRoute ? (
                <Button
                  label="Замдаа гарлаа"
                  loading={busy}
                  onPress={() => void go((o) => enRoute(http, o.id, o.version))}
                />
              ) : null}
              {actions?.checkin ? (
                <Button
                  label="Ирлээ · эргэлт эхлүүлэх"
                  variant={actions.enRoute ? "secondary" : "primary"}
                  onPress={() => open("checkin")}
                />
              ) : null}
              {actions?.record ? (
                <Button
                  label="Тэмдэглэл бөглөх, дуусгах"
                  onPress={() => open("record")}
                />
              ) : null}
            </>
          ) : undefined
        }
      >
        {state === "loading" ? <Skeleton /> : null}
        {state === "error" ? (
          <ErrorState message={error ?? ""} onRetry={() => void load()} />
        ) : null}

        {order ? (
          <>
            {error ? <OfflineBanner message={error} /> : null}
            <View style={{ gap: theme.space[1] }}>
              <Intro title="Үйлчилгээний дуудлага" />
              <AppText variant="heading" color={theme.color.navy}>
                {serviceSummary(order)}
              </AppText>
              <StatusBadge status={order.status} />
              {order.isMock ? (
                <AppText variant="caption" color={theme.color.warning}>
                  Туршилтын захиалга
                </AppText>
              ) : null}
            </View>

            <Section title="Цаг">
              <AppText>{formatSchedule(order)}</AppText>
              {order.eta ? (
                <AppText variant="caption" color={theme.color.secondary}>
                  Таны ETA: {formatUbDateTime(order.eta) ?? order.eta}
                </AppText>
              ) : null}
            </Section>

            <Section title="Үйлчлүүлэгч">
              <AppText variant="label">
                {order.patientName || "Нэр байхгүй"}
              </AppText>
              <AppText variant="caption" color={theme.color.secondary}>
                {order.familyPresent
                  ? "Гэр бүлийн гишүүн байх болно"
                  : "Гэр бүлийн гишүүн байхгүй"}
                {order.postoperative ? " · Мэс заслын дараах" : ""}
              </AppText>
              {order.patientContact ? (
                <Button
                  label={`Яаралтай холбоо руу залгах · ${order.patientContact}`}
                  variant="secondary"
                  onPress={() =>
                    void Linking.openURL(telUrl(order.patientContact!))
                  }
                />
              ) : null}
            </Section>

            {order.address ? (
              <Section title="Хаяг">
                <AppText>{order.address.text}</AppText>
                <Button
                  label="Газрын зураг нээх"
                  variant="secondary"
                  onPress={() =>
                    openMap(
                      order.address!.lat,
                      order.address!.lng,
                      order.address!.text,
                    )
                  }
                />
              </Section>
            ) : null}

            <Section title="Эм, заалт">
              {order.medication ? (
                <>
                  <AppText variant="label">{order.medication.name}</AppText>
                  <AppText variant="caption">
                    Тун: {order.medication.dose} · Арга:{" "}
                    {order.medication.route}
                    {order.medication.doseNumber !== null
                      ? ` · ${order.medication.doseNumber}-р тун`
                      : ""}
                  </AppText>
                  <AppText variant="caption" color={theme.color.secondary}>
                    Хадгалах хугацаа: {order.medication.expiresAt}
                  </AppText>
                </>
              ) : (
                <AppText variant="caption" color={theme.color.secondary}>
                  Эмийн мэдээлэл бүртгээгүй.
                </AppText>
              )}
              {order.referralText ? (
                <AppText variant="caption">Заалт: {order.referralText}</AppText>
              ) : null}
              {actions &&
              (actions.record || actions.checkin) &&
              order.attachments.length > 0 ? (
                <ReferralImages
                  orderId={order.id}
                  attachments={order.attachments}
                />
              ) : null}
              <AppText variant="caption" color={theme.color.secondary}>
                Эмийг үйлчлүүлэгч бэлдсэн. Нэр, тун, арга, хадгалах хугацааг
                газар дээр нь шалгана.
              </AppText>
            </Section>

            {order.notes ? (
              <Section title="Тэмдэглэл">
                <AppText>{order.notes}</AppText>
              </Section>
            ) : null}

            {actions?.setEta ? (
              <Section title="Ирэх хугацаа (ETA)">
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: theme.space[1],
                  }}
                >
                  {ETA_CHOICES_MIN.map((minutes) => (
                    <Button
                      key={minutes}
                      label={`${minutes} мин`}
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        void go(
                          (o) =>
                            postEta(
                              http,
                              o.id,
                              o.version,
                              etaFromNow(minutes, Date.now()),
                            ),
                          { reload: true },
                        )
                      }
                    />
                  ))}
                  {order.eta ? (
                    <Button
                      label="ETA арилгах"
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        void go((o) => postEta(http, o.id, o.version, null), {
                          reload: true,
                        })
                      }
                    />
                  ) : null}
                </View>
              </Section>
            ) : null}

            {actionError ? <ErrorBox message={actionError} /> : null}
            <FormSection title="Нэмэлт үйлдэл">
              {actions?.noShow ? (
                <Button
                  label="Үйлчлүүлэгч байхгүй"
                  variant="secondary"
                  disabled={busy}
                  onPress={confirmNoShow}
                />
              ) : null}
              {actions?.release ? (
                <Button
                  label="Дуудлагаас гарах"
                  variant="secondary"
                  disabled={busy}
                  onPress={confirmRelease}
                />
              ) : null}
              {actions?.reject ? (
                <Button
                  label="Татгалзах"
                  variant="secondary"
                  onPress={() => open("reject")}
                />
              ) : null}
              {actions?.incident ? (
                <Button
                  label="Осол бүртгэх"
                  variant="secondary"
                  onPress={() => open("incident")}
                />
              ) : null}
            </FormSection>
          </>
        ) : null}
      </TaskBody>
    </SafeAreaView>
  );
}
