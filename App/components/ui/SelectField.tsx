// A field that opens a list to pick one value (like a dropdown): tap the
// field, the list slides up, tap a row. Large rows for older users; the
// selected row has a check. Used for the district / khoroo on booking step 1.
import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown } from "lucide-react-native";

import { AppText as Text } from "@/components/AppText";
import { theme as t } from "@/design/theme";

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  placeholder = "Сонгох",
  onChange,
  disabled = false,
}: {
  label: string;
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? "сонгоогүй"}`}
        accessibilityHint="Жагсаалт нээнэ"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          t.depth.inset,
          { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text
          style={[styles.value, !current && { color: t.color.secondary }]}
          numberOfLines={1}
        >
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={22} color={t.color.brand} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityLabel="Хаах"
          onPress={() => setOpen(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {label}
          </Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[styles.rowText, selected && styles.rowTextSelected]}
                  >
                    {item.label}
                  </Text>
                  {selected && <Check size={22} color={t.color.brand} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const ROW = 56;
const styles = StyleSheet.create({
  label: { fontFamily: "NotoSans_600SemiBold", fontSize: 15, lineHeight: 24 },
  field: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  value: { flex: 1, fontSize: 16, color: t.color.text },
  backdrop: { flex: 1, backgroundColor: "rgba(14, 40, 75, 0.35)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: t.color.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: t.color.border,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: t.color.text,
    paddingVertical: 8,
  },
  row: {
    // rows grow with the system font size (never capped)
    minHeight: ROW,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: t.color.info },
  rowText: { fontSize: 17, color: t.color.text },
  rowTextSelected: { fontFamily: "NotoSans_600SemiBold", color: t.color.brand },
});
