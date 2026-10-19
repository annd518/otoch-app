import { onboardingVisual as v } from "@/design/onboardingVisual";
import { TouchTarget as TouchableOpacity } from "@/components/ui/TouchTarget";
import { Stepper } from "@/components/ui";
import { theme } from "@/design/theme";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon as Ionicons } from "@/components/ui/Icon";
import { Redirect, useRouter } from "expo-router";

import { useSingleFlight } from "@/components/useSingleFlight";
import { useBookingDraft } from "@/context/BookingDraftContext";
import { apiService } from "@/services/api";
import type { ApiResult } from "@/services/apiResult";
import type { RedFlagQuestionnaire } from "@/services/apiTypes";
import { isBlocked, nextStepAfterDetails } from "@/services/bookingDraft";
import { reportBlockInBackground } from "@/services/blockSync";
import {
  answersPayload,
  canSubmitClear,
  initialAnswers,
  questionnaireLabel,
  questionnaireShowsBlocked,
  type Answers,
} from "@/services/redFlag";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; questionnaire: RedFlagQuestionnaire };

function toLoadState(result: ApiResult<RedFlagQuestionnaire>): LoadState {
  return result.ok
    ? { status: "ready", questionnaire: result.data }
    : { status: "error", message: result.message };
}

const LABEL_TEXT = {
  dev_fixture:
    "DEV FIXTURE: асуултын бичвэр зохиомол, эмнэлгийн хариуцагчаар батлагдаагүй. Зөвхөн хөгжүүлэлтэд.",
  server_fixture:
    "Серверийн туршилтын асуулга (isFixture): эмнэлзүйн бичвэр батлагдаагүй.",
  unapproved:
    "Асуултын бичвэр эмнэлгийн хариуцагчаар батлагдаагүй (сервер approved гэж тэмдэглээгүй).",
  approved: "",
} as const;

export default function RedFlagsScreen() {
  const router = useRouter();
  const { state, dispatch } = useBookingDraft();
  const orderId = state.server?.orderId ?? null;
  const source = apiService.sourceOf("redFlags");

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    apiService.getRedFlagQuestions(orderId).then((result) => {
      if (!active) return;
      if (result.ok && questionnaireShowsBlocked(result.data)) {
        dispatch({ type: "redFlagBlocked", advice: null });
        router.replace("/booking/emergency");
        return;
      }
      setLoad(toLoadState(result));
      if (result.ok) setAnswers(initialAnswers(result.data));
    });
    return () => {
      active = false;
    };
  }, [orderId, dispatch, router]);

  const reload = useCallback(() => {
    if (!orderId) return;
    setLoad({ status: "loading" });
    setSubmitError(null);
    apiService.getRedFlagQuestions(orderId).then((result) => {
      if (result.ok && questionnaireShowsBlocked(result.data)) {
        dispatch({ type: "redFlagBlocked", advice: null });
        router.replace("/booking/emergency");
        return;
      }
      setLoad(toLoadState(result));
      if (result.ok) setAnswers(initialAnswers(result.data));
    });
  }, [orderId, dispatch, router]);

  const answer = (questionId: string, value: boolean) => {
    if (value) {
      // One "yes" stops the booking immediately on this device. The answers given
      // so far (including this "yes") are then reported to the server; until the
      // server confirms, the block is "pending" and is retried, never CLEAR.
      if (load.status !== "ready" || !orderId) return;
      // Backend 76b7e9e blocks on a single "yes" answer (docs/l1-1-api.md §4.2).
      const report = {
        questionnaires: load.questionnaire.questionnaires,
        answers: [{ questionId, value: true }],
      };
      dispatch({
        type: "redFlagBlocked",
        advice: null,
        server: "pending",
        report,
      });
      router.replace("/booking/emergency");
      void reportBlockInBackground(orderId, report, source, (server, version) =>
        dispatch({ type: "blockReported", server, version }),
      );
      return;
    }
    setAnswers((current) => ({ ...current, [questionId]: false }));
  };

  const submit = useSingleFlight(
    useCallback(async () => {
      if (load.status !== "ready" || !orderId) return;
      const { questionnaire } = load;
      if (questionnaire.questions.length === 0) {
        // The server lists no questionnaire for this service: nothing to answer.
        dispatch({ type: "redFlagCleared" });
        router.replace(
          nextStepAfterDetails({ ...state, redFlag: { status: "clear" } }),
        );
        return;
      }
      if (!canSubmitClear(questionnaire, answers)) return;
      setSubmitError(null);
      const result = await apiService.submitRedFlagAnswers(
        orderId,
        answersPayload(questionnaire, answers),
        questionnaire.questionnaires,
      );
      if (!result.ok) {
        if (result.code === "RED_FLAG_BLOCKED") {
          dispatch({ type: "redFlagBlocked", advice: null });
          router.replace("/booking/emergency");
          return;
        }
        if (result.code === "QUESTIONNAIRE_OUTDATED") {
          // The questions changed on the server: show the new set, answers start empty.
          reload();
          setSubmitError(result.message);
          return;
        }
        // No silent skip: the user stays here until the server stores the answers.
        setSubmitError(result.message);
        return;
      }
      if (result.data.status === "FLAGGED") {
        // The server's decision wins even if every local answer was "no".
        dispatch({
          type: "redFlagBlocked",
          advice: result.data.advice,
          version: result.data.version,
        });
        router.replace("/booking/emergency");
        return;
      }
      dispatch({ type: "redFlagCleared", version: result.data.version });
      router.replace(
        nextStepAfterDetails({ ...state, redFlag: { status: "clear" } }),
      );
    }, [load, orderId, answers, dispatch, router, state, reload]),
  );

  if (isBlocked(state)) return <Redirect href="/booking/emergency" />;
  if (!orderId) return <Redirect href="/(tabs)/bookappointment" />;

  const label =
    load.status === "ready"
      ? questionnaireLabel(load.questionnaire, source)
      : null;
  const noQuestions =
    load.status === "ready" && load.questionnaire.questions.length === 0;
  const ready =
    load.status === "ready" &&
    (noQuestions || canSubmitClear(load.questionnaire, answers));

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
          <Text style={styles.headerTitle}>Аюулын шинж тэмдэг</Text>
          <Text style={styles.headerSubtitle}>
            Алхам 2: асуулт бүрт хариулна уу
          </Text>
        </View>
      </View>

      {load.status === "loading" && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.color.brand} />
          <Text style={styles.mutedText}>Асуулга ачаалж байна...</Text>
        </View>
      )}

      {load.status === "error" && (
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.color.error}
          />
          <Text style={styles.errorText}>{load.message}</Text>
          <Text style={styles.mutedText}>
            Асуулгад хариулахгүйгээр захиалгыг үргэлжлүүлэх боломжгүй.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={reload}>
            <Text style={styles.secondaryButtonText}>Дахин оролдох</Text>
          </TouchableOpacity>
        </View>
      )}

      {load.status === "ready" && (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            <Stepper step={3} />
            {noQuestions ? (
              <Text style={styles.intro}>
                Сервер энэ үйлчилгээнд аюулын шинжийн асуулга шаардаагүй байна.
              </Text>
            ) : null}
            {label && label !== "approved" && !noQuestions ? (
              <View style={styles.fixtureBanner}>
                <Text style={styles.fixtureBannerText}>
                  {LABEL_TEXT[label]}
                </Text>
              </View>
            ) : null}
            <Text style={styles.intro}>
              Аль нэг асуултад «Тийм» гэвэл гэрийн үйлчилгээ биш яаралтай
              тусламж хэрэгтэй байж болзошгүй.
            </Text>
            {load.questionnaire.questions.map((q, index) => {
              const value = answers[q.id];
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
                      style={[
                        styles.answerButton,
                        value === false && styles.answerNoSelected,
                      ]}
                      onPress={() => answer(q.id, false)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: value === false }}
                    >
                      <Text
                        style={
                          value === false
                            ? styles.answerNoSelectedText
                            : styles.answerNoText
                        }
                      >
                        Үгүй
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            {submitError ? (
              <Text style={styles.submitError}>{submitError}</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!ready || submit.running) && styles.primaryButtonDisabled,
              ]}
              onPress={() => void submit.run()}
              disabled={!ready || submit.running}
            >
              <Text style={styles.primaryButtonText}>
                {submit.running
                  ? "Хадгалж байна..."
                  : submitError
                    ? "Дахин илгээх"
                    : "Үргэлжлүүлэх"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    backgroundColor: theme.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.info,
  },
  backButton: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    marginRight: 12,
    borderRadius: 24,
    backgroundColor: v.surface,
    ...theme.depth.soft,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 24,
    fontWeight: "800",
    color: theme.color.text,
  },
  headerSubtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.secondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  mutedText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.secondary,
    textAlign: "center",
  },
  errorText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.error,
    textAlign: "center",
  },
  list: { padding: 20, gap: 12 },
  fixtureBanner: {
    backgroundColor: theme.color.subtle,
    borderRadius: 12,
    padding: 12,
  },
  fixtureBannerText: {
    color: theme.color.secondary,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 25,
  },
  intro: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.secondary,
    lineHeight: 25,
  },
  questionCard: {
    ...theme.depth.soft,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: v.ice,
  },
  questionText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    color: theme.color.text,
    lineHeight: 25,
    fontWeight: "600",
  },
  answerRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  answerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: v.ice,
    alignItems: "center",
    backgroundColor: theme.color.background,
  },
  answerYes: { borderColor: theme.color.error },
  answerYesText: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  answerNoText: {
    color: theme.color.secondary,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  answerNoSelected: {
    backgroundColor: theme.color.brand,
    borderColor: theme.color.brand,
  },
  answerNoSelectedText: {
    color: theme.color.background,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    padding: 16,
    backgroundColor: theme.color.background,
    borderTopWidth: 1,
    borderTopColor: theme.color.info,
    gap: 8,
  },
  submitError: {
    color: theme.color.error,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    textAlign: "center",
  },
  primaryButton: {
    ...theme.depth.action,
    minHeight: 60,
    backgroundColor: theme.color.brand,
    borderRadius: theme.radius.card,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: theme.color.info },
  primaryButtonText: {
    color: theme.color.background,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.brand,
  },
  secondaryButtonText: {
    color: theme.color.brand,
    fontFamily: "NotoSans_400Regular",
    fontSize: 16,
    fontWeight: "700",
  },
});
