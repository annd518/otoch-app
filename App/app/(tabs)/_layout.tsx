import { Redirect, Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { House, CalendarDays, UserRound } from "lucide-react-native";
import { OtochTabBar } from "@/components/OtochTabBar";
import { storage } from "@/utils/storage";
import { StateView } from "@/components/ui";
import { useBookingDraft } from "@/context/BookingDraftContext";
export default function TabLayout() {
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
      tabBar={(props) => <OtochTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
      <Tabs.Screen name="records" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Профайл",
          tabBarIcon: ({ color }) => <UserRound size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="bookappointment" options={{ href: null }} />
      <Tabs.Screen name="add-parent" options={{ href: null }} />
    </Tabs>
  );
}
