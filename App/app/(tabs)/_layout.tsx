import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from "@expo/vector-icons"
import Entypo from "@expo/vector-icons/Entypo"

import FontAwesome from "@expo/vector-icons/FontAwesome"

import { storage } from '@/utils/storage';

type AuthState = 'checking' | 'signed_in' | 'signed_out'

export default function TabLayout() {
  const [authState, setAuthState] = useState<AuthState>('checking')

  // Tabs are only for signed-in users. Header visibility is already set by the
  // root Stack (screenOptions.headerShown = false).
  useEffect(() => {
    let active = true
    storage.getValidSession().then((session) => {
      if (active) setAuthState(session ? 'signed_in' : 'signed_out')
    })
    return () => {
      active = false
    }
  }, [])

  if (authState === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2f80ed" />
      </View>
    )
  }
  if (authState === 'signed_out') {
    return <Redirect href="/auth/login" />
  }

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
