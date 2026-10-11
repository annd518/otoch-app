import React, { useEffect } from "react"
import { Alert, BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { EMERGENCY_PHONE } from "@/services/redFlag"

const DEFAULT_ADVICE = "Яаралтай тусламжийн 103 дугаарт одоо залгана уу."

// Terminal screen: there is intentionally no way to continue the booking.
export default function EmergencyScreen() {
  const router = useRouter()
  const { state } = useBookingDraft()
  const advice = state.redFlag.status === "blocked" ? state.redFlag.advice : null

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
  homeButtonText: { color: "#555", fontSize: 16, fontWeight: "600" },
})
