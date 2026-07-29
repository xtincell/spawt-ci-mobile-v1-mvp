// PRD §3.1 Feature 5 + §13.7 — table spawt_checkin (mécanisme du Guet)
//
// Le Guet : le Chat fait le guet en silence quand tu approches d'un lieu
// (geofence détecté), patiente pendant que tu manges, puis te demande
// "alors, c'était comment ?" à la sortie. Renommage VTC → Le Guet
// (anti-jargon : pas d'emprunt à Uber/Bolt). Cf. Moka §4.3.

export type CheckInType = "active" | "passive" | "manual";

export type GeolocationSource = "gps" | "network" | "manual";

export interface SpawtCheckin {
  id: string;
  spawter_id: string;
  /** Lieu du check-in */
  place_id: string;
  /** Détecté par geofencing (10m) — PRD §7.1 */
  arrived_at: string;
  /** Notification envoyée au spawter ("Comment c'était ?") */
  notified_at: string | null;
  /** Snooze (max 3) — PRD §3.1 Feature 5 */
  snoozed_at: string | null;
  snooze_count: number; // 0..3
  /** Action utilisateur confirmée */
  checked_in_at: string | null;
  /** Détection sortie de zone */
  left_at: string | null;
  check_in_type: CheckInType;
  /** Calculé en temps réel `now() - checked_in_at` tant que `left_at` est null,
   *  snapshot final à la sortie. Cf. cahier des charges Sprint 1 §4.7. */
  session_duration_minutes: number | null;
  geolocation_lat: number | null;
  geolocation_lng: number | null;
  accuracy_meters: number | null;
  geolocation_source: GeolocationSource;
  distance_to_lieu_meters: number | null;
  /** Vérifié si geoloc OK et dans périmètre 10m */
  is_verified: boolean;
  /** Drapeaux anti-fraude (Claude amendment 5.3) */
  flag_reason: AntifraudFlag | null;
  /** Avis attaché — null si check-in passif sans note (poids 0.5x) */
  note_etoiles: 1 | 2 | 3 | 4 | 5 | null;
  texte_avis: string | null;
  tags: ReviewTag[];
  photos: string[];
  is_cancelled: boolean;
  /** Avis fondateur — Claude amendment 5.4 (cold start) */
  is_seed: boolean;
  created_at: string;
  updated_at: string;
}

export const REVIEW_TAGS = [
  "copieux",
  "rapide",
  "ambiance_top",
  "cher",
  "a_refaire",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  copieux: "Copieux",
  rapide: "Rapide",
  ambiance_top: "Ambiance top",
  cher: "Cher",
  a_refaire: "À refaire",
};

/** Drapeaux anti-fraude — Claude amendment 5.3, basés sur PRD §20.4 */
export type AntifraudFlag =
  | "frequence_meme_lieu" // <4h depuis dernier spawt sur le lieu
  | "frequence_globale" // >5 spawts/jour
  | "vitesse_anormale" // >100 km/h entre 2 spawts
  | "sans_geoloc" // verified=false
  | "pattern_repetitif" // 10+ spawts identiques en 7j
  | "incoherence_duree"; // session<5min ET active

/** Constantes anti-fraude — invariants techniques (PRD §20.4 + Claude 5.3) */
export const ANTIFRAUD_RULES = {
  MIN_HOURS_SAME_PLACE: 4,
  MAX_SPAWTS_PER_DAY: 5,
  MAX_SPEED_KMH_BETWEEN_SPAWTS: 100,
  PATTERN_DETECTION_WINDOW_DAYS: 7,
  PATTERN_DETECTION_THRESHOLD: 10,
  MIN_SESSION_MINUTES_FOR_ACTIVE: 5,
  /** Périmètre de détection check-in (PRD §7.1) */
  GEOFENCE_RADIUS_METERS: 10,
  /** Timer avant notification (PRD §7.1) */
  PRESENCE_THRESHOLD_MINUTES: 15,
  /** Fenêtre de notation post-sortie (PRD §7.1) */
  POST_LEAVE_WINDOW_MINUTES: 30,
  /** Snooze max */
  MAX_SNOOZE_COUNT: 3,
  /** Snooze duration */
  SNOOZE_DURATION_MINUTES: 15,
  /** Poids check-in passif (PRD §7.1) */
  PASSIVE_CHECKIN_WEIGHT: 0.5,
} as const;
