// Prescription / referral photo upload: camera, photo library or a file
// (Files app / Downloads). Used on booking step 3 ("Зураг оруулах") and on the
// referral step. Uploads go to the saved draft; when there is none yet,
// `ensureOrderId` saves it first.
import { TouchTarget as TouchableOpacity } from "@/components/ui/TouchTarget";
import { theme } from "@/design/theme";
import React, { useState } from "react";
import { Alert, Image, Linking, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/AppText";
import { Icon as Ionicons } from "@/components/ui/Icon";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { useBookingDraft } from "@/context/BookingDraftContext";
import { apiService } from "@/services/api";
import {
  MAX_REFERRAL_FILES,
  checkPickedAsset,
  permissionUiState,
  remainingSlots,
  type PickedAsset,
} from "@/services/attachments";
import type { LocalAttachment } from "@/services/bookingDraft";
import { createIdempotencyKey } from "@/utils/id";

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
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

// Files are not re-encoded, so only types the server accepts can be chosen
// (PDF is decision D12, HEIC is refused by the server).
const FILE_TYPES = ["image/jpeg", "image/png"];

const UPLOAD_ERRORS: Record<string, string> = {
  UNSUPPORTED_MEDIA_TYPE: "Зөвхөн JPEG эсвэл PNG зураг хүлээн авна.",
  FILE_TOO_LARGE: "Зургийн хэмжээ 10 MB-аас их байна.",
  ATTACHMENT_LIMIT: "Нэг захиалгад 5 хүртэл зураг оруулна.",
  ORDER_NOT_FOUND: "Захиалга олдсонгүй эсвэл таных биш байна.",
  RED_FLAG_BLOCKED: "Захиалга зогссон тул зураг илгээх боломжгүй.",
  STORAGE_UNAVAILABLE:
    "Сервер зураг хадгалах боломжгүй байна. Дараа дахин оролдоно уу.",
};

export function ReferralUploader({
  orderId,
  ensureOrderId,
}: {
  orderId: string | null;
  ensureOrderId?: () => Promise<string | null>;
}) {
  const { state, dispatch } = useBookingDraft();
  const fileLimit = Math.min(
    MAX_REFERRAL_FILES,
    state.service?.formConfig?.attachmentLimit ?? MAX_REFERRAL_FILES,
  );
  const source = apiService.sourceOf("attachments");
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  // draft saved by ensureOrderId, until the parent passes its orderId
  const [savedId, setSavedId] = useState<string | null>(null);
  const remaining = remainingSlots(state.attachments.length, fileLimit);

  const getOrderId = async () => {
    const id =
      orderId ?? savedId ?? (ensureOrderId ? await ensureOrderId() : null);
    if (id && id !== savedId) setSavedId(id);
    return id;
  };

  // Uploads and deletes bump the order version on the server; keep it in sync
  // so the next draft save is not rejected with VERSION_CONFLICT.
  const syncVersion = async (id: string) => {
    const fresh = await apiService.getOrder(id);
    if (fresh.ok)
      dispatch({ type: "serverVersionSeen", version: fresh.data.version });
  };

  const upload = async (attachment: LocalAttachment, id: string) => {
    dispatch({
      type: "attachmentUpdated",
      localId: attachment.localId,
      patch: { status: "uploading", progress: 0, error: null },
    });
    const result = await apiService.uploadReferral(
      id,
      { uri: attachment.uri, name: attachment.name, type: attachment.mimeType },
      (progress) =>
        dispatch({
          type: "attachmentUpdated",
          localId: attachment.localId,
          patch: { progress },
        }),
      // the local id doubles as the upload idempotency key: a retry is the same upload
      attachment.localId,
    );
    if (result.ok) await syncVersion(id);
    dispatch({
      type: "attachmentUpdated",
      localId: attachment.localId,
      patch: result.ok
        ? {
            status: "uploaded",
            progress: 1,
            serverId: result.data.id,
            error: null,
            storage: result.data.storage,
          }
        : {
            status: "failed",
            error:
              (result.code && UPLOAD_ERRORS[result.code]) || result.message,
          },
    });
  };

  const addAssets = async (assets: PickedAsset[]) => {
    setPickError(null);
    const rejected: string[] = [];
    const accepted: LocalAttachment[] = [];
    for (const asset of assets.slice(0, remaining)) {
      const check = checkPickedAsset(asset);
      if (!check.ok) {
        rejected.push(check.message);
        continue;
      }
      accepted.push({
        localId: createIdempotencyKey(),
        uri: asset.uri,
        name: check.name,
        mimeType: check.mimeType,
        sizeBytes: check.sizeBytes,
        status: "selected",
        progress: 0,
        serverId: null,
        error: null,
      });
    }
    if (rejected.length > 0) setPickError([...new Set(rejected)].join("\n"));
    if (accepted.length === 0) return;
    const id = await getOrderId();
    if (!id) {
      setPickError(
        "Зургийг илгээхийн өмнө захиалгыг хадгалж чадсангүй. Дээрх мэдээллийг шалгана уу.",
      );
      return;
    }
    for (const attachment of accepted) {
      dispatch({ type: "attachmentAdded", attachment });
      void upload(attachment, id);
    }
  };

  const fromImagePicker = (assets: ImagePicker.ImagePickerAsset[]) =>
    addAssets(
      assets.map((a) => ({
        uri: a.uri,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
      })),
    );

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const ui = permissionUiState(permission);
    if (ui !== "granted") {
      setCameraBlocked(ui === "blocked");
      if (ui === "ask")
        setPickError("Зураг авахын тулд камерын зөвшөөрөл хэрэгтэй.");
      return;
    }
    setCameraBlocked(false);
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!result.canceled) await fromImagePicker(result.assets);
  };

  // The system photo picker (iOS PHPicker, Android Photo Picker) needs no
  // library permission, so none is requested.
  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      ...PICKER_OPTIONS,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled) await fromImagePicker(result.assets);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: FILE_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled)
      await addAssets(
        result.assets.map((a) => ({
          uri: a.uri,
          fileName: a.name,
          mimeType: a.mimeType,
          fileSize: a.size,
        })),
      );
  };

  const retry = async (attachment: LocalAttachment) => {
    const id = await getOrderId();
    if (id) await upload(attachment, id);
  };

  const remove = async (attachment: LocalAttachment) => {
    if (attachment.status === "uploaded" && attachment.serverId) {
      const id = await getOrderId();
      if (!id) return;
      const result = await apiService.deleteAttachment(id, attachment.serverId);
      if (!result.ok) {
        Alert.alert("Устгаж чадсангүй", result.message);
        return;
      }
      await syncVersion(id);
    }
    dispatch({ type: "attachmentRemoved", localId: attachment.localId });
  };

  const pickers = [
    { icon: "camera-outline", label: "Зураг авах", onPress: takePhoto },
    { icon: "images-outline", label: "Галерейгаас", onPress: pickFromLibrary },
    { icon: "document-outline", label: "Файлаас", onPress: pickFile },
  ];

  return (
    <View style={styles.container}>
      {source === "real" && state.server?.referralUploadAvailable === false && (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionText}>
            Сервер одоогоор зураг хүлээн авах боломжгүй байна (upload
            хэрэгжээгүй). Зураг илгээгдэхгүй.
          </Text>
        </View>
      )}
      {source === "mock" && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>
            MOCK upload: зураг серверт хадгалагдахгүй. Зөвхөн хөгжүүлэлтийн
            горим.
          </Text>
        </View>
      )}
      <Text style={styles.rules}>
        JPEG эсвэл PNG, нэг зураг 10 MB хүртэл, нийт {fileLimit} хүртэл. PDF
        одоогоор дэмжигдэхгүй.
      </Text>

      <View style={styles.pickRow}>
        {pickers.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={[
              styles.pickButton,
              remaining === 0 && styles.pickButtonDisabled,
            ]}
            onPress={() => void p.onPress()}
            disabled={remaining === 0}
            accessibilityLabel={p.label}
          >
            <Ionicons name={p.icon} size={24} color={theme.color.brand} />
            <Text style={styles.pickText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.counter}>
        {state.attachments.length}/{fileLimit} зураг
      </Text>

      {cameraBlocked && (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionText}>
            Камерын зөвшөөрөл хаалттай байна. Утасны тохиргооноос нээнэ үү.
          </Text>
          <TouchableOpacity onPress={() => void Linking.openSettings()}>
            <Text style={styles.linkText}>Тохиргоо нээх</Text>
          </TouchableOpacity>
        </View>
      )}
      {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}

      {state.attachments.map((attachment) => (
        <View key={attachment.localId} style={styles.itemCard}>
          {attachment.uri ? (
            <Image source={{ uri: attachment.uri }} style={styles.thumb} />
          ) : (
            <Text>Серверт хадгалсан зураг</Text>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {attachment.name}
            </Text>
            {attachment.status === "uploading" && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(attachment.progress * 100)}%` },
                  ]}
                />
              </View>
            )}
            {attachment.status === "uploaded" && (
              <Text style={styles.okText}>
                {source === "mock"
                  ? "Mock-д илгээгдсэн (серверт биш)"
                  : attachment.storage && attachment.storage !== "s3"
                    ? `Серверт хадгалагдсан (${attachment.storage}, хөгжүүлэлтийн storage)`
                    : "Серверт хадгалагдсан"}
              </Text>
            )}
            {attachment.status === "failed" && (
              <Text style={styles.errorTextSmall}>{attachment.error}</Text>
            )}
            <View style={styles.itemActions}>
              {attachment.status === "failed" && (
                <TouchableOpacity onPress={() => void retry(attachment)}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  mockBanner: {
    backgroundColor: theme.color.subtle,
    borderRadius: 12,
    padding: 12,
  },
  mockBannerText: {
    color: theme.color.secondary,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "600",
  },
  rules: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.secondary,
    lineHeight: 25,
  },
  pickRow: { flexDirection: "row", gap: 8 },
  pickButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.brand,
    backgroundColor: theme.color.background,
  },
  pickButtonDisabled: { opacity: 0.4 },
  pickText: {
    color: theme.color.brand,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  counter: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.secondary,
    textAlign: "right",
  },
  permissionCard: {
    backgroundColor: theme.color.subtle,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  permissionText: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
  },
  errorText: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
  },
  errorTextSmall: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    marginTop: 4,
  },
  itemCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: theme.color.background,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.color.info,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: theme.color.border,
  },
  itemInfo: { flex: 1, justifyContent: "center" },
  itemName: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "600",
    color: theme.color.text,
  },
  progressTrack: {
    height: 6,
    backgroundColor: theme.color.info,
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: { height: 6, backgroundColor: theme.color.brand },
  okText: {
    color: theme.color.success,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    marginTop: 4,
  },
  itemActions: { flexDirection: "row", gap: 16, marginTop: 6 },
  linkText: {
    color: theme.color.brand,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  removeText: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "600",
  },
});
