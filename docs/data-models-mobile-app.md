# Data Models — `mobile-app` (Expo/React Native)

> Source de vérité : `app/src/types/*.ts` (TypeScript strict). Aligné PRD V1.0.0 (§13) + amendements team du Sprint 1 (`documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §4).
>
> Mode démo : aucune table n'est requise — les seeds vivent dans `app/src/data/seed/`. Mode Supabase : les tables ci-dessous sont attendues côté backend (migrations à venir Sprint 1 Phase 1).

---

## 1. Vue d'ensemble

| Entité | Type fichier | Rôle | Source PRD |
|---|---|---|---|
| `Spawter` | `types/spawter.ts` | Utilisateur public B2C (renommé `users` → `spawters` — amendement 4.1) | §13.1 |
| `OnboardingDraft` | `types/spawter.ts` | Brouillon éphémère pendant les 4 étapes d'onboarding | §3.1 #2 |
| `UserPalais` | `types/palais.ts` | Profil gustatif 5 axes [-1,1] + confidence [0,1] | §5.1, §13.1 |
| `Place`, `PlaceAdn` | `types/place.ts` | Lieu + son ADN 5 axes calculé | §6, §13.2 |
| `SpawtCheckin` | `types/spawt.ts` | Mécanisme du Guet (anciennement `check_in`) + avis attaché | §3.1 #5, §13.7 |
| `Stade` | `types/stade.ts` | 5 paliers de maturité + descripteurs (poids avis, ton du Chat, quotas Coups de Cœur) | §3.1 #8, §5.2 |

Toutes les FK historiquement vers `users(id)` pointent désormais vers `spawters(id)` (cf. amendement team 4.1).

---

## 2. `Spawter` — utilisateur public

[`app/src/types/spawter.ts`](../app/src/types/spawter.ts)

```ts
type Spawter = {
  id: string;
  phone_e164: string;            // clé d'auth primaire (PRD §3.1 #1)
  display_name: string;
  avatar_url: string | null;
  neighborhood: string | null;   // quartier déclaré
  country_code: CountryCode;     // amendement 4.5 — pays de résidence
  origin_country_code: CountryCode | null; // amendement 4.5 — pays d'origine
  gender: "homme" | "femme" | "autre" | "non_renseigne";   // amendement 4.5
  age_range: "18-24" | "25-34" | "35-44" | "45-54" | "55+" | null;
  stade: Stade;
  total_spawts: number;
  unique_spots: number;
  customer_id: string | null;    // FK -> customers (amendement 4.2 — entité commerciale)
  geoloc_consent_at: string | null;  // ISO — Claude amendment 5.2 (ARTCI/Loi 2013-450)
  data_consent_at: string | null;
  created_at: string;
  updated_at: string;
};

type CountryCode = "CI" | "NG" | "SN" | "CM" | "TG" | "BJ" | "BF" | "ML" | "GN" | "GH";
```

**Invariants :**
- `phone_e164` UNIQUE (auth)
- Toute écriture mobile passe par `useSpawterStore.finalizeOnboarding()` ([`app/src/store/spawter-store.ts:69-112`](../app/src/store/spawter-store.ts#L69-L112)).
- Persistance locale (AsyncStorage) **avant** sync Supabase — fire-and-forget : `void saveSpawter(spawter)` ([`spawter-store.ts:109`](../app/src/store/spawter-store.ts#L109)).
- `customer_id` reste null tant que pas d'upgrade Gold (table `customers` séparée — amendement 4.2).

---

## 3. `UserPalais` — profil gustatif

[`app/src/types/palais.ts`](../app/src/types/palais.ts)

```ts
const PALAIS_AXES = [
  "racines_horizons",         // Racines (-1) ↔ Horizons (+1)
  "taniere_nomade",           // Tanière (-1) ↔ Nomade (+1)
  "exigeant_enthousiaste",    // Exigeant (-1) ↔ Enthousiaste (+1)
  "foule_secret",             // Foule (-1) ↔ Secret (+1)
  "maquis_table",             // Maquis (-1) ↔ Table (+1)
] as const;

type UserPalais = {
  spawter_id: string;          // PK + FK → spawters
  axe_racines_horizons: number;       // [-1, 1]
  axe_taniere_nomade: number;
  axe_exigeant_enthousiaste: number;
  axe_foule_secret: number;
  axe_maquis_table: number;
  confidence_score: number;           // [0, 1] — <0.3 ⇒ "En construction"
  dominant_axes: [PalaisAxis, PalaisAxis] | null;  // 2 axes les + marqués
  archetype_id: string | null;        // V1.5 (Sprint 2)
  stade: Stade;
  total_spawts: number;
  updated_at: string;
};
```

**Politique d'historisation : overwrite** (amendement team 4.6). Pas d'historique des Palais en V1 — l'historique des stades est implicite via `collection_titres`. Évaluation tendances par BU = V1.5+.

**Moteur** : [`app/src/lib/palais-engine.ts`](../app/src/lib/palais-engine.ts) — apprentissage exponentiel `learningFactor(uniqueSpots) = max(0.05, 1 / (1 + uniqueSpots × 0.05))`. Confidence : `1 - 1 / (1 + uniqueSpots × 0.05)`.

**Calibrage initial** : 5 questions onboarding → deltas `[-0.4, 0, +0.4]` par axe ([`spawter-store.ts:141-145`](../app/src/store/spawter-store.ts#L141-L145)).

---

## 4. `Place` + `PlaceAdn` — lieu + ADN

[`app/src/types/place.ts`](../app/src/types/place.ts)

```ts
type Place = {
  id: string;
  name: string;
  cuisine: CuisineCategory[];   // ivoirienne | ouest_africaine | francaise | ...
  location: PlaceLocation;       // lat/lng + descriptive_address ouest-africain (PRD §14.2)
  price: { tier: 1 | 2 | 3; avg_ticket_xof?: number };
  hours: Record<DayOfWeek, OpeningSlot[]>;
  phone: string | null;
  whatsapp: string | null;
  cover_photo_url: string | null;
  gallery_urls: string[];
  signals: PlaceSignal[];        // coup_de_coeur, pepite_verifiee, institution, ...
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type PlaceAdn = {
  place_id: string;              // PK + FK → places
  axe_local_international: number;     // [-1, 1]
  axe_informel_etabli: number;
  axe_budget_premium: number;
  axe_populaire_prive: number;
  axe_decontracte_habille: number;
  confidence_score: number;            // [0, 1]
  total_reviews: number;
  weighted_rating: number;             // Note pondérée par stade (PRD §3.1 #6)
  updated_at: string;
};
```

**Note Stéphanie (anti-mensonge user)** : afficher *« ADN en construction »* tant que `confidence_score < 0.3`. Implémenté côté UI dans [`app/app/place/[id].tsx:63`](../app/app/place/%5Bid%5D.tsx#L63) et [`(tabs)/profile.tsx:32`](../app/app/%28tabs%29/profile.tsx#L32).

**Cold start (Claude amendment 5.4)** : 3 avis fondateurs par lieu en seed marqués `is_seed = true` sur `spawt_checkin` — alimentent l'ADN sans être comptés dans `total_reviews` public.

---

## 5. `SpawtCheckin` — mécanisme du Guet

[`app/src/types/spawt.ts`](../app/src/types/spawt.ts) — table SQL `spawt_checkin`.

```ts
type SpawtCheckin = {
  id: string;
  spawter_id: string;            // FK → spawters (amendement 4.1)
  place_id: string;              // FK → places
  arrived_at: string;            // détection geofence (10m) — PRD §7.1
  notified_at: string | null;    // push "Comment c'était ?"
  snoozed_at: string | null;
  snooze_count: number;          // 0..3 (max ANTIFRAUD_RULES.MAX_SNOOZE_COUNT)
  checked_in_at: string | null;  // confirmation utilisateur
  left_at: string | null;        // sortie du périmètre 10m OU expiration fenêtre +30min
  check_in_type: "active" | "passive" | "manual";
  session_duration_minutes: number | null;
  geolocation_lat: number | null;
  geolocation_lng: number | null;
  accuracy_meters: number | null;
  geolocation_source: "gps" | "network" | "manual";
  distance_to_lieu_meters: number | null;
  is_verified: boolean;          // geoloc OK + dans périmètre
  flag_reason: AntifraudFlag | null;  // amendement Claude 5.3
  // Avis attaché (peut rester null = check-in passif, poids 0.5x)
  note_etoiles: 1 | 2 | 3 | 4 | 5 | null;
  texte_avis: string | null;
  tags: ReviewTag[];             // copieux | rapide | ambiance_top | cher | a_refaire
  photos: string[];              // URLs (3 max)
  is_cancelled: boolean;
  is_seed: boolean;              // amendement Claude 5.4 — avis fondateur
  created_at: string;
  updated_at: string;
};

type AntifraudFlag =
  | "frequence_meme_lieu"     // <4h sur le même lieu
  | "frequence_globale"       // >5 spawts/jour
  | "vitesse_anormale"        // >100 km/h entre 2 spawts
  | "sans_geoloc"             // verified=false
  | "pattern_repetitif"       // 10+ spawts identiques en 7j
  | "incoherence_duree";      // session<5min ET active
```

### 5.1 Constantes anti-fraude — invariants techniques

[`app/src/types/spawt.ts:81-100`](../app/src/types/spawt.ts#L81-L100)

```ts
const ANTIFRAUD_RULES = {
  MIN_HOURS_SAME_PLACE: 4,
  MAX_SPAWTS_PER_DAY: 5,
  MAX_SPEED_KMH_BETWEEN_SPAWTS: 100,
  PATTERN_DETECTION_WINDOW_DAYS: 7,
  PATTERN_DETECTION_THRESHOLD: 10,
  MIN_SESSION_MINUTES_FOR_ACTIVE: 5,
  GEOFENCE_RADIUS_METERS: 10,         // PRD §7.1
  PRESENCE_THRESHOLD_MINUTES: 15,     // timer avant notif
  POST_LEAVE_WINDOW_MINUTES: 30,      // fenêtre de notation post-sortie
  MAX_SNOOZE_COUNT: 3,
  SNOOZE_DURATION_MINUTES: 15,
  PASSIVE_CHECKIN_WEIGHT: 0.5,
};
```

Les 6 règles anti-fraude (Claude amendment 5.3) **doivent être implémentées en triggers SQL** côté Supabase, pas seulement côté client. Phase 1.3 du plan de livraison Sprint 1.

### 5.2 Décisions ouvertes (cahier §4.7)

- `session_duration_minutes` : calculé en temps réel `now() - checked_in_at` tant que `left_at` est null, snapshot final à la sortie. **À confirmer tech lead.**
- Définition « fin de session » : `left_at` = sortie du périmètre 10m **OU** expiration fenêtre +30min après notif, selon le premier survenu. Logout applicatif **ne** termine **pas** une session. **À confirmer tech lead.**

---

## 6. `Stade` — 5 paliers de maturité

[`app/src/types/stade.ts`](../app/src/types/stade.ts) — pas une table, c'est une enum + descripteurs dérivés.

| Stade | min `unique_spots` | max | reviewWeight | coupsDeCoeurBase | chatTone |
|---|---|---|---|---|---|
| `touriste` | 0 | 11 | 1.0 | 1 | enjoue_taquin |
| `explorateur` | 11 | 21 | 1.5 | 1 | complice |
| `detective` | 21 | 31 | 2.0 | 1 | grave_respectueux |
| `djidji` | 31 | 51 | 2.5 | 2 | solennel |
| `guide` | 51 | ∞ | 3.0 | 3 | rare_sacre |

```ts
function getStade(uniqueSpots: number): Stade {
  if (uniqueSpots < 11) return "touriste";
  if (uniqueSpots < 21) return "explorateur";
  if (uniqueSpots < 31) return "detective";
  if (uniqueSpots < 51) return "djidji";
  return "guide";
}
```

**Invariants** :
- La maturité **ne recule jamais** (PRD §5.2). Pas de SQL DELETE/UPDATE qui réduise `stade`.
- Calcul côté store : [`spawter-store.ts:114-133`](../app/src/store/spawter-store.ts#L114-L133) — `unique_spots` = `Set(spawts.filter(is_verified).map(place_id)).size`.

---

## 7. Tables Supabase attendues (à créer Sprint 1 Phase 0)

> Migrations versionnées non encore livrées (cahier §3.1 + état CHANGELOG v1.1.2). Schéma déduit des types TypeScript et des amendements team.

| Table | Origine | Notes |
|---|---|---|
| `spawters` | renommée `users` (amendement 4.1) | toutes FK historiques pointent ici |
| `spawt_staff` | nouvelle (amendement 4.1) | équipe interne (modos, allies, admin) |
| `customers` | nouvelle (amendement 4.2) | entité commerciale séparée du B2C |
| `plans` | nouvelle (amendement 4.3) | `code, label, price_ht, currency_id, country_code, period` |
| `currencies` | nouvelle (amendement 4.4) | `code (ISO 4217), base_rate, modifier, country_code` |
| `places` | PRD §13.2 | `is_published` filtre côté client ([`data-source.supabase.ts:14`](../app/src/lib/data-source.supabase.ts#L14)) |
| `place_adn` | PRD §13.2 | 1:1 avec `places`, joined via `select("*, place_adn(*)")` |
| `user_palais` | PRD §13.1 | overwrite (amendement 4.6) |
| `spawter_progression` | PRD §13.x | overwrite |
| `collection_titres` | PRD §13.x | append (mémoire d'identité) |
| `user_signals` | PRD §13.3 | **append-only** (matière première ML) |
| `spawt_checkin` | PRD §13.7 | append + flags anti-fraude (Claude 5.3) |
| `subscriptions` | PRD §11 | `plan_id` (amendement 4.3) + `customer_id` (amendement 4.2) |
| `invoices` | PRD §11 | `customer_id` (amendement 4.2) |
| `feature_flags` | nouvelle (Claude amendment 5.5) | `(spawter_id NULL, flag_code, enabled, scope)` |

---

## 8. Mapping client ↔ tables

[`app/src/lib/data-source.ts`](../app/src/lib/data-source.ts) — adaptateur unique. [`data-source.supabase.ts`](../app/src/lib/data-source.supabase.ts) chargé dynamiquement si `EXPO_PUBLIC_SUPABASE_URL` + `_ANON_KEY` présents.

| Méthode client | Table(s) | Mode démo (fallback) |
|---|---|---|
| `listPlaces()` | `places` join `place_adn` (where `is_published=true`) | `SEED_PLACES` (12 lieux Abidjan) |
| `getPlace(id)` | idem `single()` | `SEED_PLACES.find` |
| `listSpawtsForSpawter(spawter_id)` | `spawt_checkin` order by `created_at desc` | `[]` (vide en démo) |
| `saveSpawter(spawter)` | `spawters` upsert | géré côté store via AsyncStorage |
| `savePalais(palais)` | `user_palais` upsert | idem |

---

## 9. Liens

- Spec produit : `documentation/SPAWT_PRD_V1.docx` §13 (modèle de données)
- Cahier Sprint 1 : `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §4 (amendements)
- Architecture mobile : [architecture-mobile-app.md](./architecture-mobile-app.md)
- API contracts : [api-contracts-mobile-app.md](./api-contracts-mobile-app.md)
