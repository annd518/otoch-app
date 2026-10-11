import React, { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, useRouter } from "expo-router"

import { PriceSummary } from "@/components/PriceSummary"
import { useSingleFlight } from "@/components/useSingleFlight"
import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import type { ApiResult } from "@/services/apiResult"
import type { NurseGenderPreference, Parent } from "@/services/apiTypes"
import {
  isBlocked,
  nextStepAfterDetails,
  planDraftSave,
  validateDetails,
  type DetailsField,
} from "@/services/bookingDraft"
import { EMERGENCY_PHONE } from "@/services/redFlag"
import { ulaanbaatarDate } from "@/utils/datetime"
import { createIdempotencyKey } from "@/utils/id"
import { formatMnt } from "@/utils/money"

// Display labels only; stored values stay in English
const GENDER_LABELS: Record<string, string> = { Female: "Эмэгтэй", Male: "Эрэгтэй", Other: "Бусад" }

// Placeholder windows until the backend availability endpoint exists
// (docs/l1-1-api.md §11, decision D13). They are not checked for capacity.
const TIME_SLOTS = ["09:00-11:00", "11:00-13:00", "13:00-15:00", "15:00-17:00", "17:00-19:00"]
const WEEKDAYS = ["Ням", "Дав", "Мяг", "Лха", "Пүр", "Баа", "Бям"]
const NURSE_PREFS: { value: NurseGenderPreference; label: string }[] = [
  { value: "ANY", label: "Хамаагүй" },
  { value: "FEMALE", label: "Эмэгтэй" },
  { value: "MALE", label: "Эрэгтэй" },
]
const DAY_MS = 24 * 60 * 60 * 1000

type ParentsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; parents: Parent[] }

function toParentsState(result: ApiResult<Parent[]>): ParentsState {
  return result.ok ? { status: "ready", parents: result.data } : { status: "error", message: result.message }
}

// Next 14 calendar days in Ulaanbaatar time.
function upcomingDates(now: Date): { value: string; label: string }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const value = ulaanbaatarDate(new Date(now.getTime() + i * DAY_MS))
    const [y, m, d] = value.split("-").map(Number)
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
    return { value, label: `${m}/${d} ${weekday}` }
  })
}

export default function BookAppointment() {
  const router = useRouter()
  const { state, dispatch } = useBookingDraft()
  const { details, service, server } = state
  const blocked = isBlocked(state)

  const [parentsState, setParentsState] = useState<ParentsState>({ status: "loading" })
  const [errors, setErrors] = useState<Partial<Record<DetailsField, string>>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const dates = useMemo(() => upcomingDates(new Date()), [])

  // Reload when the tab gains focus, e.g. after adding a parent.
  useFocusEffect(
    useCallback(() => {
      let active = true
      apiService.getParents().then((result) => {
        if (active) setParentsState(toParentsState(result))
      })
      return () => {
        active = false
      }
    }, []),
  )

  const retryParents = () => {
    setParentsState({ status: "loading" })
    apiService.getParents().then((result) => setParentsState(toParentsState(result)))
  }

  const parents = parentsState.status === "ready" ? parentsState.parents : []

  const selectParent = (parent: Parent) => {
    dispatch({
      type: "updateDetails",
      // Prefill the visit address from the patient profile; the user can edit it.
      patch: {
        parentId: parent.id,
        parentName: parent.name,
        addressText: details.parentId === parent.id ? details.addressText : parent.address,
      },
    })
  }

  const save = useSingleFlight(
    useCallback(async () => {
      setSaveError(null)
      const found = validateDetails(state, new Date())
      setErrors(found)
      if (Object.keys(found).length > 0) return

      const plan = planDraftSave(state, () => createIdempotencyKey())
      if (plan.kind === "invalid") {
        setSaveError("Захиалгын мэдээлэл дутуу байна.")
        return
      }
      if (plan.kind === "none") {
        router.push(nextStepAfterDetails(state))
        return
      }
      if (plan.kind === "create") dispatch({ type: "createStarted", key: plan.key })
      const result =
        plan.kind === "create"
          ? await apiService.createDraftOrder(plan.input, plan.key)
          : await apiService.updateDraftOrder(plan.orderId, plan.patch)
      if (!result.ok) {
        setSaveError(result.message)
        return
      }
      dispatch({ type: "draftSaved", order: result.data, source: apiService.sourceOf("orders") })
      if (result.data.status === "BLOCKED_RED_FLAG") {
        dispatch({ type: "redFlagBlocked", advice: null })
        router.replace("/booking/emergency")
        return
      }
      router.push(nextStepAfterDetails(state, result.data.requiresReferral))
    }, [state, dispatch, router]),
  )

  const draftLabel = !server
    ? "Ноорог серверт хадгалагдаагүй байна."
    : server.source === "mock"
      ? "MOCK ноорог: зөвхөн хөгжүүлэлтийн горимд, серверт хадгалагдаагүй."
      : state.dirty
        ? "Өөрчлөлт серверт хадгалагдаагүй байна."
        : "Ноорог серверт хадгалагдсан. Төлбөр хийгдээгүй."

  if (blocked) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.blockedCard}>
          <Ionicons name="warning" size={40} color="#c62828" />
          <Text style={styles.blockedTitle}>Энэ захиалга зогссон</Text>
          <Text style={styles.blockedText}>
            Асуулгад яаралтай тусламж шаардлагатай шинж тэмдэглэгдсэн тул захиалгыг үргэлжлүүлэх боломжгүй.
          </Text>
          <TouchableOpacity style={styles.emergencyButton} onPress={() => void Linking.openURL(`tel:${EMERGENCY_PHONE}`).catch(() => undefined)}>
            <Text style={styles.emergencyButtonText}>{EMERGENCY_PHONE} руу залгах</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => dispatch({ type: "reset" })}>
            <Text style={styles.secondaryButtonText}>Шинэ захиалга эхлэх</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Цаг захиалах</Text>
        <Text style={styles.headerSubtitle}>Алхам 1: өвчтөн, үйлчилгээ, цаг, хаяг</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. Patient */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Өвчтөн</Text>
          {parentsState.status === "loading" ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2f80ed" />
              <Text style={styles.mutedText}>Эцэг эхийн мэдээллийг ачаалж байна...</Text>
            </View>
          ) : parentsState.status === "error" ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{parentsState.message}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={retryParents}>
                <Text style={styles.secondaryButtonText}>Дахин оролдох</Text>
              </TouchableOpacity>
            </View>
          ) : parents.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={40} color="#999" />
              <Text style={styles.mutedText}>Одоогоор эцэг/эх нэмээгүй байна</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/(tabs)/add-parent")}>
                <Text style={styles.secondaryButtonText}>Эцэг/эх нэмэх</Text>
              </TouchableOpacity>
            </View>
          ) : (
            parents.map((patient) => {
              const selected = details.parentId === patient.id
              return (
                <TouchableOpacity
                  key={patient.id}
                  style={[styles.optionCard, selected && styles.optionCardActive]}
                  onPress={() => selectParent(patient)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionTitle}>{patient.name}</Text>
                    <Text style={styles.optionMeta}>
                      {patient.age} нас • {GENDER_LABELS[patient.gender] ?? patient.gender}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={24} color="#2f80ed" />}
                </TouchableOpacity>
              )
            })
          )}
          {errors.parent ? <Text style={styles.fieldError}>{errors.parent}</Text> : null}
        </View>

        {/* 2. Service */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Үйлчилгээ</Text>
          {service ? (
            <View style={[styles.optionCard, styles.optionCardActive]}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{service.name}</Text>
                <Text style={styles.optionMeta}>
                  {service.durationMin} мин • {formatMnt(service.priceMnt)} (урьдчилсан)
                </Text>
                {service.requiresReferral && <Text style={styles.warnText}>Эмчийн заалтын зураг шаардлагатай</Text>}
                {service.source === "mock" && <Text style={styles.tagText}>MOCK өгөгдөл</Text>}
                {service.isFixture && <Text style={styles.tagText}>Серверийн туршилтын өгөгдөл</Text>}
              </View>
              <TouchableOpacity onPress={() => router.push("/booking/catalog")}>
                <Text style={styles.linkText}>Солих</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.dashedButton} onPress={() => router.push("/booking/catalog")}>
              <Ionicons name="list-outline" size={22} color="#2f80ed" />
              <Text style={styles.linkText}>Каталогоос үйлчилгээ сонгох</Text>
            </TouchableOpacity>
          )}
          {errors.service ? <Text style={styles.fieldError}>{errors.service}</Text> : null}
        </View>

        {/* 3. Date and time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Огноо ба цаг (Улаанбаатарын цагаар)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {dates.map((date) => {
              const selected = details.date === date.value
              return (
                <TouchableOpacity
                  key={date.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => dispatch({ type: "updateDetails", patch: { date: date.value } })}
                >
                  <Text style={selected ? styles.chipTextActive : styles.chipText}>{date.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          {errors.date ? <Text style={styles.fieldError}>{errors.date}</Text> : null}
          <View style={styles.wrapRow}>
            {TIME_SLOTS.map((slot) => {
              const selected = details.timeSlot === slot
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => dispatch({ type: "updateDetails", patch: { timeSlot: slot } })}
                >
                  <Text style={selected ? styles.chipTextActive : styles.chipText}>{slot}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={styles.noteText}>Цагийн цонх түр жагсаалт. Сул эсэхийг сервер хараахан шалгадаггүй.</Text>
          {errors.timeSlot ? <Text style={styles.fieldError}>{errors.timeSlot}</Text> : null}
        </View>

        {/* 4. Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Үзлэгийн хаяг</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={details.addressText}
            onChangeText={(addressText) => dispatch({ type: "updateDetails", patch: { addressText } })}
            placeholder="Дүүрэг, хороо, байр, тоот"
            placeholderTextColor="#999"
            multiline
          />
          {errors.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}
        </View>

        {/* 5. Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Нэмэлт заавар</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={details.notes}
            onChangeText={(notes) => dispatch({ type: "updateDetails", patch: { notes } })}
            placeholder="Жишээ нь: ирэхээс 10 минутын өмнө залгана уу"
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          {errors.notes ? <Text style={styles.fieldError}>{errors.notes}</Text> : null}
        </View>

        {/* 6. Nurse preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Сувилагчийн сонголт (заавал биш)</Text>
          <View style={styles.wrapRow}>
            {NURSE_PREFS.map((pref) => {
              const selected = details.nurseGenderPreference === pref.value
              return (
                <TouchableOpacity
                  key={pref.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => dispatch({ type: "updateDetails", patch: { nurseGenderPreference: pref.value } })}
                >
                  <Text style={selected ? styles.chipTextActive : styles.chipText}>{pref.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* 7. Price */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Үнэ</Text>
          <PriceSummary service={service} quote={state.quote} />
        </View>

        <Text style={styles.draftStatus}>{draftLabel}</Text>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, save.running && styles.primaryButtonDisabled]}
          onPress={() => void save.run()}
          disabled={save.running}
        >
          <Text style={styles.primaryButtonText}>{save.running ? "Хадгалж байна..." : "Үргэлжлүүлэх"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e4e8",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#111", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: "#666" },
  container: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111", marginBottom: 12 },
  centered: { alignItems: "center", paddingVertical: 20, gap: 10 },
  mutedText: { fontSize: 15, color: "#666", textAlign: "center" },
  errorText: { fontSize: 15, color: "#c62828", textAlign: "center" },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e1e4e8",
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  optionCardActive: { borderColor: "#2f80ed", backgroundColor: "#f0f6ff" },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  optionMeta: { fontSize: 14, color: "#555", marginTop: 4 },
  warnText: { fontSize: 13, color: "#c62828", marginTop: 6 },
  tagText: { fontSize: 12, color: "#e65100", fontWeight: "700", marginTop: 6 },
  linkText: { color: "#2f80ed", fontSize: 15, fontWeight: "700" },
  dashedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2f80ed",
    backgroundColor: "#fff",
  },
  chipRow: { gap: 8, paddingBottom: 10 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },
  chipActive: { backgroundColor: "#2f80ed", borderColor: "#2f80ed" },
  chipText: { fontSize: 14, color: "#555", fontWeight: "600" },
  chipTextActive: { fontSize: 14, color: "#fff", fontWeight: "700" },
  noteText: { fontSize: 12, color: "#888", marginTop: 8 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e4e8",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#111",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  fieldError: { color: "#c62828", fontSize: 13, marginTop: 6 },
  draftStatus: { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 8 },
  saveError: { fontSize: 14, color: "#c62828", textAlign: "center", marginBottom: 8 },
  primaryButton: { backgroundColor: "#2f80ed", borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  primaryButtonDisabled: { backgroundColor: "#a0c4f0" },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f80ed",
    marginTop: 8,
  },
  secondaryButtonText: { color: "#2f80ed", fontSize: 15, fontWeight: "700", textAlign: "center" },
  blockedCard: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  blockedTitle: { fontSize: 22, fontWeight: "800", color: "#c62828" },
  blockedText: { fontSize: 15, color: "#444", textAlign: "center", lineHeight: 22 },
  emergencyButton: {
    backgroundColor: "#c62828",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  emergencyButtonText: { color: "#fff", fontSize: 18, fontWeight: "800" },
})
