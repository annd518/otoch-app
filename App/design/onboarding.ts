// Onboarding slides (app/index.tsx). The texts are the existing approved
// ones; only the presentation changed. `icon` / `badge` name lucide icons.
export const ONBOARDING_GOLD = "#FFB821"; // the star in the splash logo

export interface OnboardingSlide {
  title: string;
  text: string;
  icon: "home" | "shield" | "clipboard";
  badge: "heart" | "check" | "clock";
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    title: "Сувилахуйн тусламжийг гэртээ",
    text: "Өөрт тохирох үйлчилгээг сонгож, хаяг болон цагаа захиалаарай.",
    icon: "home",
    badge: "heart",
  },
  {
    title: "Аюулгүй байдлаа эхэлж шалгана",
    text: "Эмчийн заалт, зөвшөөрөл, аюулын шинжийн асуулга нь үйлчилгээний өмнөх шалгалт юм.",
    icon: "shield",
    badge: "check",
  },
  {
    title: "Захиалгын явцаа хянаарай",
    text: "Захиалга, төлбөр, баталгаажсан тэмдэглэлээ нэг дороос харна.",
    icon: "clipboard",
    badge: "clock",
  },
];

export const EMERGENCY_NOTICE =
  "Яаралтай тусламж шаардлагатай үед 103 руу залгана уу.";

/** Page shown after a horizontal scroll ends at offset `x` (clamped). */
export function pageAt(x: number, width: number, count: number): number {
  if (!(width > 0)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(x / width)));
}
