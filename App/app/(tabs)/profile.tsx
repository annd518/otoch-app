import React, { useCallback, useState } from "react"
import {
  Alert,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, useRouter } from "expo-router"

import { useBookingDraft } from "@/context/BookingDraftContext"
import { apiService } from "@/services/api"
import type { AppUser } from "@/services/apiTypes"
import { storage } from "@/utils/storage"

export default function ProfileScreen() {
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(null)
  const { dispatch } = useBookingDraft()

  useFocusEffect(
    useCallback(() => {
      let active = true
      storage.getUser().then((stored) => {
        if (active) setUser(stored)
      })
      return () => {
        active = false
      }
    }, []),
  )

  const performLogout = async () => {
    await apiService.logout()
    // The in-memory booking draft belongs to this user; unconfirmed red flag
    // blocks stay in storage per user and are retried after the next login.
    dispatch({ type: "reset" })
    router.replace("/auth/login")
  }

  const handleLogout = () => {
    Alert.alert("Гарах", "Та системээс гарах уу?", [
      { text: "Болих", style: "cancel" },
      { text: "Гарах", style: "destructive", onPress: () => void performLogout() },
    ])
  }

  const initial = user?.name.trim().charAt(0).toUpperCase() || "?"

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || "Хэрэглэгч"}</Text>
          {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="people-outline" size={24} color="#2f80ed" />
            </View>
            <Text style={styles.actionText}>Миний эцэг эх</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="calendar-outline" size={24} color="#2f80ed" />
            </View>
            <Text style={styles.actionText}>Захиалгууд</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text-outline" size={24} color="#2f80ed" />
            </View>
            <Text style={styles.actionText}>Тайлан</Text>
          </TouchableOpacity>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Бүртгэлийн тохиргоо</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#e3f2fd" }]}>
                <Ionicons name="card-outline" size={20} color="#2f80ed" />
              </View>
              <Text style={styles.menuText}>Төлбөрийн хэрэгсэл</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#e8f5e9" }]}>
                <Ionicons name="location-outline" size={20} color="#4caf50" />
              </View>
              <Text style={styles.menuText}>Хаяг</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#fff3e0" }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#ff9800" />
              </View>
              <Text style={styles.menuText}>Аюулгүй байдал ба нууц үг</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Help & Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Тусламж ба мэдээлэл</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#f3e5f5" }]}>
                <Ionicons name="help-circle-outline" size={20} color="#9c27b0" />
              </View>
              <Text style={styles.menuText}>Тусламж ба дэмжлэг</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#e0f2f1" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#009688" />
              </View>
              <Text style={styles.menuText}>Нууцлалын бодлого</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#e3f2fd" }]}>
                <Ionicons name="information-circle-outline" size={20} color="#2196f3" />
              </View>
              <Text style={styles.menuText}>Аппын тухай</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Гарах</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#2f80ed",
  },
  userName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 32,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#e8f2ff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6e9ff",
  },
  iconContainer: {
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  logoutButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ff3b30",
    marginTop: 8,
  },
  logoutText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "700",
  },
  avatarPlaceholder: {
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: "800",
    color: "#2f80ed",
  },
  userEmail: {
    fontSize: 15,
    color: "#666",
    marginTop: 4,
  },
})
