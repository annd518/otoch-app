import React, { useState } from "react"
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native"
import { Link, useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { apiService } from "@/services/api"

export default function LoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string; registered?: string; expired?: string }>()
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const justRegistered = params.registered === "1"
  const sessionExpired = params.expired === "1"

  const handleLogin = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      Alert.alert("Алдаа", "Бүх талбарыг бөглөнө үү")
      return
    }

    setLoading(true)
    try {
      const result = await apiService.login(trimmedEmail, password)
      if (result.ok) {
        router.replace("/(tabs)")
      } else {
        Alert.alert("Нэвтэрч чадсангүй", result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Тавтай морил</Text>
            <Text style={styles.subtitle}>
              PariwarCare-д үргэлжлүүлэхийн тулд нэвтэрнэ үү
            </Text>
          </View>

          {sessionExpired && (
            <View style={[styles.notice, styles.noticeWarn]}>
              <Text style={[styles.noticeText, styles.noticeWarnText]}>Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.</Text>
            </View>
          )}

          {justRegistered && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Бүртгэл амжилттай үүслээ. Нууц үгээ оруулаад нэвтэрнэ үү.
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Имэйл хаяг</Text>
              <TextInput
                style={styles.input}
                placeholder="Имэйлээ оруулна уу"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Нууц үг</Text>
              <TextInput
                style={styles.input}
                placeholder="Нууц үгээ оруулна уу"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Нууц үгээ мартсан уу?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                loading && styles.primaryButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Нэвтэрч байна..." : "Нэвтрэх"}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ЭСВЭЛ</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.registerSection}>
              <Text style={styles.registerText}>Бүртгэл байхгүй юу? </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.registerLink}>Бүртгүүлэх</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f7f8fb",
    borderWidth: 1,
    borderColor: "#e1e4e8",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#111",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: "#2f80ed",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#2f80ed",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#2f80ed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: "#a0c4f0",
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e1e4e8",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
  },
  registerSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontSize: 15,
    color: "#666",
  },
  registerLink: {
    fontSize: 15,
    color: "#2f80ed",
    fontWeight: "700",
  },
  notice: {
    backgroundColor: "#e8f5e9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    color: "#1b5e20",
    fontSize: 14,
    lineHeight: 20,
  },
  noticeWarn: {
    backgroundColor: "#fff3e0",
  },
  noticeWarnText: {
    color: "#e65100",
  },
})
