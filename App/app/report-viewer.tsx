import React from 'react'
import { StyleSheet, View, Text, ScrollView } from 'react-native'

export default function ReportViewer() {
  // Hard-coded vitals and notes
  const report = {
    date: '2025-10-31',
    vitals: { hr: 72, bp: '120/78', spo2: '98%', temp: '36.6°C' },
    notes: 'Өвчтөний биеийн байдал тогтвортой. Одоогийн эмчилгээг үргэлжлүүлнэ. Хөнгөн дасгал хийж, ус сайн уухыг зөвлөж байна.'
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Тайлан — {report.date}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Амин үзүүлэлт</Text>
        <View style={styles.row}>
          <View style={styles.stat}><Text style={styles.val}>{report.vitals.hr}</Text><Text style={styles.label}>Зүрх</Text></View>
          <View style={styles.stat}><Text style={styles.val}>{report.vitals.bp}</Text><Text style={styles.label}>Даралт</Text></View>
          <View style={styles.stat}><Text style={styles.val}>{report.vitals.spo2}</Text><Text style={styles.label}>SpO2</Text></View>
          <View style={styles.stat}><Text style={styles.val}>{report.vitals.temp}</Text><Text style={styles.label}>Халуун</Text></View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Эмчийн тэмдэглэл</Text>
        <Text>{report.notes}</Text>
      </View>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#f7f8fb', padding: 12, borderRadius: 8, marginBottom: 12 },
  cardTitle: { fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  val: { fontSize: 18, fontWeight: '700' },
  label: { color: '#666' }
})
