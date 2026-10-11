import React, { useState } from 'react'
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
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import axios from 'axios'
import { env } from '@/utils/env'
import { storage } from '@/utils/storage'

export default function RegisterScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Алдаа", "Заавал бөглөх талбаруудыг бөглөнө үү")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Алдаа", "Нууц үг таарахгүй байна")
      return
    }

    if (password.length < 6) {
      Alert.alert("Алдаа", "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой")
      return
    }

    setLoading(true)
    try {
      console.log("Registering user:", { name, email })
      const {data} = await axios.post(`${env.baseUrl}api/auth/signup`, {
        name,
        email,
        password,
        role: "CHILD"
      })

      console.log("Signup Response:", data.data)

      if (data.data.token) {
        // Store the token
        await storage.setAuthToken(data.data.token)

        // Store user data if available
        if (data.data.user) {
          await storage.setUserData(data.data.user)
        }

        Alert.alert("Амжилттай", "Бүртгэл амжилттай үүслээ!", [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)")
          }
        ])
      }
    } catch (error: any) {
      console.error("Signup Error:", error)
      const errorMessage = error.response?.data?.message || "Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу."
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
            <Text style={styles.title}>Бүртгэл үүсгэх</Text>
            <Text style={styles.subtitle}>Эхлэхийн тулд PariwarCare-д нэгдээрэй</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Овог нэр</Text>
              <TextInput
                style={styles.input}
                placeholder="Овог нэрээ оруулна уу"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

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
              <Text style={styles.label}>Утасны дугаар</Text>
              <TextInput
                style={styles.input}
                placeholder="Утасны дугаараа оруулна уу"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Нууц үг</Text>
              <TextInput
                style={styles.input}
                placeholder="Нууц үг үүсгэнэ үү"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Нууц үг баталгаажуулах</Text>
              <TextInput
                style={styles.input}
                placeholder="Нууц үгээ дахин оруулна уу"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                loading && styles.primaryButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Бүртгэл үүсгэж байна..." : "Бүртгэл үүсгэх"}
              </Text>
            </TouchableOpacity>

            <View style={styles.termsSection}>
              <Text style={styles.termsText}>
                Бүртгүүлснээр та манай{" "}
                <Text style={styles.termsLink}>Үйлчилгээний нөхцөл</Text> болон{" "}
                <Text style={styles.termsLink}>Нууцлалын бодлого</Text>-ыг зөвшөөрч байна
              </Text>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ЭСВЭЛ</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.loginSection}>
              <Text style={styles.loginText}>Бүртгэлтэй юу? </Text>
              <Link href="/" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>Нэвтрэх</Text>
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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f7f8fb',
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111',
  },
  primaryButton: {
    backgroundColor: '#2f80ed',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2f80ed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: '#a0c4f0',
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  termsSection: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2f80ed',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e1e4e8',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    fontSize: 15,
    color: '#666',
  },
  loginLink: {
    fontSize: 15,
    color: '#2f80ed',
    fontWeight: '700',
  },
})
