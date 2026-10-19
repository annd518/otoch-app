import { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
interface BlobTabBarProps {
  tabs: {
    key: string;
    label?: string;
    icon?: (active: boolean) => ReactNode;
  }[];
  activeKey: string;
  onChange: (key: string) => void;
  onLongPress?: (key: string) => void;
  color?: string;
  inactiveColor?: string;
  pillColor?: string;
  pillWidthRatio?: number;
  pillRadius?: number;
  background?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}
// Adapted from joeyjoy007/react-native-foonto BlobTabBar (MIT; see LICENSE).

/**
 * An Instagram-style bottom tab bar: a glassy rounded pill with a soft gray
 * highlight that tracks the active tab. Pass `indicatorIndex` (a pager's
 * fractional scroll position) to make the highlight follow a swipe in real
 * time; otherwise it eases with timing — no spring overshoot.
 */
export function BlobTabBar({
  tabs,
  activeKey,
  onChange,
  onLongPress,
  color = "#111111",
  inactiveColor = "#9ca3af",
  pillColor = "rgba(0,0,0,0.06)",
  pillWidthRatio = 0.82,
  pillRadius = 999,
  background = "rgba(255,255,255,0.8)",
  height = 60,
  style,
}: BlobTabBarProps) {
  const [width, setWidth] = useState(0);
  const tabWidth = width / Math.max(tabs.length, 1);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === activeKey),
  );

  // Eased position used when no external indicator is driving the pill.
  const pos = useSharedValue(activeIndex);
  useEffect(() => {
    {
      pos.value = withTiming(activeIndex, { duration: 220 });
    }
  }, [activeIndex, pos]);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const pillStyle = useAnimatedStyle(() => {
    const index = pos.value;
    return {
      width: tabWidth,
      transform: [{ translateX: index * tabWidth }],
      opacity: width > 0 ? 1 : 0,
    };
  });

  return (
    <View
      onLayout={onLayout}
      style={[styles.bar, { height, backgroundColor: background }, style]}
    >
      <Animated.View style={[styles.pillWrap, pillStyle]} pointerEvents="none">
        <View
          style={[
            styles.pill,
            {
              backgroundColor: pillColor,
              width: `${pillWidthRatio * 100}%`,
              borderRadius: pillRadius,
            },
          ]}
        />
      </Animated.View>

      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            onLongPress={() => onLongPress?.(tab.key)}
            accessibilityLabel={tab.label}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {tab.icon?.(active)}
            {tab.label ? (
              <Text
                style={[
                  styles.label,
                  { color: active ? color : inactiveColor },
                ]}
              >
                {tab.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pillWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  pill: {
    height: "72%",
  },
  tab: {
    flex: 1,
    minHeight: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "NotoSans_600SemiBold",
    textAlign: "center",
  },
});
