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
import {
  CircleCheck,
  ClipboardList,
  Clock,
  HeartPulse,
  House,
  Phone,
  ShieldCheck,
} from "lucide-react-native";
import { AppText as Text } from "@/components/AppText";
import { theme } from "@/design/theme";
import {
  EMERGENCY_NOTICE,
  ONBOARDING_GOLD,
  ONBOARDING_SLIDES,
  pageAt,
  type OnboardingSlide,
} from "@/design/onboarding";
import { storage } from "@/utils/storage";

// Continues the splash: same gradient and the white ОТОЧ wordmark, then three
// swipeable slides with a large icon each.
const GRADIENT = require("../assets/splash/splash-bg.png");
const WORDMARK = require("../assets/brand/otoch-wordmark.png");
const ICONS = { home: House, shield: ShieldCheck, clipboard: ClipboardList };
const BADGES = { heart: HeartPulse, check: CircleCheck, clock: Clock };

export default function Onboarding() {
  const { width } = useWindowDimensions();
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
    scroller.current?.scrollTo({ x: next * width, animated: !reduceMotion });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(pageAt(e.nativeEvent.contentOffset.x, width, last + 1));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image
        source={GRADIENT}
        resizeMode="stretch"
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View accessible accessibilityRole="header" accessibilityLabel="OTOCH">
            <Image source={WORDMARK} resizeMode="contain" style={styles.wordmark} />
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
            <Slide key={slide.title} slide={slide} width={width} index={i} />
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
                hitSlop={12}
              >
                <View style={[styles.dot, i === page && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.notice}>
            <Phone color={ONBOARDING_GOLD} size={22} />
            <Text style={styles.noticeText}>{EMERGENCY_NOTICE}</Text>
          </View>
          <Pressable
            onPress={() => (page < last ? goTo(page + 1) : start())}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>
              {page < last ? "Үргэлжлүүлэх" : "Эхлэх"}
            </Text>
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
  const Icon = ICONS[slide.icon];
  const Badge = BADGES[slide.badge];
  return (
    // vertical scroll keeps large system font sizes readable on small phones
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.slide}
      showsVerticalScrollIndicator={false}
    >
      <View
        accessible
        accessibilityLabel={`${index + 1}. ${slide.title}. ${slide.text}`}
        style={styles.slideInner}
      >
        <View style={styles.halo}>
          <View style={styles.circle}>
            <Icon color={theme.color.background} size={84} strokeWidth={1.6} />
          </View>
          <View style={styles.badge}>
            <Badge color={theme.color.navy} size={30} strokeWidth={2.2} />
          </View>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.text}</Text>
      </View>
    </ScrollView>
  );
}

const WHITE_SOFT = "rgba(255,255,255,0.86)";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.navy },
  safe: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // 654x183 @3x
  wordmark: { width: 115, height: 32, tintColor: theme.color.background },
  skip: { minHeight: 48, minWidth: 48, justifyContent: "center" },
  skipText: { color: WHITE_SOFT, fontSize: 18 },
  pager: { flex: 1 },
  slide: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  slideInner: { alignItems: "center", gap: 20 },
  halo: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  circle: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 26,
    bottom: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ONBOARDING_GOLD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#123F72",
  },
  title: {
    color: theme.color.background,
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    lineHeight: 36,
    textAlign: "center",
  },
  text: {
    color: WHITE_SOFT,
    fontSize: 19,
    lineHeight: 29,
    textAlign: "center",
  },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 16 },
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
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { width: 28, backgroundColor: ONBOARDING_GOLD },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  noticeText: { flex: 1, color: theme.color.background, fontSize: 16, lineHeight: 23 },
  primary: {
    minHeight: 56,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.background,
  },
  pressed: { opacity: 0.85 },
  primaryText: {
    color: theme.color.navy,
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
  },
});
