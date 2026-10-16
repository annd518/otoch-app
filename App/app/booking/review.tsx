import { orderStatus } from "@/design/catalog";
import { TouchTarget as TouchableOpacity } from "@/components/ui/TouchTarget";
import { formatMnt } from "@/utils/money";
import { Stepper } from "@/components/ui";
import { theme } from "@/design/theme";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon as Ionicons } from "@/components/ui/Icon";
import { Redirect, useRouter } from "expo-router";

import { PriceSummary } from "@/components/PriceSummary";
import { useNow } from "@/components/useNow";
import { useSingleFlight } from "@/components/useSingleFlight";
import { useBookingDraft } from "@/context/BookingDraftContext";
import { apiService } from "@/services/api";
import {
  isBlocked,
  hasReferralInput,
  needsReferral,
  referralTextOk,
  uploadedReferralCount,
} from "@/services/bookingDraft";
import { isQuoteStale } from "@/services/orders";

const QUOTE_ERRORS: Record<string, string> = {
  RED_FLAG_REQUIRED: "Эхлээд аюулын шинжийн асуулгад хариулна уу.",
  REFERRAL_REQUIRED:
    "Эмчийн заалтын зураг серверт хадгалагдаагүй байна. Үнийн санал авах боломжгүй.",
  ORDER_INCOMPLETE: "Захиалгын мэдээлэл дутуу байна. Алхам 1-ийг шалгана уу.",
  VERSION_CONFLICT: "Захиалга өөрчлөгдсөн байна. Үнийн саналыг дахин авна уу.",
  CATALOG_OUTDATED:
    "Каталог шинэчлэгдсэн байна. Үйлчилгээгээ дахин сонгоно уу.",
};

// Summary + server quote. A quote is a price offer only: the order is not
// confirmed until payment is confirmed by the server.
export default function ReviewScreen() {
  const router = useRouter();
  const { state, dispatch } = useBookingDraft();
  const [error, setError] = useState<string | null>(null);
  const quoteSource = apiService.sourceOf("quote");
  const now = useNow();

  const getQuote = useSingleFlight(
    useCallback(async () => {
      const orderId = state.server?.orderId;
      if (!orderId) return;
      setError(null);
      // Uploads and answers bump the order version on the server: read the
      // current version first so the quote is made for exactly this order state.
      const current = await apiService.getOrder(orderId);
      if (!current.ok) {
        setError(current.message);
        return;
      }
      dispatch({
        type: "draftSaved",
        order: current.data,
        source: apiService.sourceOf("orders"),
      });
      if (current.data.status === "BLOCKED_RED_FLAG") {
        router.replace("/booking/emergency");
        return;
      }
      const result = await apiService.requestQuote(
        orderId,
        current.data.version,
      );
      if (!result.ok) {
        if (result.code === "RED_FLAG_BLOCKED") {
          dispatch({
            type: "redFlagBlocked",
            advice: null,
            server: "recorded",
          });
          router.replace("/booking/emergency");
          return;
        }
        dispatch({ type: "setQuote", quote: null });
        setError((result.code && QUOTE_ERRORS[result.code]) || result.message);
        return;
      }
      dispatch({ type: "setQuote", quote: result.data });
    }, [state.server?.orderId, dispatch, router]),
  );

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />;
  if (!state.server || state.redFlag.status !== "clear")
    return <Redirect href="/(tabs)/bookappointment" />;

  const { service, details, server, quote } = state;
  const referralMissing = needsReferral(state) && !hasReferralInput(state);
  const expired = quote ? isQuoteStale(quote, server.version, now) : false;
  const canPay = Boolean(quote) && !expired && !referralMissing && !state.dirty;

  const rows: [string, string][] = [
    ["Үйлчилгээ", service?.name ?? "-"],
    ["Өвчтөн", details.parentName || "-"],
    ["Хаяг", details.addressText],
    [
      "Огноо, цаг",
      `${details.date} ${details.timeSlot} (Улаанбаатарын цагаар)`,
    ],
    ["Аюулын шинж", "Илрээгүй (асуулга серверт хадгалагдсан)"],
  ];
  if (needsReferral(state)) {
    const photos = uploadedReferralCount(state);
    const parts = [
      ...(photos > 0 ? [`${photos} зураг`] : []),
      ...(referralTextOk(details.bookingForm?.referralText)
        ? ["гараар бичсэн"]
        : []),
    ];
    rows.push([
      "Эмчийн заалт",
      parts.length ? `${parts.join(", ")} (серверт хадгалагдсан)` : "-",
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Буцах"
        >
          <Ionicons name="chevron-back" size={24} color={theme.color.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Захиалгын хураангуй</Text>
          <Text style={styles.headerSubtitle}>Төлбөр хийгдээгүй ноорог</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ ...styles.container, paddingBottom: 40 }}
      >
        <Stepper step={4} />
        <View
          style={[
            styles.statusCard,
            server.source === "mock" && styles.statusCardMock,
          ]}
        >
          <Text style={styles.statusText}>
            {server.source === "mock"
              ? "MOCK ноорог: серверт хадгалагдаагүй, зөвхөн хөгжүүлэлтийн горим."
              : `Ноорог серверт хадгалагдсан. Төлөв: ${orderStatus(server.status)}. Баталгаажаагүй, төлбөр хийгдээгүй.`}
          </Text>
        </View>

        <View style={styles.card}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        <PriceSummary service={service} quote={expired ? null : quote} />
        {quote && !expired ? (
          <Text style={styles.note}>
            {quote.isFixture || quoteSource === "mock"
              ? "Туршилтын үнэ (fixture). "
              : ""}
            Үнийн санал нь захиалга баталгаажсан гэсэн үг биш.
          </Text>
        ) : null}
        {expired ? (
          <Text style={styles.error}>
            Үнийн санал хүчингүй болсон (хугацаа дууссан эсвэл захиалга
            өөрчлөгдсөн). Дахин авна уу.
          </Text>
        ) : null}
        {referralMissing ? (
          <Text style={styles.error}>
            Эмчийн заалт (зураг эсвэл бичвэр) серверт хадгалагдаагүй тул
            үргэлжлэх боломжгүй.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            (getQuote.running || referralMissing) && styles.disabled,
          ]}
          onPress={() => void getQuote.run()}
          disabled={getQuote.running || referralMissing}
        >
          <Text style={styles.secondaryButtonText}>
            {getQuote.running
              ? "Үнийн санал авч байна..."
              : quote
                ? "Үнийн саналыг шинэчлэх"
                : "Үнийн санал авах"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            !canPay && styles.primaryButtonDisabled,
          ]}
          onPress={() => router.push("/booking/payment")}
          disabled={!canPay}
        >
          <Text style={styles.primaryButtonText}>
            {quote
              ? `${formatMnt(quote.totalMnt)} · QPay-ээр төлөх`
              : "Үнийн санал шаардлагатай"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.color.subtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.color.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.info,
  },
  backButton: { minHeight: 56, padding: 8, marginRight: 4 },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 22,
    fontWeight: "800",
    color: theme.color.text,
  },
  headerSubtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
    marginTop: 2,
  },
  container: { padding: 16, gap: 14 },
  statusCard: {
    backgroundColor: theme.color.info,
    borderRadius: 12,
    padding: 12,
  },
  statusCardMock: { backgroundColor: theme.color.subtle },
  statusText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.text,
    lineHeight: 28,
  },
  card: {
    backgroundColor: theme.color.background,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.color.info,
    gap: 10,
  },
  row: { gap: 2 },
  rowLabel: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
  },
  rowValue: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.text,
  },
  note: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
    textAlign: "center",
    lineHeight: 28,
  },
  error: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.error,
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.color.brand,
  },
  secondaryButtonText: {
    color: theme.color.brand,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "700",
  },
  disabled: { opacity: 0.4 },
  primaryButton: {
    minHeight: 56,
    backgroundColor: theme.color.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: theme.color.info },
  primaryButtonText: {
    color: theme.color.background,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "700",
  },
});
