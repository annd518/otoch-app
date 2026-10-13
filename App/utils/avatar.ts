import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
const key = (userId: string) => `@otoch_avatar:${userId}`;
function removeManaged(uri: string | null) {
  if (Platform.OS === "web" || !uri) return;
  const folder = new Directory(Paths.document, "avatars");
  if (
    uri.startsWith(folder.uri.endsWith("/") ? folder.uri : folder.uri + "/")
  ) {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}
export async function getAvatar(userId: string): Promise<string | null> {
  const uri = await AsyncStorage.getItem(key(userId));
  if (!uri) return null;
  if (Platform.OS !== "web" && !new File(uri).exists) return null;
  return uri;
}
export async function saveAvatar(
  userId: string,
  source: string,
): Promise<string> {
  const previous = await AsyncStorage.getItem(key(userId));
  let uri = source;
  if (Platform.OS !== "web") {
    const directory = new Directory(Paths.document, "avatars");
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(
      directory,
      `${Date.now()}-${Math.random().toString(36).slice(2)}${new File(source).extension || ".jpg"}`,
    );
    new File(source).copy(destination);
    uri = destination.uri;
  }
  try {
    await AsyncStorage.setItem(key(userId), uri);
  } catch (error) {
    if (uri !== source) removeManaged(uri);
    throw error;
  }
  try {
    if (previous !== uri) removeManaged(previous);
  } catch {
    /* New avatar is safely persisted. */
  }
  return uri;
}
export async function removeAvatar(userId: string) {
  const previous = await AsyncStorage.getItem(key(userId));
  await AsyncStorage.removeItem(key(userId));
  try {
    removeManaged(previous);
  } catch {
    /* Missing old file does not block removal. */
  }
}
