import { Tabs, useNavigation } from 'expo-router';
import React, { useEffect } from 'react';
import { Ionicons } from "@expo/vector-icons"
import Entypo from "@expo/vector-icons/Entypo"

import FontAwesome from "@expo/vector-icons/FontAwesome"




export default function TabLayout() {
  const navigation = useNavigation()


  useEffect(() => {
    navigation.setOptions({
      headerShown:false
    })
  },[])

  return (
    <Tabs screenOptions={{}}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Нүүр",
          tabBarIcon: ({ color, size }) => (
            <Entypo name="home" size={size} color={color} />
          ),
          headerShown: false,
          // tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="bookappointment"
        options={{
          title: "Захиалга",
          headerShown: false,

          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="add-parent"
        options={{
          title: "Өвчтөн нэмэх",
          tabBarIcon: ({ color, size }) => (
            <Entypo name="add-user" size={size} color={ color} />
          ),
          headerShown: false,

          // tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Профайл",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
          headerShown: false,

          // tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  )
}
