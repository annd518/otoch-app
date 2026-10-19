import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../components/AppText'
import { Button } from '../components/Button'
import { useSession } from '../context/SessionContext'
import { theme } from '../design/theme'

export default function LoginScreen() {
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
    // On success the session guard in app/_layout.tsx replaces this screen.
    if (!outcome.ok) setError(outcome.message)
    setBusy(false)
  }

  const input = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.small,
    paddingHorizontal: theme.space[3],
    color: theme.color.text,
    ...theme.type.body,
  } as const

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

          <View style={{ gap: theme.space[1] }}>
            <AppText variant="label">И-мэйл</AppText>
            <TextInput
              accessibilityLabel="И-мэйл"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              style={input}
            />
          </View>
          <View style={{ gap: theme.space[1] }}>
            <AppText variant="label">Нууц үг</AppText>
            <TextInput
              accessibilityLabel="Нууц үг"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              style={input}
            />
          </View>

          {error ? (
            <View
              accessibilityRole="alert"
              style={{ backgroundColor: theme.color.errorBg, borderRadius: theme.radius.small, padding: theme.space[3] }}
            >
              <AppText variant="caption" color={theme.color.error}>
                {error}
              </AppText>
            </View>
          ) : null}

          <Button label="Нэвтрэх" loading={busy} disabled={!canSubmit} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
