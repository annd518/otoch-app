import { TouchTarget as TouchableOpacity } from "@/components/ui/TouchTarget";
import { theme } from "@/design/theme";
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiService } from "@/services/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert("Алдаа", "Заавал бөглөх талбаруудыг бөглөнө үү");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      Alert.alert("Алдаа", "Имэйл хаяг буруу байна");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Алдаа", "Нууц үг таарахгүй байна");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Алдаа", "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой");
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.signup({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });
      if (result.kind === "signed_in") {
        router.replace("/(tabs)");
      } else if (result.kind === "login_required") {
        // The server created the account but returned no token (current contract).
        router.replace({
          pathname: "/auth/login",
          params: { email: result.email, registered: "1" },
        });
      } else {
        Alert.alert("Бүртгүүлж чадсангүй", result.message);
      }
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.subtitle}>Эхлэхийн тулд OTOCH-д нэгдээрэй</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Овог нэр</Text>
              <TextInput
                style={styles.input}
                placeholder="Овог нэрээ оруулна уу"
                placeholderTextColor={theme.color.secondary}
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
                placeholderTextColor={theme.color.secondary}
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
                placeholderTextColor={theme.color.secondary}
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
                placeholderTextColor={theme.color.secondary}
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
                placeholderTextColor={theme.color.secondary}
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
                <Text style={styles.termsLink}>Нууцлалын бодлого</Text>-ыг
                зөвшөөрч байна
              </Text>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ЭСВЭЛ</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.loginSection}>
              <Text style={styles.loginText}>Бүртгэлтэй юу? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>Нэвтрэх</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
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
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: "#111",
  },
  primaryButton: {
    minHeight: 56,
    backgroundColor: "#2f80ed",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
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
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "700",
  },
  termsSection: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    lineHeight: 28,
  },
  termsLink: {
    color: "#2f80ed",
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e1e4e8",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#999",
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "600",
  },
  loginSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  loginText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: "#666",
  },
  loginLink: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: "#2f80ed",
    fontWeight: "700",
  },
});
