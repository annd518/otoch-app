import { Redirect, Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { House, CalendarDays, FileText, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage } from "@/utils/storage";
import { theme } from "@/design/theme";
import { StateView, Copy } from "@/components/ui";
import { useBookingDraft } from "@/context/BookingDraftContext";
export default function TabLayout() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const { restore } = useBookingDraft();
  useEffect(() => {
    let active = true;
    void storage.getValidSession().then(async (s) => {
      // An unsaved booking from before an app restart comes back here.
      if (s) await restore();
      if (active) setAuth(s ? "in" : "out");
    });
    return () => {
      active = false;
    };
  }, [restore]);
  if (auth === "checking")
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <StateView title="Нэвтрэлтийг шалгаж байна" loading />
      </View>
    );
  if (auth === "out") return <Redirect href="/auth/phone" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarItemStyle: { paddingTop: 6 },
        tabBarInactiveTintColor: theme.color.secondary,
        tabBarStyle: {
          height: Math.max(72, 32 + 36 * fontScale) + insets.bottom,
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          ...theme.depth.soft,
        },
        tabBarLabelPosition: "below-icon",
        tabBarLabel: ({ color, children }) => (
          <Copy
            variant="caption"
            style={{
              color,
              fontFamily: "NotoSans_600SemiBold",
              fontSize: width < 360 ? 12 : 13,
              lineHeight: 18,
              textAlign: "center",
              paddingHorizontal: 2,
            }}
          >
            {children}
          </Copy>
        ),
        tabBarLabelStyle: { fontFamily: "NotoSans_600SemiBold", fontSize: 14 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Нүүр",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 5,
                borderRadius: 18,
                backgroundColor: focused ? theme.color.info : "transparent",
                ...(focused ? theme.depth.inset : theme.depth.flat),
              }}
            >
              <House
                size={23}
                strokeWidth={focused ? 2.3 : 1.7}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Захиалга",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 5,
                borderRadius: 18,
                backgroundColor: focused ? theme.color.info : "transparent",
                ...(focused ? theme.depth.inset : theme.depth.flat),
              }}
            >
              <CalendarDays
                size={23}
                strokeWidth={focused ? 2.3 : 1.7}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Тэмдэглэл",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 5,
                borderRadius: 18,
                backgroundColor: focused ? theme.color.info : "transparent",
                ...(focused ? theme.depth.inset : theme.depth.flat),
              }}
            >
              <FileText
                size={23}
                strokeWidth={focused ? 2.3 : 1.7}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Нүүр хуудас",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 5,
                borderRadius: 18,
                backgroundColor: focused ? theme.color.info : "transparent",
                ...(focused ? theme.depth.inset : theme.depth.flat),
              }}
            >
              <UserRound
                size={23}
                strokeWidth={focused ? 2.3 : 1.7}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="bookappointment" options={{ href: null }} />
      <Tabs.Screen name="add-parent" options={{ href: null }} />
    </Tabs>
  );
}
