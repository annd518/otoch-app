import React, { useId } from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Rect,
  Ellipse,
} from "react-native-svg";
import { LinearGradient as SurfaceGradient } from "expo-linear-gradient";
import {
  CircleCheck,
  ClipboardList,
  Clock,
  HeartPulse,
  ShieldCheck,
} from "lucide-react-native";
import type { OnboardingSlide } from "@/design/onboarding";
import { onboardingVisual as v } from "@/design/onboardingVisual";

function CareHouse() {
  const id = useId().replace(/:/g, "");
  return (
    <Svg width={166} height={162} viewBox="0 0 180 180" accessible={false}>
      <Defs>
        <LinearGradient id={`${id}roof`} x1="0%" y1="0%" x2="65%" y2="100%">
          <Stop stopColor={v.skyLight} />
          <Stop offset="0.35" stopColor={v.sky} />
          <Stop offset="1" stopColor={v.deep} />
        </LinearGradient>
        <LinearGradient id={`${id}wall`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor={v.white} />
          <Stop offset="1" stopColor={v.glow} />
        </LinearGradient>
        <LinearGradient id={`${id}door`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor={v.sky} />
          <Stop offset="1" stopColor={v.deep} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="93" cy="161" rx="65" ry="10" fill={v.dot} opacity={0.4} />
      <Rect
        x="122"
        y="37"
        width="22"
        height="57"
        rx="5"
        fill={`url(#${id}door)`}
      />
      <Path
        d="M31 84 L90 28 L150 84 V147 Q150 160 137 160 H44 Q31 160 31 147Z"
        fill={`url(#${id}wall)`}
        stroke={v.white}
        strokeWidth="2"
      />
      <Path
        d="M20 89 L82 29 Q90 21 98 29 L160 89"
        fill="none"
        stroke={v.dot}
        strokeWidth="20"
        strokeLinecap="round"
        transform="translate(1 4)"
      />
      <Path
        d="M20 86 L82 26 Q90 18 98 26 L160 86"
        fill="none"
        stroke={`url(#${id}roof)`}
        strokeWidth="19"
        strokeLinecap="round"
      />
      <Rect
        x="70"
        y="105"
        width="41"
        height="55"
        rx="10"
        fill={`url(#${id}door)`}
      />
      <Path
        d="M73 151 V116 Q73 108 82 108"
        fill="none"
        stroke={v.skyLight}
        strokeWidth="2"
        opacity={0.8}
      />
    </Svg>
  );
}
export function OnboardingHero({
  slide,
  compact = false,
}: {
  slide: OnboardingSlide;
  compact?: boolean;
}) {
  const Badge = { heart: HeartPulse, check: CircleCheck, clock: Clock }[
    slide.badge
  ];
  const Icon = slide.icon === "shield" ? ShieldCheck : ClipboardList;
  return (
    <View style={[s.stage, compact && { height: 174 }]} accessible={false}>
      <View
        style={[
          s.orbit,
          s.orbitLeft,
          compact && { transform: [{ scale: 0.74 }] },
        ]}
      />
      <View
        style={[
          s.orbit,
          s.orbitRight,
          compact && { transform: [{ scale: 0.74 }] },
        ]}
      />
      <View style={s.dotOne} />
      <View style={s.dotTwo} />
      <View style={[s.disc, compact && { transform: [{ scale: 0.74 }] }]}>
        <SurfaceGradient
          colors={[v.white, v.surface, v.glow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.discFill}
        >
          <View style={s.recess}>
            {slide.icon === "home" ? (
              <CareHouse />
            ) : (
              <Icon size={108} color={v.blue} strokeWidth={1.6} />
            )}
          </View>
        </SurfaceGradient>
        <View style={s.badgeShadow}>
          <SurfaceGradient colors={[v.yellowLight, v.yellow]} style={s.badge}>
            <Badge color={v.deep} size={32} strokeWidth={2.4} />
          </SurfaceGradient>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  stage: {
    width: 272,
    height: 256,
    alignItems: "center",
    justifyContent: "center",
  },
  orbit: {
    position: "absolute",
    width: 214,
    height: 214,
    borderRadius: 107,
    backgroundColor: v.glow,
    opacity: 0.7,
  },
  orbitLeft: { left: -18, top: 0 },
  orbitRight: { right: -16, bottom: -3 },
  dotOne: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: v.dot,
    right: 0,
    top: 22,
    opacity: 0.65,
  },
  dotTwo: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: v.dot,
    left: 10,
    bottom: 10,
    opacity: 0.65,
  },
  disc: { width: 232, height: 232, borderRadius: 116, boxShadow: v.heroShadow },
  discFill: {
    flex: 1,
    borderRadius: 116,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: v.ice,
  },
  recess: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: v.surface,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: v.recessShadow,
    borderWidth: 1,
    borderColor: v.ice,
  },
  badgeShadow: {
    position: "absolute",
    right: 8,
    bottom: 22,
    borderRadius: 34,
    boxShadow: "4px 7px 12px #C9D5E5",
  },
  badge: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: v.yellowLight,
  },
});
