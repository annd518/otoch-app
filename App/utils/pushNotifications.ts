// Asks for notification permission, gets this phone's Expo push token and hands
// it to the server; opens the right screen when a notification is tapped.
// An Expo push token needs the EAS project ID (app.json extra.eas.projectId,
// written by `eas init`). Without it, or on a simulator, push stays off and the
// app works as before.
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import type { ApiResult } from '../services/apiResult'
import { pushTarget, type PushApp } from '../services/push'

// Shown as a banner while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export type PushSetup = { ok: true } | { ok: false; reason: 'simulator' | 'denied' | 'no-project-id' | 'token-failed' | 'server' }

// The token this phone registered in this run, so sign-out can remove it.
let registered: string | null = null
// A notification opens its screen once, even when the layout mounts again.
let lastOpened: string | null = null

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
  Constants.easConfig?.projectId

export async function enablePush(
  app: PushApp,
  register: (device: { token: string; app: PushApp; platform: 'ios' | 'android' }) => Promise<ApiResult<true>>,
): Promise<PushSetup> {
  if (!Device.isDevice) return { ok: false, reason: 'simulator' }
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Мэдэгдэл',
      importance: Notifications.AndroidImportance.HIGH,
    })
  let status = (await Notifications.getPermissionsAsync()).status
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return { ok: false, reason: 'denied' }
  const id = projectId()
  if (!id) return { ok: false, reason: 'no-project-id' }
  let token: string
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data
  } catch {
    return { ok: false, reason: 'token-failed' }
  }
  const r = await register({ token, app, platform: Platform.OS === 'ios' ? 'ios' : 'android' })
  if (!r.ok) return { ok: false, reason: 'server' }
  registered = token
  return { ok: true }
}

/** Sign-out: this phone stops getting this account's notifications. Never throws. */
export async function disablePush(unregister: (token: string) => Promise<ApiResult<true>>): Promise<void> {
  const token = registered
  registered = null
  if (!token) return
  try {
    await unregister(token)
  } catch {
    // signing out never waits on this
  }
}

/** Opens the screen of a tapped notification, also when it started the app. */
export function usePushNavigation(app: PushApp, open: (path: string) => void) {
  useEffect(() => {
    const go = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.notification.request.identifier === lastOpened) return
      lastOpened = response.notification.request.identifier
      const path = pushTarget(response.notification.request.content.data, app)
      if (path) open(path)
    }
    void Notifications.getLastNotificationResponseAsync().then(go)
    const sub = Notifications.addNotificationResponseReceivedListener(go)
    return () => sub.remove()
  }, [app, open])
}
