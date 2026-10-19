import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../../components/AppText'
import { Button } from '../../../components/Button'
import { ErrorBox } from '../../../components/ErrorBox'
import { Field } from '../../../components/Field'
import { theme } from '../../../design/theme'
import { useOrder } from '../../../hooks/useOrder'
import { http } from '../../../services/http'
import { REJECT_REASONS, reject, type RejectReason } from '../../../services/nurseVisit'
import { REJECT_LABELS } from '../../../utils/visitRecord'

export default function RejectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { order, busy, load, run } = useOrder(id)
  const [reason, setReason] = useState<RejectReason | null>(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function submit() {
    if (!reason) return
    setMessage(null)
    const outcome = await run((o) =>
      reject(http, o.id, { version: o.version, reason, ...(comment.trim() && { comment: comment.trim() }) }),
    )
    if (outcome.ok) router.replace('/')
    else setMessage(outcome.message)
  }

  function confirm() {
    Alert.alert('Татгалзах уу?', 'Захиалга «Татгалзсан» болж, админ руу шилжинэ. Буцаах боломжгүй.', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Татгалзах', style: 'destructive', onPress: () => void submit() },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Татгалзах', headerBackTitle: 'Буцах' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.space[3], gap: theme.space[2] }}>
        <AppText color={theme.color.secondary}>
          {order ? `${order.patientName} · ` : ''}Шалтгаанаа сонгоно уу. Хийх боломжтой хэсгийг (жишээ нь амин үзүүлэлт) хийж болно.
        </AppText>
        {REJECT_REASONS.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === r }}
            onPress={() => setReason(r)}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              padding: theme.space[3],
              borderRadius: theme.radius.small,
              borderWidth: 1,
              borderColor: reason === r ? theme.color.brand : theme.color.border,
              backgroundColor: reason === r ? theme.color.info : theme.color.background,
            }}
          >
            <AppText variant="label">{REJECT_LABELS[r]}</AppText>
          </Pressable>
        ))}
        <Field
          label="Нэмэлт тайлбар (заавал биш)"
          multiline
          maxLength={500}
          textAlignVertical="top"
          style={{ minHeight: 90 }}
          value={comment}
          onChangeText={setComment}
        />
        {message ? <ErrorBox message={message} /> : null}
        <View>
          <Button label="Татгалзах" loading={busy} disabled={!reason || !order} onPress={confirm} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
