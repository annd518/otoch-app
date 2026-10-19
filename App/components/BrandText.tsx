// The brand name drawn in the designer's ОТОЧ lettering. The lettering is a
// picture (assets/brand/otoch-wordmark.png, cut from the splash logo), not a
// font, so every "OTOCH" in a text is replaced by that picture inline.
import React from "react";
import { Image } from "react-native";

import { BRAND_TOKEN, brandSize } from "../utils/brand";

export { brandLabel } from "../utils/brand";

const WORDMARK = require("../assets/brand/otoch-wordmark.png");

/**
 * Text children with every "OTOCH" drawn as the ОТОЧ wordmark in `color`.
 * Put the result inside a <Text> and give that Text
 * accessibilityLabel={brandLabel(text)}.
 */
export function withBrand(
  text: string,
  fontSize: number,
  color: string,
): React.ReactNode {
  const parts = text.split(BRAND_TOKEN);
  if (parts.length === 1) return text;
  const size = brandSize(fontSize);
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <Image
            key={`brand-${i}`}
            source={WORDMARK}
            resizeMode="contain"
            style={{ ...size, tintColor: color }}
          />,
          part,
        ],
  );
}
