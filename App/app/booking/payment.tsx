import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, AppState, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import { isBlocked } from "@/services/bookingDraft"
import { isQuoteExpired } from "@/services/orders"
import { POLL_INTERVAL_MS, invoiceOutcome, type Invoice, type PaymentRecord, type RecoveryResult } from "@/services/payment"
import { createIdempotencyKey } from "@/utils/id"
import { formatMnt } from "@/utils/money"
import { paymentStore } from "@/utils/paymentStore"
import { storage } from "@/utils/storage"

type Phase = { kind: "loading" } | { kind: "no_quote" } | RecoveryResult

// QPay invoice (docs/l1-1-api.md §7). "Paid" is shown only when the backend
// returns PAID with paidAt; returning from a bank app is never a payment.
// Recovery: the device remembers {key, quoteId, paymentId} per order and
// either reads that payment or replays the same create; it never makes a
// second invoice for the same order.
export default function PaymentScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ orderId?: string }>()
  const { state, dispatch } = useBookingDraft()
  const source = apiService.sourceOf("payments")
  const orderId = (typeof params.orderId === "string" && params.orderId) || state.server?.orderId || null
  const quote = state.server?.orderId === orderId ? state.quote : null
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const record = useRef<PaymentRecord | null>(null)
  const userId = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const appActive = useRef(AppState.currentState === "active")

  const remember = useCallback(async (next: PaymentRecord | null) => {
    record.current = next
    if (!userId.current || !orderId) return
    if (next) await paymentStore.save(userId.current, next)
    else await paymentStore.remove(userId.current, orderId)
  }, [orderId])

  // Final states end the attempt: a new quote gets a new key next time.
  const settle = useCallback(async (result: RecoveryResult, paymentId: string | null): Promise<RecoveryResult> => {
    // paid / expired / failed / new_quote end this logical attempt; the next
    // invoice needs a new quote and a new key. reconciliation keeps the record.
    const ended = ["paid", "expired", "failed", "new_quote"].includes(result.kind)
    if (ended) await remember(null)
    else if (record.current && paymentId && record.current.paymentId !== paymentId) {
      await remember({ ...record.current, paymentId })
    }
    return result
  }, [remember])

  const start = useCallback(async (): Promise<Phase> => {
    if (!orderId) return { kind: "no_quote" }
    const user = await storage.getUser()
    userId.current = user?.id ?? null
    const saved = user ? await paymentStore.get(user.id, orderId) : null
    if (saved) {
      record.current = saved
      const { result, paymentId } = await apiService.recoverPayment(saved)
      const settled = await settle(result, paymentId)
      // An old attempt that ended can be followed by a new invoice for a new quote.
      const ended = settled.kind === "expired" || settled.kind === "failed" || settled.kind === "new_quote"
      if (!ended || !quote || quote.id === saved.quoteId) return settled
    }
    if (!quote) return { kind: "no_quote" }
    if (isQuoteExpired(quote, Date.now())) return { kind: "expired", invoice: null }
    // Store the attempt before sending, so a timeout is recovered with the same key.
    const attempt: PaymentRecord = { orderId, quoteId: quote.id, key: createIdempotencyKey(), paymentId: null }
    await remember(attempt)
    dispatch({ type: "paymentKey", quoteId: quote.id, key: attempt.key })
    const { result, paymentId } = await apiService.recoverPayment(attempt)
    return settle(result, paymentId)
  }, [orderId, quote, remember, settle, dispatch])

  const check = useCallback(async () => {
    const current = record.current
    if (!current?.paymentId || !orderId || inFlight.current) return
    inFlight.current = true
    try {
      const read = await apiService.getInvoice(orderId, current.paymentId)
      if (!mounted.current) return
      // A failed status read is not a payment result: keep the pending state.
      if (!read.ok) return
      setPhase(await settle(invoiceOutcome(read.data, Date.now()), read.data.id))
    } finally {
      inFlight.current = false
    }
  }, [orderId, settle])

  useEffect(() => {
    mounted.current = true
    start().then((next) => {
      if (mounted.current) setPhase(next)
    })
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [start])

  // One timer at a time, only while pending/unconfirmed and in the foreground.
  // The server moves the payment to EXPIRED at expiresAt, which ends polling.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (phase.kind !== "pending" && phase.kind !== "unconfirmed") return
    timer.current = setTimeout(() => {
      if (appActive.current) void check()
    }, POLL_INTERVAL_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [phase, check])

  // Back from the bank app: check once right away (the in-flight guard stops doubles).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appActive.current = next === "active"
      if (next === "active") void check()
    })
    return () => sub.remove()
  }, [check])

  const retry = () => {
    setPhase({ kind: "loading" })
    start().then((next) => {
      if (mounted.current) setPhase(next)
    })
  }

  const openBank = async (link: string) => {
    try {
      await Linking.openURL(link)
    } catch {
      // ignore: the QR code is still available
    }
  }

  if (isBlocked(state) && state.server?.orderId === orderId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.error}>Энэ захиалга аюулын шинжээр зогссон тул төлбөр хийх боломжгүй.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const invoice: Invoice | null =
    phase.kind === "pending" || phase.kind === "paid" || phase.kind === "failed" || phase.kind === "expired" || phase.kind === "unconfirmed"
      ? phase.invoice
      : null
  const isMock = source === "mock" || invoice?.isMock === true

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Буцах">
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>QPay төлбөр</Text>
          <Text style={styles.headerSubtitle}>
            {invoice ? `Дүн: ${formatMnt(invoice.amountMnt)}` : quote ? `Дүн: ${formatMnt(quote.totalMnt)}` : "Төлбөр"}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {isMock && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerText}>
              MOCK нэхэмжлэх: бодит QPay биш, төлөх боломжгүй, мөнгө шилжихгүй.
            </Text>
          </View>
        )}

        {phase.kind === "loading" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2f80ed" />
            <Text style={styles.muted}>Нэхэмжлэх бэлдэж байна...</Text>
          </View>
        )}

        {phase.kind === "no_quote" && (
          <View style={styles.centered}>
            <Text style={styles.muted}>Үнийн санал алга. Хураангуй дэлгэцээс үнийн санал авна уу.</Text>
          </View>
        )}

        {phase.kind === "unavailable" && (
          <View style={styles.centered}>
            <Ionicons name="card-outline" size={48} color="#999" />
            <Text style={styles.muted}>{phase.message}</Text>
            <Text style={styles.muted}>Захиалга төлөгдөөгүй, баталгаажаагүй байна.</Text>
          </View>
        )}

        {phase.kind === "unconfirmed" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2f80ed" />
            <Text style={styles.muted}>
              Төлбөрийн үйлчилгээний хариу тодорхойгүй байна. Давхар төлбөрөөс сэргийлж хүлээж байна. QR харуулахгүй.
            </Text>
            {phase.expiresAt ? (
              <Text style={styles.muted}>Хамгийн удаад {new Date(phase.expiresAt).toLocaleTimeString()} хүртэл шалгана.</Text>
            ) : null}
          </View>
        )}

        {phase.kind === "reconciliation" && (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color="#c62828" />
            <Text style={styles.error}>{phase.message}</Text>
            <Text style={styles.muted}>
              Тусламжийн суваг одоогоор батлагдаагүй тул энд холбоо барих мэдээлэл өгөхгүй.
            </Text>
          </View>
        )}

        {phase.kind === "new_quote" && (
          <View style={styles.centered}>
            <Text style={styles.error}>{phase.message}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/booking/review")}>
              <Text style={styles.secondaryButtonText}>Шинэ үнийн санал авах</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase.kind === "unknown_pending" && (
          <View style={styles.centered}>
            <Text style={styles.error}>{phase.message}</Text>
            <Text style={styles.muted}>Төлбөр төлөгдсөн гэж харуулахгүй.</Text>
          </View>
        )}

        {phase.kind === "error" && (
          <View style={styles.centered}>
            <Text style={styles.error}>{phase.message}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={retry}>
              <Text style={styles.secondaryButtonText}>Дахин оролдох</Text>
            </TouchableOpacity>
            <Text style={styles.muted}>Дахин оролдоход ижил нэхэмжлэх сэргээгдэнэ, шинээр үүсэхгүй.</Text>
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
              <Text style={styles.muted}>QR зураг ирээгүй.</Text>
            )}
            <Text style={styles.muted}>Төлбөр хүлээгдэж байна. Сервер баталгаажуулмагц энд харагдана.</Text>
            {phase.invoice.deeplinks.map((bank) => (
              <TouchableOpacity key={bank.link} style={styles.bankButton} onPress={() => void openBank(bank.link)}>
                <Text style={styles.bankText}>{bank.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void check()}>
              <Text style={styles.secondaryButtonText}>Төлбөр шалгах</Text>
            </TouchableOpacity>
          </>
        )}

        {phase.kind === "paid" && (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle" size={64} color="#2e7d32" />
            <Text style={styles.paid}>{isMock ? "MOCK төлбөр төлөгдсөн гэж тэмдэглэгдсэн" : "Төлбөрийг сервер баталгаажууллаа"}</Text>
            <Text style={styles.muted}>
              {isMock ? "Бодит QPay эсвэл sandbox гүйлгээ биш. Мөнгө шилжээгүй." : `Төлсөн: ${phase.paidAt}`}
            </Text>
          </View>
        )}

        {phase.kind === "expired" && (
          <View style={styles.centered}>
            <Text style={styles.error}>Нэхэмжлэх эсвэл үнийн саналын хугацаа дууссан. Төлбөр хийгдээгүй.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/booking/review")}>
              <Text style={styles.secondaryButtonText}>Үнийн саналыг шинэчлэх</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase.kind === "failed" && (
          <View style={styles.centered}>
            <Text style={styles.error}>Төлбөр амжилтгүй эсвэл цуцлагдсан гэж сервер мэдэгдсэн. Мөнгө шилжээгүй.</Text>
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
  paid: { fontSize: 20, fontWeight: "800", color: "#2e7d32", textAlign: "center" },
  secondaryButton: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", borderWidth: 1, borderColor: "#2f80ed" },
  secondaryButtonText: { color: "#2f80ed", fontSize: 16, fontWeight: "700" },
})
