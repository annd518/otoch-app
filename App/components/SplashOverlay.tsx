import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { SPLASH, splashLayout } from "@/utils/splashLayout";

const LOGO = require("../assets/splash/splash-logo.png");
const MARK = require("../assets/splash/splash-mark.png");
const BRAND = require("../assets/splash/splash-brand.png");
const GRADIENT = require("../assets/splash/splash-bg.png");

const platform = Platform.OS === "ios" ? "ios" : "android";

// Continues the native splash in JS: it first draws exactly what the native
// splash shows (solid color + centered artwork), hides the native splash, then
// reveals the full design (gradient, logo at its place, company line) and fades
// out over the app. See utils/splashLayout.ts for the geometry.
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // useState initializers (not refs): read during render, stable across renders
  const [progress] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const started = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size) setSize({ width, height });
  };

  useEffect(() => {
    if (!size || started.current) return;
    started.current = true;
    let cancelled = false;
    // One frame after the start pose is laid out, so it is on screen before
    // the native splash goes away.
    requestAnimationFrame(async () => {
      SplashScreen.hide();
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;
      const ease = Easing.out(Easing.cubic);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 650, easing: ease, useNativeDriver: true }),
          Animated.timing(reveal, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
        ]),
        Animated.delay(450),
        Animated.timing(fade, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        if (!cancelled) onDone();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [size, progress, reveal, fade, onDone]);

  const layout = size
    ? splashLayout(size.width, size.height, initialWindowMetrics?.insets.bottom ?? 0, platform)
    : null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Image source={GRADIENT} resizeMode="stretch" style={[StyleSheet.absoluteFill, { opacity: reveal }]} />
      {layout && (
        <>
          <Animated.Image
            source={LOGO}
            resizeMode="contain"
            style={[
              styles.abs,
              layout.logo,
              {
                // Android: the native splash only had the mark, the rest fades in
                opacity:
                  platform === "android"
                    ? progress.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: "clamp" })
                    : 1,
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [layout.start.translateX, 0] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [layout.start.translateY, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [layout.start.scale, 1] }) },
                ],
              },
            ]}
          />
          {platform === "android" && (
            <Animated.Image
              source={MARK}
              resizeMode="contain"
              style={[
                styles.abs,
                layout.mark,
                {
                  opacity: progress.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: "clamp" }),
                  transform: [
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, layout.markEnd.translateX] }) },
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, layout.markEnd.translateY] }) },
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, layout.markEnd.scale] }) },
                  ],
                },
              ]}
            />
          )}
          <Animated.Image source={BRAND} resizeMode="contain" style={[styles.abs, layout.brand, { opacity: reveal }]} />
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH.backgroundColor, zIndex: 1000, elevation: 1000 },
  abs: { position: "absolute" },
});
