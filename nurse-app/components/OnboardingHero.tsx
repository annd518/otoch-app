import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  CircleCheck,
  ClipboardCheck,
  Clock,
  HeartPulse,
  ShieldCheck,
  Wallet,
} from "lucide-react-native";
import type { WelcomeSlide } from "../design/onboarding";
import { onboardingVisual as v } from "../design/onboardingVisual";

const ICONS = { shield: ShieldCheck, wallet: Wallet, clipboard: ClipboardCheck };
const BADGES = { heart: HeartPulse, check: CircleCheck, clock: Clock };

// Same soft raised disc as the family app's onboarding (App/components/OnboardingHero.tsx),
// with an icon per slide instead of the house.
export function OnboardingHero({
  slide,
  compact = false,
}: {
  slide: Pick<WelcomeSlide, "icon" | "badge">;
  compact?: boolean;
}) {
  const Icon = ICONS[slide.icon];
  const Badge = BADGES[slide.badge];
  const scale = compact ? { transform: [{ scale: 0.74 }] } : null;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[s.stage, compact && { height: 174 }]}
    >
      <View style={[s.orbit, s.orbitLeft, scale]} />
      <View style={[s.orbit, s.orbitRight, scale]} />
      <View style={s.dotOne} />
      <View style={s.dotTwo} />
      <View style={[s.disc, scale]}>
        <LinearGradient
          colors={[v.white, v.surface, v.glow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.discFill}
        >
          <View style={s.recess}>
            <Icon size={108} color={v.blue} strokeWidth={1.6} />
          </View>
        </LinearGradient>
        <View style={s.badgeShadow}>
          <LinearGradient colors={[v.yellowLight, v.yellow]} style={s.badge}>
            <Badge color={v.deep} size={32} strokeWidth={2.4} />
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stage: { width: 272, height: 256, alignItems: "center", justifyContent: "center" },
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
