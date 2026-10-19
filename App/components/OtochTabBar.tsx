import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { House, CalendarDays, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlobTabBar } from "./foonto/BlobTabBar";
import { theme } from "@/design/theme";

type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const tabs = [
  { key: "index", label: "Нүүр", Icon: House },
  { key: "orders", label: "Захиалга", Icon: CalendarDays },
  { key: "profile", label: "Профайл", Icon: UserRound },
];
export function OtochTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const current = state.routes[state.index].name;
  const activeKey =
    current === "records" || current === "add-parent"
      ? "profile"
      : current === "bookappointment"
        ? "orders"
        : current;
  return (
    <View
      style={{
        backgroundColor: theme.color.background,
        paddingTop: 10,
        paddingBottom: Math.max(10, insets.bottom),
        paddingLeft: Math.max(16, insets.left),
        paddingRight: Math.max(16, insets.right),
      }}
    >
      <BlobTabBar
        tabs={tabs.map(({ key, label, Icon }) => ({
          key,
          label,
          icon: (active) => (
            <Icon
              size={24}
              strokeWidth={active ? 2.5 : 1.8}
              color={active ? theme.color.brand : theme.color.secondary}
            />
          ),
        }))}
        activeKey={activeKey}
        color={theme.color.brand}
        inactiveColor={theme.color.secondary}
        pillColor={theme.color.info}
        background={theme.color.background}
        height={Math.max(76, 44 + 24 * fontScale)}
        style={{
          borderColor: theme.color.border,
          shadowColor: theme.color.navy,
          shadowOpacity: 0.08,
        }}
        onChange={(key) => {
          const route = state.routes.find((r) => r.name === key);
          if (!route) return;
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (current !== key && !event.defaultPrevented)
            navigation.navigate(route.name, route.params);
        }}
        onLongPress={(key) => {
          const route = state.routes.find((r) => r.name === key);
          if (route)
            navigation.emit({ type: "tabLongPress", target: route.key });
        }}
      />
    </View>
  );
}
