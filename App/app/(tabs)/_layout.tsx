import { Redirect, Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { House, CalendarDays, FileText, UserRound } from "lucide-react-native";
import { storage } from "@/utils/storage";
import { theme } from "@/design/theme";
import { StateView } from "@/components/ui";
export default function TabLayout() {
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  useEffect(() => {
    let active = true;
    void storage.getValidSession().then((s) => {
      if (active) setAuth(s ? "in" : "out");
    });
    return () => {
      active = false;
    };
  }, []);
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
        tabBarInactiveTintColor: theme.color.secondary,
        tabBarStyle: { minHeight: 64 },
        tabBarLabelStyle: { fontFamily: "NotoSans_600SemiBold", fontSize: 14 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Нүүр",
          tabBarIcon: ({ color }) => <House size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Захиалга",
          tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Тэмдэглэл",
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Нүүр хуудас",
          tabBarIcon: ({ color }) => <UserRound size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="bookappointment" options={{ href: null }} />
      <Tabs.Screen name="add-parent" options={{ href: null }} />
    </Tabs>
  );
}
