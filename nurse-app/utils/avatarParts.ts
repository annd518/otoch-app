// A self-made avatar: named parts drawn on the device with DiceBear
// "avataaars". The server stores only these names (server/src/services/avatar.ts);
// keep this file in sync with App/utils/avatarParts.ts.

export type Gender = "female" | "male";
export interface AvatarParts {
  v: 1;
  gender: Gender;
  skinColor: string;
  top: string;
  hairColor: string;
  facialHair: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  accessories: string;
  clothing: string;
  clothesColor: string;
  backgroundColor: string;
}
export type PartKey = Exclude<keyof AvatarParts, "v" | "gender">;
export interface Choice {
  value: string;
  label: string;
}

const NONE = "none";

export const HAIR: Record<Gender, Choice[]> = {
  female: [
    { value: "straight01", label: "Шулуун урт" },
    { value: "straight02", label: "Шулуун урт 2" },
    { value: "straightAndStrand", label: "Унжсан урт" },
    { value: "longButNotTooLong", label: "Дунд урт" },
    { value: "bob", label: "Богино шулуун" },
    { value: "bun", label: "Боодол" },
    { value: "curly", label: "Буржгар" },
    { value: "curvy", label: "Долгионтой" },
    { value: "bigHair", label: "Өтгөн" },
    { value: "miaWallace", label: "Шулуун, үзүүртэй" },
    { value: "frida", label: "Сүлжсэн" },
    { value: "dreads", label: "Сүлжмэл" },
    { value: "fro", label: "Афро" },
    { value: "froBand", label: "Афро, туузтай" },
    { value: "hijab", label: "Хижаб" },
    { value: "winterHat02", label: "Өвлийн малгай" },
  ],
  male: [
    { value: "shortFlat", label: "Богино" },
    { value: "shortRound", label: "Богино дугуй" },
    { value: "shortWaved", label: "Богино долгионтой" },
    { value: "shortCurly", label: "Богино буржгар" },
    { value: "theCaesar", label: "Цезарь" },
    { value: "theCaesarAndSidePart", label: "Хажуу задгай" },
    { value: "sides", label: "Хажуудаа үстэй" },
    { value: "shavedSides", label: "Хажуу хуссан" },
    { value: "frizzle", label: "Сэвсгэр" },
    { value: "shaggy", label: "Урт сэвсгэр" },
    { value: "shaggyMullet", label: "Маллет" },
    { value: "dreads01", label: "Сүлжмэл богино" },
    { value: "dreads02", label: "Сүлжмэл" },
    { value: NONE, label: "Үсгүй" },
    { value: "hat", label: "Малгай" },
    { value: "turban", label: "Турбан" },
    { value: "winterHat1", label: "Өвлийн малгай" },
  ],
};

export const PARTS: Record<Exclude<PartKey, "top">, Choice[]> = {
  skinColor: [
    { value: "ffdbb4", label: "Цайвар" },
    { value: "edb98a", label: "Шаргал" },
    { value: "d08b5b", label: "Хүрэн шаргал" },
    { value: "ae5d29", label: "Бор" },
    { value: "614335", label: "Хар бор" },
  ],
  hairColor: [
    { value: "2c1b18", label: "Хар" },
    { value: "4a312c", label: "Хар хүрэн" },
    { value: "724133", label: "Хүрэн" },
    { value: "a55728", label: "Зэс хүрэн" },
    { value: "b58143", label: "Цайвар хүрэн" },
    { value: "d6b370", label: "Шар" },
    { value: "c93305", label: "Улаан" },
    { value: "ecdcbf", label: "Цайвар шар" },
    { value: "e8e1e1", label: "Буурал" },
  ],
  facialHair: [
    { value: NONE, label: "Сахалгүй" },
    { value: "beardLight", label: "Богино сахал" },
    { value: "beardMedium", label: "Дунд сахал" },
    { value: "beardMajestic", label: "Өтгөн сахал" },
    { value: "moustacheFancy", label: "Сэмж" },
    { value: "moustacheMagnum", label: "Өтгөн сэмж" },
  ],
  eyes: [
    { value: "default", label: "Энгийн" },
    { value: "happy", label: "Баяртай" },
    { value: "squint", label: "Онийсон" },
    { value: "side", label: "Хажуу тийш" },
    { value: "wink", label: "Нүд ирмэсэн" },
    { value: "surprised", label: "Гайхсан" },
    { value: "closed", label: "Аньсан" },
  ],
  eyebrows: [
    { value: "defaultNatural", label: "Энгийн" },
    { value: "flatNatural", label: "Тэгш" },
    { value: "raisedExcitedNatural", label: "Өргөсөн" },
    { value: "upDownNatural", label: "Нэг нь өргөгдсөн" },
    { value: "sadConcernedNatural", label: "Санаа зовсон" },
    { value: "unibrowNatural", label: "Нийлсэн" },
  ],
  mouth: [
    { value: "smile", label: "Инээмсэглэсэн" },
    { value: "default", label: "Энгийн" },
    { value: "twinkle", label: "Зөөлөн инээмсэглэл" },
    { value: "serious", label: "Ноцтой" },
    { value: "concerned", label: "Санаа зовсон" },
  ],
  accessories: [
    { value: NONE, label: "Шилгүй" },
    { value: "prescription01", label: "Нүдний шил" },
    { value: "prescription02", label: "Нүдний шил 2" },
    { value: "round", label: "Дугуй шил" },
    { value: "kurt", label: "Том шил" },
    { value: "wayfarers", label: "Нарны шил" },
    { value: "sunglasses", label: "Нарны шил 2" },
  ],
  clothing: [
    { value: "shirtCrewNeck", label: "Футболк" },
    { value: "shirtVNeck", label: "V захтай" },
    { value: "shirtScoopNeck", label: "Дугуй захтай" },
    { value: "collarAndSweater", label: "Захтай цамц" },
    { value: "blazerAndShirt", label: "Пиджак" },
    { value: "blazerAndSweater", label: "Пиджак, цамц" },
    { value: "hoodie", label: "Худи" },
    { value: "overall", label: "Комбинезон" },
  ],
  clothesColor: [
    { value: "65c9ff", label: "Цэнхэр" },
    { value: "5199e4", label: "Хөх" },
    { value: "25557c", label: "Хар хөх" },
    { value: "262e33", label: "Хар" },
    { value: "929598", label: "Саарал" },
    { value: "e6e6e6", label: "Цайвар саарал" },
    { value: "a7ffc4", label: "Ногоон" },
    { value: "ffafb9", label: "Ягаан" },
    { value: "ff5c5c", label: "Улаан" },
    { value: "ffffff", label: "Цагаан" },
  ],
  backgroundColor: [
    { value: "b6e3f4", label: "Цэнхэр" },
    { value: "c0aede", label: "Нил ягаан" },
    { value: "d1d4f9", label: "Цайвар хөх" },
    { value: "ffd5dc", label: "Ягаан" },
    { value: "ffdfbf", label: "Тоорын" },
    { value: "d8f0dc", label: "Ногоон" },
  ],
};

/** Sections of the editor, in order. Beards only for "male". */
export const SECTIONS: { key: PartKey; title: string; color?: boolean }[] = [
  { key: "skinColor", title: "Арьс", color: true },
  { key: "top", title: "Үс" },
  { key: "hairColor", title: "Үсний өнгө", color: true },
  { key: "facialHair", title: "Сахал" },
  { key: "eyes", title: "Нүд" },
  { key: "eyebrows", title: "Хөмсөг" },
  { key: "mouth", title: "Ам" },
  { key: "accessories", title: "Шил" },
  { key: "clothing", title: "Хувцас" },
  { key: "clothesColor", title: "Хувцасны өнгө", color: true },
  { key: "backgroundColor", title: "Дэвсгэр", color: true },
];

export const choicesFor = (key: PartKey, gender: Gender): Choice[] =>
  key === "top"
    ? HAIR[gender]
    : key === "facialHair" && gender === "female"
      ? [PARTS.facialHair[0]]
      : PARTS[key];

export const DEFAULT_AVATAR: Record<Gender, AvatarParts> = {
  female: {
    v: 1,
    gender: "female",
    skinColor: "edb98a",
    top: "straight01",
    hairColor: "2c1b18",
    facialHair: NONE,
    eyes: "default",
    eyebrows: "defaultNatural",
    mouth: "smile",
    accessories: NONE,
    clothing: "shirtScoopNeck",
    clothesColor: "65c9ff",
    backgroundColor: "ffd5dc",
  },
  male: {
    v: 1,
    gender: "male",
    skinColor: "edb98a",
    top: "shortFlat",
    hairColor: "2c1b18",
    facialHair: NONE,
    eyes: "default",
    eyebrows: "defaultNatural",
    mouth: "smile",
    accessories: NONE,
    clothing: "shirtCrewNeck",
    clothesColor: "5199e4",
    backgroundColor: "b6e3f4",
  },
};

/** Changes one part; switching gender keeps what still fits the new gender. */
export function withPart(
  a: AvatarParts,
  key: PartKey | "gender",
  value: string,
): AvatarParts {
  if (key !== "gender") return { ...a, [key]: value };
  const gender: Gender = value === "female" ? "female" : "male";
  const fits = (k: PartKey) =>
    choicesFor(k, gender).some((c) => c.value === a[k]);
  return {
    ...a,
    gender,
    top: fits("top") ? a.top : DEFAULT_AVATAR[gender].top,
    facialHair: fits("facialHair") ? a.facialHair : NONE,
  };
}

const pick = <T>(list: T[], random: () => number) =>
  list[Math.floor(random() * list.length) % list.length];

export function randomAvatar(random: () => number = Math.random): AvatarParts {
  const gender: Gender = random() < 0.5 ? "female" : "male";
  const a = { ...DEFAULT_AVATAR[gender] };
  for (const s of SECTIONS)
    (a[s.key] as string) = pick(choicesFor(s.key, gender), random).value;
  // most people: no beard, no glasses
  if (random() < 0.6) a.facialHair = NONE;
  if (random() < 0.7) a.accessories = NONE;
  return a;
}

/**
 * Reads an avatar from the server. Anything unknown falls back to the default
 * part, so an old or odd value never breaks the drawing; null = no avatar.
 */
export function parseAvatar(value: unknown): AvatarParts | null {
  if (typeof value !== "object" || value === null) return null;
  const o = value as Record<string, unknown>;
  if (o.v !== 1 || (o.gender !== "female" && o.gender !== "male")) return null;
  const gender = o.gender;
  const a = { ...DEFAULT_AVATAR[gender] };
  for (const s of SECTIONS) {
    const v = o[s.key];
    if (choicesFor(s.key, gender).some((c) => c.value === v))
      (a[s.key] as string) = v as string;
  }
  return a;
}

/** Options for DiceBear avataaars (a "none" part is drawn with probability 0). */
export function diceBearOptions(a: AvatarParts) {
  const has = (v: string) => v !== NONE;
  return {
    seed: "otoch",
    style: ["circle" as const],
    backgroundColor: [a.backgroundColor],
    skinColor: [a.skinColor],
    top: [has(a.top) ? a.top : "shortFlat"],
    topProbability: has(a.top) ? 100 : 0,
    hairColor: [a.hairColor],
    hatColor: [a.clothesColor],
    facialHair: [has(a.facialHair) ? a.facialHair : "beardLight"],
    facialHairProbability: has(a.facialHair) ? 100 : 0,
    facialHairColor: [a.hairColor],
    eyes: [a.eyes],
    eyebrows: [a.eyebrows],
    mouth: [a.mouth],
    accessories: [has(a.accessories) ? a.accessories : "round"],
    accessoriesProbability: has(a.accessories) ? 100 : 0,
    accessoriesColor: ["262e33"],
    clothing: [a.clothing],
    clothesColor: [a.clothesColor],
    clothingGraphic: ["bear"],
  };
}
