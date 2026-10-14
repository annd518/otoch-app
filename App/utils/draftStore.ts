import AsyncStorage from '@react-native-async-storage/async-storage'

// One unsaved booking draft per device (services/draftPersistence.ts decides
// what is kept). The record carries its userId, so a different account never
// sees it. Explicit logout clears it.
const KEY = '@booking_draft'

export const draftStore = {
  async load(): Promise<unknown> {
    try {
      const raw = await AsyncStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as unknown) : null
    } catch {
      return null
    }
  },
  async save(value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      // Losing the local copy only means the user re-enters step 1.
    }
  },
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY)
    } catch {
      // same as above
    }
  },
}
