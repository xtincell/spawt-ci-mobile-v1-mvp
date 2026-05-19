// Story 4.1 — Point d'entrée du module guet/.
// L'import depuis `app/app/_layout.tsx` déclenche l'enregistrement top-level
// de `defineTask` dans guet-task.ts (effet de bord side-effect import).

export {
  GUET_TASK,
  setPlaceNameLookup,
  registerGeofenceCallback,
  _simulateGeofenceForTest,
} from "./guet-task";

export {
  armGuet,
  disarmGuet,
  isGuetArmed,
  selectClosestPlaces,
  getArmedPlaceIds,
  _resetArmedForTest,
  MAX_ACTIVE_GEOFENCES,
  GEOFENCE_RADIUS_METERS,
} from "./geofence";

export {
  ensureGuetChannel,
  cancelAllGuetNotifications,
  setupGuetCategories,
  scheduleGuetPrompt,
  cancelGuetPrompt,
  registerNotificationResponseHandler,
  guetPromptId,
  GUET_CHANNEL_ID,
  GUET_PROMPT_CATEGORY,
  type GuetPromptPayload,
  type NotificationResponseHandler,
} from "./guet-notifications";

export { ensureNotifPermissionPostOTP } from "./guet-permissions";

export {
  computeConfirmPatch,
  computeSnoozePatch,
  computePassivePatch,
  buildManualSpawt,
  type GpsMeasurement,
  type ConfirmResult,
} from "./guet-spawt-actions";

export type {
  ArmablePlace,
  SpawterLocation,
} from "./geofence";

export type {
  GeofenceEventType,
  GeofenceCallback,
} from "./guet-task";
