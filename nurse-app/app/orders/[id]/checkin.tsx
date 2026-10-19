import * as Location from 'expo-location'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Linking, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../../components/AppText'
import { Button } from '../../../components/Button'
import { ErrorBox } from '../../../components/ErrorBox'
import { ErrorState, Skeleton } from '../../../components/ScreenState'
import { theme } from '../../../design/theme'
import { useOrder } from '../../../hooks/useOrder'
import { http } from '../../../services/http'
import { checkin } from '../../../services/nurseVisit'
import { formatSchedule } from '../../../utils/orderView'

const CONFIRMATIONS = [
  'Үйлчлүүлэгчийг таньж, зөвшөөрөл авсан',
  'Гар ариутгасан, бээлий өмссөн',
  'Эм, заалт, хадгалах хугацааг шалгасан',
] as const

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { order, state, error, busy, load, run } = useOrder(id)
  const [ticked, setTicked] = useState<boolean[]>([false, false, false])
  const [message, setMessage] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [locating, setLocating] = useState(false)

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function submit() {
    setMessage(null)
    setDenied(false)
    setLocating(true)
    let position: Location.LocationObject
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        setDenied(true)
        return
      }
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    } catch {
      setMessage('Байршлыг тодорхойлж чадсангүй. GPS асаалттай эсэхийг шалгаад дахин оролдоно уу.')
      return
    } finally {
      setLocating(false)
    }
    const outcome = await run((o) =>
      checkin(http, o.id, { version: o.version, lat: position.coords.latitude, lng: position.coords.longitude }),
    )
    if (outcome.ok) router.replace({ pathname: '/orders/[id]/record', params: { id } })
    else setMessage(outcome.message)
  }

  const allTicked = ticked.every(Boolean)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Ирсэн · check-in', headerBackTitle: 'Буцах' }} />
      <ScrollView contentContainerStyle={{ padding: theme.space[3], gap: theme.space[2] }}>
        {state === 'loading' ? <Skeleton rows={2} /> : null}
        {state === 'error' ? <ErrorState message={error ?? ''} onRetry={() => void load()} /> : null}
        {order ? (
          <>
            <AppText variant="heading" color={theme.color.navy}>
              {order.patientName}
            </AppText>
            <AppText color={theme.color.secondary}>
              {formatSchedule(order)}
              {order.address ? ` · ${order.address.text}` : ''}
            </AppText>
            <AppText variant="caption" color={theme.color.secondary}>
              Байршил үйлчлүүлэгчийн хаягаас 200 м-ийн дотор, товлосон цагаас ±30 минутын дотор байх ёстой.
            </AppText>

            <View style={{ gap: theme.space[1] }}>
              <AppText variant="label">Эхлэхийн өмнө</AppText>
              {CONFIRMATIONS.map((text, i) => (
                <Pressable
                  key={text}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ticked[i] }}
                  onPress={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))}
                  style={{
                    minHeight: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space[2],
                    padding: theme.space[2],
                    borderRadius: theme.radius.small,
                    borderWidth: 1,
                    borderColor: ticked[i] ? theme.color.brand : theme.color.border,
                    backgroundColor: ticked[i] ? theme.color.info : theme.color.background,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: theme.color.brand,
                      backgroundColor: ticked[i] ? theme.color.brand : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {ticked[i] ? <AppText variant="caption" color="#FFFFFF">✓</AppText> : null}
                  </View>
                  <AppText style={{ flex: 1 }}>{text}</AppText>
                </Pressable>
              ))}
            </View>

            {denied ? (
              <View style={{ gap: theme.space[1] }}>
                <ErrorBox message="Check-in хийхэд байршил шаардлагатай. Утасны тохиргооноос байршлын зөвшөөрөл өгнө үү." />
                <Button label="Тохиргоо нээх" variant="secondary" onPress={() => void Linking.openSettings()} />
              </View>
            ) : null}
            {message ? <ErrorBox message={message} /> : null}

            <Button
              label="Эргэлт эхлүүлэх"
              loading={busy || locating}
              disabled={!allTicked}
              onPress={() => void submit()}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
