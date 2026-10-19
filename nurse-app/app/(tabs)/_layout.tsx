import { Tabs } from 'expo-router'
import { ClipboardList, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { theme } from '../../design/theme'

// The default tab bar is 49 px high, too short for an icon plus a 14/20 label (the label was
// cut off). Height is set here and must include the bottom safe-area inset. Labels do not
// follow the system font scale: a larger label would not fit any fixed bar height, and the
// icon carries the meaning too.
const TAB_CONTENT_HEIGHT = 72

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.secondary,
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { fontFamily: theme.type.caption.fontFamily, fontSize: 12, lineHeight: 16 },
        tabBarStyle: {
          borderTopColor: theme.color.border,
          height: TAB_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
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
