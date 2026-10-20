import { useRouter } from "expo-router";
import { ArrowLeft, CalendarClock, ClipboardCheck, HeartHandshake, ShieldCheck, Wallet, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { Button } from "../components/Button";
import { FormSection, Intro, Surface, TaskBody } from "../components/Presentation";
import { JOIN_BENEFITS, JOIN_INTRO, JOIN_STEPS, type JoinIcon } from "../design/onboarding";
import { onboardingVisual as v } from "../design/onboardingVisual";
import { theme } from "../design/theme";

const ICONS: Record<JoinIcon, LucideIcon> = {
  calendar: CalendarClock,
  wallet: Wallet,
  clipboard: ClipboardCheck,
  shield: ShieldCheck,
};

// "Register" for a nurse: what the work is like and what happens after she applies. The
// account itself is made on the sign-in screen (phone + code), the application inside the app.
export default function JoinScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 56 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Буцах"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
          style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
        >
          <ArrowLeft color={v.navy} size={24} />
        </Pressable>
        <AppText variant="label" color={v.navy} accessibilityRole="header" style={{ flex: 1, textAlign: "center" }}>
          Бүртгүүлэх
        </AppText>
        <View style={{ width: 48 }} />
      </View>

      <TaskBody
        footer={
          <>
            <Button label="Үргэлжлүүлэх" onPress={() => router.push({ pathname: "/login", params: { mode: "register" } })} />
            <Button label="Бүртгэлтэй юу? Нэвтрэх" variant="secondary" onPress={() => router.replace("/login")} />
          </>
        }
      >
        <Surface style={{ backgroundColor: v.ice, ...theme.depth.raised }}>
          <Intro title={JOIN_INTRO.title} description={JOIN_INTRO.text} icon={HeartHandshake} />
        </Surface>

        <FormSection title="Яагаад ОТОЧ-ийг сонгох вэ?">
          <AppText variant="caption" color={theme.color.secondary}>
            Баталгаажсан сувилагчийг үйлчлүүлэгчтэй холбож, үнэ болон эргэлтийн тэмдэглэлийг тодорхой хөтөлдөг платформ.
          </AppText>
          {JOIN_BENEFITS.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <Surface key={b.title} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start", padding: 16 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.color.surface,
                    ...theme.depth.inset,
                  }}
                >
                  <Icon size={24} color={v.deep} strokeWidth={1.7} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <AppText variant="label">{b.title}</AppText>
                  <AppText variant="caption" color={theme.color.secondary}>
                    {b.text}
                  </AppText>
                </View>
              </Surface>
            );
          })}
        </FormSection>

        <FormSection title="Хэрхэн бүртгүүлэх вэ?">
          <AppText variant="caption" color={theme.color.secondary}>
            Доорх алхмуудаар өргөдлөө илгээж, баталгаажуулалтад орно.
          </AppText>
          <View>
            {JOIN_STEPS.map((step, i) => (
              <View key={step.title} style={{ flexDirection: "row", gap: 14 }}>
                <View style={{ alignItems: "center", width: 44 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: i === JOIN_STEPS.length - 1 ? v.yellow : v.deep,
                    }}
                  >
                    <AppText variant="label" color={i === JOIN_STEPS.length - 1 ? v.navy : v.white}>
                      {String(i + 1)}
                    </AppText>
                  </View>
                  {i < JOIN_STEPS.length - 1 ? (
                    <View style={{ flex: 1, width: 2, minHeight: 16, backgroundColor: v.dot }} />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4, paddingBottom: i < JOIN_STEPS.length - 1 ? 18 : 0 }}>
                  <AppText variant="label">{step.title}</AppText>
                  <AppText variant="caption" color={theme.color.secondary}>
                    {step.text}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </FormSection>
      </TaskBody>
    </SafeAreaView>
  );
}
