import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { Button } from "../components/Button";
import { OnboardingHero } from "../components/OnboardingHero";
import { theme } from "../design/theme";
import { pageAt, WELCOME_SLIDES } from "../design/onboarding";
import { onboardingVisual as v } from "../design/onboardingVisual";

const WORDMARK = require("../assets/images/otoch-wordmark.png");
const LAST = WELCOME_SLIDES.length - 1;

// First screen of a signed-out nurse: three calm slides (the same visual language as the
// family app's onboarding), then "register" or "sign in". "Алгасах" goes straight to sign in.
export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const pageWidth = layoutWidth || width || 390;
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const compact = height > 0 && height < 740;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (active) setReduceMotion(on);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const goTo = (next: number) => {
    setPage(next);
    scroller.current?.scrollTo({ x: next * pageWidth, animated: !reduceMotion });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(pageAt(e.nativeEvent.contentOffset.x, pageWidth, WELCOME_SLIDES.length));

  return (
    <View style={s.root} onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.top}>
          <Image
            source={WORDMARK}
            accessibilityLabel="ОТОЧ"
            resizeMode="contain"
            style={s.wordmark}
          />
          <Pressable
            onPress={() => router.replace("/login")}
            accessibilityRole="button"
            accessibilityLabel="Алгасах"
            hitSlop={8}
            style={s.skip}
          >
            <AppText variant="label" color={v.navy}>
              Алгасах
            </AppText>
          </Pressable>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={{ flex: 1 }}
        >
          {WELCOME_SLIDES.map((slide, i) => (
            <ScrollView
              key={slide.title}
              style={{ width: pageWidth }}
              contentContainerStyle={[s.slide, compact && { paddingVertical: 8 }]}
              showsVerticalScrollIndicator={false}
            >
              <View
                accessible
                accessibilityLabel={`${i + 1}. ${slide.title}. ${slide.text}`}
                style={[s.slideInner, compact && { gap: 12 }]}
              >
                <OnboardingHero slide={slide} compact={compact} />
                <AppText
                  style={[s.title, compact && { fontSize: 26, lineHeight: 32 }]}
                  accessibilityRole="header"
                >
                  {slide.title}
                </AppText>
                <AppText style={s.text}>{slide.text}</AppText>
              </View>
            </ScrollView>
          ))}
        </ScrollView>

        <View style={s.bottom}>
          <View style={s.dots}>
            {WELCOME_SLIDES.map((slide, i) => (
              <Pressable
                key={slide.title}
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityLabel={`Хуудас ${i + 1} / ${LAST + 1}`}
                accessibilityState={{ selected: i === page }}
                style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
              >
                <View style={[s.dot, i === page && s.dotActive]} />
              </Pressable>
            ))}
          </View>

          {page < LAST ? (
            <Button label="Үргэлжлүүлэх" onPress={() => goTo(page + 1)} />
          ) : (
            <View style={{ gap: 12 }}>
              <Button label="Шинээр бүртгүүлэх" onPress={() => router.push("/join")} />
              <Button label="Нэвтрэх" variant="secondary" onPress={() => router.replace("/login")} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  wordmark: { width: 136, height: 38, tintColor: v.deep },
  skip: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "flex-end" },
  slide: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 12 },
  slideInner: { alignItems: "center", gap: 18 },
  title: {
    color: v.navy,
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    lineHeight: 36,
    textAlign: "center",
  },
  text: { color: v.muted, fontSize: 16, lineHeight: 26, textAlign: "center" },
  bottom: { paddingHorizontal: 24, paddingBottom: 16, gap: 16 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: v.dot },
  dotActive: { width: 28, backgroundColor: v.yellow },
});
