import AsyncStorage from '@react-native-async-storage/async-storage'

import type { PaymentRecord } from '../services/payment'

// Invoice attempts per user and order: key, quote id and payment id only (no
// amounts, QR or personal data). Lets the app recover its own invoice after a
// restart, a timeout or a re-login instead of creating a second one.
const KEY = '@payment_records'

interface StoredRecord extends PaymentRecord {
  userId: string
}

async function readAll(): Promise<StoredRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as StoredRecord[]) : []
  } catch {
    return []
  }
}

export const paymentStore = {
  async get(userId: string, orderId: string): Promise<PaymentRecord | null> {
    const found = (await readAll()).find((r) => r.userId === userId && r.orderId === orderId)
    return found ? { orderId: found.orderId, quoteId: found.quoteId, key: found.key, paymentId: found.paymentId } : null
  },
  async save(userId: string, record: PaymentRecord): Promise<void> {
    const rest = (await readAll()).filter((r) => !(r.userId === userId && r.orderId === record.orderId))
    await AsyncStorage.setItem(KEY, JSON.stringify([...rest, { ...record, userId }]))
  },
  async remove(userId: string, orderId: string): Promise<void> {
    const rest = (await readAll()).filter((r) => !(r.userId === userId && r.orderId === orderId))
    await AsyncStorage.setItem(KEY, JSON.stringify(rest))
  },
}
