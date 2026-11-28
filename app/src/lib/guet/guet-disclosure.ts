// A choice is tied to this account, device and disclosure version. Existing
// location grants and legacy default-on behavior are not Android opt-ins.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type GuetChoice = "accepted" | "declined";
const key = (id: string) => `spawt:guet:android-disclosure-v1:${id}`;
const blocked = new Set<string>();

export async function readGuetChoice(id: string): Promise<GuetChoice | null> {
  if (blocked.has(id)) return "declined";
  try {
    const value = await AsyncStorage.getItem(key(id));
    if (blocked.has(id)) return "declined";
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return "declined"; // Fail closed when the current choice cannot be read.
  }
}

export async function writeGuetChoice(id: string, choice: GuetChoice): Promise<void> {
  if (choice === "declined") blocked.add(id);
  await AsyncStorage.setItem(key(id), choice);
  if (choice === "accepted") blocked.delete(id);
}
