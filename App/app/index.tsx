import { StyleSheet, Text, View, TouchableOpacity, Image } from "react-native"
import React from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

const Index = () => {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push("/auth/login")
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/images/logoop.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>PariwarCare</Text>
            <Text style={styles.slogan}>
              Таны эцэг эхийн эрүүл мэнд таны гарт
            </Text>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedText}>Эхлэх</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Биднийг асарсан хүмүүсээ асарцгаая
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default Index

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 180,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#111",
    marginBottom: 16,
    textAlign: "center",
  },
  slogan: {
    fontSize: 20,
    color: "#666",
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "500",
  },
  bottomSection: {
    alignItems: "center",
    paddingBottom: 20,
  },
  getStartedButton: {
    backgroundColor: "#2f80ed",
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    shadowColor: "#2f80ed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 16,
  },
  getStartedText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  footerText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    fontStyle: "italic",
  },
})
