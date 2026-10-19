import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../components/AppText'
import { Button } from '../components/Button'
import { ErrorBox } from '../components/ErrorBox'
import { Field } from '../components/Field'
import { useSession } from '../context/SessionContext'
import { theme } from '../design/theme'
import { http } from '../services/http'
import { OTP_RESEND_SECONDS, requestOtp, type OtpChallenge } from '../services/otp'
import { toE164 } from '../utils/phone'

type Mode = 'phone' | 'email'

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('phone')
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: theme.space[5], gap: theme.space[3] }}
          keyboardShouldPersistTaps="handled"
        >
          <AppText variant="title" color={theme.color.navy}>
            ОТОЧ Сувилагч
          </AppText>
          <AppText color={theme.color.secondary}>Бүртгэлтэй сувилагчийн эрхээр нэвтэрнэ үү.</AppText>
          {mode === 'phone' ? <PhoneLogin /> : <EmailLogin />}
          <Button
            label={mode === 'phone' ? 'И-мэйлээр нэвтрэх' : 'Утасны дугаараар нэвтрэх'}
            variant="secondary"
            onPress={() => setMode(mode === 'phone' ? 'email' : 'phone')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function PhoneLogin() {
  const { signInWithOtp } = useSession()
  const [digits, setDigits] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const phone = toE164(digits)
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  async function send() {
    if (!phone || busy) return
    setBusy(true)
    setError(null)
    const result = await requestOtp(http, phone)
    if (result.ok) {
      setChallenge(result.data)
      setResendAt(Date.now() + (result.data.resendAfterSeconds || OTP_RESEND_SECONDS) * 1000)
      setCode('')
    } else {
      setError(result.message)
    }
    setBusy(false)
  }

  async function verify() {
    if (!phone || !challenge || busy) return
    setBusy(true)
    setError(null)
    const outcome = await signInWithOtp(phone, challenge.challengeId, code)
    // On success the session guard in app/_layout.tsx replaces this screen.
    if (!outcome.ok) setError(outcome.message)
    setBusy(false)
  }

  return (
    <View style={{ gap: theme.space[3] }}>
      <Field
        label="Утасны дугаар"
        unit="+976"
        keyboardType="number-pad"
        autoComplete="tel"
        maxLength={8}
        editable={!challenge}
        value={digits}
        onChangeText={(v) => setDigits(v.replace(/\D/g, ''))}
        error={digits.length > 0 && !phone && digits.length >= 8 ? '8 оронтой дугаар оруулна уу' : undefined}
      />
      {challenge ? (
        <>
          <Field
            label="SMS-ээр ирсэн 6 оронтой код"
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
          />
          {error ? <ErrorBox message={error} /> : null}
          <Button label="Нэвтрэх" loading={busy} disabled={code.length !== 6} onPress={() => void verify()} />
          <Button
            label={wait > 0 ? `Код дахин авах (${wait} с)` : 'Код дахин авах'}
            variant="secondary"
            disabled={wait > 0 || busy}
            onPress={() => void send()}
          />
          <Button
            label="Дугаар солих"
            variant="secondary"
            onPress={() => {
              setChallenge(null)
              setError(null)
            }}
          />
        </>
      ) : (
        <>
          {error ? <ErrorBox message={error} /> : null}
          <Button label="Код авах" loading={busy} disabled={!phone} onPress={() => void send()} />
        </>
      )}
    </View>
  )
}

function EmailLogin() {
  const { signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit = email.trim() !== '' && password !== ''

  async function submit() {
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    const outcome = await signIn(email, password)
    if (!outcome.ok) setError(outcome.message)
    setBusy(false)
  }

  return (
    <View style={{ gap: theme.space[3] }}>
      <Field
        label="И-мэйл"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Нууц үг"
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      {error ? <ErrorBox message={error} /> : null}
      <Button label="Нэвтрэх" loading={busy} disabled={!canSubmit} onPress={() => void submit()} />
    </View>
  )
}
