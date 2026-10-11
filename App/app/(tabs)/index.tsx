import React from "react"
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import { Link } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

export default function HomeTab() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Хянах самбар</Text>
          <Text style={styles.headerSubtitle}>PariwarCare-д тавтай морил</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Идэвхтэй эцэг/эх</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Идэвхтэй</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>Анита Шарма, 78 нас</Text>
          <Text style={styles.small}>Сүүлд мэдээлсэн: 2 цагийн өмнө</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Эрүүл мэндийн тойм</Text>
          <View style={styles.row}>
            <View style={styles.stat}>
              <View style={styles.statCircle}>
                <Text style={styles.statValue}>72</Text>
              </View>
              <Text style={styles.statLabel}>Зүрхний цохилт</Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.statCircle}>
                <Text style={styles.statValue}>120/78</Text>
              </View>
              <Text style={styles.statLabel}>Цусны даралт</Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.statCircle}>
                <Text style={styles.statValue}>98%</Text>
              </View>
              <Text style={styles.statLabel}>Хүчилтөрөгч</Text>
            </View>
          </View>
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.cardTitle}>Сүүлийн мэдэгдлүүд</Text>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>2</Text>
            </View>
          </View>
          <View style={styles.alertItem}>
            <Text style={styles.alertIcon}>💊</Text>
            <View style={styles.alertContent}>
              <Text style={styles.alertText}>Эм уух сануулга алгассан</Text>
              <Text style={styles.alertTime}>Өнөөдөр</Text>
            </View>
          </View>
          <View style={styles.alertItem}>
            <Text style={styles.alertIcon}>📄</Text>
            <View style={styles.alertContent}>
              <Text style={styles.alertText}>Шинэ тайлан бэлэн боллоо</Text>
              <Text style={styles.alertTime}>1 цагийн өмнө</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Link href="/add-parent" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>+ Эцэг/эх нэмэх</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/parent/1" asChild>
            <TouchableOpacity style={styles.buttonOutline}>
              <Text style={styles.buttonOutlineText}>Профайл харах</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.shortcuts}>
          <Text style={styles.menuTitle}>Шуурхай үйлдлүүд</Text>
          <View style={styles.shortcutsRow}>
            <Link href="/report-viewer" asChild>
              <TouchableOpacity style={styles.tile}>
                <View style={styles.tileIconContainer}>
                  <Text style={styles.tileIcon}>📊</Text>
                </View>
                <Text style={styles.tileText}>Тайлан</Text>
                <Text style={styles.tileSub}>Сүүлийнхийг харах</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/notifications" asChild>
              <TouchableOpacity style={styles.tile}>
                <View style={styles.tileIconContainer}>
                  <Text style={styles.tileIcon}>🔔</Text>
                </View>
                <Text style={styles.tileText}>Мэдэгдэл</Text>
                <Text style={styles.tileSub}>Мэдэгдлүүд</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/" asChild>
              <TouchableOpacity style={styles.tile}>
                <View style={styles.tileIconContainer}>
                  <Text style={styles.tileIcon}>👤</Text>
                </View>
                <Text style={styles.tileText}>Бүртгэл</Text>
                <Text style={styles.tileSub}>Тохиргоо</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  container: {
    padding: 20,
    backgroundColor: "#f5f7fa",
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  h1: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 6,
    fontWeight: "600",
  },
  small: {
    fontSize: 13,
    color: "#9ca3af",
  },
  statusBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: "#2f80ed",
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statCircle: {
    backgroundColor: "#eff6ff",
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 3,
    borderColor: "#2f80ed",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2f80ed",
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "600",
  },
  alertCard: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  alertBadge: {
    backgroundColor: "#fee2e2",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBadgeText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    color: "#1a1a1a",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  alertTime: {
    color: "#9ca3af",
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#2f80ed",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
    shadowColor: "#2f80ed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonOutline: {
    borderWidth: 2,
    borderColor: "#2f80ed",
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#2f80ed",
    fontWeight: "700",
    fontSize: 15,
  },
  shortcuts: {
    marginTop: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  shortcutsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  tile: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tileIconContainer: {
    backgroundColor: "#eff6ff",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  tileIcon: {
    fontSize: 24,
  },
  tileText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 4,
  },
  tileSub: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
  },
})
