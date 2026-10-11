import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Redirect, useRouter } from "expo-router"

import { useSingleFlight } from "@/components/useSingleFlight"
import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import type { ApiResult } from "@/services/apiResult"
import type { RedFlagQuestionnaire } from "@/services/apiTypes"
import { isBlocked, nextStepAfterDetails } from "@/services/bookingDraft"
import { reportBlockInBackground } from "@/services/blockSync"
import {
  answersPayload,
  canSubmitClear,
  initialAnswers,
  questionnaireLabel,
  questionnaireShowsBlocked,
  type Answers,
} from "@/services/redFlag"

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; questionnaire: RedFlagQuestionnaire }

function toLoadState(result: ApiResult<RedFlagQuestionnaire>): LoadState {
  return result.ok ? { status: "ready", questionnaire: result.data } : { status: "error", message: result.message }
}

const LABEL_TEXT = {
  dev_fixture: "DEV FIXTURE: асуултын бичвэр зохиомол, эмнэлгийн хариуцагчаар батлагдаагүй. Зөвхөн хөгжүүлэлтэд.",
  server_fixture: "Серверийн туршилтын асуулга (isFixture): эмнэлзүйн бичвэр батлагдаагүй.",
  unapproved: "Асуултын бичвэр эмнэлгийн хариуцагчаар батлагдаагүй (сервер approved гэж тэмдэглээгүй).",
  approved: "",
} as const

export default function RedFlagsScreen() {
  const router = useRouter()
  const { state, dispatch } = useBookingDraft()
  const orderId = state.server?.orderId ?? null
  const source = apiService.sourceOf("redFlags")

  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [answers, setAnswers] = useState<Answers>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return
    let active = true
    apiService.getRedFlagQuestions(orderId).then((result) => {
      if (!active) return
      if (result.ok && questionnaireShowsBlocked(result.data)) {
        dispatch({ type: "redFlagBlocked", advice: null })
        router.replace("/booking/emergency")
        return
      }
      setLoad(toLoadState(result))
      if (result.ok) setAnswers(initialAnswers(result.data))
    })
    return () => {
      active = false
    }
  }, [orderId, dispatch, router])

  const reload = useCallback(() => {
    if (!orderId) return
    setLoad({ status: "loading" })
    setSubmitError(null)
    apiService.getRedFlagQuestions(orderId).then((result) => {
      if (result.ok && questionnaireShowsBlocked(result.data)) {
        dispatch({ type: "redFlagBlocked", advice: null })
        router.replace("/booking/emergency")
        return
      }
      setLoad(toLoadState(result))
      if (result.ok) setAnswers(initialAnswers(result.data))
    })
  }, [orderId, dispatch, router])

  const answer = (questionId: string, value: boolean) => {
    if (value) {
      // One "yes" stops the booking immediately on this device. The answers given
      // so far (including this "yes") are then reported to the server; until the
      // server confirms, the block is "pending" and is retried, never CLEAR.
      if (load.status !== "ready" || !orderId) return
      const report = {
        questionnaires: load.questionnaire.questionnaires,
        answers: answersPayload(load.questionnaire, { ...answers, [questionId]: true }),
      }
      dispatch({ type: "redFlagBlocked", advice: null, server: "pending", report })
      router.replace("/booking/emergency")
      void reportBlockInBackground(orderId, report, source, (server, version) =>
        dispatch({ type: "blockReported", server, version }),
      )
      return
    }
    setAnswers((current) => ({ ...current, [questionId]: false }))
  }

  const submit = useSingleFlight(
    useCallback(async () => {
      if (load.status !== "ready" || !orderId) return
      const { questionnaire } = load
      if (questionnaire.questions.length === 0) {
        // The server lists no questionnaire for this service: nothing to answer.
        dispatch({ type: "redFlagCleared" })
        router.replace(nextStepAfterDetails({ ...state, redFlag: { status: "clear" } }))
        return
      }
      if (!canSubmitClear(questionnaire, answers)) return
      setSubmitError(null)
      const result = await apiService.submitRedFlagAnswers(
        orderId,
        answersPayload(questionnaire, answers),
        questionnaire.questionnaires,
      )
      if (!result.ok) {
        if (result.code === "RED_FLAG_BLOCKED") {
          dispatch({ type: "redFlagBlocked", advice: null })
          router.replace("/booking/emergency")
          return
        }
        if (result.code === "QUESTIONNAIRE_OUTDATED") {
          // The questions changed on the server: show the new set, answers start empty.
          reload()
          setSubmitError(result.message)
          return
        }
        // No silent skip: the user stays here until the server stores the answers.
        setSubmitError(result.message)
        return
      }
      if (result.data.status === "FLAGGED") {
        // The server's decision wins even if every local answer was "no".
        dispatch({ type: "redFlagBlocked", advice: result.data.advice, version: result.data.version })
        router.replace("/booking/emergency")
        return
      }
      dispatch({ type: "redFlagCleared", version: result.data.version })
      router.replace(nextStepAfterDetails({ ...state, redFlag: { status: "clear" } }))
    }, [load, orderId, answers, dispatch, router, state, reload]),
  )

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />
  if (!orderId) return <Redirect href="/(tabs)/bookappointment" />

  const label = load.status === "ready" ? questionnaireLabel(load.questionnaire, source) : null
  const noQuestions = load.status === "ready" && load.questionnaire.questions.length === 0
  const ready = load.status === "ready" && (noQuestions || canSubmitClear(load.questionnaire, answers))

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Буцах">
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Аюулын шинж тэмдэг</Text>
          <Text style={styles.headerSubtitle}>Алхам 2: асуулт бүрт хариулна уу</Text>
        </View>
      </View>

      {load.status === "loading" && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2f80ed" />
          <Text style={styles.mutedText}>Асуулга ачаалж байна...</Text>
        </View>
      )}

      {load.status === "error" && (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#c62828" />
          <Text style={styles.errorText}>{load.message}</Text>
          <Text style={styles.mutedText}>Асуулгад хариулахгүйгээр захиалгыг үргэлжлүүлэх боломжгүй.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={reload}>
            <Text style={styles.secondaryButtonText}>Дахин оролдох</Text>
          </TouchableOpacity>
        </View>
      )}

      {load.status === "ready" && (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            {noQuestions ? (
              <Text style={styles.intro}>Сервер энэ үйлчилгээнд аюулын шинжийн асуулга шаардаагүй байна.</Text>
            ) : null}
            {label && label !== "approved" && !noQuestions ? (
              <View style={styles.fixtureBanner}>
                <Text style={styles.fixtureBannerText}>{LABEL_TEXT[label]}</Text>
              </View>
            ) : null}
            <Text style={styles.intro}>
              Аль нэг асуултад «Тийм» гэвэл гэрийн үйлчилгээ биш яаралтай тусламж хэрэгтэй байж болзошгүй.
            </Text>
            {load.questionnaire.questions.map((q, index) => {
              const value = answers[q.id]
              return (
                <View key={q.id} style={styles.questionCard}>
                  <Text style={styles.questionText}>
                    {index + 1}. {q.text}
                  </Text>
                  <View style={styles.answerRow}>
                    <TouchableOpacity
                      style={[styles.answerButton, styles.answerYes]}
                      onPress={() => answer(q.id, true)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: false }}
                    >
                      <Text style={styles.answerYesText}>Тийм</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.answerButton, value === false && styles.answerNoSelected]}
                      onPress={() => answer(q.id, false)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: value === false }}
                    >
                      <Text style={value === false ? styles.answerNoSelectedText : styles.answerNoText}>Үгүй</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </ScrollView>
          <View style={styles.footer}>
            {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, (!ready || submit.running) && styles.primaryButtonDisabled]}
              onPress={() => void submit.run()}
              disabled={!ready || submit.running}
            >
              <Text style={styles.primaryButtonText}>
                {submit.running ? "Хадгалж байна..." : submitError ? "Дахин илгээх" : "Үргэлжлүүлэх"}
              </Text>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  mutedText: { fontSize: 15, color: "#666", textAlign: "center" },
  errorText: { fontSize: 15, color: "#c62828", textAlign: "center" },
  list: { padding: 16, gap: 12 },
  fixtureBanner: { backgroundColor: "#fff3e0", borderRadius: 12, padding: 12 },
  fixtureBannerText: { color: "#e65100", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  intro: { fontSize: 15, color: "#444", lineHeight: 22 },
  questionCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e1e4e8" },
  questionText: { fontSize: 16, color: "#111", lineHeight: 23, fontWeight: "600" },
  answerRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  answerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e1e4e8",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  answerYes: { borderColor: "#c62828" },
  answerYesText: { color: "#c62828", fontSize: 16, fontWeight: "700" },
  answerNoText: { color: "#555", fontSize: 16, fontWeight: "700" },
  answerNoSelected: { backgroundColor: "#2f80ed", borderColor: "#2f80ed" },
  answerNoSelectedText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e1e4e8", gap: 8 },
  submitError: { color: "#c62828", fontSize: 14, textAlign: "center" },
  primaryButton: { backgroundColor: "#2f80ed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonDisabled: { backgroundColor: "#a0c4f0" },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: "#2f80ed" },
  secondaryButtonText: { color: "#2f80ed", fontSize: 15, fontWeight: "700" },
})
