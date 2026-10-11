import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { connectivity } from "../services/connectivity";
import { apiConfig } from "./env";
import { createHttpClient } from "../services/httpClient";
import { isRecord } from "../services/apiResult";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppUser, UserRole } from "../services/apiTypes";
import type { Session, SessionStore } from "../services/authFlow";
import { decodeJwtClaims, isJwtExpired } from "../services/jwt";
import { isUserRole, parseUser } from "../services/validators";

// Keys are unchanged from the previous version so existing installs keep working.
const STORAGE_KEYS = {
  AUTH_TOKEN: "@auth_token",
  USER_DATA: "@user_data",
  USER_ROLE: "@user_role",
} as const;

const SESSION_KEYS = [
  STORAGE_KEYS.AUTH_TOKEN,
  STORAGE_KEYS.USER_DATA,
  STORAGE_KEYS.USER_ROLE,
];

function parseStoredUser(raw: string | null): AppUser | null {
  if (!raw) return null;
  try {
    return parseUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

const ACCESS_KEY = "otoch_access_token";
const REFRESH_KEY = "otoch_refresh_token";
const secure = {
  get: async (key: string) =>
    Platform.OS === "web"
      ? typeof sessionStorage === "undefined"
        ? null
        : sessionStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined")
        sessionStorage.setItem(key, value);
    } else await SecureStore.setItemAsync(key, value);
  },
  remove: async (key: string) => {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
    } else await SecureStore.deleteItemAsync(key);
  },
};
const authClient = createHttpClient({
  config: apiConfig,
  fetch: async (url, init) => {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(15000),
      });
      connectivity.set(false);
      return response;
    } catch (error) {
      connectivity.set(true);
      throw error;
    }
  },
  getToken: async () => null,
});
let refreshInFlight: Promise<string | null> | null = null;
let sessionEpoch = 0;
let mutationTail: Promise<void> = Promise.resolve();
function mutate(action: () => Promise<void>) {
  const next = mutationTail.then(action);
  mutationTail = next.catch(() => {});
  return next;
}
async function writeSession({
  token,
  user,
  refreshToken,
}: Session & { refreshToken?: string }) {
  const previous = await getUser();
  if (previous && previous.id !== user.id) await secure.remove(REFRESH_KEY);
  await secure.set(ACCESS_KEY, token);
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.USER_DATA, JSON.stringify(user)],
    [STORAGE_KEYS.USER_ROLE, user.role],
  ]);
  await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  if (refreshToken) await secure.set(REFRESH_KEY, refreshToken);
}
async function saveSession(
  data: Session & { refreshToken?: string },
): Promise<void> {
  sessionEpoch++;
  await mutate(() => writeSession(data));
}
async function clearSession(): Promise<void> {
  sessionEpoch++;
  await mutate(async () => {
    const refreshToken = await secure.get(REFRESH_KEY);
    await Promise.all([
      secure.remove(ACCESS_KEY),
      secure.remove(REFRESH_KEY),
      AsyncStorage.multiRemove(SESSION_KEYS),
    ]);
    if (refreshToken)
      void authClient.request({
        method: "POST",
        path: "/api/auth/logout",
        auth: "none",
        body: { refreshToken },
        parse: () => true,
      });
  });
}
async function getAuthToken(): Promise<string | null> {
  let token = await secure.get(ACCESS_KEY);
  if (!token) {
    const legacy = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (legacy) {
      await secure.set(ACCESS_KEY, legacy);
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      token = legacy;
    }
  }
  const claims = token ? decodeJwtClaims(token) : null;
  if (token && claims && !isJwtExpired(claims, Date.now())) return token;
  const refreshToken = await secure.get(REFRESH_KEY);
  if (!refreshToken) return token;
  const epoch = sessionEpoch;
  if (!refreshInFlight)
    refreshInFlight = authClient
      .request({
        method: "POST",
        path: "/api/auth/refresh",
        auth: "none",
        body: { refreshToken },
        parse: (d) => {
          if (
            !isRecord(d) ||
            typeof d.token !== "string" ||
            typeof d.refreshToken !== "string"
          )
            return null;
          const user = parseUser(d.user);
          return user
            ? { token: d.token, refreshToken: d.refreshToken, user }
            : null;
        },
      })
      .then(async (r) => {
        if (!r.ok) return r.kind === "network" ? token : null;
        let accepted = false;
        await mutate(async () => {
          if (epoch !== sessionEpoch) return;
          await writeSession(r.data);
          accepted = true;
        });
        return accepted ? r.data.token : null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  return refreshInFlight;
}

async function getUser(): Promise<AppUser | null> {
  return parseStoredUser(await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA));
}

async function getUserRole(): Promise<UserRole | null> {
  const role = await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
  return isUserRole(role) ? role : null;
}

// A session is valid only with a token, a well-formed user object and a token
// that is not past its exp claim. Older installs stored the JWT string as the
// user; those sessions are cleared so the user logs in again.
async function getValidSession(
  nowMs: number = Date.now(),
): Promise<Session | null> {
  const token = await getAuthToken();
  const user = await getUser();
  const claims = token ? decodeJwtClaims(token) : null;
  if (
    token &&
    user &&
    claims &&
    isJwtExpired(claims, nowMs) &&
    connectivity.get() &&
    (await secure.get(REFRESH_KEY))
  )
    return { token, user };
  if (!token || !user || !claims || isJwtExpired(claims, nowMs)) {
    if (token || user) await clearSession();
    return null;
  }
  return { token, user };
}

export const storage = {
  saveSession,
  clearSession,
  getAuthToken,
  getUser,
  getUserRole,
  getValidSession,
} satisfies SessionStore & Record<string, unknown>;
