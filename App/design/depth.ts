import type { ViewStyle } from "react-native";

// Native RN 0.86 boxShadow parser supports multiple/inset shadows in Fabric.
// Strings also satisfy RN Web TextInput's CSSProperties-based style typing.
// Older Android OSes can omit inset shadows; visible borders/fills remain.
export const depth = {
  raised: { boxShadow: "6px 6px 16px #D1D9E6, -6px -6px 16px #FFFFFF" },
  soft: { boxShadow: "3px 4px 10px #D1D9E6, -3px -3px 10px #FFFFFF" },
  inset: {
    boxShadow: "inset 2px 2px 5px #D1D9E6, inset -2px -2px 5px #FFFFFF",
  },
  action: { boxShadow: "0px 7px 16px rgba(11,79,165,0.24)" },
  flat: { boxShadow: "none" },
} satisfies Record<string, ViewStyle>;
