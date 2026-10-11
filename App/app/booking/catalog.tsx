import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import type { CatalogResult } from "@/services/catalog"
import type { CatalogService } from "@/services/apiTypes"
import { formatMnt } from "@/utils/money"

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; services: CatalogService[]; catalogVersion: string; source: "real" | "mock" }

function toLoadState(result: CatalogResult): LoadState {
  if (!result.ok) return { status: "error", message: result.message }
  return {
    status: "ready",
    services: result.data.services.filter((service) => service.isActive),
    catalogVersion: result.data.catalogVersion,
    source: result.source,
  }
}

export default function CatalogScreen() {
  const router = useRouter()
  const draft = useBookingDraft()
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [selectedId, setSelectedId] = useState<string | null>(draft.service?.id ?? null)

  useEffect(() => {
    let active = true
    apiService.getCatalog().then((result) => {
      if (active) setState(toLoadState(result))
    })
    return () => {
      active = false
    }
  }, [])

  const reload = useCallback(() => {
    setState({ status: "loading" })
    apiService.getCatalog().then((result) => setState(toLoadState(result)))
  }, [])

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)/bookappointment")
  }

  const confirmSelection = () => {
    if (state.status !== "ready") return
    const service = state.services.find((item) => item.id === selectedId)
    if (!service) return
    draft.selectService(service, state.catalogVersion, state.source)
    goBack()
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} accessibilityLabel="Буцах">
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Үйлчилгээ сонгох</Text>
          <Text style={styles.headerSubtitle}>Гэрийн үйлчилгээний каталог</Text>
        </View>
      </View>

      {state.status === "ready" && state.source === "mock" && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>
            MOCK горим: зохиомол өгөгдөл. Зөвхөн хөгжүүлэлтийн build-д харагдана.
          </Text>
        </View>
      )}

      {state.status === "loading" && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2f80ed" />
          <Text style={styles.mutedText}>Каталог ачаалж байна...</Text>
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color="#999" />
          <Text style={styles.errorText}>{state.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reload}>
            <Text style={styles.retryButtonText}>Дахин оролдох</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.status === "ready" && state.services.length === 0 && (
        <View style={styles.centered}>
          <Ionicons name="file-tray-outline" size={48} color="#999" />
          <Text style={styles.mutedText}>Одоогоор захиалах боломжтой үйлчилгээ алга</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reload}>
            <Text style={styles.retryButtonText}>Шинэчлэх</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.status === "ready" && state.services.length > 0 && (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            {state.services.map((service) => {
              const selected = service.id === selectedId
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => setSelectedId(service.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{service.name}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={24} color="#2f80ed" />}
                  </View>
                  {service.description ? <Text style={styles.cardDescription}>{service.description}</Text> : null}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{service.durationMin} мин</Text>
                    {service.requiresReferral && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Эмчийн заалт шаардлагатай</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.price}>{formatMnt(service.priceMnt)}</Text>
                  <Text style={styles.priceNote}>Урьдчилсан үнэ. Эцсийн дүнг баталгаажуулах үед сервер тооцно.</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, !selectedId && styles.primaryButtonDisabled]}
              onPress={confirmSelection}
              disabled={!selectedId}
            >
              <Text style={styles.primaryButtonText}>Сонгох</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
  mockBanner: { backgroundColor: "#fff3e0", paddingHorizontal: 16, paddingVertical: 10 },
  mockBannerText: { color: "#e65100", fontSize: 13, fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  mutedText: { fontSize: 15, color: "#666", textAlign: "center" },
  errorText: { fontSize: 15, color: "#c62828", textAlign: "center" },
  retryButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f80ed",
  },
  retryButtonText: { color: "#2f80ed", fontSize: 15, fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: "#e1e4e8",
  },
  cardSelected: { borderColor: "#2f80ed", backgroundColor: "#f0f6ff" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111" },
  cardDescription: { fontSize: 14, color: "#555", marginTop: 6, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 },
  metaText: { fontSize: 13, color: "#666" },
  badge: { backgroundColor: "#fdecea", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, color: "#c62828", fontWeight: "600" },
  price: { fontSize: 20, fontWeight: "800", color: "#2f80ed", marginTop: 10 },
  priceNote: { fontSize: 12, color: "#888", marginTop: 2 },
  footer: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e1e4e8" },
  primaryButton: { backgroundColor: "#2f80ed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonDisabled: { backgroundColor: "#a0c4f0" },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
})
