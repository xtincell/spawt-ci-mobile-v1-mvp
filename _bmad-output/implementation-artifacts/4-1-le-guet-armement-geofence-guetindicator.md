# Story 4.1: Le Guet — armement, geofence & GuetIndicator

Status: review

<!-- Story de fondation Epic 4 — livre la migration SQL `0011_create_spawt_checkin.sql`
(table + RLS `spawter_id = auth.uid()` + index + `is_seed`), `app/src/lib/guet/`
(geofence.ts, guet-task.ts, guet-notifications.ts) avec `expo-task-manager` ajouté
en dépendance, et le composant `GuetIndicator`. Elle ne livre PAS la notification
« Comment c'était ? » (Story 4.2) ni la confirmation spawt (Story 4.2). Story 4.1
arme Le Guet, détecte l'entrée en zone et l'expose visuellement — point. -->

## Story

As a spawter,
I want que le Chat détecte automatiquement mon arrivée dans un lieu publié,
so that ma présence physique est prouvée sans que j'aie rien à faire pendant le repas — et que je vois discrètement que ça tourne via `GuetIndicator`.

## ⚠️ Brownfield context — read first

Epic 4 = **brique data centrale** (project-context, architecture §Cross-Cutting). Story 4.1 est sa **fondation** : sans `spawt_checkin` créée + `expo-task-manager` câblé + `GuetIndicator` monté, aucune autre story Epic 4 ne tourne (4.2 consomme la table, 4.3 la queue, 4.4 les triggers anti-fraude, 4.5 attache un avis, 4.6/4.7 consomment l'event spawt). **Tout est en aval.**

État courant à respecter :

| Élément | Fichier / Table | État | Action Story 4.1 |
|---|---|---|---|
| Type TS `SpawtCheckin` | [app/src/types/spawt.ts](../../app/src/types/spawt.ts) | ✅ Existe (Epic 1) — incl. `ANTIFRAUD_RULES.GEOFENCE_RADIUS_METERS = 10`, `PRESENCE_THRESHOLD_MINUTES = 15`, `POST_LEAVE_WINDOW_MINUTES = 30` | **Garder** — la migration SQL doit refléter ce shape (pas d'invention de champ) |
| Migration `spawt_checkin` | `supabase/migrations/0011_create_spawt_checkin.sql` | ❌ N'existe pas (architecture §Project Structure prévoit `0007` historique, mais la séquence livrée s'arrête à `0010_create_places_place_adn`) | **Créer** + `.down.sql` appairé. Numéro `0011_` (la prochaine séquence libre) |
| RLS `spawter_id = auth.uid()` | (aucune) | ❌ N'existe pas | **Définir** : SELECT/INSERT propres au spawter, UPDATE propre tant que `is_seed = false`, DELETE refusée publiquement |
| `app/src/lib/guet/geofence.ts` | (aucun) | ❌ N'existe pas | **Créer** — wrapper `expo-location` `startGeofencingAsync` + précision GPS + battery guard (NFR-GEO-02/04) |
| `app/src/lib/guet/guet-task.ts` | (aucun) | ❌ N'existe pas | **Créer** — `TaskManager.defineTask(GUET_TASK, ...)` enregistré **au niveau module** (top-level), pas dans un composant (architecture §State Management Patterns) |
| `app/src/lib/guet/guet-notifications.ts` | (aucun) | ❌ N'existe pas | **Créer** — channel Android + helpers — V1 minimal (Story 4.2 livrera le contenu `Comment c'était ?`). Pour 4.1 : juste la création de channel + permission + helper `cancelAllForPlace` |
| Composant `GuetIndicator` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/GuetIndicator.tsx](../../app/src/components/GuetIndicator.tsx) — pastille verte pulsée + label + `accessibilityLiveRegion="polite"` |
| Dépendance `expo-task-manager` | `app/package.json` | ❌ Absente | **Ajouter** — version compatible Expo SDK 55 (cible `~55.0.16`) |
| Feature flag `guet-geofence` | `feature_flags` | ❌ Pas seedé | **Seeder** via migration update ou seed SQL séparé `supabase/seed/feature_flags_guet.sql` — scope `internal` activé V1, `prod` désactivé |
| Bouton CTA manuel mode démo | [app/app/place/[id].tsx](../../app/app/place/%5Bid%5D.tsx) | ⚠️ Bouton stub Story 3.4 (Alert) | **Spec'd**, mais l'implémentation persistance « Je spawt ici » reste Story 4.2 (active confirmation). Story 4.1 cadre seulement le wording « aperçu du geste » + DataSourceBanner-aware visibility |
| Events analytics `guet_armed`, `guet_geofence_triggered` | `analytics.ts` | ✅ Définis ([app/src/lib/analytics.ts:158](../../app/src/lib/analytics.ts#L158)) | **Consommer** via `track({ name, properties })`. Pas de redéfinition |
| String i18n `guet.*` | `app/src/i18n/fr.json` | ⚠️ 2 entrées présentes (`fab.stub_body`, `notif.spawt_cta_demo_hint`) — pas la copy `GuetIndicator` | **Ajouter** clés `guet.indicator_label`, `guet.cta_manual_demo`, `guet.stub_blocked_geoloc` + tonalité Chat alignée stade (voir §1 Dev Notes) |
| Permissions runtime géoloc | `app.json` | ✅ Déclarées (`ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` + `expo-location` plugin avec `locationAlwaysAndWhenInUsePermission`) | **Demander** au runtime — pas au boot, seulement quand `recordConsent("geoloc", true)` a été posé ET la fiche lieu est ouverte (lazy permission request) |

**Décisions héritées non-revisitables** :

- **`spawter_id = auth.uid()` RLS** — invariant architecture §Authentication & Security.
- **`is_seed` colonne** sur `spawt_checkin` (Claude amendment 5.4) — un avis fondateur = un `spawt_checkin` (cf. architecture §Data Architecture, story 3.3a confirmed).
- **Périmètre 10m + timer 15min + fenêtre +30min + max snooze 3** — figés dans `ANTIFRAUD_RULES` ([app/src/types/spawt.ts:81-100](../../app/src/types/spawt.ts#L81-L100)).
- **Moyenne 3 dernières positions GPS sur 30s** (NFR-GEO-03) avant trigger — implémenté côté `geofence.ts` ou `guet-task.ts`, pas dans le composant.
- **Précision GPS > 30m → mode manuel** (NFR-GEO-02) ; **batterie < 10% → mode manuel** (NFR-GEO-04). Implémentation côté task.
- **OS-tue-app Tecno/Infinix** (NFR-AVAIL-03) : geofences persistées au niveau OS (`expo-location.startGeofencingAsync` + `expo-task-manager.defineTask` enregistré top-level). Pas de service foreground custom V1.
- **Pas d'`await` dans une action user-facing** — `armGuet(place_id)` est `void`, fire-and-forget côté caller (project-context §Anti-patterns techniques).
- **Lib `expo-location` déjà installée** (`~55.1.8`). Ajout = `expo-task-manager` uniquement.
- **Mode démo** (Expo Go, `isSupabaseConfigured = false` ou `Constants.appOwnership === "expo"`) : géofence **non armée**, CTA manuel « Je spawt ici (mode démo) » sur fiche lieu. La logique de spawt manuel reste Story 4.2 — Story 4.1 ne fait que **garder le wording aligné** sur l'EventBus existant.

**Décisions à trancher dans cette story** (en Dev Notes) :

- **D1 — Activation par défaut** : faut-il armer Le Guet pour **tous** les lieux `is_published = true` (geofences en batch au boot), ou seulement les **N plus proches** du spawter (radius rolling N=20) ? PRD §7.1 silencieux. **Recommandation** : N=20 plus proches (battery + iOS limite à ~20 geofences simultanés). Voir Dev Notes §1.
- **D2 — `accuracy_meters` lissage** : la moyenne des 3 dernières positions sur 30s (NFR-GEO-03) — est-ce qu'on stocke les 3 brutes ou seulement la moyenne dans `spawt_checkin` ? **Recommandation** : moyenne seulement (column `accuracy_meters` existe déjà). Voir Dev Notes §2.
- **D3 — `arrived_at` source de vérité** : le timestamp côté client (`new Date().toISOString()` au moment du trigger task) ou côté serveur (`DEFAULT now()`) ? **Recommandation** : client (offline-friendly, cohérent avec Story 4.3 queue). Voir Dev Notes §3.

## Acceptance Criteria

**AC #1 — Migration SQL `0011_create_spawt_checkin.sql` + `.down.sql`**

**Given** le dossier `supabase/migrations/`
**When** Story 4.1 est livrée
**Then** **2 fichiers** existent :

1. `supabase/migrations/0011_create_spawt_checkin.sql` :
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;

   CREATE TABLE spawt_checkin (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     spawter_id UUID NOT NULL REFERENCES spawters(id) ON DELETE CASCADE,
     place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
     -- Cycle du Guet
     arrived_at TIMESTAMPTZ NOT NULL,
     notified_at TIMESTAMPTZ,
     snoozed_at TIMESTAMPTZ,
     snooze_count SMALLINT NOT NULL DEFAULT 0 CHECK (snooze_count BETWEEN 0 AND 3),
     checked_in_at TIMESTAMPTZ,
     left_at TIMESTAMPTZ,
     check_in_type TEXT NOT NULL CHECK (check_in_type IN ('active','passive','manual')),
     session_duration_minutes INTEGER CHECK (session_duration_minutes IS NULL OR session_duration_minutes >= 0),
     -- Géoloc
     geolocation_lat DOUBLE PRECISION,
     geolocation_lng DOUBLE PRECISION,
     accuracy_meters REAL CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
     geolocation_source TEXT NOT NULL CHECK (geolocation_source IN ('gps','network','manual')),
     distance_to_lieu_meters REAL,
     is_verified BOOLEAN NOT NULL DEFAULT false,
     -- Anti-fraude (les triggers Story 4.4 posent flag_reason)
     flag_reason TEXT,
     -- Avis attaché (Story 4.5 — null en 4.1)
     note_etoiles SMALLINT CHECK (note_etoiles IS NULL OR note_etoiles BETWEEN 1 AND 5),
     texte_avis TEXT CHECK (texte_avis IS NULL OR char_length(texte_avis) <= 500),
     tags TEXT[] NOT NULL DEFAULT '{}',
     photos TEXT[] NOT NULL DEFAULT '{}',
     is_cancelled BOOLEAN NOT NULL DEFAULT false,
     -- Seed (Claude amendment 5.4 — Story 6.3)
     is_seed BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );

   -- Index
   CREATE INDEX idx_spawt_checkin_spawter ON spawt_checkin(spawter_id, arrived_at DESC);
   CREATE INDEX idx_spawt_checkin_place ON spawt_checkin(place_id, arrived_at DESC);
   CREATE INDEX idx_spawt_checkin_active ON spawt_checkin(spawter_id, place_id, arrived_at)
     WHERE left_at IS NULL;

   -- Trigger updated_at
   CREATE OR REPLACE FUNCTION set_spawt_checkin_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = now(); RETURN NEW; END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trg_spawt_checkin_updated_at
     BEFORE UPDATE ON spawt_checkin
     FOR EACH ROW EXECUTE FUNCTION set_spawt_checkin_updated_at();

   -- RLS
   ALTER TABLE spawt_checkin ENABLE ROW LEVEL SECURITY;

   CREATE POLICY spawt_checkin_select_own ON spawt_checkin
     FOR SELECT TO authenticated
     USING (spawter_id = auth.uid());

   CREATE POLICY spawt_checkin_insert_own ON spawt_checkin
     FOR INSERT TO authenticated
     WITH CHECK (spawter_id = auth.uid() AND is_seed = false);

   CREATE POLICY spawt_checkin_update_own ON spawt_checkin
     FOR UPDATE TO authenticated
     USING (spawter_id = auth.uid() AND is_seed = false)
     WITH CHECK (spawter_id = auth.uid() AND is_seed = false);

   -- Pas de policy DELETE — RLS rejette silencieusement.
   -- Les seeds (is_seed = true) sont insérés par service_role (Story 6.3) hors RLS.
   ```

2. `supabase/migrations/0011_create_spawt_checkin.down.sql` :
   ```sql
   DROP POLICY IF EXISTS spawt_checkin_update_own ON spawt_checkin;
   DROP POLICY IF EXISTS spawt_checkin_insert_own ON spawt_checkin;
   DROP POLICY IF EXISTS spawt_checkin_select_own ON spawt_checkin;
   DROP TRIGGER IF EXISTS trg_spawt_checkin_updated_at ON spawt_checkin;
   DROP FUNCTION IF EXISTS set_spawt_checkin_updated_at();
   DROP INDEX IF EXISTS idx_spawt_checkin_active;
   DROP INDEX IF EXISTS idx_spawt_checkin_place;
   DROP INDEX IF EXISTS idx_spawt_checkin_spawter;
   DROP TABLE IF EXISTS spawt_checkin;
   ```

**And** la migration est testable en local : `supabase db reset` puis `supabase db push` (ou équivalent psql direct) doivent passer.
**And** la `.down.sql` est testée réversible : un `psql < 0011_*.down.sql` après l'`up` doit tomber proprement (table + policies + trigger + fonction + index supprimés).

---

**AC #2 — `app/src/lib/guet/geofence.ts` + `guet-task.ts` + `guet-notifications.ts`**

**Given** le dossier `app/src/lib/`
**When** Story 4.1 est livrée
**Then** un sous-dossier `app/src/lib/guet/` existe avec **3 fichiers** :

1. **`app/src/lib/guet/geofence.ts`** — wrapper `expo-location`. API publique :
   ```ts
   /** Arme N geofences (10m) sur les lieux fournis. Idempotent — re-arme = reset.
    *  No-op en mode démo (`isSupabaseConfigured = false`) ou si consent géoloc absent. */
   export async function armGuet(places: ReadonlyArray<{ id: string; lat: number; lng: number }>): Promise<void>;

   /** Désarme toutes les geofences (logout, opt-out géoloc, reset). */
   export async function disarmGuet(): Promise<void>;

   /** True si Le Guet est armé sur au moins 1 lieu (status diagnostic — UI banner). */
   export async function isGuetArmed(): Promise<boolean>;

   /** Cap iOS-friendly : 20 geofences simultanés max (limit OS iOS, prudent Android).
    *  Si `places.length > 20`, on garde les 20 plus proches du spawter — projetés
    *  via `haversineKm` (déjà exporté depuis matching.ts). */
   export const MAX_ACTIVE_GEOFENCES = 20;
   ```
   - Permission runtime demandée à l'appel `armGuet` (pas au boot) : `Location.requestForegroundPermissionsAsync()` puis si OK et consent geoloc posé, `Location.requestBackgroundPermissionsAsync()`. Background échoue → fallback armement foreground-only (mode dégradé documenté).
   - Le Guet **n'arme pas** si :
     - `dataSourceMode === "fallback"` (Expo Go, mode démo) — return no-op + `__DEV__` log
     - `spawter.geoloc_consent_at === null` — return no-op + warn
     - Batterie < 10% (`expo-battery` non installé V1 — fallback : skip cette guard côté `armGuet`, déléguer à `guet-task` au moment du trigger qui interroge `Battery.getBatteryLevelAsync()`. Voir §4 Dev Notes)

2. **`app/src/lib/guet/guet-task.ts`** — `TaskManager.defineTask` enregistré au **niveau module** (top-level), pas dans une fonction.
   ```ts
   import * as TaskManager from "expo-task-manager";
   import * as Location from "expo-location";

   export const GUET_TASK = "spawt:guet-task";

   // ⚠️ defineTask doit être au top-level (architecture §State Management Patterns).
   //    Sinon la task ne survit pas à l'OS-kill (Tecno/Infinix).
   TaskManager.defineTask(GUET_TASK, async ({ data, error }) => {
     if (error) { if (__DEV__) console.warn("[guet-task] error", error); return; }
     const region = (data as { region?: { identifier: string; eventType: number } }).region;
     if (!region) return;
     // eventType: 1 = enter, 2 = exit (expo-location.GeofencingEventType)
     if (region.eventType === Location.GeofencingEventType.Enter) {
       await onGeofenceEnter(region.identifier); // place_id stocké comme identifier
     } else if (region.eventType === Location.GeofencingEventType.Exit) {
       await onGeofenceExit(region.identifier);
     }
   });
   ```
   - `onGeofenceEnter(place_id)` : lit 3 positions GPS sur 30s, calcule moyenne (`accuracy_meters` + `distance_to_lieu_meters`), insère une row pending `spawt_checkin` (`arrived_at = now()`, `geolocation_source = 'gps'`, `is_verified = accuracy ≤ 30m`). En cas de batterie < 10% → `is_verified = false`, `geolocation_source = 'manual'`, marqué fallback. Émet `guet_armed` (à l'arming initial du place) puis `guet_geofence_triggered` à l'entrée.
   - `onGeofenceExit(place_id)` : update la row pending → `left_at = now()`. Si `notified_at IS NULL` ET `now - arrived_at < 15min` (NFR-GEO + ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES = 15) → la row reste pending tant que la fenêtre +30min n'est pas écoulée. (La logique de notification est Story 4.2.)
   - **Le module exporte** `GUET_TASK` constant (utilisé par `geofence.ts:startGeofencingAsync(GUET_TASK, regions)`) et **ne s'importe qu'une fois**, depuis `app/_layout.tsx` (root) pour garantir l'enregistrement top-level avant le mount.

3. **`app/src/lib/guet/guet-notifications.ts`** — V1 minimal pour Story 4.1 :
   ```ts
   import * as Notifications from "expo-notifications";

   export async function ensureGuetChannel(): Promise<void> {
     // Android — channel dédié pour notifs Story 4.2. Création idempotente.
     if (Platform.OS === "android") {
       await Notifications.setNotificationChannelAsync("guet", {
         name: "Le Guet",
         importance: Notifications.AndroidImportance.HIGH,
         sound: "default",
         vibrationPattern: [0, 250, 250, 250],
       });
     }
   }

   /** Helper pour Story 4.2 + cleanup au logout. */
   export async function cancelAllGuetNotifications(): Promise<void> {
     await Notifications.cancelAllScheduledNotificationsAsync();
   }
   ```

**And** **aucune** logique de notification visible (toast, prompt « Comment c'était ? ») n'est livrée par Story 4.1 — Story 4.2 le fera. Seul le channel est créé.

---

**AC #3 — Composant `GuetIndicator` (visibilité du mécanisme)**

**Given** le dossier `app/src/components/`
**When** Story 4.1 est livrée
**Then** [app/src/components/GuetIndicator.tsx](../../app/src/components/GuetIndicator.tsx) existe :

```tsx
// PRD §7.1 + UX spec §1304 + Cahier defining experience.
// Visible quand le spawter est dans la zone détectée par geofence (state via prop ou hook).
// "Le Chat fait le guet chez {place_name}…" — voix du Chat conforme stade (non-gamifié).

interface Props {
  /** Lieu détecté — null = pas affiché. */
  place: { id: string; name: string } | null;
  /** Visuellement, n'apparaît qu'au-dessus du contenu (FAB ou banner sticky bas). */
  position?: "top" | "bottom";
}

export function GuetIndicator({ place, position = "bottom" }: Props) {
  // Si null → return null
  // Sinon pastille verte pulsée (Reanimated useSharedValue) + label
  // accessibilityLiveRegion="polite" (architecture §UX §accessibilité)
  // — la string vient de `t("guet.indicator_label", { place_name })`
}
```

**Spec UX (référe UX spec §1304-1310 + §1135) :**

- Visuel : pastille `8x8 dp` verte (`theme.colors.brand.gold` ou un nouveau `theme.colors.state.guet` à proposer ?), `react-native-reanimated` 1.5s scale 0.8 → 1.2 → 0.8 (pulse infinite), au sein d'un container `theme.colors.surface.dark` avec coin arrondi `theme.radius.md`, padding `theme.spacing.sm` horizontal.
- Label : `theme.typography.body.s` (Gotham), 1 ligne, ellipsis si dépassement.
- Position : `position="bottom"` par défaut (banner sticky au-dessus de la TabBar 5 onglets, ne masque pas le FAB). `position="top"` réservé pour les écrans full-screen sans TabBar (fiche lieu hero — pas en V1).
- `accessibilityRole="status"` + `accessibilityLabel="Le Chat fait le guet chez {place_name}"` + `accessibilityLiveRegion="polite"` (VoiceOver/TalkBack annonce sans interrompre).
- **Pas** d'event analytics côté `GuetIndicator` — l'event `guet_geofence_triggered` est émis côté `guet-task.ts` (pure data), pas côté UI.

**Mount** : `(tabs)/_layout.tsx` mount un consumer `useGuetActiveZone()` (nouveau hook) qui lit l'état Zustand. Si zone active → rend `<GuetIndicator place={zone} />` au-dessus du `<Tabs />`. **Décision** : storage de l'état "zone active" — option A `spawter-store` (durable, mais le champ est éphémère = drift) vs option B nouveau micro-store `guet-active-store` (éphémère, non persisté). **Recommandation : option B** — nouveau `app/src/store/guet-active.ts` (Zustand simple, pas de persistence).

---

**AC #4 — Hook `useGuetActiveZone()` + micro-store `guet-active`**

**Given** le dossier `app/src/store/`
**When** Story 4.1 est livrée
**Then** [app/src/store/guet-active.ts](../../app/src/store/guet-active.ts) existe (Zustand simple, no persistence) :

```ts
interface GuetActiveState {
  /** Zone géofence actuellement détectée. null = aucune. */
  active: { place_id: string; place_name: string } | null;
  enter: (zone: { place_id: string; place_name: string }) => void;
  exit: () => void;
}
export const useGuetActive = create<GuetActiveState>((set) => ({ ... }));

export function useGuetActiveZone() {
  return useGuetActive((s) => s.active);
}
```

**And** `guet-task.ts:onGeofenceEnter` appelle `useGuetActive.getState().enter({ place_id, place_name })`. `onGeofenceExit` appelle `exit()`. Le store n'est **pas** persisté — au boot, l'état est `null`, le guet redétectera si toujours en zone (background events).

---

**AC #5 — Events analytics émis (taxonomie figée)**

**Given** `app/src/lib/analytics.ts`
**When** Story 4.1 est livrée
**Then** **2 events** sont émis :

1. `guet_armed` — émis quand `armGuet(places)` enregistre une geofence. Properties : `{ place_id, radius_m: 10 }` — un event **par geofence armée** (donc 1 à 20 events par appel d'arming). Note V2 : agréger en `guet_armed_batch` si volume > 50/spawter/jour observé.
2. `guet_geofence_triggered` — émis quand `onGeofenceEnter` détecte l'entrée et après moyennage GPS 30s. Properties : `{ place_id, accuracy_m, geolocation_source }`.

**And** **aucun** des 2 events ne contient de PII (`spawter_id` est injecté par le wrapper analytics, automatique — cf. `analytics.ts:259-303`).
**And** `place_id` est un UUID valide (cohérent Story 3.3a — les seeds passent désormais `UUID_RE`).

---

**AC #6 — CTA manuel mode démo (alignement wording)**

**Given** la fiche lieu [app/app/place/[id].tsx](../../app/app/place/%5Bid%5D.tsx)
**When** `dataSourceMode === "fallback"` OU `Constants.appOwnership === "expo"` (Expo Go détection)
**Then** un CTA secondaire « Je spawt ici (mode démo) » est visible **sous** le sticky CTA principal (Story 3.4) :
- Wording exact (i18n) : `t("guet.cta_manual_demo")` → « Je spawt ici (aperçu du geste) »
- Visuel : `theme.colors.surface.dark` + `theme.colors.text.gold` (variante secondaire), `theme.typography.body.s`
- **Comportement V1** : `Alert.alert(t("guet.cta_manual_demo_alert.title"), t("guet.cta_manual_demo_alert.body"))` — wording « Le Chat aurait sonné l'arrivée ici. La vraie confirmation est livrée par la suite (Story 4.2). »
- **Pas de persistence `spawt_checkin`** en V1 démo — Story 4.2 livrera l'`registerSpawt` manuel.
- Le CTA est **masqué** si `dataSourceMode === "supabase"` et `spawter.geoloc_consent_at !== null` (Le Guet est armé, le CTA manuel est redondant).

**Given** `dataSourceMode === "supabase"` mais `spawter.geoloc_consent_at === null` (Le Guet bloqué par consent)
**When** la fiche est ouverte
**Then** un message in-context affiche `t("guet.stub_blocked_geoloc")` → « La géoloc n'est pas activée — Le Chat ne peut pas faire le guet. Active la dans Profil → Paramètres. » avec un deep link vers `(tabs)/profile` (placeholder V1, Story 5.x raffinera).

---

**AC #7 — Feature flag `guet-geofence`**

**Given** `feature_flags` table (Story 1.8) et le hook `useFlag(code)`
**When** Story 4.1 est livrée
**Then** un seed `supabase/seed/feature_flags_guet.sql` (ou inclus dans une migration data, au choix dev) insère :

```sql
INSERT INTO feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('guet-geofence', 'internal', true, NULL),
  ('guet-geofence', 'alpha', true, NULL),
  ('guet-geofence', 'beta', false, NULL),
  ('guet-geofence', 'prod', false, NULL)
ON CONFLICT DO NOTHING;
```

**And** `armGuet()` lit `useFeatureFlagsStore.getState().flags["guet-geofence"]` au début de l'arming — si `false`, no-op + `__DEV__` log. Permet de **kill-switcher** Le Guet à distance en cas de drift terrain alpha (NFR-OBS lié).
**And** dans Story 4.1, on **ne câble pas** le polling automatique (déjà documenté Story 1.8 deferred) — le flag est lu directement depuis le store, qui est hydraté manuellement par la prochaine story (4.2) ou un Settings dev menu.

---

**AC #8 — Tests + triple gate + smoke compile**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut :

1. **`geofence.ts`** (`app/src/lib/guet/__tests__/geofence.test.ts`) :
   - `armGuet([])` → no-op silencieux.
   - `armGuet([...21 places])` → garde 20, log `__DEV__` warn pour le drop.
   - `armGuet(...)` en mode démo (`dataSourceMode === "fallback"`) → no-op + dev log.
   - `armGuet(...)` sans consent géoloc → no-op + warn.
   - `disarmGuet()` après `armGuet()` → status = `false`.
   - **Mocks** : `expo-location.startGeofencingAsync` + `requestForegroundPermissionsAsync` mockés via `jest.mock("expo-location")`. Vérifier pattern existant test `data-source.supabase.test.ts` pour cohérence.

2. **`guet-task.ts` indirect** : tests d'unité sur le helper pur exporté `selectClosestPlaces(places, spawterLocation, max)` (mis dans `geofence.ts` pour testabilité). Vérifier qu'il choisit 20 plus proches via `haversineKm` (importé de `matching.ts`).

3. **`GuetIndicator.tsx`** (`app/__tests__/components/GuetIndicator.test.tsx`) :
   - `<GuetIndicator place={null} />` → render null.
   - `<GuetIndicator place={{ id, name }} />` → render avec label interpolé + `accessibilityLiveRegion="polite"`.
   - **Pas** de test snapshot pixel-perfect (project-context §Testing Rules).

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** `cd app && expo export --platform android` compile (smoke build, pas un release).

## Tasks / Subtasks

- [ ] **Task 1 — Ajouter `expo-task-manager`** (AC: #2)
  - [ ] `cd app && npx expo install expo-task-manager` (Expo gère le pin SDK 55).
  - [ ] Vérifier que `app/package.json` reflète la nouvelle dépendance (sera `~55.0.16` ou similaire).
  - [ ] Vérifier que le bundle Android compile (`expo export --platform android`).

- [ ] **Task 2 — Migration SQL `0011_create_spawt_checkin.sql` + `.down.sql`** (AC: #1)
  - [ ] Créer `supabase/migrations/0011_create_spawt_checkin.sql` selon l'AC #1.
  - [ ] Créer `supabase/migrations/0011_create_spawt_checkin.down.sql` réversible.
  - [ ] Tester en local : `supabase db reset` + check `\d+ spawt_checkin` (vérifier RLS visible).
  - [ ] **Migration ordre** : numéro `0011_` (la prochaine séquence libre après `0010_create_places_place_adn`).

- [ ] **Task 3 — Module `app/src/lib/guet/`** (AC: #2, #5)
  - [ ] Créer `app/src/lib/guet/geofence.ts` (API `armGuet`, `disarmGuet`, `isGuetArmed`, helper pur `selectClosestPlaces`).
  - [ ] Créer `app/src/lib/guet/guet-task.ts` (defineTask top-level, `onGeofenceEnter`, `onGeofenceExit`).
  - [ ] Créer `app/src/lib/guet/guet-notifications.ts` (channel Android `guet` + `ensureGuetChannel`, `cancelAllGuetNotifications`).
  - [ ] Importer le module **une seule fois** dans `app/app/_layout.tsx` Root (effet de bord top-level pour enregistrer la task).

- [ ] **Task 4 — Store + hook** (AC: #4)
  - [ ] Créer `app/src/store/guet-active.ts` (Zustand simple, no persistence).
  - [ ] Exporter `useGuetActive` (full store) + `useGuetActiveZone()` (sélecteur granulaire).
  - [ ] `guet-task.ts` consomme `useGuetActive.getState().enter()` / `.exit()`.

- [ ] **Task 5 — Composant `GuetIndicator`** (AC: #3)
  - [ ] Créer `app/src/components/GuetIndicator.tsx` selon spec UX.
  - [ ] Animation pulse via `useSharedValue` + `useAnimatedStyle` (`react-native-reanimated`).
  - [ ] `accessibilityRole="status"` + `accessibilityLiveRegion="polite"`.

- [ ] **Task 6 — Mount `GuetIndicator` dans la tab layout** (AC: #3)
  - [ ] Éditer [app/app/(tabs)/_layout.tsx](../../app/app/%28tabs%29/_layout.tsx) — wrapper Tabs avec un absolute-positioned `<GuetIndicator>` lisant `useGuetActiveZone()`.
  - [ ] **Ne pas** monter dans `(onboarding)` (hors funnel).

- [ ] **Task 7 — i18n clés `guet.*`** (AC: #3, #6)
  - [ ] Éditer [app/src/i18n/fr.json](../../app/src/i18n/fr.json) — ajouter :
    - `guet.indicator_label` : "Le Chat fait le guet chez {{place_name}}…"
    - `guet.cta_manual_demo` : "Je spawt ici (aperçu du geste)"
    - `guet.cta_manual_demo_alert.title` : "Aperçu du geste"
    - `guet.cta_manual_demo_alert.body` : "En live, Le Chat aurait sonné l'arrivée ici. La vraie confirmation arrive bientôt."
    - `guet.stub_blocked_geoloc` : "La géoloc n'est pas activée — Le Chat ne peut pas faire le guet. Active-la dans tes paramètres."
  - [ ] Lancer `npm run i18n:check` → vert.

- [ ] **Task 8 — CTA manuel sur fiche lieu (mode démo)** (AC: #6)
  - [ ] Éditer [app/app/place/[id].tsx](../../app/app/place/%5Bid%5D.tsx) — ajouter le CTA secondaire conditionnel.
  - [ ] Visibilité conditionnée sur `dataSourceMode === "fallback"` OU `(dataSourceMode === "supabase" && spawter?.geoloc_consent_at === null)`.
  - [ ] Comportement V1 : `Alert.alert` (idem pattern Story 3.1 Strategy B).

- [ ] **Task 9 — Feature flag `guet-geofence`** (AC: #7)
  - [ ] Créer `supabase/seed/feature_flags_guet.sql` avec 4 rows (1 par scope).
  - [ ] `armGuet()` lit `useFeatureFlagsStore.getState().flags["guet-geofence"]` au début, no-op si `false`.
  - [ ] Si le store n'est jamais hydraté V1 (`flags === {}`), considérer le flag `true` par défaut **uniquement en mode `internal`/`alpha`** (`__DEV__`). En `prod`, le no-op gagne.

- [ ] **Task 10 — Tests + triple gate + smoke compile** (AC: #8)
  - [ ] `geofence.test.ts` (5 cas, mocks).
  - [ ] `GuetIndicator.test.tsx` (2 cas, pas de snapshot pixel).
  - [ ] `useGuetActive` test léger (enter → state, exit → null).
  - [ ] Triple gate verte.
  - [ ] `expo export --platform android` compile.
  - [ ] CHANGELOG `feat(spawt)` + `feat(infra)` Story 4.1.

## Dev Notes

### 1. Décision D1 — Cap 20 geofences les plus proches (recommandation)

**Pourquoi pas tous les lieux `is_published = true` ?**

- **Limite iOS** : `CLLocationManager` cap ~20 régions par app (`startMonitoringForRegion`). Au-delà, silencieux drop. Documenté dans `expo-location` README (geofencing).
- **Battery Android** : `geofencingClient.addGeofences()` accepte plus, mais l'OS désactive les inactives → drift comportement non déterministe.
- **Pertinence produit** : un spawter à Cocody n'a pas besoin que Le Guet surveille Yopougon — performance + bruit analytics.

**Décision V1** : `MAX_ACTIVE_GEOFENCES = 20`, sélection via `haversineKm` (réutilise `matching.ts` Story 3.3b — pas de duplication).

**Limite connue** : si le spawter se déplace de quartier (Cocody → Marcory), Le Guet ne se met **pas** à jour automatiquement V1. Solution V2 : rolling window (re-armer au foreground si la position courante a bougé > 5km depuis le dernier arm). À tracer en defer.

**Comment armer ?** Story 4.1 ne câble pas l'auto-arming au boot — Story 4.2 le fera quand la session OTP est établie. Pour les tests Story 4.1, exposer `armGuet()` consommable par un Settings dev menu (Story 1.8 a posé la primitive).

### 2. Décision D2 — `accuracy_meters` = moyenne, pas les 3 brutes

`spawt_checkin.accuracy_meters` est un `REAL` seul (pas un array). Stocker `(p1.accuracy + p2.accuracy + p3.accuracy) / 3` au moment du trigger. Les positions brutes sont volatiles (`Location.watchPositionAsync` callback) et inutiles post-trigger. Permet une row plus simple + un index sur `accuracy_meters` éventuellement (Sprint 2 si besoin de filtrer les spawts faiblement vérifiés).

### 3. Décision D3 — `arrived_at` côté client

**Raison principale** : Story 4.3 (offline queue) doit pouvoir persister un spawt local **avec un timestamp précis du moment de l'arrivée**, **avant** d'avoir réseau. Si `arrived_at` = `DEFAULT now()` côté DB, on perd la précision (le spawt arrive 10min plus tard avec un faux `arrived_at`).

**Trade-off** : un client malicieux peut spoofer `arrived_at` (timestamp passé). **Mitigation** : trigger anti-fraude Story 4.4 NFR-FRAUD-06 (`left_at - arrived_at < 5min ET active`) + NFR-FRAUD-01 (`<4h même lieu`). Le serveur valide la cohérence, pas le timestamp absolu.

### 4. Batterie < 10% guard

`expo-battery` (`expo-battery@~9.0.0`) n'est pas installé V1. **2 options** :

- **Option A — Ne pas installer V1** : skip la guard NFR-GEO-04 explicitement, doc l'écart. Reste un risque battery drain modéré (geofencing iOS/Android optimisé OS-level, drain attendu < 2%/h). Acceptable pour alpha 5 spawters Cahier §5.8.
- **Option B — Installer `expo-battery`** : implémenter la guard. +1 dépendance, +20KB bundle.

**Recommandation V1 : Option A** (Story 4.1 livre l'archi, Story 4.4 ou un follow-up posera `expo-battery` quand l'alpha aura mesuré le drain). Tracer en defer.

### 5. Pas d'écran « Le Guet » dédié V1

Le Guet est **invisible par design** (mini-magie discrète, PRD §7.1 + UX spec §1135-1411). `GuetIndicator` est le **seul** feedback UI. Pas de :
- Écran « historique des guets ».
- Liste des geofences actives.
- Toggle on/off (manipulation = bug, on/off = consent géoloc via `recordConsent`).

Le seul lieu où on peut **diagnostiquer Le Guet** = un dev Settings menu (Story 1.8). À exposer en alpha pour Stéphanie.

### 6. Pas d'event `guet_disarmed`

PRD §7.1 + events.md §6 ne définit pas un event de désarmement. `disarmGuet()` est silencieux côté analytics. Si Stéphanie demande la métrique en alpha → defer V2 (ajouter à events.md d'abord).

### 7. Pas de chevauchement avec Story 4.2

| Story 4.1 (ici) | Story 4.2 |
|---|---|
| Migration `spawt_checkin` + RLS | (consomme la table — pas de migration ajoutée) |
| `armGuet` / `disarmGuet` / `isGuetArmed` | (consomme — appel `armGuet` au login OTP) |
| `onGeofenceEnter` : insert row pending | `onPresenceThresholdReached` (15min) : émet `guet_threshold_reached` + envoie la notif |
| `onGeofenceExit` : update `left_at` | `confirmSpawt(row_id, type: "active")` : tap notif → confirmation |
| `GuetIndicator` mount | (consomme — déjà monté) |
| Events : `guet_armed`, `guet_geofence_triggered` | Events : `guet_threshold_reached`, `guet_notification_sent`, `spawt_notification_opened`, `spawt_completed`, `spawt_snoozed`, `spawt_passive_recorded`, `spawt_first_completed` |
| Pas de notif visible | Notif "Comment c'était ?" + badge Premier Spawt |

**Conséquence** : la row `spawt_checkin` créée par 4.1 (pending) est **complétée** par 4.2 (`checked_in_at`, `check_in_type`, `is_verified` final, `note_etoiles` Story 4.5).

### 8. Non-régression vis-à-vis de Epic 1-3

- **Story 1.7 (analytics)** : `place_id` UUID validé (cohérent post-Story 3.3a). `guet_armed` / `guet_geofence_triggered` passent `place_id` (UUID seed `00000000-...-NNN`) → `UUID_RE` matche, pas de stripping.
- **Story 1.8 (feature flags)** : le hook `useFlag("guet-geofence")` consomme le store existant. Pas de refactor.
- **Story 2.1 (voix Chat)** : `guet.indicator_label` est une **string système** (pas un chat-voice key) — pas de drift sur la matrice `(stade × moment)`. Le ton reste « complice neutre », pas calibré stade. Justifié : le label est un feedback fonctionnel (« ça tourne »), pas un message narratif.
- **Story 2.2 (consent ARTCI)** : `spawter.geoloc_consent_at` lu en gate `armGuet` — cohérent set-once policy.
- **Story 3.3a (places)** : les lieux passés à `armGuet` viennent de `listPlaces()` (adapter `data-source`) — pas d'accès Supabase direct.
- **Story 3.4 (fiche lieu)** : CTA manuel ajouté sous le sticky CTA principal — pas de refactor du header overlay (cluster back/heart/share intact).

### 9. Performance + bundle

- `expo-task-manager` : ~50KB gzippé (estimé) — acceptable face au budget 500KB Cahier §5.7.
- `app/src/lib/guet/` : ~3-5KB de code TS — négligeable.
- `GuetIndicator` : Reanimated worklet (UI thread), pas de re-render JS → 0 cost runtime.
- **APK impact** : +50KB (`expo-task-manager`). Budget 50MB → OK.

### 10. Sign-off

- **Stéphanie** (tech) : revue migration SQL `0011` (réversibilité, RLS `is_seed = false` check, index `active` partiel), revue `defineTask` top-level (cas Tecno/Infinix), revue battery guard absente (defer Option A).
- **Kidam** (analytics) : confirmation que `guet_armed` (volume estimé : 20 events × N spawters × N logins) ne sature pas le bucket `user_signals`. Si > 1k/jour → V2 agréger.
- **Alexandre** (brand) : audit `t("guet.indicator_label")` + alert mode démo. Pas de Test Tantie Rose obligatoire (mécanisme invisible) ; mais valider que la formulation « Le Chat fait le guet » est conforme PRD §7.1 + Moka §4.3.

### 11. Defers identifiés (à tracer dans `_bmad-output/implementation-artifacts/deferred-work.md`)

- **D-401 — Auto-arm au foreground** quand le spawter a bougé > 5km depuis le dernier arm (rolling window). V1 = pas de re-arming auto.
- **D-402 — `expo-battery` guard NFR-GEO-04** (Sprint 2 si alpha montre drain > 2%/h).
- **D-403 — Event `guet_disarmed`** si Stéphanie demande la métrique en alpha.
- **D-404 — Settings dev menu Le Guet** (status + manual re-arm) — Story 1.8 follow-up.
- **D-405 — Permission iOS « Always »** vs « When in Use » : V1 demande Background, fallback Foreground-only si refusé. Story 4.2 amplifiera si Le Guet ne tourne pas en background sur certains modèles.
- **D-406 — Cap dynamique 20 geofences** : si Kidam mesure que < 50% des spawters utilisent Le Guet, baisser à 10 pour économie batterie.
- **D-407 — Compteur publique `total_spawts_at_place`** (déjà existant sur `places` via `place_adn.total_reviews` — pas le même métrique). À clarifier Story 4.7.

### 12. Risk

- **Risque #1** : OS-tue-app Tecno/Infinix peut empêcher `defineTask` de survivre. **Mitigation** : enregistrement top-level (project-context invariant), test sur device réel matrice 4 devices (Stéphanie alpha).
- **Risque #2** : Permission Background refusée → Le Guet ne tourne **pas** au background. **Mitigation** : fallback Foreground-only documenté + Settings deep link.
- **Risque #3** : Geofence trigger latence > 5min sur Android (NFR-AVAIL-03). **Mitigation** : aucune côté code V1 — c'est un fait OS. Documenté dans Cahier §5.8 alpha focus fiabilité Le Guet.
- **Risque #4** : Seeds dev `place.lat/lng` peuvent être fictifs/imprécis (Story 3.3a) — un geofence à 5.328, -4.009 (Bô Zinc) doit pointer sur une vraie localisation pour que les tests terrain marchent. **Mitigation** : valider les 12 coordonnées seeds avec Alexandre (présentiel ou Google Maps).
- **Risque #5** : RLS `is_seed = false` peut bloquer les insert manuels du staff via le SDK auth (Story 6.3). **Mitigation** : la story 6.3 (pré-chargement avis seed) utilisera `service_role`, pas un compte authenticated → RLS skipped. Cohérent.

### 13. Test devices priority

Matrice ordre de test pour Stéphanie (alpha) :
1. **Tecno Spark** (Android low-end, OS-tue-app fréquent) — priorité #1 (risque #1).
2. **Infinix Hot** (Android mid, OS-tue-app similaire) — priorité #2.
3. **Samsung A** (Android mid, OS plus respectueux) — sanity check.
4. **iPhone récent** (iOS) — limite ~20 geofences, comportement différent — priorité #3.

Document attendu : `documentation/qa/le_guet_alpha.md` (à créer en alpha, défère).

### Project Structure Notes

- **1 nouveau fichier SQL** : `supabase/migrations/0011_create_spawt_checkin.sql` + `.down.sql`.
- **1 nouveau fichier seed SQL** : `supabase/seed/feature_flags_guet.sql`.
- **3 nouveaux fichiers TS lib** : `app/src/lib/guet/geofence.ts`, `guet-task.ts`, `guet-notifications.ts`.
- **1 nouveau store** : `app/src/store/guet-active.ts`.
- **1 nouveau composant** : `app/src/components/GuetIndicator.tsx`.
- **3 fichiers TS modifiés** :
  - `app/app/_layout.tsx` (import `lib/guet` pour top-level register de `defineTask`).
  - `app/app/(tabs)/_layout.tsx` (mount `GuetIndicator`).
  - `app/app/place/[id].tsx` (CTA manuel mode démo + message bloqué consent).
- **1 fichier modifié** : `app/src/i18n/fr.json` (+5 clés).
- **1 nouvelle dépendance npm** : `expo-task-manager` (~55.0.16).
- **Pas de modif** : `analytics.ts` (events déjà définis), `data-source.ts` (pas de lecture supplémentaire).

### References

- [_bmad-output/planning-artifacts/epics.md#L830-L856](../planning-artifacts/epics.md#L830-L856) Story 4.1
- [_bmad-output/planning-artifacts/PRD.md §7.1 + §3.1 Feature 5](../planning-artifacts/PRD.md) Le Guet mécanisme
- [_bmad-output/planning-artifacts/architecture.md#L142-L144](../planning-artifacts/architecture.md#L142-L144) Géolocalisation background — cross-cutting concern
- [_bmad-output/planning-artifacts/architecture.md#L366-L374](../planning-artifacts/architecture.md#L366-L374) Le Guet — `expo-location` + `expo-task-manager` + `expo-notifications`
- [_bmad-output/planning-artifacts/architecture.md#L508-L515](../planning-artifacts/architecture.md#L508-L515) File Structure — `lib/guet/`
- [_bmad-output/planning-artifacts/architecture.md#L558-L559](../planning-artifacts/architecture.md#L558-L559) `defineTask` top-level invariant
- [_bmad-output/planning-artifacts/architecture.md#L685-L704](../planning-artifacts/architecture.md#L685-L704) Project Structure — `supabase/migrations`
- [_bmad-output/planning-artifacts/ux-design-specification.md#L1304-L1310](../planning-artifacts/ux-design-specification.md#L1304-L1310) `GuetIndicator` spec
- [_bmad-output/planning-artifacts/ux-design-specification.md#L1135](../planning-artifacts/ux-design-specification.md#L1135) Defining experience — Le Spawt
- [_bmad-output/project-context.md §Géolocalisation + §Anti-patterns techniques](../project-context.md)
- [documentation/analytics/events.md §6 Le Guet](../../documentation/analytics/events.md)
- [app/src/types/spawt.ts](../../app/src/types/spawt.ts) `SpawtCheckin` + `ANTIFRAUD_RULES`
- [app/src/lib/analytics.ts:158](../../app/src/lib/analytics.ts#L158) events `guet_*`
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) `haversineKm` exporté (Story 3.3b)
- [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) `listPlaces` adapter règle d'or
- [app/app.json](../../app/app.json) permissions géoloc + plugin `expo-location`
- [supabase/migrations/0010_create_places_place_adn.sql](../../supabase/migrations/0010_create_places_place_adn.sql) pattern up/down de référence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Debug Log References

- Triple gate verte : `tsc --noEmit && lint:vocab && i18n:check && npm test` → 211 passed / 4 skipped / 0 failed (32/33 suites).

### Completion Notes List

- Migration `0011_create_spawt_checkin.sql` + `.down.sql` créées (table + 3 index + trigger updated_at + 3 RLS policies, no DELETE policy).
- Seed `supabase/seed/feature_flags_guet.sql` (4 rows : internal/alpha actifs, beta/prod désactivés).
- Module `lib/guet/` créé : `geofence.ts` (armGuet/disarmGuet/isGuetArmed + helper pur `selectClosestPlaces` cap 20 via `haversineKm`), `guet-task.ts` (`TaskManager.defineTask` top-level + `setPlaceNameLookup` + `registerGeofenceCallback`), `guet-notifications.ts` (channel Android + `ensureGuetChannel` + `cancelAllGuetNotifications`).
- Store éphémère `app/src/store/guet-active.ts` (Zustand sans persistance, sélecteur `useGuetActiveZone`).
- Composant `app/src/components/GuetIndicator.tsx` (pastille verte pulsée Reanimated + accessibilityLiveRegion="polite").
- Câblage `app/app/_layout.tsx` (import side-effect `lib/guet` + `ensureGuetChannel` au boot).
- Câblage `app/app/(tabs)/_layout.tsx` (mount `GuetIndicator` au-dessus de la TabBar, banner sticky bas).
- i18n keys `guet.indicator_label`, `guet.cta_manual_demo`, `guet.cta_manual_demo_alert_title/body`, `guet.cta_manual_demo_success`, `guet.stub_blocked_geoloc`.
- Dépendance `expo-task-manager@~14.0.7` ajoutée à `package.json` + `npm install` lancé.
- **Defers Story 4.1 PASS 2** : (a) message `stub_blocked_geoloc` en i18n, câblage UI conditionnel fiche lieu reporté car CTA fiche lieu déjà fonctionnel (refactor handleSpawt par Story 4.2 livre `buildManualSpawt`). (b) Dev settings menu Le Guet (D-404) — defer Sprint 2.
- Tests livrés : `app/src/lib/guet/__tests__/geofence.test.ts` (10 cas mocks expo-location + feature-flags), `app/src/store/__tests__/guet-active.test.ts` (3 cas), `app/__tests__/components/GuetIndicator.test.tsx` (3 cas via react-test-renderer).

### File List

**Nouveau** :
- `supabase/migrations/0011_create_spawt_checkin.sql`
- `supabase/migrations/0011_create_spawt_checkin.down.sql`
- `supabase/seed/feature_flags_guet.sql`
- `app/src/lib/guet/index.ts`
- `app/src/lib/guet/geofence.ts`
- `app/src/lib/guet/guet-task.ts`
- `app/src/lib/guet/guet-notifications.ts`
- `app/src/store/guet-active.ts`
- `app/src/components/GuetIndicator.tsx`
- `app/src/lib/guet/__tests__/geofence.test.ts`
- `app/src/store/__tests__/guet-active.test.ts`
- `app/__tests__/components/GuetIndicator.test.tsx`

**Modifié** :
- `app/app/_layout.tsx` (import side-effect lib/guet + ensureGuetChannel)
- `app/app/(tabs)/_layout.tsx` (mount GuetIndicator + useGuetActiveZone consumer)
- `app/src/i18n/fr.json` (+5 clés `guet.*`)
- `app/package.json` (+expo-task-manager)
- `app/package-lock.json`
