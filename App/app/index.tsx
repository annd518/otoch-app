import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { ArrowRight, Phone } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { OnboardingHero } from "@/components/OnboardingHero";
import { onboardingVisual as v } from "@/design/onboardingVisual";
import { AppText as Text } from "@/components/AppText";
import { theme } from "@/design/theme";
import {
  ONBOARDING_SLIDES,
  pageAt,
  type OnboardingSlide,
} from "@/design/onboarding";
import { storage } from "@/utils/storage";

// Keeps the approved splash assets, then transitions into three calm,
// softly raised onboarding slides using the shared medical palette.
const WORDMARK = require("../assets/brand/otoch-wordmark.png");

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const pageWidth = layoutWidth || width || 390;
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const last = ONBOARDING_SLIDES.length - 1;

  useEffect(() => {
    let active = true;
    void storage.getValidSession().then((s) => {
      if (active && s) router.replace("/(tabs)");
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (active) setReduceMotion(on);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const start = () => router.push("/auth/phone");
  const goTo = (next: number) => {
    setPage(next);
    scroller.current?.scrollTo({
      x: next * pageWidth,
      animated: !reduceMotion,
    });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(pageAt(e.nativeEvent.contentOffset.x, pageWidth, last + 1));

  return (
    <View
      style={styles.root}
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel="OTOCH"
          >
            <Image
              source={WORDMARK}
              resizeMode="contain"
              style={styles.wordmark}
            />
          </View>
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel="Алгасах"
            style={styles.skip}
            hitSlop={8}
          >
            <Text style={styles.skipText}>Алгасах</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.pager}
        >
          {ONBOARDING_SLIDES.map((slide, i) => (
            <Slide
              key={slide.title}
              slide={slide}
              width={pageWidth}
              index={i}
            />
          ))}
        </ScrollView>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {ONBOARDING_SLIDES.map((slide, i) => (
              <Pressable
                key={slide.title}
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityLabel={`Хуудас ${i + 1} / ${last + 1}`}
                accessibilityState={{ selected: i === page }}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={[styles.dot, i === page && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.notice}>
            <View style={styles.phoneBadge}>
              <Phone color={v.yellow} size={26} strokeWidth={2} />
            </View>
            <View style={styles.noticeDivider} />
            <Text style={styles.noticeText}>
              Яаралтай тусламж шаардлагатай үед{" "}
              <Text style={styles.emergencyNumber}>103</Text> руу залгана уу.
            </Text>
          </View>
          <Pressable
            onPress={() => (page < last ? goTo(page + 1) : start())}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            {({ pressed }) => (
              <LinearGradient
                colors={pressed ? [v.deep, v.deep] : [v.blue, v.deep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryFill}
              >
                <Text style={styles.primaryText}>
                  {page < last ? "Үргэлжлүүлэх" : "Эхлэх"}
                </Text>
                <ArrowRight size={24} color={v.white} />
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Slide({
  slide,
  width,
  index,
}: {
  slide: OnboardingSlide;
  width: number;
  index: number;
}) {
  const { height } = useWindowDimensions();
  const compact = height > 0 && height < 740;
  return (
    // vertical scroll keeps large system font sizes readable on small phones
    <ScrollView
      style={{ width }}
      contentContainerStyle={[styles.slide, compact && { paddingVertical: 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View
        accessible
        accessibilityLabel={`${index + 1}. ${slide.title}. ${slide.text}`}
        style={[styles.slideInner, compact && { gap: 12 }]}
      >
        <OnboardingHero slide={slide} compact={compact} />
        <Text
          style={[styles.title, compact && { fontSize: 26, lineHeight: 32 }]}
        >
          {slide.title}
        </Text>
        <Text style={styles.text}>{slide.text}</Text>
      </View>
    </ScrollView>
  );
}

const WHITE_SOFT = v.muted;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  safe: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  // 654x183 @3x
  wordmark: { width: 136, height: 38, tintColor: v.deep },
  skip: { minHeight: 48, minWidth: 48, justifyContent: "center" },
  skipText: { color: v.navy, fontSize: 15, fontFamily: "NotoSans_600SemiBold" },
  pager: { flex: 1 },
  slide: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  slideInner: { alignItems: "center", gap: 18 },
  title: {
    color: v.navy,
    fontFamily: "Montserrat_700Bold",
    fontSize: 30,
    lineHeight: 37,
    textAlign: "center",
  },
  text: {
    color: WHITE_SOFT,
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
  },
  bottom: { paddingHorizontal: 24, paddingBottom: 16, gap: 18 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: v.dot,
  },
  dotActive: { width: 28, backgroundColor: v.yellow },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: v.surface,
    boxShadow: v.cardShadow,
    borderWidth: 1,
    borderColor: v.ice,
  },
  noticeText: {
    flex: 1,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 23,
  },
  phoneBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: v.badgeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeDivider: { width: 1, alignSelf: "stretch", backgroundColor: v.dot },
  emergencyNumber: { color: v.deep, fontFamily: "NotoSans_600SemiBold" },
  primary: {
    minHeight: 62,
    borderRadius: 24,
    backgroundColor: v.deep,
    boxShadow: v.buttonShadow,
    borderWidth: 1,
    borderColor: v.blue,
  },
  primaryFill: {
    minHeight: 62,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  pressed: { transform: [{ scale: 0.98 }], ...theme.depth.flat },
  primaryText: {
    color: v.white,
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    flexShrink: 1,
    textAlign: "center",
  },
});
