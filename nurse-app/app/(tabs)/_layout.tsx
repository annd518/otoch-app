import { Tabs } from 'expo-router'
import { ClipboardList, User } from 'lucide-react-native'

import { theme } from '../../design/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.secondary,
        tabBarLabelStyle: { ...theme.type.caption },
        tabBarStyle: { borderTopColor: theme.color.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Дуудлага',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профайл',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
