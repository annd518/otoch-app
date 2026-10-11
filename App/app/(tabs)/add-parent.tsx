import React, { useState } from "react"
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import axios from "axios"

import { env } from "@/utils/env"
import { storage } from "@/utils/storage"

// Display labels only; stored values stay in English
const GENDER_LABELS: Record<string, string> = { Female: "Эмэгтэй", Male: "Эрэгтэй", Other: "Бусад" }
const RELATION_LABELS: Record<string, string> = { Mother: "Ээж", Father: "Аав", Self: "Өөрөө" }

export default function AddParent() {
  const router = useRouter()

  // Parent details
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("Female")
  const [phone, setPhone] = useState("")
  const [relation, setRelation] = useState("Mother")

  // Address
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [pincode, setPincode] = useState("")

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")

  // Medical information
  const [bloodGroup, setBloodGroup] = useState("A+")
  const [medicalHistory, setMedicalHistory] = useState("")
  const [currentMedications, setCurrentMedications] = useState("")
  const [allergies, setAllergies] = useState("")

  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name || !age || !phone || !address) {
      Alert.alert("Алдаа", "Заавал бөглөх талбаруудыг бөглөнө үү")
      return
    }

    setLoading(true)
    try {
      // Get the auth token
      const token = await storage.getAuthToken()

      if (!token) {
        Alert.alert("Алдаа", "Эцэг/эх нэмэхийн тулд нэвтэрсэн байх шаардлагатай. Эхлээд нэвтэрнэ үү.")
        router.replace("/auth/login")
        return
      }

      // Combine address fields
      const fullAddress = `${address}${city ? ', ' + city : ''}${pincode ? ', ' + pincode : ''}`

      const response = await axios.post(
        `${env.baseUrl}api/parents`,
        {
          name,
          age: parseInt(age),
          gender,
          address: fullAddress,
          diseases: medicalHistory || "None",
          medications: currentMedications || "None",
          emergencyContact: emergencyPhone || phone
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      console.log("Add Parent Response: sucess", response.data)
      console.log("Add Parent Response:", response)

      Alert.alert("Амжилттай", "Эцэг/эхийн профайл амжилттай нэмэгдлээ!", [
        { text: "OK", onPress: () => router.back() }
      ])
    } catch (error: any) {
      console.error("Add Parent Error:", error)
      const errorMessage = error.response?.data?.message || "Эцэг/эх нэмж чадсангүй. Дахин оролдоно уу."
      Alert.alert("Error", errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Эцэг/эхийн профайл нэмэх</Text>
        <Text style={styles.headerSubtitle}>Доор эцэг/эхийн мэдээллийг оруулна уу</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Үндсэн мэдээлэл</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Эцэг/эхийн овог нэр *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Овог нэрийг оруулна уу"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Нас *</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              placeholder="Нас"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Таны хэн болох</Text>
            <View style={styles.buttonRow}>
              {["Mother", "Father", "Self"].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRelation(r)}
                  style={[
                    styles.selectBtn,
                    relation === r && styles.selectBtnActive,
                  ]}
                >
                  <Text
                    style={
                      relation === r
                        ? styles.selectTextActive
                        : styles.selectText
                    }
                  >
                    {RELATION_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Хүйс</Text>
          <View style={styles.buttonRow}>
            {["Female", "Male", "Other"].map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGender(g)}
                style={[
                  styles.selectBtn,
                  gender === g && styles.selectBtnActive,
                ]}
              >
                <Text
                  style={
                    gender === g ? styles.selectTextActive : styles.selectText
                  }
                >
                  {GENDER_LABELS[g]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Утасны дугаар *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 XXXXX XXXXX"
            placeholderTextColor="#999"
          />
        </View>

        <Text style={styles.sectionTitle}>Хаягийн мэдээлэл</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Бүтэн хаяг *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={address}
            onChangeText={setAddress}
            multiline
            placeholder="Байр, тоот, гудамж, хороо"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Хот</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Хот"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Шуудангийн код</Text>
            <TextInput
              style={styles.input}
              value={pincode}
              onChangeText={setPincode}
              keyboardType="numeric"
              placeholder="Шуудангийн код"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Яаралтай үед холбогдох</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Холбогдох хүний нэр</Text>
          <TextInput
            style={styles.input}
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="Овог нэр"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Холбогдох хүний утас</Text>
          <TextInput
            style={styles.input}
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            keyboardType="phone-pad"
            placeholder="+91 XXXXX XXXXX"
            placeholderTextColor="#999"
          />
        </View>

        <Text style={styles.sectionTitle}>Эрүүл мэндийн мэдээлэл</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Цусны бүлэг</Text>
          <View style={styles.buttonRow}>
            {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
              <TouchableOpacity
                key={bg}
                onPress={() => setBloodGroup(bg)}
                style={[
                  styles.bloodBtn,
                  bloodGroup === bg && styles.selectBtnActive,
                ]}
              >
                <Text
                  style={
                    bloodGroup === bg
                      ? styles.selectTextActive
                      : styles.selectText
                  }
                >
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Өвчний түүх</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={medicalHistory}
            onChangeText={setMedicalHistory}
            multiline
            placeholder="Жишээ нь: чихрийн шижин, даралт ихсэх гэх мэт"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Одоо хэрэглэж буй эм</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={currentMedications}
            onChangeText={setCurrentMedications}
            multiline
            placeholder="Хэрэглэж буй эм болон тунг бичнэ үү"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Харшил</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={allergies}
            onChangeText={setAllergies}
            multiline
            placeholder="Мэдэгдэж буй харшил"
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Хадгалж байна..." : "Эцэг/эхийн профайл хадгалах"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Цуцлах</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e4e8",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginTop: 20,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
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
    padding: 14,
    fontSize: 15,
    color: "#111",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  selectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e1e4e8",
    backgroundColor: "#fff",
  },
  selectBtnActive: {
    backgroundColor: "#2f80ed",
    borderColor: "#2f80ed",
  },
  selectText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  selectTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  bloodBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e1e4e8",
    backgroundColor: "#fff",
    minWidth: 50,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#2f80ed",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#2f80ed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: "#a0c4f0",
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#e1e4e8",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
})
