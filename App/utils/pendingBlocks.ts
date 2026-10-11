import AsyncStorage from '@react-native-async-storage/async-storage'

import type { PendingBlockAnswers } from '../services/bookingDraft'

// Red flag blocks the server has not confirmed yet. Survive app restarts and
// re-login so the block is retried and never silently forgotten. Holds only
// question ids and yes/no values, no question text or patient data.
const KEY = '@pending_red_flag_blocks'

export interface PendingBlock extends PendingBlockAnswers {
  userId: string
  orderId: string
  source: 'real' | 'mock'
}

async function readAll(): Promise<PendingBlock[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as PendingBlock[]) : []
  } catch {
    return []
  }
}

export const pendingBlocks = {
  async list(userId: string): Promise<PendingBlock[]> {
    return (await readAll()).filter((b) => b.userId === userId)
  },
  async save(block: PendingBlock): Promise<void> {
    const all = (await readAll()).filter((b) => !(b.userId === block.userId && b.orderId === block.orderId))
    await AsyncStorage.setItem(KEY, JSON.stringify([...all, block]))
  },
  async remove(userId: string, orderId: string): Promise<void> {
    const all = (await readAll()).filter((b) => !(b.userId === userId && b.orderId === orderId))
    await AsyncStorage.setItem(KEY, JSON.stringify(all))
  },
}
