import React, { useCallback, useState } from "react"
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Redirect, useRouter } from "expo-router"

import { PriceSummary } from "@/components/PriceSummary"
import { useNow } from "@/components/useNow"
import { useSingleFlight } from "@/components/useSingleFlight"
import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import { isBlocked, needsReferral, uploadedReferralCount } from "@/services/bookingDraft"
import { isQuoteExpired } from "@/services/orders"

const QUOTE_ERRORS: Record<string, string> = {
  RED_FLAG_REQUIRED: "Эхлээд аюулын шинжийн асуулгад хариулна уу.",
  REFERRAL_REQUIRED: "Эмчийн заалтын зураг серверт хадгалагдаагүй байна. Үнийн санал авах боломжгүй.",
  ORDER_INCOMPLETE: "Захиалгын мэдээлэл дутуу байна. Алхам 1-ийг шалгана уу.",
}

// Summary + server quote. A quote is a price offer only: the order is not
// confirmed until payment is confirmed by the server.
export default function ReviewScreen() {
  const router = useRouter()
  const { state, dispatch } = useBookingDraft()
  const [error, setError] = useState<string | null>(null)
  const quoteSource = apiService.sourceOf("quote")
  const now = useNow()

  const getQuote = useSingleFlight(
    useCallback(async () => {
      const orderId = state.server?.orderId
      if (!orderId) return
      setError(null)
      const result = await apiService.requestQuote(orderId)
      if (!result.ok) {
        if (result.code === "RED_FLAG_BLOCKED") {
          dispatch({ type: "redFlagBlocked", advice: null, server: "recorded" })
          router.replace("/booking/emergency")
          return
        }
        dispatch({ type: "setQuote", quote: null })
        setError((result.code && QUOTE_ERRORS[result.code]) || result.message)
        return
      }
      dispatch({ type: "setQuote", quote: result.data })
    }, [state.server?.orderId, dispatch, router]),
  )

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />
  if (!state.server || state.redFlag.status !== "clear") return <Redirect href="/(tabs)/bookappointment" />

  const { service, details, server, quote } = state
  const referralMissing = needsReferral(state) && uploadedReferralCount(state) === 0
  const expired = quote ? isQuoteExpired(quote, now) : false
  const canPay = Boolean(quote) && !expired && !referralMissing && !state.dirty

  const rows: [string, string][] = [
    ["Үйлчилгээ", service?.name ?? "-"],
    ["Өвчтөн", details.parentName || "-"],
    ["Хаяг", details.addressText],
    ["Огноо, цаг", `${details.date} ${details.timeSlot} (Улаанбаатарын цагаар)`],
    ["Аюулын шинж", "Илрээгүй (асуулга серверт хадгалагдсан)"],
  ]
  if (needsReferral(state)) rows.push(["Заалтын зураг", `${uploadedReferralCount(state)} серверт хадгалагдсан`])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Буцах">
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Захиалгын хураангуй</Text>
          <Text style={styles.headerSubtitle}>Төлбөр хийгдээгүй ноорог</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.statusCard, server.source === "mock" && styles.statusCardMock]}>
          <Text style={styles.statusText}>
            {server.source === "mock"
              ? "MOCK ноорог: серверт хадгалагдаагүй, зөвхөн хөгжүүлэлтийн горим."
              : `Ноорог серверт хадгалагдсан. Төлөв: ${server.status}. Баталгаажаагүй, төлбөр хийгдээгүй.`}
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
            {quote.isFixture || quoteSource === "mock" ? "Туршилтын үнэ (fixture). " : ""}
            Үнийн санал нь захиалга баталгаажсан гэсэн үг биш.
          </Text>
        ) : null}
        {expired ? <Text style={styles.error}>Үнийн саналын хугацаа дууссан. Дахин авна уу.</Text> : null}
        {referralMissing ? (
          <Text style={styles.error}>Заалтын зураг серверт хадгалагдаагүй тул үргэлжлэх боломжгүй.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.secondaryButton, (getQuote.running || referralMissing) && styles.disabled]}
          onPress={() => void getQuote.run()}
          disabled={getQuote.running || referralMissing}
        >
          <Text style={styles.secondaryButtonText}>
            {getQuote.running ? "Үнийн санал авч байна..." : quote ? "Үнийн саналыг шинэчлэх" : "Үнийн санал авах"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !canPay && styles.primaryButtonDisabled]}
          onPress={() => router.push("/booking/payment")}
          disabled={!canPay}
        >
          <Text style={styles.primaryButtonText}>QPay-ээр төлөх</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e4e8",
  },
  backButton: { padding: 8, marginRight: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#111" },
  headerSubtitle: { fontSize: 14, color: "#666", marginTop: 2 },
  container: { padding: 16, gap: 14 },
  statusCard: { backgroundColor: "#e3f2fd", borderRadius: 12, padding: 12 },
  statusCardMock: { backgroundColor: "#fff3e0" },
  statusText: { fontSize: 14, color: "#333", lineHeight: 20 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e1e4e8", gap: 10 },
  row: { gap: 2 },
  rowLabel: { fontSize: 13, color: "#888" },
  rowValue: { fontSize: 15, color: "#111" },
  note: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 18 },
  error: { fontSize: 14, color: "#c62828", textAlign: "center" },
  secondaryButton: { borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#2f80ed" },
  secondaryButtonText: { color: "#2f80ed", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  primaryButton: { backgroundColor: "#2f80ed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonDisabled: { backgroundColor: "#a0c4f0" },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
})
