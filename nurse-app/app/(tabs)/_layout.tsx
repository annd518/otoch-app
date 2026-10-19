import { Tabs } from "expo-router";
import { ClipboardList, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { View, useWindowDimensions } from "react-native";
import { AppText } from "../../components/AppText";
import { theme } from "../../design/theme";

// The default tab bar is 49 px high, too short for an icon plus a 14/20 label (the label was
// cut off). Height includes the bottom safe-area inset. Labels now
// grow with the system font scale and the bar height grows with them.
const TAB_CONTENT_HEIGHT = 72;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.secondary,
        tabBarAllowFontScaling: true,
        tabBarLabel: ({ color, children }) => (
          <AppText
            variant="caption"
            style={{
              color,
              textAlign: "center",
              fontFamily: theme.type.label.fontFamily,
            }}
          >
            {children}
          </AppText>
        ),
        tabBarLabelStyle: {
          fontFamily: theme.type.caption.fontFamily,
          fontSize: 12,
          lineHeight: 16,
        },
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          ...theme.depth.soft,
          borderTopColor: theme.color.border,
          height:
            Math.max(TAB_CONTENT_HEIGHT, 32 + 36 * fontScale) + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Дуудлага",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                padding: 6,
                borderRadius: 16,
                backgroundColor: focused ? theme.color.info : "transparent",
                ...(focused ? theme.depth.inset : {}),
              }}
            >
              <ClipboardList color={color} size={size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Профайл",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                padding: 6,
                borderRadius: 16,
                backgroundColor: focused ? theme.color.info : "transparent",
                ...(focused ? theme.depth.inset : {}),
              }}
            >
              <User color={color} size={size} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
