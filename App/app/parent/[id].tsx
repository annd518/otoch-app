import React from 'react'
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'

export default function ParentProfile() {
  const params = useLocalSearchParams()
  const router = useRouter()
  const id = params.id || '1'

  // Hard-coded example data for parent id
  const parent = {
    id,
    name: 'Anita Sharma',
    age: 78,
    conditions: ['Даралт ихсэх', 'Үе мөчний үрэвсэл'],
    lastVisit: '2025-10-15'
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text>{'< Буцах'}</Text></TouchableOpacity>
      <Text style={styles.h1}>{parent.name}</Text>
      <Text style={styles.small}>Нас: {parent.age}</Text>
      <Text style={styles.small}>Сүүлийн үзлэг: {parent.lastVisit}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Оношууд</Text>
        {parent.conditions.map((c, i) => (
          <Text key={i} style={styles.listItem}>• {c}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Түүх</Text>
        <Text style={styles.listItem}>2025-10-15 — Ердийн үзлэг, тогтвортой.</Text>
        <Text style={styles.listItem}>2025-09-01 — Эмийн тун өөрчилсөн.</Text>
      </View>

      <TouchableOpacity style={styles.primary}><Text style={styles.primaryText}>Тайлан харах</Text></TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  back: { marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: '700' },
  small: { color: '#666', marginTop: 4 },
  card: { backgroundColor: '#f7f8fb', padding: 12, borderRadius: 8, marginTop: 12 },
  cardTitle: { fontWeight: '700', marginBottom: 8 },
  listItem: { marginBottom: 6 },
  primary: { backgroundColor: '#2f80ed', padding: 12, borderRadius: 8, marginTop: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' }
})
