import { TouchTarget as TouchableOpacity } from "@/components/ui/TouchTarget";
import { Stepper } from "@/components/ui";
import { theme } from "@/design/theme";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AppText as Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon as Ionicons } from "@/components/ui/Icon";
import { Redirect, useRouter } from "expo-router";

import { ReferralUploader } from "@/components/ReferralUploader";
import { useSingleFlight } from "@/components/useSingleFlight";
import { useBookingDraft } from "@/context/BookingDraftContext";
import { apiService } from "@/services/api";
import {
  MAX_REFERRAL_TEXT,
  MIN_REFERRAL_TEXT,
  isBlocked,
  medicationPhotoChosen,
  planDraftSave,
  referralTextOk,
  uploadedReferralCount,
} from "@/services/bookingDraft";
import { createIdempotencyKey } from "@/utils/id";

export default function ReferralScreen() {
  const router = useRouter();
  const { state, dispatch } = useBookingDraft();
  const orderId = state.server?.orderId ?? null;
  // The prescription can be a photo or typed in: some people cannot read the
  // doctor's handwriting, others cannot take or pick a photo.
  const form = state.details.bookingForm;
  const savedText = form?.referralText ?? "";
  // Step 3 chose "Зураг оруулах" for the medicine: only a photo will do here
  const photoRequired = medicationPhotoChosen(state);
  const [mode, setMode] = useState<"photo" | "text">(() =>
    !photoRequired && savedText.trim() && state.attachments.length === 0
      ? "text"
      : "photo",
  );
  const [text, setText] = useState(savedText);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A changed text is saved on the draft (bookingForm.referralText) before
  // the review screen asks the server for a quote.
  const continueToReview = useSingleFlight(
    useCallback(async () => {
      setSaveError(null);
      const trimmed = text.trim();
      if (form && trimmed !== savedText.trim()) {
        const bookingForm = { ...form, referralText: trimmed || null };
        const plan = planDraftSave(
          { ...state, details: { ...state.details, bookingForm }, dirty: true },
          createIdempotencyKey,
        );
        if (plan.kind !== "update") {
          setSaveError("Захиалгын мэдээлэл дутуу байна. Өмнөх алхам руу буцна уу.");
          return;
        }
        dispatch({ type: "updateDetails", patch: { bookingForm } });
        const r = await apiService.updateDraftOrder(plan.orderId, plan.patch);
        if (!r.ok) {
          if (r.code === "RED_FLAG_BLOCKED") {
            dispatch({ type: "redFlagBlocked", advice: null });
            router.replace("/booking/emergency");
          } else setSaveError(r.message);
          return;
        }
        dispatch({
          type: "draftSaved",
          order: r.data,
          source: apiService.sourceOf("orders"),
        });
      }
      router.push("/booking/review");
    }, [text, savedText, form, state, dispatch, router]),
  );

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />;
  if (!orderId) return <Redirect href="/(tabs)/bookappointment" />;

  const uploaded = uploadedReferralCount(state);
  const busy = state.attachments.some((a) => a.status === "uploading");

  const canContinue =
    (uploaded > 0 || (!photoRequired && referralTextOk(text))) &&
    !busy &&
    !continueToReview.running;

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
          <Text style={styles.headerTitle}>Эмчийн заалт</Text>
          <Text style={styles.headerSubtitle}>
            Алхам 3: заалтын зураг эсвэл бичвэр
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ ...styles.container, paddingBottom: 40 }}
      >
        <Stepper step={3} />
        {!photoRequired && (
          <Text style={styles.rules}>
            Жорын зургийг оруулах эсвэл жорт бичигдсэнийг гараар бичих: аль нэг
            нь хангалттай.
          </Text>
        )}
        {photoRequired && (
          <Text style={styles.rules}>
            Эмийн мэдээллийг зургаар оруулахаар сонгосон тул жорын зургийг
            оруулна уу.
          </Text>
        )}
        {form && !photoRequired && (
          <View style={styles.modeRow}>
            {(["photo", "text"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeButton, mode === m && styles.modeButtonActive]}
                onPress={() => setMode(m)}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === m }}
              >
                <Ionicons
                  name={m === "photo" ? "camera-outline" : "create-outline"}
                  size={22}
                  color={mode === m ? theme.color.background : theme.color.brand}
                />
                <Text
                  style={[styles.modeText, mode === m && styles.modeTextActive]}
                >
                  {m === "photo" ? "Зураг оруулах" : "Гараар бичих"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {mode === "text" && (
          <View style={styles.textCard}>
            <Text style={styles.itemName}>Жорт бичигдсэн зүйл</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={MAX_REFERRAL_TEXT}
              textAlignVertical="top"
              placeholder="Жишээ нь: эмийн нэр, тун, өдөрт хэдэн удаа, хэдэн өдөр"
              placeholderTextColor={theme.color.secondary}
              accessibilityLabel="Жорт бичигдсэн зүйл"
              style={styles.textInput}
            />
            <Text style={styles.counter}>
              {text.trim().length}/{MAX_REFERRAL_TEXT}
            </Text>
            {!referralTextOk(text) && (
              <Text style={styles.hint}>
                Хамгийн багадаа {MIN_REFERRAL_TEXT} тэмдэгт бичнэ үү.
              </Text>
            )}
            <Text style={styles.hint}>
              Жорын бичгийг уншиж чадахгүй бол «Зураг оруулах»-ыг сонгоно уу.
            </Text>
          </View>
        )}
        {mode === "photo" && <ReferralUploader orderId={orderId} />}
      </ScrollView>

      <View style={styles.footer}>
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !canContinue && styles.primaryButtonDisabled,
          ]}
          onPress={() => void continueToReview.run()}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>
            {continueToReview.running ? "Хадгалж байна..." : "Үргэлжлүүлэх"}
          </Text>
        </TouchableOpacity>
      </View>
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
  container: { padding: 16, gap: 12 },
  rules: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
    lineHeight: 28,
  },
  modeRow: { flexDirection: "row", gap: 12 },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.brand,
    backgroundColor: theme.color.background,
  },
  modeButtonActive: { backgroundColor: theme.color.brand },
  modeText: {
    color: theme.color.brand,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "700",
  },
  modeTextActive: { color: theme.color.background },
  textCard: {
    backgroundColor: theme.color.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.color.info,
  },
  textInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    lineHeight: 26,
    color: theme.color.text,
  },
  hint: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.secondary,
  },
  counter: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
    textAlign: "right",
  },
  errorText: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
  },
  itemName: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "600",
    color: theme.color.text,
  },
  footer: {
    padding: 16,
    backgroundColor: theme.color.background,
    borderTopWidth: 1,
    borderTopColor: theme.color.info,
  },
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
