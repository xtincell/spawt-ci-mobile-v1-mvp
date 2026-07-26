// Wrapper analytics typé — Story 1.7.
//
// Source de vérité : documentation/analytics/events.md (taxonomie figée).
// Le compilateur force la conformité : impossible d'émettre un event hors
// taxonomie ni avec des propriétés manquantes.
//
// Provider : PostHog (architecture §3 l395) — pas encore wiré V1, décision
// Kidam + Madame Sun ouverte (project-context « Décisions historisées #7 »).
// V1 : INSERT batché dans user_signals via Supabase. V2 : ajouter posthog.capture().
//
// Pattern d'usage côté caller :
//   track({ name: "feed_card_clicked", properties: { place_id, position, match_score, distance_km } });
//
// Le wrapper est fire-and-forget : pas de await côté caller, pas de blocage UX.
//
// ━━━ Pipeline (Decisions D2 + D3, code review 2026-05-16) ━━━━━━━━━━━━━━━━━━━
//   track(event)
//     │
//     ▼  build PendingPayload (signal_type + UUID-validated place_id + captured_at)
//   buffer in-memory (cap 100, FIFO)
//     │
//     ▼  flush trigger : timer 2s | 50 events | AppState=background
//   flushBuffer()
//     │
//     ▼  batch insert via insertUserSignals(payloads[])
//   ┌─ success ─┐         ┌─ RLS rejection (pre-auth) ─┐
//   │   clear  │         │  persist to AsyncStorage   │
//   └──────────┘         │  spawt:analytics:pending   │
//                        └────────────────────────────┘
//                                       │
//                       Story 2.3 OTP → flushPendingSignals()
//                                       │
//                                       ▼  drain + batch insert
//
// Cap AsyncStorage : 200 entries, FIFO drop si dépassé.

import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CountryCode, Gender, AgeRange } from "../types/spawter";

// ━━━ signal_type agrégés (DB level) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9 catégories historiques (0003) + swipe_like/swipe_pass (Mode Rapide) +
// crew_vote (Mode Crew) — migration 0046. Le CHECK DB accepte aussi
// reservation — ajouté ici par son chantier quand ses events arrivent.
export type SignalType =
  | "spawt"
  | "review"
  | "view"
  | "save"
  | "share"
  | "search"
  | "filter"
  | "click"
  | "dismiss"
  | "swipe_like"
  | "swipe_pass"
  | "crew_vote";

// ━━━ Discriminated union des events granulaires ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Les 5 events critiques funnel (PRD §16.1) sont strictement typés.
// Les autres acceptent Record<string, unknown> en V1 — raffinement story par story.

// 1. Acquisition
type AppFirstOpen = {
  name: "app_first_open";
  properties: { device_os: string; device_model: string; app_version: string; referrer?: string };
};
type AppOpen = {
  name: "app_open";
  properties: { app_version: string; seconds_since_last_open: number };
};

// 2. Activation onboarding
type OnboardingStarted = { name: "onboarding_started"; properties: Record<string, never> };
type ConsentScreenViewed = {
  name: "consent_screen_viewed";
  properties: Record<string, never>;
};
type ConsentRecorded = {
  name: "consent_recorded";
  properties: { kind: "cgv" | "geoloc"; decision: "accepted" | "declined" };
};
type OnboardingStepCompleted = {
  name: "onboarding_step_completed";
  properties: {
    step: "consent" | "phone" | "profile" | "calibration";
    step_index: 1 | 2 | 3 | 4;
  };
};
type CalibrationAnswered = {
  name: "calibration_answered";
  properties: {
    axis: string;
    direction: "neg" | "pos" | "neutral";
    // P-33 (review 2026-05-18) — `null` distingue le skip explicite d'une
    // réponse neutre (cartes balanced via resolveDirection).
    value: -0.4 | 0 | 0.4 | null;
    // P-25 — flag pour distinguer skip ("Pas d'avis") d'une réponse neutre.
    skipped?: boolean;
  };
};
type OnboardingCompleted = {
  name: "onboarding_completed";
  properties: {
    country_code: CountryCode;
    age_range: AgeRange | null;
    gender: Gender;
    time_to_complete_seconds: number;
    palais_initial_dominant_axes: readonly string[];
  };
};
type OnboardingAbandoned = {
  name: "onboarding_abandoned";
  properties: { last_step: string };
};

// 3. Activation premier spawt
type FeedFirstView = {
  name: "feed_first_view";
  properties: { places_count: number };
};
type PlaceFirstView = {
  name: "place_first_view";
  properties: {
    place_id: string;
    match_score: number;
    distance_km: number;
    time_since_onboarding_seconds: number;
  };
};
type SpawtFirstCompleted = {
  name: "spawt_first_completed";
  properties: { place_id: string; time_since_onboarding_hours: number };
};
type ActivationJ7Reached = {
  name: "activation_j7_reached";
  properties: { spawts_in_window: number };
};

// 4-12. Autres events — typage permissif V1, raffinement story par story.
type GenericEvent<TName extends string> = {
  name: TName;
  properties: Record<string, unknown>;
};

// Liste des event_name granulaires conformes events.md.
type EventName =
  // 1. Acquisition
  | "app_first_open" | "app_open"
  // 2. Activation onboarding
  | "onboarding_started" | "consent_screen_viewed" | "consent_recorded"
  | "onboarding_step_completed" | "calibration_answered"
  | "onboarding_completed" | "onboarding_abandoned"
  // 3. Activation premier spawt
  | "feed_first_view" | "place_first_view" | "spawt_first_completed" | "activation_j7_reached"
  // 4. Feed & recherche
  | "feed_viewed" | "feed_card_impressed" | "feed_card_clicked" | "feed_refreshed"
  | "search_submitted" | "filter_applied"
  // 5. Fiche lieu & ADN
  | "place_viewed" | "place_call_tapped" | "place_whatsapp_tapped"
  | "place_tab_viewed"
  | "place_saved" | "place_unsaved" | "adn_under_construction_seen"
  // 6. Le Guet
  | "guet_armed" | "guet_geofence_triggered" | "guet_threshold_reached"
  | "guet_notification_sent" | "spawt_notification_opened" | "spawt_snoozed"
  | "spawt_completed" | "spawt_passive_recorded" | "spawt_cancelled"
  | "antifraud_flag_raised"
  // 6b. Onglet Spawter géolocalisé (Story 4.10)
  | "nearby_screen_opened" | "nearby_spawt_tapped"
  // 7. Avis
  | "review_started" | "review_submitted" | "review_photo_added" | "review_abandoned"
  | "review_reported"
  // 8. Coup de Cœur
  | "coup_de_coeur_attempted" | "coup_de_coeur_posted" | "coup_de_coeur_quota_exhausted"
  // 9. Stade & Palais & Identité
  | "palais_updated" | "stade_unlocked" | "archetype_assigned" | "archetype_mue"
  | "title_displayed_changed" | "profile_opened" | "spawter_card_flipped"
  | "avatar_updated"
  // 10. Partage
  | "share_initiated" | "share_completed" | "share_link_opened"
  // 11. Auth
  | "auth_otp_sent" | "auth_otp_validated" | "auth_signed_in" | "auth_signed_out"
  | "account_reset" | "account_deletion_requested"
  // 12. Premium
  | "paywall_shown" | "subscription_initiated" | "payment_completed"
  | "subscription_renewed" | "subscription_lapsed"
  // 13. Mode Rapide (swipe de suggestions — migration 0046)
  | "rapide_opened" | "rapide_swipe_like" | "rapide_swipe_pass"
  | "rapide_deck_ended"
  // 14. Mode Explore (collections éditoriales — migration 0045)
  | "explore_opened" | "explore_collection_opened" | "explore_item_clicked"
  // 15. Mode Crew (vote de groupe — migrations 0038 + 0046)
  | "crew_session_created" | "crew_session_joined" | "crew_place_proposed"
  | "crew_vote_cast" | "crew_session_resolved"
  | "crew_code_shared" | "crew_result_shared"
  // 16. Progression complète (badges/collection/paws/défis — 0035-0037 + 0040)
  | "progression_opened"
  // 17. Feature 18 — suggestion de lieu par la Meute (0039)
  | "place_suggestion_submitted"
  // 18. SPAWT Wrapped — rétrospective annuelle + share card
  | "wrapped_opened" | "wrapped_shared";

export type AnalyticsEvent =
  | AppFirstOpen | AppOpen
  | OnboardingStarted | ConsentScreenViewed | ConsentRecorded
  | OnboardingStepCompleted | CalibrationAnswered
  | OnboardingCompleted | OnboardingAbandoned
  | FeedFirstView | PlaceFirstView | SpawtFirstCompleted | ActivationJ7Reached
  // Reste : générique V1, à raffiner story par story.
  | GenericEvent<Exclude<EventName,
      | "app_first_open" | "app_open"
      | "onboarding_started" | "consent_screen_viewed" | "consent_recorded"
      | "onboarding_step_completed" | "calibration_answered"
      | "onboarding_completed" | "onboarding_abandoned"
      | "feed_first_view" | "place_first_view" | "spawt_first_completed" | "activation_j7_reached"
    >>;

// ━━━ Mapping event_name → signal_type (figé) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// `satisfies` force l'exhaustivité au compile-time : ajouter un EventName
// sans entry ici → erreur TS, pas un `undefined` silencieux à l'insert.
const EVENT_TO_SIGNAL = {
  // view
  app_first_open: "view", app_open: "view",
  onboarding_started: "view", consent_screen_viewed: "view",
  feed_first_view: "view", place_first_view: "view", feed_viewed: "view",
  feed_card_impressed: "view", place_viewed: "view",
  // Refonte fiche lieu (R17) — changement d'onglet Média · Menu · Avis.
  place_tab_viewed: "view",
  adn_under_construction_seen: "view", paywall_shown: "view",
  // click
  onboarding_step_completed: "click", calibration_answered: "click",
  onboarding_completed: "click", consent_recorded: "click",
  feed_card_clicked: "click", feed_refreshed: "click",
  place_call_tapped: "click", place_whatsapp_tapped: "click",
  guet_notification_sent: "click", spawt_notification_opened: "click",
  // spawt
  spawt_first_completed: "spawt", spawt_completed: "spawt",
  spawt_passive_recorded: "spawt", guet_armed: "spawt",
  guet_geofence_triggered: "spawt", guet_threshold_reached: "spawt",
  activation_j7_reached: "spawt", antifraud_flag_raised: "spawt",
  // Onglet Spawter géolocalisé (Story 4.10) — open=view, tap=click.
  nearby_screen_opened: "view", nearby_spawt_tapped: "click",
  // review
  review_started: "review", review_submitted: "review",
  review_reported: "click",
  review_photo_added: "review",
  coup_de_coeur_attempted: "review", coup_de_coeur_posted: "review",
  coup_de_coeur_quota_exhausted: "review",
  palais_updated: "review", stade_unlocked: "review",
  archetype_assigned: "review", archetype_mue: "review",
  // Identité (Story 5.2 / 5.3)
  title_displayed_changed: "click",
  profile_opened: "view",
  spawter_card_flipped: "click",
  // R27 (build 8) — changement de photo de profil.
  avatar_updated: "click",
  // save
  place_saved: "save", place_unsaved: "save",
  // share
  share_initiated: "share", share_completed: "share", share_link_opened: "share",
  // search
  search_submitted: "search",
  // filter
  filter_applied: "filter",
  // dismiss
  onboarding_abandoned: "dismiss", review_abandoned: "dismiss",
  spawt_snoozed: "dismiss", spawt_cancelled: "dismiss",
  auth_signed_out: "dismiss", account_reset: "dismiss",
  account_deletion_requested: "dismiss",
  subscription_lapsed: "dismiss",
  // click (auth + premium)
  auth_otp_sent: "click", auth_otp_validated: "click", auth_signed_in: "click",
  subscription_initiated: "click", payment_completed: "click",
  subscription_renewed: "click",
  // Mode Rapide — les swipes ont leur signal_type dédié (0046) : le ML futur
  // les distingue d'un save/dismiss classique (geste ambigu, poids différent).
  rapide_opened: "view", rapide_deck_ended: "view",
  rapide_swipe_like: "swipe_like", rapide_swipe_pass: "swipe_pass",
  // Mode Explore — lecture éditoriale (0045).
  explore_opened: "view", explore_collection_opened: "view",
  explore_item_clicked: "click",
  // Mode Crew — le vote a son signal_type dédié `crew_vote` (0046) : un vote
  // de crew engage socialement, le ML le pèse autrement qu'un like solitaire.
  crew_session_created: "click", crew_session_joined: "click",
  crew_place_proposed: "click", crew_vote_cast: "crew_vote",
  crew_session_resolved: "click",
  crew_code_shared: "share", crew_result_shared: "share",
  // Progression — ouverture de l'écran (badges/collection/paws/défis).
  progression_opened: "view",
  // Feature 18 — envoi d'une suggestion de lieu.
  place_suggestion_submitted: "click",
  // SPAWT Wrapped — ouverture + partage de la carte.
  wrapped_opened: "view", wrapped_shared: "share",
} as const satisfies Record<EventName, SignalType>;

// Regex UUID v4 (validation soft pour `place_id` avant insert — la column DB
// est typée `uuid`, un slug `"place_bushman"` crasherait `22P02`).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ━━━ Configuration du batching ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FLUSH_INTERVAL_MS = 2000;
const FLUSH_THRESHOLD = 50;          // flush dès que le buffer atteint N events
const BUFFER_CAP = 100;              // cap in-memory — FIFO drop au-delà
const MAX_PENDING_PERSISTED = 200;   // cap AsyncStorage pre-auth — FIFO drop
const PENDING_STORAGE_KEY = "spawt:analytics:pending";

// PendingPayload : représentation interne (post-validation place_id,
// + captured_at pour préserver l'horodatage réel à travers le batching/queue).
interface PendingPayload {
  signal_type: SignalType;
  event_name: string;
  place_id: string | null;
  metadata: Record<string, unknown>;
  captured_at: number; // ms epoch — horodatage de capture côté client
}

// State module-scope. Acceptable car analytics est un singleton applicatif.
let buffer: PendingPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscribed = false;

/**
 * Émet un event analytics typé.
 *
 * Fire-and-forget : pas de await côté caller, pas de blocage UX. L'event
 * est bufferisé en mémoire puis flush :
 *   - toutes les {@link FLUSH_INTERVAL_MS} ms par timer
 *   - dès que le buffer atteint {@link FLUSH_THRESHOLD} events
 *   - quand l'app passe en background (AppState)
 *
 * Pre-auth (avant session OTP) : le flush échoue côté RLS, les payloads
 * sont persistés dans AsyncStorage (`spawt:analytics:pending`). Story 2.3
 * (OTP) appellera {@link flushPendingSignals} après `SIGNED_IN` pour drainer.
 *
 * V2 : ajouter `posthog.capture(event.name, event.properties)` quand le
 *      provider est tranché (project-context « Décisions historisées #7 »).
 */
export function track<T extends AnalyticsEvent>(event: T): void {
  const signalType = EVENT_TO_SIGNAL[event.name];

  if (__DEV__) {
    console.info("[analytics]", signalType, event.name, event.properties);
  }

  const rawPlaceId =
    event.properties && typeof event.properties === "object" && "place_id" in event.properties
      ? (event.properties as { place_id?: string }).place_id
      : undefined;
  const placeId =
    typeof rawPlaceId === "string" && UUID_RE.test(rawPlaceId) ? rawPlaceId : null;

  enqueue({
    signal_type: signalType,
    event_name: event.name,
    place_id: placeId,
    metadata: (event.properties as Record<string, unknown>) ?? {},
    captured_at: Date.now(),
  });
}

/**
 * À appeler après un événement `SIGNED_IN` (Story 2.3 OTP). Drain la queue
 * AsyncStorage des events capturés pre-auth et tente un batch insert.
 * Idempotent : si la queue est vide ou si l'insert échoue, no-op silencieux.
 */
export async function flushPendingSignals(): Promise<void> {
  const drained = await drainStorage();
  if (drained.length === 0) return;
  // Ré-injecte dans le buffer pour bénéficier du flush logic standard.
  for (const p of drained) enqueue(p);
  await flushBuffer();
}

function enqueue(payload: PendingPayload): void {
  buffer.push(payload);
  if (buffer.length > BUFFER_CAP) {
    // FIFO drop : on garde les events les plus récents (les anciens sont
    // souvent moins critiques que ceux qui arrivent en flux).
    buffer.splice(0, buffer.length - BUFFER_CAP);
  }
  ensureAppStateListener();
  if (buffer.length >= FLUSH_THRESHOLD) {
    void flushBuffer();
    return;
  }
  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushBuffer();
    }, FLUSH_INTERVAL_MS);
  }
}

async function flushBuffer(): Promise<void> {
  if (buffer.length === 0) return;
  // Snapshot atomique — protège contre les enqueue concurrents pendant le await.
  const batch = buffer;
  buffer = [];
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    // Import dynamique — cohérent avec la règle d'or du data-source.
    const mod = await import("./data-source.supabase");
    if (!("insertUserSignals" in mod)) {
      // Adapter pas encore présent (mode démo strict, future story qui aurait
      // retiré la fonction). On persiste pour ne pas perdre les events.
      await persistToStorage(batch);
      return;
    }
    const inserted = await mod.insertUserSignals(
      batch.map((p) => ({
        signal_type: p.signal_type,
        event_name: p.event_name,
        place_id: p.place_id,
        // captured_at préservé en metadata — Kidam fonde la funnel sur cette
        // valeur (pas sur DB.created_at qui = insert time, peut différer en
        // pre-auth ou si l'app a été offline).
        metadata: { ...p.metadata, captured_at: new Date(p.captured_at).toISOString() },
      })),
    );
    if (!inserted) {
      // Insert refusé (RLS pre-auth, réseau down, etc.) — persist + retry à
      // l'événement SIGNED_IN.
      await persistToStorage(batch);
    }
  } catch (err) {
    if (__DEV__) console.warn("[analytics] flush failed, persisting batch", err);
    await persistToStorage(batch);
  }
}

async function persistToStorage(payloads: readonly PendingPayload[]): Promise<void> {
  try {
    const existing = await drainStorage();
    const merged = [...existing, ...payloads];
    // FIFO drop : on garde les MAX_PENDING_PERSISTED derniers.
    const capped =
      merged.length > MAX_PENDING_PERSISTED
        ? merged.slice(merged.length - MAX_PENDING_PERSISTED)
        : merged;
    await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(capped));
  } catch (err) {
    if (__DEV__) console.warn("[analytics] persistToStorage failed", err);
  }
}

async function drainStorage(): Promise<PendingPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(PENDING_STORAGE_KEY);
    return JSON.parse(raw) as PendingPayload[];
  } catch {
    return [];
  }
}

function ensureAppStateListener(): void {
  if (appStateSubscribed) return;
  appStateSubscribed = true;
  AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") {
      void flushBuffer();
    }
  });
}
