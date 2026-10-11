import React from "react"
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Redirect, useRouter } from "expo-router"

import { PriceSummary } from "@/components/PriceSummary"
import { useBookingDraft } from "@/context/BookingDraftContext"
import { isBlocked, needsReferral, uploadedReferralCount } from "@/services/bookingDraft"

// Summary before the quote/payment steps. The quote (§6) and QPay (§7)
// endpoints are not implemented yet, so this screen never shows a payable
// total or a "confirmed" state.
export default function ReviewScreen() {
  const router = useRouter()
  const { state } = useBookingDraft()

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />
  if (!state.server || state.redFlag.status !== "clear") return <Redirect href="/(tabs)/bookappointment" />

  const { service, details, server } = state
  const rows: [string, string][] = [
    ["Үйлчилгээ", service?.name ?? "-"],
    ["Өвчтөн", details.parentName || "-"],
    ["Хаяг", details.addressText],
    ["Огноо, цаг", `${details.date} ${details.timeSlot} (Улаанбаатарын цагаар)`],
    ["Аюулын шинж", "Илрээгүй (асуулга хадгалагдсан)"],
  ]
  if (needsReferral(state)) rows.push(["Заалтын зураг", `${uploadedReferralCount(state)} илгээгдсэн`])

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

        <PriceSummary service={service} quote={state.quote} />

        <TouchableOpacity style={[styles.primaryButton, styles.primaryButtonDisabled]} disabled>
          <Text style={styles.primaryButtonText}>Үнийн санал авах</Text>
        </TouchableOpacity>
        <Text style={styles.note}>
          Серверийн үнийн санал (quote) болон QPay төлбөрийн API хараахан хэрэгжээгүй. Эцсийн төлөх дүнг зөвхөн сервер тооцно.
        </Text>
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
  primaryButton: { backgroundColor: "#2f80ed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonDisabled: { backgroundColor: "#a0c4f0" },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  note: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 18 },
})
