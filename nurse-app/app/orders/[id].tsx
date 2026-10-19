import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Linking, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { ErrorState, OfflineBanner, Skeleton } from '../../components/ScreenState'
import { StatusBadge } from '../../components/StatusBadge'
import { theme } from '../../design/theme'
import { useOrder } from '../../hooks/useOrder'
import {
  availableActions,
  ETA_CHOICES_MIN,
  etaFromNow,
  formatSchedule,
  formatUbDateTime,
  serviceSummary,
} from '../../utils/orderView'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        gap: theme.space[1],
        padding: theme.space[3],
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.color.border,
      }}
    >
      <AppText variant="caption" color={theme.color.secondary}>
        {title}
      </AppText>
      {children}
    </View>
  )
}

function openMap(lat: number | null, lng: number | null, text: string) {
  const query = encodeURIComponent(text)
  const url =
    lat !== null && lng !== null
      ? Platform.OS === 'ios'
        ? `maps:?ll=${lat},${lng}&q=${query}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${query})`
      : Platform.OS === 'ios'
        ? `maps:?q=${query}`
        : `geo:0,0?q=${query}`
  void Linking.openURL(url).catch(() => Alert.alert('Газрын зураг нээж чадсангүй'))
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { order, state, error, busy, load, act } = useOrder(id)
  const [actionError, setActionError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function run(action: 'eta' | 'start' | 'complete', extra: { eta?: string | null } = {}) {
    setActionError(null)
    const outcome = await act(action, extra)
    if (!outcome.ok) setActionError(outcome.message)
  }

  function confirm(title: string, message: string, onYes: () => void) {
    Alert.alert(title, message, [{ text: 'Болих', style: 'cancel' }, { text: 'Тийм', onPress: onYes }])
  }

  const actions = order ? availableActions(order.status) : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Дуудлага', headerBackTitle: 'Буцах' }} />
      <ScrollView contentContainerStyle={{ padding: theme.space[3], gap: theme.space[2] }}>
        {state === 'loading' ? <Skeleton /> : null}
        {state === 'error' ? <ErrorState message={error ?? ''} onRetry={() => void load()} /> : null}

        {order ? (
          <>
            {error ? <OfflineBanner message={error} /> : null}
            <View style={{ gap: theme.space[1] }}>
              <AppText variant="heading" color={theme.color.navy}>
                {serviceSummary(order)}
              </AppText>
              <StatusBadge status={order.status} />
              {order.isMock ? (
                <AppText variant="caption" color={theme.color.warning}>
                  Туршилтын захиалга
                </AppText>
              ) : null}
            </View>

            <Section title="Цаг">
              <AppText>{formatSchedule(order)}</AppText>
              {order.eta ? (
                <AppText variant="caption" color={theme.color.secondary}>
                  Таны ETA: {formatUbDateTime(order.eta) ?? order.eta}
                </AppText>
              ) : null}
            </Section>

            <Section title="Үйлчлүүлэгч">
              <AppText variant="label">{order.patientName || 'Нэр байхгүй'}</AppText>
              <AppText variant="caption" color={theme.color.secondary}>
                {order.familyPresent ? 'Гэр бүлийн гишүүн байх болно' : 'Гэр бүлийн гишүүн байхгүй'}
                {order.postoperative ? ' · Мэс заслын дараах' : ''}
              </AppText>
            </Section>

            {order.address ? (
              <Section title="Хаяг">
                <AppText>{order.address.text}</AppText>
                <Button
                  label="Газрын зураг нээх"
                  variant="secondary"
                  onPress={() => openMap(order.address!.lat, order.address!.lng, order.address!.text)}
                />
              </Section>
            ) : null}

            <Section title="Эм, заалт">
              {order.medication ? (
                <>
                  <AppText variant="label">{order.medication.name}</AppText>
                  <AppText variant="caption">
                    Тун: {order.medication.dose} · Арга: {order.medication.route}
                    {order.medication.doseNumber !== null ? ` · ${order.medication.doseNumber}-р тун` : ''}
                  </AppText>
                  <AppText variant="caption" color={theme.color.secondary}>
                    Хадгалах хугацаа: {order.medication.expiresAt}
                  </AppText>
                </>
              ) : (
                <AppText variant="caption" color={theme.color.secondary}>
                  Эмийн мэдээлэл бүртгээгүй.
                </AppText>
              )}
              {order.referralText ? <AppText variant="caption">Заалт: {order.referralText}</AppText> : null}
              {order.attachmentCount > 0 ? (
                <AppText variant="caption" color={theme.color.secondary}>
                  Заалтын зураг: {order.attachmentCount} (зургийг харах боломж серверт хараахан нэмэгдээгүй)
                </AppText>
              ) : null}
              <AppText variant="caption" color={theme.color.secondary}>
                Эмийг үйлчлүүлэгч бэлдсэн. Нэр, тун, арга, хадгалах хугацааг газар дээр нь шалгана.
              </AppText>
            </Section>

            {order.notes ? (
              <Section title="Тэмдэглэл">
                <AppText>{order.notes}</AppText>
              </Section>
            ) : null}

            {actions?.setEta ? (
              <Section title="Ирэх хугацаа (ETA)">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[1] }}>
                  {ETA_CHOICES_MIN.map((minutes) => (
                    <Button
                      key={minutes}
                      label={`${minutes} мин`}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => void run('eta', { eta: etaFromNow(minutes, Date.now()) })}
                    />
                  ))}
                  {order.eta ? (
                    <Button label="ETA арилгах" variant="secondary" disabled={busy} onPress={() => void run('eta', { eta: null })} />
                  ) : null}
                </View>
              </Section>
            ) : null}

            {actionError ? (
              <View
                accessibilityRole="alert"
                style={{ backgroundColor: theme.color.errorBg, borderRadius: theme.radius.small, padding: theme.space[3] }}
              >
                <AppText variant="caption" color={theme.color.error}>
                  {actionError}
                </AppText>
              </View>
            ) : null}

            {actions?.start ? (
              <Button
                label="Эргэлт эхлүүлэх"
                loading={busy}
                onPress={() => confirm('Эргэлт эхлүүлэх үү?', 'Үйлчлүүлэгчтэй уулзсан, эм заалтыг шалгасан бол эхлүүлнэ.', () => void run('start'))}
              />
            ) : null}
            {actions?.complete ? (
              <Button
                label="Эргэлт дуусгах"
                loading={busy}
                onPress={() => confirm('Эргэлт дуусгах уу?', 'Дуусгасны дараа буцаах боломжгүй.', () => void run('complete'))}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
