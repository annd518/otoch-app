import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../../components/AppText'
import { Button } from '../../../components/Button'
import { ErrorBox } from '../../../components/ErrorBox'
import { Field } from '../../../components/Field'
import { ErrorState, Skeleton } from '../../../components/ScreenState'
import { SignaturePad, type SignaturePadHandle } from '../../../components/SignaturePad'
import { theme } from '../../../design/theme'
import { useOrder } from '../../../hooks/useOrder'
import { useVisitRecord, type SaveState } from '../../../hooks/useVisitRecord'
import { http } from '../../../services/http'
import { finish } from '../../../services/nurseVisit'
import { serviceSummary } from '../../../utils/orderView'
import { VITAL_FIELDS } from '../../../utils/vitals'
import { MEDICATION_CHECKS, PROCEDURES, missingForFinish, suggestedProcedures } from '../../../utils/visitRecord'

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Автоматаар хадгалагдана',
  saving: 'Хадгалж байна…',
  saved: 'Хадгалагдсан',
  error: 'Хадгалж чадсангүй',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: theme.space[2] }}>
      <AppText variant="label" color={theme.color.navy}>
        {title}
      </AppText>
      {children}
    </View>
  )
}

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { order, state, error, busy, load, run } = useOrder(id)

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (state === 'loading' || (!order && state !== 'error')) {
    return (
      <SafeAreaView style={{ flex: 1, padding: theme.space[3] }}>
        <Stack.Screen options={{ headerShown: true, title: 'Эргэлтийн тэмдэглэл' }} />
        <Skeleton rows={3} />
      </SafeAreaView>
    )
  }
  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: true, title: 'Эргэлтийн тэмдэглэл' }} />
        <ErrorState message={error ?? ''} onRetry={() => void load()} />
      </SafeAreaView>
    )
  }

  return (
    <RecordForm
      orderId={id}
      serviceCodes={order.items.map((i) => i.serviceCode)}
      summary={serviceSummary(order)}
      hasMedication={order.medication !== null}
      status={order.status}
      busy={busy}
      onFinish={(signerName, signature) =>
        run((o) => finish(http, o.id, { version: o.version, signerName, signature }))
      }
      onDone={() => router.replace('/')}
    />
  )
}

function RecordForm(props: {
  orderId: string
  serviceCodes: string[]
  summary: string
  hasMedication: boolean
  status: string
  busy: boolean
  onFinish: (signerName: string, signature: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onDone: () => void
}) {
  const record = useVisitRecord(props.orderId, props.hasMedication)
  const pad = useRef<SignaturePadHandle>(null)
  const [signer, setSigner] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  const suggested = suggestedProcedures(props.serviceCodes)
  const vitalsOk = Object.keys(record.vitals.errors).length === 0
  const missing = [
    ...missingForFinish({
      vitals: record.vitals.values,
      procedures: record.procedures,
      hasMedication: props.hasMedication,
      medicationChecks: record.checks,
      signerName: signer,
      hasSignature: hasInk,
    }),
    ...(vitalsOk ? [] : ['Амин үзүүлэлтийн алдааг засна уу']),
  ]

  async function submit() {
    setMessage(null)
    setFinishing(true)
    try {
      if (!(await record.flush())) {
        setMessage('Тэмдэглэлийг хадгалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.')
        return
      }
      const png = await pad.current?.toPng()
      if (!png) {
        setMessage('Гарын үсэг зурна уу.')
        return
      }
      const outcome = await props.onFinish(signer.trim(), png)
      if (outcome.ok) props.onDone()
      else setMessage(outcome.message)
    } finally {
      setFinishing(false)
    }
  }

  function confirmFinish() {
    Alert.alert('Эргэлт дуусгах уу?', 'Гарын үсэгтэй тэмдэглэл хадгалагдаж, дараа нь өөрчлөх боломжгүй.', [
      { text: 'Болих', style: 'cancel' },
      { text: 'Дуусгах', onPress: () => void submit() },
    ])
  }

  if (props.status !== 'IN_PROGRESS') {
    return (
      <SafeAreaView style={{ flex: 1, padding: theme.space[3] }}>
        <Stack.Screen options={{ headerShown: true, title: 'Эргэлтийн тэмдэглэл' }} />
        <AppText>Энэ захиалгад тэмдэглэл бөглөх боломжгүй байна.</AppText>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Эргэлтийн тэмдэглэл', headerBackTitle: 'Буцах' }} />
      <ScrollView
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.space[3], gap: theme.space[4] }}
      >
        <View style={{ gap: theme.space[0] }}>
          <AppText variant="heading" color={theme.color.navy}>
            {props.summary}
          </AppText>
          <AppText
            variant="caption"
            accessibilityLiveRegion="polite"
            color={record.saveState === 'error' ? theme.color.error : theme.color.secondary}
          >
            {SAVE_LABEL[record.saveState]}
            {record.saveError ? ` · ${record.saveError}` : ''}
          </AppText>
        </View>

        {record.loadError ? <ErrorBox message={`Хадгалсан тэмдэглэлийг ачаалж чадсангүй: ${record.loadError}`} /> : null}

        <Section title="Амин үзүүлэлт">
          {VITAL_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              unit={f.unit}
              keyboardType={f.integer ? 'number-pad' : 'decimal-pad'}
              value={record.vitalsText[f.key]}
              onChangeText={(v) => record.setVital(f.key, v)}
              error={record.vitals.errors[f.key]}
            />
          ))}
        </Section>

        <Section title="Хийсэн ажилбар">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[1] }}>
            {PROCEDURES.map((p) => {
              const on = record.procedures.includes(p.code)
              return (
                <Pressable
                  key={p.code}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => record.toggleProcedure(p.code)}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    paddingHorizontal: theme.space[3],
                    borderRadius: theme.radius.small,
                    borderWidth: 1,
                    borderColor: on ? theme.color.brand : theme.color.border,
                    backgroundColor: on ? theme.color.info : theme.color.background,
                  }}
                >
                  <AppText variant="label" color={on ? theme.color.brand : theme.color.text}>
                    {p.label}
                    {suggested.includes(p.code) ? ' ★' : ''}
                  </AppText>
                </Pressable>
              )
            })}
          </View>
          {suggested.length > 0 ? (
            <AppText variant="caption" color={theme.color.secondary}>
              ★ захиалсан үйлчилгээнд тохирох ажилбар
            </AppText>
          ) : null}
        </Section>

        {props.hasMedication ? (
          <Section title="Эм, заалт шалгах (5 зөв)">
            {MEDICATION_CHECKS.map((c) => (
              <View
                key={c.key}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <AppText style={{ flex: 1 }}>{c.label}</AppText>
                <Switch
                  accessibilityLabel={c.label}
                  value={record.checks[c.key]}
                  onValueChange={(v) => record.setCheck(c.key, v)}
                  trackColor={{ true: theme.color.brand }}
                />
              </View>
            ))}
            <AppText variant="caption" color={theme.color.secondary}>
              Таарахгүй бол «Татгалзах» дэлгэцээс шалтгаанаа сонгоно.
            </AppText>
          </Section>
        ) : null}

        <Section title="Тэмдэглэл">
          <Field
            label="Ажиглалт, хүндрэл"
            multiline
            numberOfLines={4}
            maxLength={2000}
            textAlignVertical="top"
            style={{ minHeight: 110 }}
            value={record.note}
            onChangeText={record.setNote}
          />
        </Section>

        <Section title="Үйлчлүүлэгчийн гарын үсэг">
          <Field label="Гарын үсэг зурсан хүний нэр" value={signer} onChangeText={setSigner} autoCapitalize="words" />
          <SignaturePad ref={pad} onInkChange={setHasInk} onDrawing={(d) => setScrollEnabled(!d)} />
          <Button label="Гарын үсэг арилгах" variant="secondary" onPress={() => pad.current?.clear()} />
        </Section>

        {message ? <ErrorBox message={message} /> : null}
        {missing.length > 0 ? (
          <View style={{ gap: theme.space[0] }}>
            {missing.map((m) => (
              <AppText key={m} variant="caption" color={theme.color.warning}>
                • {m}
              </AppText>
            ))}
          </View>
        ) : null}
        <Button
          label="Эргэлт дуусгах"
          loading={finishing || props.busy}
          disabled={missing.length > 0}
          onPress={confirmFinish}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
