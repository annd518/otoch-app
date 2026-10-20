import { Pressable, View } from "react-native";

import { theme } from "../design/theme";
import { UB_DISTRICTS } from "../utils/districts";
import { AppText } from "./AppText";

// Ulaanbaatar districts the nurse works in; any number can be chosen.
export function DistrictPicker({
  value,
  onChange,
  disabled,
}: {
  value: readonly string[];
  onChange(next: string[]): void;
  disabled?: boolean;
}) {
  const toggle = (d: string) =>
    onChange(
      // kept in the fixed list order
      UB_DISTRICTS.filter((x) => (x === d ? !value.includes(d) : value.includes(x))),
    );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space[2] }}>
      {UB_DISTRICTS.map((d) => {
        const on = value.includes(d);
        return (
          <Pressable
            key={d}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            onPress={() => toggle(d)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: theme.space[3],
              borderRadius: theme.radius.round,
              borderWidth: 1,
              borderColor: on ? theme.color.brand : theme.color.border,
              backgroundColor: on ? theme.color.brand : theme.color.background,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <AppText variant="label" color={on ? theme.color.onBrand : theme.color.text}>
              {on ? `✓ ${d}` : d}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
