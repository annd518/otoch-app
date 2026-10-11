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
import { Link, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import axios from "axios"
import { env } from "@/utils/env"
import { storage } from "@/utils/storage"

export default function login() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Алдаа", "Бүх талбарыг бөглөнө үү")
      return
    }

    setLoading(true)
    try {
      console.log("Logging in with:", { email })
      const response = await axios.post(`${env.baseUrl}api/auth/login`, {
        email,
        password,
      })

        console.log("Login Response 1:", response.data.data)


      if (response.data.data.token) {
        // Store the token
        await storage.setAuthToken(response.data.data.token)

        // Store user data if available
        if (response.data.data.user) {
          await storage.setUserData(response.data.data.user)
        }

        Alert.alert("Амжилттай", "Амжилттай нэвтэрлээ!", [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)")
          }
        ])
      }
    } catch (error: any) {
      console.error("Login Error:", error)
      const errorMessage = error.response?.data?.message || "Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу."
      Alert.alert("Error", errorMessage)
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
})
