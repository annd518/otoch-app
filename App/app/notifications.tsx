import React from 'react'
import { StyleSheet, View, Text, FlatList } from 'react-native'

const items = [
  { id: 'n1', text: 'Анита Шармагийн шинэ тайлан орлоо', time: '2ц' },
  { id: 'n2', text: 'Эмч Пателтэй цаг товлогдлоо', time: '1ө' },
  { id: 'n3', text: 'Эм уух сануулга алгассан', time: '3ө' }
]

export default function Notifications() {
  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Мэдэгдлүүд</Text>
      <FlatList data={items} keyExtractor={i=>i.id} renderItem={({item})=> (
        <View style={styles.row}>
          <Text>{item.text}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      )} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flex: 1 },
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { padding: 12, borderRadius: 8, backgroundColor: '#f7f8fb', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#888' }
})
