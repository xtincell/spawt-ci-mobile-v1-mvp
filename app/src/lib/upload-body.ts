import { Platform } from "react-native";

/** Supabase Storage attend des octets sur React Native, pas un Blob natif. */
export async function readUploadBody(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS !== "web") {
    const { File } = await import("expo-file-system");
    return new File(uri).arrayBuffer();
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error("photo_read_failed");
  return response.arrayBuffer();
}
