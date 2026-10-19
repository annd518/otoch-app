// Pure helpers for the ОТОЧ wordmark in texts (components/BrandText.tsx).
export const RATIO = 654 / 183; // @3x size of the wordmark

export const BRAND_TOKEN = "OTOCH";

/** What a screen reader says for a text with the brand in it. */
export function brandLabel(text: string): string {
  return text.split(BRAND_TOKEN).join("ОТОЧ");
}

/** The inline size of the wordmark for a font size (cap height + a bit). */
export function brandSize(fontSize: number) {
  const height = Math.round(fontSize * 0.86);
  return { width: Math.round(height * RATIO), height };
}
