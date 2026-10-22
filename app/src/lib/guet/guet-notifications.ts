import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import fr from "../../i18n/fr.json";

export const GUET_CHANNEL_ID = "guet";
export const GUET_PROMPT_CATEGORY = "guet-prompt";
const PREFIX = "spawt:guet:v2:";
let channelEnsured = false; let categoriesSetup = false;
export async function ensureGuetChannel(): Promise<void> {
  if (channelEnsured || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(GUET_CHANNEL_ID, { name: fr.guet_v2.title, importance: Notifications.AndroidImportance.DEFAULT });
  channelEnsured = true;
}
export async function setupGuetCategories(): Promise<void> {
  if (Platform.OS === "web" || categoriesSetup) return;
  await Notifications.setNotificationCategoryAsync(GUET_PROMPT_CATEGORY, [
    { identifier: "confirm", buttonTitle: fr.guet_v2.open, options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync("guet-review", [
    { identifier: "confirm", buttonTitle: fr.guet_v2.review_open, options: { opensAppToForeground: true } },
  ]);
  categoriesSetup = true;
}
export const guetPromptId = (rowId: string): string => `${PREFIX}${rowId}`;
export interface GuetPromptPayload {
  row_id: string; place_id: string; place_name: string; owner_id?: string;
  body?: string; kind?: "nearby" | "review";
}
export async function scheduleGuetPrompt(payload: GuetPromptPayload, delaySeconds = 120): Promise<string | null> {
  if (Platform.OS === "web" || !payload.owner_id) return null;
  const id = guetPromptId(payload.row_id);
  try {
    await ensureGuetChannel(); await setupGuetCategories();
    await Notifications.cancelScheduledNotificationAsync(id);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: fr.guet_v2.title, body: payload.body ?? fr.guet_v2.discover.replace("{{name}}", payload.place_name), data: { ...payload }, categoryIdentifier: payload.kind === "review" ? "guet-review" : GUET_PROMPT_CATEGORY },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, delaySeconds), repeats: false, ...(Platform.OS === "android" ? { channelId: GUET_CHANNEL_ID } : {}) },
    });
    return id;
  } catch (error) { if (__DEV__) console.warn("[guet] schedule failed", error); return null; }
}
export async function cancelGuetPrompt(rowId: string): Promise<void> {
  if (Platform.OS !== "web") await Notifications.cancelScheduledNotificationAsync(guetPromptId(rowId));
}
export async function cancelAllGuetNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pending.filter(p => p.identifier.startsWith("spawt:guet:")).map(p => Notifications.cancelScheduledNotificationAsync(p.identifier)));
}
export interface NotificationResponseHandler { (action: "confirm" | "snooze" | "default", payload: GuetPromptPayload): void | Promise<void>; }
export function registerNotificationResponseHandler(handler: NotificationResponseHandler): () => void {
  if (Platform.OS === "web") return () => undefined;
  let stopped = false; const seen = new Set<string>();
  const receive = async (event: Notifications.NotificationResponse | null) => {
    if (stopped || !event) return;
    const data = event.notification.request.content.data as Partial<GuetPromptPayload>;
    const id = event.notification.request.identifier;
    if (!id.startsWith(PREFIX) || !data.row_id || !data.place_id || !data.owner_id || seen.has(id)) return;
    seen.add(id);
    await handler(event.actionIdentifier === "confirm" ? "confirm" : "default", data as GuetPromptPayload);
    await Notifications.clearLastNotificationResponseAsync();
  };
  const sub = Notifications.addNotificationResponseReceivedListener(event => { void receive(event).catch(() => undefined); });
  void Notifications.getLastNotificationResponseAsync().then(receive).catch(() => undefined);
  return () => { stopped = true; sub.remove(); };
}
