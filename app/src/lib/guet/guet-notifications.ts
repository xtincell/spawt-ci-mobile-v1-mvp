// Story 4.1 + 4.2 — Wrapper expo-notifications.
// Story 4.1 : channel Android + cleanup helper.
// Story 4.2 : schedule du prompt 15min + catégorie d'actions (Confirmer/Snooze) +
// listener `addNotificationResponseReceivedListener` qui route vers les helpers
// `guet-spawt-actions.ts` (re-vérif state row Option C avant prompt).

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "guet";
const CATEGORY_ID = "guet-prompt";
const PROMPT_PREFIX = "spawt:guet:prompt:";

let channelEnsured = false;
let categoriesSetup = false;
let responseListener: { remove: () => void } | null = null;

/** Crée le channel Android "guet" — idempotent (Notifications API gère le replace). */
export async function ensureGuetChannel(): Promise<void> {
  if (channelEnsured) return;
  if (Platform.OS !== "android") {
    channelEnsured = true;
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Le Guet",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
    channelEnsured = true;
  } catch (err) {
    if (__DEV__) console.warn("[guet-notifications] ensureGuetChannel failed", err);
  }
}

/**
 * Cleanup helper — Story 4.2 utilisera pour cancel les prompts au logout/exit.
 * V1 : cancel toutes les notifs schedulées (granulaire à Sprint 2).
 */
export async function cancelAllGuetNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    if (__DEV__) console.warn("[guet-notifications] cancel failed", err);
  }
}

export const GUET_CHANNEL_ID = CHANNEL_ID;
export const GUET_PROMPT_CATEGORY = CATEGORY_ID;

/** Identifiant déterministe basé sur row_id — permet cancel idempotent. */
export function guetPromptId(row_id: string): string {
  return `${PROMPT_PREFIX}${row_id}`;
}

/**
 * Story 4.2 — Déclare la catégorie de notif avec 2 actions :
 * "Confirmer" et "Snooze 15min". À appeler 1× au boot.
 */
export async function setupGuetCategories(): Promise<void> {
  if (categoriesSetup) return;
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      {
        identifier: "confirm",
        buttonTitle: "Confirmer",
        options: { opensAppToForeground: true },
      },
      {
        identifier: "snooze",
        buttonTitle: "Snooze 15min",
        options: { opensAppToForeground: false },
      },
    ]);
    categoriesSetup = true;
  } catch (err) {
    if (__DEV__) console.warn("[guet-notifications] setupGuetCategories failed", err);
  }
}

export interface GuetPromptPayload {
  row_id: string;
  place_id: string;
  place_name: string;
}

/**
 * Schedule la notif "Comment c'était ?" 15min après l'entrée en zone.
 *
 * Option C (Story 4.2 Dev Notes §1) — OS scheduler survie OS-kill +
 * re-vérification à la réception côté handler (si row exit < 15min, dismiss).
 *
 * `delaySeconds` permet aux tests + au snooze de raccourcir le délai.
 */
export async function scheduleGuetPrompt(
  payload: GuetPromptPayload,
  delaySeconds: number = 15 * 60,
): Promise<string | null> {
  const id = guetPromptId(payload.row_id);
  try {
    // Cancel précédent si existant (idempotence — re-arming).
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {
      /* no-op si pas trouvé */
    });
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: "Le Guet a sonné",
        body: `Comment c'était chez ${payload.place_name} ? Le Chat attend ton avis.`,
        data: { row_id: payload.row_id, place_id: payload.place_id },
        categoryIdentifier: CATEGORY_ID,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: { seconds: Math.max(1, delaySeconds) } as Notifications.NotificationTriggerInput,
    });
    return id;
  } catch (err) {
    if (__DEV__) console.warn("[guet-notifications] scheduleGuetPrompt failed", err);
    return null;
  }
}

export async function cancelGuetPrompt(row_id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(guetPromptId(row_id));
  } catch (err) {
    if (__DEV__) console.warn("[guet-notifications] cancelGuetPrompt failed", err);
  }
}

export interface NotificationResponseHandler {
  (action: "confirm" | "snooze" | "default", payload: GuetPromptPayload): void | Promise<void>;
}

/**
 * Story 4.2 — Listener tap notif + actions. À appeler au Root layout après
 * `setupGuetCategories`. Idempotent (clean previous subscription).
 */
export function registerNotificationResponseHandler(
  handler: NotificationResponseHandler,
): () => void {
  responseListener?.remove();
  responseListener = Notifications.addNotificationResponseReceivedListener((event) => {
    const data = event.notification.request.content.data as {
      row_id?: string;
      place_id?: string;
    };
    if (!data?.row_id || !data?.place_id) return;
    const action: "confirm" | "snooze" | "default" =
      event.actionIdentifier === "confirm"
        ? "confirm"
        : event.actionIdentifier === "snooze"
        ? "snooze"
        : "default";
    void handler(action, {
      row_id: data.row_id,
      place_id: data.place_id,
      // place_name est lu par le caller via lookup (pas dans la notif data pour
      // garder le payload minimal — la notif body affiche déjà le nom).
      place_name: "",
    });
  });
  return () => {
    responseListener?.remove();
    responseListener = null;
  };
}
