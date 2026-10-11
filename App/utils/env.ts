import Constants from "expo-constants"
import { Platform } from "react-native"

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || "8000"

// In development, derive the dev machine's LAN IP from the Metro bundler host
// (e.g. "192.168.1.37:8081") so a physical device never hits its own localhost.
function getDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost
  if (!hostUri) return null
  return hostUri.split(":")[0]
}

function resolveBaseUrl(): string {
  // Explicit override always wins (production builds, tunnels, etc.)
  const explicit = process.env.EXPO_PUBLIC_API_URL
  if (explicit) return explicit.endsWith("/") ? explicit : `${explicit}/`

  if (Platform.OS === "web") return `http://localhost:${API_PORT}/`

  const host = getDevHost()
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${API_PORT}/`
  }

  // Android emulator maps the host machine to 10.0.2.2
  if (Platform.OS === "android") return `http://10.0.2.2:${API_PORT}/`
  return `http://localhost:${API_PORT}/`
}

export const env = {
  baseUrl: resolveBaseUrl(),
}

if (__DEV__) {
  console.log("[env] API base URL:", env.baseUrl)
}
