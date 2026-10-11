import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, AppState, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Redirect, useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import { isBlocked } from "@/services/bookingDraft"
import { isQuoteExpired } from "@/services/orders"
import { POLL_INTERVAL_MS, pollDecision, type Invoice } from "@/services/payment"
import { createIdempotencyKey } from "@/utils/id"
import { formatMnt } from "@/utils/money"

type Phase =
  | { kind: "creating" }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string }
  | { kind: "pending"; invoice: Invoice; checkError: string | null }
  | { kind: "paid"; invoice: Invoice; paidAt: string }
  | { kind: "expired"; invoice: Invoice | null }
  | { kind: "failed"; invoice: Invoice }

// QPay invoice (docs/l1-1-api.md §7). "Paid" is shown only when the backend
// returns PAID; returning from a bank app is never treated as payment.
export default function PaymentScreen() {
  const router = useRouter()
  const { state, dispatch } = useBookingDraft()
  const source = apiService.sourceOf("payments")
  const orderId = state.server?.orderId ?? null
  const quote = state.quote
  const [phase, setPhase] = useState<Phase>({ kind: "creating" })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appActive = useRef(true)

  // One idempotency key per quote: retries and re-opening the screen return the
  // same invoice. A new quote (new price) gets a new key.
  const [paymentKey] = useState(() =>
    quote && state.paymentKey?.quoteId === quote.id ? state.paymentKey.key : createIdempotencyKey(),
  )

  const requestInvoice = useCallback(async (): Promise<Phase> => {
    if (!orderId || !quote) return { kind: "error", message: "Үнийн санал алга." }
    if (isQuoteExpired(quote, Date.now())) return { kind: "expired", invoice: null }
    dispatch({ type: "paymentKey", quoteId: quote.id, key: paymentKey })
    const result = await apiService.createInvoice(orderId, quote.id, paymentKey)
    if (!result.ok) {
      return result.kind === "not_implemented"
        ? { kind: "unavailable", message: result.message }
        : { kind: "error", message: result.message }
    }
    return { kind: "pending", invoice: result.data, checkError: null }
  }, [orderId, quote, paymentKey, dispatch])

  const createOrReuse = () => {
    setPhase({ kind: "creating" })
    void requestInvoice().then(setPhase)
  }

  const check = useCallback(
    async (invoice: Invoice) => {
      if (!orderId) return
      const result = await apiService.getPaymentState(orderId, invoice.id)
      if (!result.ok) {
        // A failed status read is not a payment result: keep waiting, show the error.
        setPhase((p) => (p.kind === "pending" ? { ...p, checkError: result.message } : p))
        return
      }
      const decision = pollDecision(result.data.status, invoice.expiresAt, Date.now())
      if (decision === "paid" && result.data.paidAt) setPhase({ kind: "paid", invoice, paidAt: result.data.paidAt })
      else if (decision === "expired") setPhase({ kind: "expired", invoice })
      else if (decision === "stop_failed") setPhase({ kind: "failed", invoice })
      else setPhase((p) => (p.kind === "pending" ? { ...p, checkError: null } : p))
    },
    [orderId],
  )

  useEffect(() => {
    let active = true
    requestInvoice().then((next) => {
      if (active) setPhase(next)
    })
    return () => {
      active = false
    }
  }, [requestInvoice])

  // Poll while pending and the app is in the foreground.
  useEffect(() => {
    if (phase.kind !== "pending") return
    const invoice = phase.invoice
    timer.current = setTimeout(() => {
      if (appActive.current) void check(invoice)
    }, POLL_INTERVAL_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [phase, check])

  // Coming back from the bank app: check right away.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appActive.current = next === "active"
      if (next === "active" && phase.kind === "pending") void check(phase.invoice)
    })
    return () => sub.remove()
  }, [phase, check])

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />
  if (!orderId || !quote) return <Redirect href="/booking/review" />

  const openBank = async (link: string) => {
    try {
      await Linking.openURL(link)
    } catch {
      setPhase((p) => (p.kind === "pending" ? { ...p, checkError: "Банкны аппыг нээж чадсангүй. QR кодыг уншуулна уу." } : p))
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Буцах">
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>QPay төлбөр</Text>
          <Text style={styles.headerSubtitle}>Дүн: {formatMnt(quote.totalMnt)}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {source === "mock" && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerText}>MOCK төлбөр: бодит QPay биш, мөнгө шилжихгүй. Зөвхөн хөгжүүлэлтийн горим.</Text>
          </View>
        )}

        {phase.kind === "creating" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2f80ed" />
            <Text style={styles.muted}>Нэхэмжлэх үүсгэж байна...</Text>
          </View>
        )}

        {phase.kind === "unavailable" && (
          <View style={styles.centered}>
            <Ionicons name="card-outline" size={48} color="#999" />
            <Text style={styles.muted}>{phase.message}</Text>
            <Text style={styles.muted}>Захиалга төлөгдөөгүй, баталгаажаагүй байна.</Text>
          </View>
        )}

        {phase.kind === "error" && (
          <View style={styles.centered}>
            <Text style={styles.error}>{phase.message}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={createOrReuse}>
              <Text style={styles.secondaryButtonText}>Дахин оролдох</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase.kind === "pending" && (
          <>
            {phase.invoice.qrImageBase64 ? (
              <Image
                source={{ uri: `data:image/png;base64,${phase.invoice.qrImageBase64}` }}
                style={styles.qr}
                accessibilityLabel="QPay QR код"
              />
            ) : (
              <Text style={styles.muted}>QR зураг ирээгүй. Банкны аппаар төлнө үү.</Text>
            )}
            <Text style={styles.muted}>Төлбөр хүлээгдэж байна. Төлсний дараа энд автоматаар шалгана.</Text>
            {phase.invoice.deeplinks.map((bank) => (
              <TouchableOpacity key={bank.link} style={styles.bankButton} onPress={() => void openBank(bank.link)}>
                <Text style={styles.bankText}>{bank.name}</Text>
              </TouchableOpacity>
            ))}
            {phase.checkError ? <Text style={styles.error}>{phase.checkError}</Text> : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void check(phase.invoice)}>
              <Text style={styles.secondaryButtonText}>Төлбөр шалгах</Text>
            </TouchableOpacity>
          </>
        )}

        {phase.kind === "paid" && (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle" size={64} color="#2e7d32" />
            <Text style={styles.paid}>Төлбөрийг сервер баталгаажууллаа</Text>
            <Text style={styles.muted}>{source === "mock" ? "(MOCK, бодит гүйлгээ биш)" : `Төлсөн: ${phase.paidAt}`}</Text>
          </View>
        )}

        {phase.kind === "expired" && (
          <View style={styles.centered}>
            <Text style={styles.error}>Нэхэмжлэхийн хугацаа дууссан. Төлбөр хийгдээгүй.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/booking/review")}>
              <Text style={styles.secondaryButtonText}>Үнийн саналыг шинэчлэх</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase.kind === "failed" && (
          <View style={styles.centered}>
            <Text style={styles.error}>Төлбөр амжилтгүй эсвэл цуцлагдсан. Мөнгө шилжээгүй гэж сервер мэдэгдсэн.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/booking/review")}>
              <Text style={styles.secondaryButtonText}>Буцах</Text>
            </TouchableOpacity>
          </View>
        )}
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
  container: { padding: 16, gap: 14, alignItems: "stretch" },
  mockBanner: { backgroundColor: "#fff3e0", borderRadius: 12, padding: 12 },
  mockBannerText: { color: "#e65100", fontSize: 13, fontWeight: "600" },
  centered: { alignItems: "center", gap: 12, paddingVertical: 24 },
  muted: { fontSize: 14, color: "#666", textAlign: "center" },
  error: { fontSize: 14, color: "#c62828", textAlign: "center" },
  qr: { width: 240, height: 240, alignSelf: "center", backgroundColor: "#fff" },
  bankButton: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e1e4e8", padding: 14 },
  bankText: { fontSize: 16, color: "#111", fontWeight: "600", textAlign: "center" },
  paid: { fontSize: 20, fontWeight: "800", color: "#2e7d32" },
  secondaryButton: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", borderWidth: 1, borderColor: "#2f80ed" },
  secondaryButtonText: { color: "#2f80ed", fontSize: 16, fontWeight: "700" },
})
