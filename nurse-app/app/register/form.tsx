import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { CheckRow } from '../../components/CheckRow'
import { ErrorBox } from '../../components/ErrorBox'
import { Field } from '../../components/Field'
import { ScreenHeader } from '../../components/ScreenHeader'
import { theme } from '../../design/theme'
import { submitApplication } from '../../services/applications'
import { http } from '../../services/http'
import { DECLARATIONS, validateApplication, type ApplicationErrors } from '../../utils/registration'

export default function RegisterFormScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [licenseNo, setLicenseNo] = useState('')
  const [experience, setExperience] = useState('')
  const [declared, setDeclared] = useState({ license: false, experience: false, scope: false })
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const result = validateApplication({ name, phoneDigits, licenseNo, experience, declarations: declared })
  const errors: ApplicationErrors = result.ok ? {} : result.errors
  // Show a field's error once the nurse has pressed the button, not while typing.
  const shown = touched ? errors : {}

  async function submit() {
    setTouched(true)
    if (!result.ok || busy) return
    setBusy(true)
    setMessage(null)
    const response = await submitApplication(http, result.value)
    setBusy(false)
    if (!response.ok) {
      setMessage(response.message)
      return
    }
    router.replace({ pathname: '/register/done', params: { name: result.value.name, phone: result.value.phone } })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <ScreenHeader fallback="/register" action={{ label: 'Нэвтрэх', onPress: () => router.replace('/login') }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.space[3], gap: theme.space[3] }}>
          <View style={{ gap: theme.space[1] }}>
            <AppText variant="title" color={theme.color.navy}>
              Бүртгүүлэх
            </AppText>
            <AppText color={theme.color.secondary} style={{ fontSize: 16, lineHeight: 24 }}>
              Та ОТОЧ-той хамтран ажиллахад бэлэн үү? Мэдээллээ үнэн зөв бөглөнө үү.
            </AppText>
          </View>

          <Field label="Овог, нэр" autoComplete="name" textContentType="name" value={name} onChangeText={setName} error={shown.name} />
          <Field
            label="Утасны дугаар"
            unit="+976"
            keyboardType="number-pad"
            autoComplete="tel"
            maxLength={8}
            value={phoneDigits}
            onChangeText={(v) => setPhoneDigits(v.replace(/\D/g, ''))}
            error={shown.phone}
          />
          <Field
            label="Мэргэжлийн үйл ажиллагаа эрхлэх зөвшөөрлийн дугаар"
            autoCapitalize="characters"
            maxLength={40}
            value={licenseNo}
            onChangeText={setLicenseNo}
            error={shown.licenseNo}
          />
          <Field
            label="Мэргэжлээрээ ажилласан жил"
            keyboardType="number-pad"
            maxLength={2}
            value={experience}
            onChangeText={(v) => setExperience(v.replace(/\D/g, ''))}
            error={shown.experience}
          />

          <View style={{ gap: theme.space[0] }}>
            <AppText variant="label">Дараах нөхцөлийг баталгаажуулна уу</AppText>
            {DECLARATIONS.map((d) => (
              <CheckRow
                key={d.key}
                text={d.text}
                checked={declared[d.key]}
                onToggle={() => setDeclared((s) => ({ ...s, [d.key]: !s[d.key] }))}
              />
            ))}
            {shown.declarations ? (
              <AppText variant="caption" color={theme.color.error}>
                {shown.declarations}
              </AppText>
            ) : null}
          </View>

          {message ? <ErrorBox message={message} /> : null}
        </ScrollView>

        <View style={{ backgroundColor: theme.color.subtle, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2] }}>
          <AppText variant="caption" color={theme.color.secondary} style={{ textAlign: 'center' }}>
            «Өргөдөл илгээх» товчийг дарснаар та Үйлчилгээний нөхцөл болон Нууцлалын бодлогыг зөвшөөрч байна.
          </AppText>
        </View>
        <View style={{ padding: theme.space[3], paddingTop: theme.space[2] }}>
          <Button label="Өргөдөл илгээх" loading={busy} disabled={!result.ok && touched} onPress={() => void submit()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
