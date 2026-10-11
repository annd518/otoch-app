import React, { useCallback, useState } from "react"
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import MapView from "react-native-maps"
import { useFocusEffect, useRouter } from "expo-router"

import { PriceSummary } from "@/components/PriceSummary"
import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import type { ApiResult } from "@/services/apiResult"
import type { Parent } from "@/services/apiTypes"
import { slotStartToUtcIso, ulaanbaatarDate } from "@/utils/datetime"
import { formatMnt } from "@/utils/money"

// Display labels only; stored values stay in English
const GENDER_LABELS: Record<string, string> = { Female: "Эмэгтэй", Male: "Эрэгтэй", Other: "Бусад" }

// Placeholder windows until the backend provides allowed slots (mobile plan GAP-1).
const TIME_SLOTS = ["09:00-11:00", "11:00-13:00", "13:00-15:00", "15:00-17:00", "17:00-19:00"]
const REPEAT_OPTIONS = [
  { value: "one-time", label: "Нэг удаа" },
  { value: "weekly", label: "Долоо хоног бүр" },
  { value: "monthly", label: "Сар бүр" },
]

type ParentsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; parents: Parent[] }

function toParentsState(result: ApiResult<Parent[]>): ParentsState {
  return result.ok ? { status: "ready", parents: result.data } : { status: "error", message: result.message }
}

export default function BookAppointment() {
  const router = useRouter()
  const draft = useBookingDraft()

  const [parentsState, setParentsState] = useState<ParentsState>({ status: "loading" })
  const [submitting, setSubmitting] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [appointmentDate, setAppointmentDate] = useState("")
  const [timeSlot, setTimeSlot] = useState("")
  const [repeatSchedule, setRepeatSchedule] = useState("one-time")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [nurseGenderPref, setNurseGenderPref] = useState("any")

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
  const selectedParent = parents.find((p) => p.id === selectedPatient) ?? null

  const resetForm = () => {
    setSelectedPatient(null)
    setAppointmentDate("")
    setTimeSlot("")
    setRepeatSchedule("one-time")
    setSpecialInstructions("")
    setNurseGenderPref("any")
    draft.resetDraft()
  }

  const handleSubmit = async () => {
    if (!selectedParent) {
      Alert.alert("Мэдээлэл дутуу", "Өвчтөнөө сонгоно уу")
      return
    }
    if (!draft.service) {
      Alert.alert("Мэдээлэл дутуу", "Каталогоос үйлчилгээ сонгоно уу")
      return
    }
    const date = appointmentDate.trim()
    if (!date) {
      Alert.alert("Мэдээлэл дутуу", "Захиалгын огноогоо оруулна уу")
      return
    }
    if (!timeSlot) {
      Alert.alert("Мэдээлэл дутуу", "Цагаа сонгоно уу")
      return
    }
    const scheduledFor = slotStartToUtcIso(date, timeSlot)
    if (!scheduledFor) {
      Alert.alert("Огноо буруу", "Огноог YYYY-MM-DD хэлбэрээр зөв оруулна уу (жишээ нь: 2026-10-20)")
      return
    }
    if (date < ulaanbaatarDate(new Date())) {
      Alert.alert("Огноо буруу", "Ирээдүйн огноо сонгоно уу")
      return
    }
    if (new Date(scheduledFor).getTime() <= Date.now()) {
      Alert.alert("Цаг буруу", "Сонгосон цаг өнгөрсөн байна. Өөр цаг сонгоно уу")
      return
    }

    setSubmitting(true)
    try {
      // Legacy endpoint: it stores only parentId, scheduledFor and visitType.
      // Service, payment and notes move to the orders API (docs/l1-1-api.md §3).
      const result = await apiService.createVisit({
        parentId: selectedParent.id,
        scheduledFor,
        visitType: "FULL",
      })
      if (!result.ok) {
        Alert.alert("Захиалга илгээгдсэнгүй", result.message)
        return
      }
      Alert.alert(
        "Үзлэгийн хүсэлт бүртгэгдлээ",
        `Өвчтөн: ${selectedParent.name}\nОгноо: ${date}\nЦаг: ${timeSlot} (Улаанбаатарын цагаар)\n\nСувилагч томилогдсоны дараа мэдэгдэнэ.`,
        [{ text: "OK", onPress: resetForm }],
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Цаг захиалах</Text>
        <Text style={styles.headerSubtitle}>
          Эцэг эхдээ гэрийн үзлэг захиалаарай
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Select Patient */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Өвчтөн сонгох</Text>

          {parentsState.status === "loading" ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2f80ed" />
              <Text style={styles.loadingText}>Эцэг эхийн мэдээллийг ачаалж байна...</Text>
            </View>
          ) : parentsState.status === "error" ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#999" />
              <Text style={styles.errorText}>{parentsState.message}</Text>
              <TouchableOpacity style={styles.addParentBtn} onPress={retryParents}>
                <Text style={styles.addParentBtnText}>Дахин оролдох</Text>
              </TouchableOpacity>
            </View>
          ) : parents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>Одоогоор эцэг/эх нэмээгүй байна</Text>
              <Text style={styles.emptySubtext}>
                Эхлээд эцэг/эхийн профайл нэмнэ үү
              </Text>
              <TouchableOpacity
                style={styles.addParentBtn}
                onPress={() => router.push("/(tabs)/add-parent")}
              >
                <Text style={styles.addParentBtnText}>Эцэг/эх нэмэх</Text>
              </TouchableOpacity>
            </View>
          ) : (
            parents.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.patientCard,
                  selectedPatient === patient.id && styles.patientCardActive,
                ]}
                onPress={() => setSelectedPatient(patient.id)}
              >
                <View style={styles.patientInfo}>
                  <Ionicons
                    name={patient.gender === "Female" ? "woman" : "man"}
                    size={24}
                    color={selectedPatient === patient.id ? "#2f80ed" : "#666"}
                  />
                  <View style={styles.patientDetails}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientAge}>
                      {patient.age} нас • {GENDER_LABELS[patient.gender] ?? patient.gender}
                    </Text>
                  </View>
                </View>
                {selectedPatient === patient.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#2f80ed" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* 2. Service */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Үйлчилгээ</Text>
          {draft.service ? (
            <View style={styles.selectedServiceCard}>
              <View style={styles.selectedServiceInfo}>
                <Text style={styles.selectedServiceName}>{draft.service.name}</Text>
                <Text style={styles.selectedServiceMeta}>
                  {draft.service.durationMin} мин • {formatMnt(draft.service.priceMnt)}
                </Text>
                {draft.service.requiresReferral && (
                  <Text style={styles.referralNote}>Эмчийн заалт шаардлагатай. Зураг оруулах алхам удахгүй нэмэгдэнэ.</Text>
                )}
                {draft.service.source === "mock" && <Text style={styles.mockTag}>MOCK өгөгдөл</Text>}
              </View>
              <TouchableOpacity onPress={() => router.push("/booking/catalog")}>
                <Text style={styles.changeServiceText}>Солих</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.chooseServiceBtn} onPress={() => router.push("/booking/catalog")}>
              <Ionicons name="list-outline" size={22} color="#2f80ed" />
              <Text style={styles.chooseServiceText}>Каталогоос үйлчилгээ сонгох</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Appointment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Захиалгын дэлгэрэнгүй</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Хүссэн огноо *</Text>
            <TextInput
              style={styles.input}
              value={appointmentDate}
              onChangeText={setAppointmentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Хүссэн цаг *</Text>
            <View style={styles.timeSlotContainer}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.timeSlotBtn,
                    timeSlot === slot && styles.timeSlotBtnActive,
                  ]}
                  onPress={() => setTimeSlot(slot)}
                >
                  <Text
                    style={
                      timeSlot === slot
                        ? styles.timeSlotTextActive
                        : styles.timeSlotText
                    }
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Давтамж</Text>
            <View style={styles.repeatContainer}>
              {REPEAT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.repeatBtn,
                    repeatSchedule === option.value && styles.repeatBtnActive,
                  ]}
                  onPress={() => setRepeatSchedule(option.value)}
                >
                  <Text
                    style={
                      repeatSchedule === option.value
                        ? styles.repeatTextActive
                        : styles.repeatText
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 4. Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Байршил</Text>

          <MapView style={styles.map} />

          <View style={styles.locationCard}>
            <Ionicons name="location" size={20} color="#2f80ed" />
            <Text style={styles.locationText}>
              {selectedParent ? selectedParent.address : "Өвчтөн сонгоход түүний хаяг энд харагдана"}
            </Text>
          </View>
          <TouchableOpacity style={styles.editLocationBtn}>
            <Ionicons name="map-outline" size={16} color="#2f80ed" />
            <Text style={styles.editLocationText}>Газрын зураг дээр засах</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Нэмэлт заавар</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            placeholder="Жишээ нь: Хөдөлгөөний хязгаарлалттай, ирэхээс 10 минутын өмнө залгана уу"
            placeholderTextColor="#999"
            multiline
          />
        </View>

        {/* 6. Nurse Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            6. Сувилагчийн сонголт (заавал биш)
          </Text>
          <View style={styles.nursePreference}>
            {[
              { value: "any", label: "Хамаагүй" },
              { value: "female", label: "Эмэгтэй" },
              { value: "male", label: "Эрэгтэй" },
            ].map((pref) => (
              <TouchableOpacity
                key={pref.value}
                style={[
                  styles.nursePrefBtn,
                  nurseGenderPref === pref.value && styles.nursePrefBtnActive,
                ]}
                onPress={() => setNurseGenderPref(pref.value)}
              >
                <Text
                  style={
                    nurseGenderPref === pref.value
                      ? styles.nursePrefTextActive
                      : styles.nursePrefText
                  }
                >
                  {pref.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 7. Price */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Үнэ</Text>
          <PriceSummary service={draft.service} quote={draft.quote} />
        </View>

        {/* 8. Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? "Илгээж байна..." : "Үзлэгийн хүсэлт илгээх"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e4e8",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },
  // Patient Selection
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  addParentBtn: {
    marginTop: 20,
    backgroundColor: "#2f80ed",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  addParentBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e1e4e8",
  },
  patientCardActive: {
    borderColor: "#2f80ed",
    backgroundColor: "#f0f7ff",
  },
  patientInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  patientDetails: {
    marginLeft: 12,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  patientAge: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  // Form Inputs
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e4e8",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#111",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  // Time Slots
  timeSlotContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeSlotBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e4e8",
  },
  timeSlotBtnActive: {
    backgroundColor: "#2f80ed",
    borderColor: "#2f80ed",
  },
  timeSlotText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  timeSlotTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  // Repeat Schedule
  repeatContainer: {
    flexDirection: "row",
    gap: 8,
  },
  repeatBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e4e8",
    alignItems: "center",
  },
  repeatBtnActive: {
    backgroundColor: "#2f80ed",
    borderColor: "#2f80ed",
  },
  repeatText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  repeatTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  // Location
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e4e8",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    color: "#333",
    marginLeft: 10,
    flex: 1,
  },
  editLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  editLocationText: {
    fontSize: 14,
    color: "#2f80ed",
    fontWeight: "600",
    marginLeft: 6,
  },
  // Nurse Preference
  nursePreference: {
    flexDirection: "row",
    gap: 8,
  },
  nursePrefBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e4e8",
    alignItems: "center",
  },
  nursePrefBtnActive: {
    backgroundColor: "#2f80ed",
    borderColor: "#2f80ed",
  },
  nursePrefText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  nursePrefTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  // Submit Button
  submitButton: {
    backgroundColor: "#2f80ed",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#2f80ed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: "#a0c4f0",
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  map: {
    width: "100%",
    height: 150,
  },
  errorText: {
    fontSize: 15,
    color: "#c62828",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  selectedServiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f6ff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#2f80ed",
    padding: 14,
    gap: 12,
  },
  selectedServiceInfo: {
    flex: 1,
  },
  selectedServiceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  selectedServiceMeta: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
  referralNote: {
    fontSize: 13,
    color: "#c62828",
    marginTop: 6,
  },
  mockTag: {
    fontSize: 12,
    color: "#e65100",
    fontWeight: "700",
    marginTop: 6,
  },
  changeServiceText: {
    color: "#2f80ed",
    fontSize: 15,
    fontWeight: "700",
  },
  chooseServiceBtn: {
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
  chooseServiceText: {
    color: "#2f80ed",
    fontSize: 15,
    fontWeight: "700",
  },
})