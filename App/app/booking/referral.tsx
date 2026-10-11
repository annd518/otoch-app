import React, { useState } from "react"
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { Redirect, useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import { MAX_REFERRAL_FILES, checkPickedAsset, permissionUiState, remainingSlots } from "@/services/attachments"
import { isBlocked, uploadedReferralCount, type LocalAttachment } from "@/services/bookingDraft"
import { createIdempotencyKey } from "@/utils/id"

// Re-encode to JPEG/PNG. On iOS "compatible" makes the photo picker hand over
// JPEG instead of HEIC; quality < 1 makes both platforms re-compress instead of
// copying the original file. Verified in expo-image-picker 57.0.20 sources;
// still to be confirmed on a real iPhone.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.8,
  allowsEditing: false,
  exif: false,
  base64: false,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
}

export default function ReferralScreen() {
  const router = useRouter()
  const { state, dispatch } = useBookingDraft()
  const orderId = state.server?.orderId ?? null
  const source = apiService.sourceOf("attachments")
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />
  if (!orderId) return <Redirect href="/(tabs)/bookappointment" />

  const remaining = remainingSlots(state.attachments.length)
  const uploaded = uploadedReferralCount(state)
  const busy = state.attachments.some((a) => a.status === "uploading")

  const upload = async (attachment: LocalAttachment) => {
    dispatch({ type: "attachmentUpdated", localId: attachment.localId, patch: { status: "uploading", progress: 0, error: null } })
    const result = await apiService.uploadReferral(
      orderId,
      { uri: attachment.uri, name: attachment.name, type: attachment.mimeType },
      (progress) => dispatch({ type: "attachmentUpdated", localId: attachment.localId, patch: { progress } }),
    )
    dispatch({
      type: "attachmentUpdated",
      localId: attachment.localId,
      patch: result.ok
        ? { status: "uploaded", progress: 1, serverId: result.data.id, error: null }
        : { status: "failed", error: result.message },
    })
  }

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    setPickError(null)
    const rejected: string[] = []
    for (const asset of assets.slice(0, remainingSlots(state.attachments.length))) {
      const check = checkPickedAsset({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: asset.fileSize })
      if (!check.ok) {
        rejected.push(check.message)
        continue
      }
      const attachment: LocalAttachment = {
        localId: createIdempotencyKey(),
        uri: asset.uri,
        name: check.name,
        mimeType: check.mimeType,
        sizeBytes: check.sizeBytes,
        status: "selected",
        progress: 0,
        serverId: null,
        error: null,
      }
      dispatch({ type: "attachmentAdded", attachment })
      void upload(attachment)
    }
    if (rejected.length > 0) setPickError([...new Set(rejected)].join("\n"))
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    const ui = permissionUiState(permission)
    if (ui !== "granted") {
      setCameraBlocked(ui === "blocked")
      if (ui === "ask") setPickError("Зураг авахын тулд камерын зөвшөөрөл хэрэгтэй.")
      return
    }
    setCameraBlocked(false)
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
    if (!result.canceled) addAssets(result.assets)
  }

  // The system photo picker (iOS PHPicker, Android Photo Picker) needs no
  // library permission, so none is requested.
  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      ...PICKER_OPTIONS,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    })
    if (!result.canceled) addAssets(result.assets)
  }

  const remove = async (attachment: LocalAttachment) => {
    if (attachment.status === "uploaded" && attachment.serverId) {
      const result = await apiService.deleteAttachment(orderId, attachment.serverId)
      if (!result.ok) {
        Alert.alert("Устгаж чадсангүй", result.message)
        return
      }
    }
    dispatch({ type: "attachmentRemoved", localId: attachment.localId })
  }

  const canContinue = uploaded > 0 && !busy

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Буцах">
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Эмчийн заалт</Text>
          <Text style={styles.headerSubtitle}>Алхам 3: заалтын зургийг оруулна уу</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {source === "mock" && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerText}>MOCK upload: зураг серверт хадгалагдахгүй. Зөвхөн хөгжүүлэлтийн горим.</Text>
          </View>
        )}
        <Text style={styles.rules}>
          JPEG эсвэл PNG, нэг зураг 10 MB хүртэл, нийт {MAX_REFERRAL_FILES} хүртэл. PDF одоогоор дэмжигдэхгүй.
        </Text>

        <View style={styles.pickRow}>
          <TouchableOpacity
            style={[styles.pickButton, remaining === 0 && styles.pickButtonDisabled]}
            onPress={() => void takePhoto()}
            disabled={remaining === 0}
          >
            <Ionicons name="camera-outline" size={24} color="#2f80ed" />
            <Text style={styles.pickText}>Камераар авах</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickButton, remaining === 0 && styles.pickButtonDisabled]}
            onPress={() => void pickFromLibrary()}
            disabled={remaining === 0}
          >
            <Ionicons name="images-outline" size={24} color="#2f80ed" />
            <Text style={styles.pickText}>Галерейгаас сонгох</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.counter}>
          {state.attachments.length}/{MAX_REFERRAL_FILES} зураг
        </Text>

        {cameraBlocked && (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionText}>Камерын зөвшөөрөл хаалттай байна. Утасны тохиргооноос нээнэ үү.</Text>
            <TouchableOpacity onPress={() => void Linking.openSettings()}>
              <Text style={styles.linkText}>Тохиргоо нээх</Text>
            </TouchableOpacity>
          </View>
        )}
        {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}

        {state.attachments.map((attachment) => (
          <View key={attachment.localId} style={styles.itemCard}>
            <Image source={{ uri: attachment.uri }} style={styles.thumb} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {attachment.name}
              </Text>
              {attachment.status === "uploading" && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(attachment.progress * 100)}%` }]} />
                </View>
              )}
              {attachment.status === "uploaded" && (
                <Text style={styles.okText}>{source === "mock" ? "Mock-д илгээгдсэн (серверт биш)" : "Серверт хадгалагдсан"}</Text>
              )}
              {attachment.status === "failed" && <Text style={styles.errorTextSmall}>{attachment.error}</Text>}
              <View style={styles.itemActions}>
                {attachment.status === "failed" && (
                  <TouchableOpacity onPress={() => void upload(attachment)}>
                    <Text style={styles.linkText}>Дахин илгээх</Text>
                  </TouchableOpacity>
                )}
                {attachment.status !== "uploading" && (
                  <TouchableOpacity onPress={() => void remove(attachment)}>
                    <Text style={styles.removeText}>Устгах</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          onPress={() => router.push("/booking/review")}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Үргэлжлүүлэх</Text>
        </TouchableOpacity>
      </View>
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
  container: { padding: 16, gap: 12 },
  mockBanner: { backgroundColor: "#fff3e0", borderRadius: 12, padding: 12 },
  mockBannerText: { color: "#e65100", fontSize: 13, fontWeight: "600" },
  rules: { fontSize: 14, color: "#555", lineHeight: 20 },
  pickRow: { flexDirection: "row", gap: 12 },
  pickButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2f80ed",
    backgroundColor: "#fff",
  },
  pickButtonDisabled: { opacity: 0.4 },
  pickText: { color: "#2f80ed", fontSize: 14, fontWeight: "700" },
  counter: { fontSize: 13, color: "#888", textAlign: "right" },
  permissionCard: { backgroundColor: "#fdecea", borderRadius: 12, padding: 12, gap: 6 },
  permissionText: { color: "#b71c1c", fontSize: 14 },
  errorText: { color: "#c62828", fontSize: 14 },
  errorTextSmall: { color: "#c62828", fontSize: 13, marginTop: 4 },
  itemCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: "#eee" },
  itemInfo: { flex: 1, justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "600", color: "#111" },
  progressTrack: { height: 6, backgroundColor: "#e1e4e8", borderRadius: 3, marginTop: 8, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#2f80ed" },
  okText: { color: "#2e7d32", fontSize: 13, marginTop: 4 },
  itemActions: { flexDirection: "row", gap: 16, marginTop: 6 },
  linkText: { color: "#2f80ed", fontSize: 14, fontWeight: "700" },
  removeText: { color: "#c62828", fontSize: 14, fontWeight: "600" },
  footer: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e1e4e8" },
  primaryButton: { backgroundColor: "#2f80ed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonDisabled: { backgroundColor: "#a0c4f0" },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
})
