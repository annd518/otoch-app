import React, { useEffect, useState } from "react"
import { Alert, BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import { reportBlockInBackground } from "@/services/blockSync"
import { EMERGENCY_PHONE } from "@/services/redFlag"

const DEFAULT_ADVICE = "Яаралтай тусламжийн 103 дугаарт одоо залгана уу."

// Terminal screen: there is intentionally no way to continue the booking.
export default function EmergencyScreen() {
  const router = useRouter()
  const { state, dispatch } = useBookingDraft()
  const blocked = state.redFlag.status === "blocked" ? state.redFlag : null
  const advice = blocked?.advice ?? null
  const [retrying, setRetrying] = useState(false)

  // Re-send an unconfirmed block. This never re-opens the booking.
  const retryReport = async () => {
    const orderId = state.server?.orderId
    if (!blocked?.report || !orderId) return
    setRetrying(true)
    await reportBlockInBackground(orderId, blocked.report, apiService.sourceOf("redFlags"), (server, version) =>
      dispatch({ type: "blockReported", server, version }),
    )
    setRetrying(false)
  }

  const goHome = () => router.replace("/(tabs)")

  // Android back button leaves to home instead of returning to the questionnaire.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)")
      return true
    })
    return () => sub.remove()
  }, [router])

  const call = async () => {
    try {
      await Linking.openURL(`tel:${EMERGENCY_PHONE}`)
    } catch {
      Alert.alert("Залгаж чадсангүй", `${EMERGENCY_PHONE} дугаарт утаснаасаа шууд залгана уу.`)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Ionicons name="medkit" size={64} color="#c62828" />
        <Text style={styles.title}>Яаралтай тусламж шаардлагатай байж болзошгүй</Text>
        <Text style={styles.advice}>{DEFAULT_ADVICE}</Text>
        {advice ? (
          <Text style={styles.note}>
            {advice.text}
            {advice.isFixture ? " (туршилтын бичвэр, батлагдаагүй)" : ""}
          </Text>
        ) : null}
        <Text style={styles.note}>Энэ тохиолдолд гэрийн үйлчилгээний захиалга хийх боломжгүй.</Text>
        {blocked?.server === "recorded" ? (
          <Text style={styles.serverNote}>Захиалгын блок серверт бүртгэгдсэн.</Text>
        ) : blocked ? (
          <View style={styles.pendingBox}>
            <Text style={styles.serverNote}>
              {blocked.server === "not_supported"
                ? "Сервер энэ блокийг одоогоор бүртгэж чадахгүй байна. Захиалга энэ утсан дээр зогссон хэвээр."
                : "Блок серверт бүртгэгдээгүй байна. Захиалга энэ утсан дээр зогссон хэвээр."}
            </Text>
            {blocked.report ? (
              <TouchableOpacity onPress={() => void retryReport()} disabled={retrying}>
                <Text style={styles.retryText}>{retrying ? "Илгээж байна..." : "Серверт дахин илгээх"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.callButton} onPress={() => void call()} accessibilityRole="button">
          <Ionicons name="call" size={26} color="#fff" />
          <Text style={styles.callButtonText}>{EMERGENCY_PHONE} руу залгах</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeButton} onPress={goHome}>
          <Text style={styles.homeButtonText}>Нүүр хуудас руу буцах</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff5f5" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#b71c1c", textAlign: "center", lineHeight: 32 },
  advice: { fontSize: 18, color: "#333", textAlign: "center", lineHeight: 26 },
  note: { fontSize: 14, color: "#666", textAlign: "center" },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#c62828",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 36,
    marginTop: 12,
  },
  callButtonText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  homeButton: { paddingVertical: 14, paddingHorizontal: 24 },
  serverNote: { fontSize: 13, color: "#555", textAlign: "center" },
  pendingBox: { alignItems: "center", gap: 6 },
  retryText: { fontSize: 14, color: "#2f80ed", fontWeight: "700" },
  homeButtonText: { color: "#555", fontSize: 16, fontWeight: "600" },
})
