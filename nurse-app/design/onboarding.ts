// Welcome slides and the "how to join" copy of the nurse app. Presentation lives in
// app/welcome.tsx and app/join.tsx; keeping the words here lets a test guard the wording.
//
// Rules for every text in this file (spec v2.0 slide 10, 28):
// - never "эмнэлэг", "эмчлэх", "онош", "24 цаг", "шууд", "SOS": ОТОЧ is a platform, not a hospital
//   or an emergency service;
// - no pay percentage, payment timing or approval time: those are contract terms (⚑);
// - say only what the app does today.

export interface WelcomeSlide {
  title: string;
  text: string;
  icon: "wallet" | "calendar" | "shield";
  badge: "heart" | "check" | "clock";
}

// The idea of the app: a nurse earns from her profession and helps people at home.
export const WELCOME_SLIDES: readonly WelcomeSlide[] = [
  {
    title: "Мэргэжлээрээ орлого ол, хүнд тусал",
    text: "Гэртээ сувилуулахыг хүссэн хүмүүст очиж тусалж, мэргэжлээрээ орлогоо нэмэгдүүлээрэй.",
    icon: "wallet",
    badge: "heart",
  },
  {
    title: "Ажлын цагаа өөрөө сонго",
    text: "«Дуудлага хүлээн авах»-ыг асаасан үедээ л дуудлага авна. Хүлээн авахаасаа өмнө үнэ, орлогоо харна.",
    icon: "calendar",
    badge: "clock",
  },
  {
    title: "Баталгаажсан сувилагчдын сүлжээ",
    text: "Зөвшөөрлөө баталгаажуулаад, найдвартай, цахим тэмдэглэлтэй ажиллаарай.",
    icon: "shield",
    badge: "check",
  },
];

export type JoinIcon = "calendar" | "wallet" | "clipboard" | "shield" | "handshake";

export const JOIN_INTRO = {
  title: "Мэргэжлээрээ хүнд тусалж, орлогоо нэмэгдүүлээрэй",
  text: "Мэргэжлийн зөвшөөрөлтэй сувилагч та утсаа баталгаажуулаад өргөдлөө илгээнэ үү. Админ баталгаажуулсны дараа гэрийн сувилгааны дуудлага хүлээн авч эхэлнэ.",
};

export const JOIN_BENEFITS: readonly { icon: JoinIcon; title: string; text: string }[] = [
  {
    icon: "wallet",
    title: "Орлогоо нэмэгдүүлнэ",
    text: "Дуудлага бүрийн үнэ, таны орлого хүлээн авахаас өмнө харагдана. Үйлчлүүлэгчтэй үнэ тохиролцох шаардлагагүй.",
  },
  {
    icon: "handshake",
    title: "Хүнд тусална",
    text: "Ахмад настан, хэвтрийн болон хагалгааны дараах хүмүүст гэрт нь очиж мэргэжлийн сувилгаа үзүүлнэ.",
  },
  {
    icon: "calendar",
    title: "Ажлын цагаа өөрөө сонгоно",
    text: "«Дуудлага хүлээн авах» горимыг асаасан үедээ л дуудлага авна. Хүссэн цагтаа ажиллаж, хүсээгүй цагтаа амарна.",
  },
  {
    icon: "clipboard",
    title: "Цахим тэмдэглэл",
    text: "Амин үзүүлэлт, хийсэн ажилбар, үйлчлүүлэгчийн гарын үсгийг утсандаа хөтөлнө. Бичиг цаасгүй, дутуу бөглөх боломжгүй.",
  },
  {
    icon: "shield",
    title: "Аюулгүй, ойлгомжтой дүрэм",
    text: "Эмчийн заалт, эмийн хугацааг дуудлага дээр шалгаж, таарахгүй бол татгалзах эрхтэй. Эмчийн заалтгүй тарилга, дусал хийхгүй.",
  },
];

// The path a nurse follows. Steps 1-3 and 5 are what the app and admin web do today; step 4
// is a company process (spec slide 35), hence "when needed".
export const JOIN_STEPS: readonly { title: string; text: string }[] = [
  {
    title: "Утсаа баталгаажуулах",
    text: "Овог нэр, утасны дугаараа оруулж, SMS кодоор баталгаажуулна.",
  },
  {
    title: "Өргөдөл бөглөх",
    text: "Апп дотроос зөвшөөрлийн дугаар, ажлын газар, туршлага, ажиллах дүүргээ бөглөж, баримтын зураг хавсаргана.",
  },
  {
    title: "Админ шалгах",
    text: "Манай баг зөвшөөрөл, баримтыг мэргэжлийн бүртгэлтэй тулган шалгана. Дутуу бол шалтгааныг бичиж буцаана, та засаад дахин илгээнэ.",
  },
  {
    title: "Ярилцлага, сургалт",
    text: "Шаардлагатай бол манай баг тантай холбогдож, ярилцлага, ёс зүй болон халдвар хамгааллын сургалтыг товлоно.",
  },
  {
    title: "Баталгаажиж, ажиллаж эхлэх",
    text: "Бүртгэл «Баталгаажсан» болмогц «Дуудлага хүлээн авах»-ыг асаагаад дуудлага хүлээнэ.",
  },
];

/** Page shown after a horizontal scroll ends at offset `x` (clamped). */
export function pageAt(x: number, width: number, count: number): number {
  if (!(width > 0)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(x / width)));
}
