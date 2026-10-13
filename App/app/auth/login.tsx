import { TouchTarget as TouchableOpacity } from "@/components/ui/TouchTarget";
import { theme } from "@/design/theme";
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { AppText as Text } from "@/components/AppText";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBookingDraft } from "@/context/BookingDraftContext";
import { apiService } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    registered?: string;
    expired?: string;
  }>();
  const [email, setEmail] = useState(
    typeof params.email === "string" ? params.email : "",
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { dispatch } = useBookingDraft();
  const justRegistered = params.registered === "1";
  const sessionExpired = params.expired === "1";

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert("Алдаа", "Бүх талбарыг бөглөнө үү");
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.login(trimmedEmail, password);
      if (result.ok) {
        dispatch({ type: "reset" });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Нэвтэрч чадсангүй", result.message);
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
            <Text style={styles.title}>Тавтай морил</Text>
            <Text style={styles.subtitle}>
              OTOCH-д үргэлжлүүлэхийн тулд нэвтэрнэ үү
            </Text>
          </View>

          {sessionExpired && (
            <View style={[styles.notice, styles.noticeWarn]}>
              <Text style={[styles.noticeText, styles.noticeWarnText]}>
                Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.
              </Text>
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
                placeholderTextColor={theme.color.secondary}
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
                placeholderTextColor={theme.color.secondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>
                Нууц үгээ мартсан уу?
              </Text>
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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.background,
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
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 32,
    fontWeight: "800",
    color: theme.color.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "600",
    color: theme.color.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.color.subtle,
    borderWidth: 1,
    borderColor: theme.color.info,
    borderRadius: 12,
    padding: 16,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.text,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: theme.color.brand,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 56,
    backgroundColor: theme.color.brand,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: theme.color.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.color.info,
    opacity: 0.6,
  },
  primaryButtonText: {
    color: theme.color.background,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
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
    backgroundColor: theme.color.info,
  },
  dividerText: {
    marginHorizontal: 16,
    color: theme.color.secondary,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    fontWeight: "600",
  },
  registerSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.secondary,
  },
  registerLink: {
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    color: theme.color.brand,
    fontWeight: "700",
  },
  notice: {
    backgroundColor: theme.color.info,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    color: theme.color.secondary,
    fontFamily: "NotoSans_400Regular",
    fontSize: 18,
    lineHeight: 28,
  },
  noticeWarn: {
    backgroundColor: theme.color.subtle,
  },
  noticeWarnText: {
    color: theme.color.secondary,
  },
});
