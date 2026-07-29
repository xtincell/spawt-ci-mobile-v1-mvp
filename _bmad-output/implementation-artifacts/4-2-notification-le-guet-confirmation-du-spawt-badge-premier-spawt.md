# Story 4.2: Notification Le Guet, confirmation du spawt & badge Premier Spawt

Status: review

<!-- Story phare Epic 4 — défining experience (UX spec §1135) : la 1re notif Le Guet
reçue *juste après* un repas. Story 4.2 livre : (1) timer 15min en background sur la
row pending Story 4.1, (2) notif locale `expo-notifications` "Comment c'était chez X ?"
i18n + voix Chat, (3) snooze ×3, (4) confirmation tap → `spawt_completed`, (5) mode
passive si pas de réponse + fenêtre +30min, (6) badge "Premier Spawt" au 1er spawt
verified, (7) batterie/précision guards. Consomme `spawt_checkin` (Story 4.1) +
`GuetIndicator` (4.1) + offline queue (Story 4.3 — parallèle, pas blocking). -->

## Story

As a spawter,
I want être sollicité au bon moment pour confirmer ma visite en 1 tap,
so that je valide mon spawt sans effort à la fin du repas — et je vois mon Palais s'éclairer dès le 1er.

## ⚠️ Brownfield context — read first

État courant Story 4.2 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| `spawt_checkin` row pending (créée par 4.1) | DB + types `SpawtCheckin` | ✅ Story 4.1 livre row avec `arrived_at`, `is_verified` initial, `left_at` null | **Consommer** — Story 4.2 update la row (`notified_at`, `snoozed_at`, `snooze_count`, `checked_in_at`, `check_in_type`, `session_duration_minutes`) |
| `lib/guet/guet-task.ts` `onGeofenceEnter`/`Exit` | Story 4.1 | ✅ | **Étendre** — ajouter `onPresenceThresholdReached(place_id, row_id)` après 15min |
| `lib/guet/guet-notifications.ts` | Story 4.1 | ✅ channel `guet` + helpers | **Étendre** — `scheduleGuetPrompt(row_id, place_id, place_name)`, `cancelGuetPrompt`, `handleNotificationResponse` |
| Permission `expo-notifications` | (pas demandée) | ❌ | **Demander** au runtime à la 1re ouverture post-OTP (gating sur `geoloc_consent_at != null`) |
| Voix Chat `notif.guet.prompt` | `fr.json` + `chat-voice.ts` | ❌ Pas de moment `guet_prompt` dans `CHAT_MOMENTS` | **Ajouter** moment `guet_prompt` + clés `chat.{stade}.guet_prompt` (5 stades) — ton complice |
| Badge « Premier Spawt » | (aucun) | ❌ | **Créer** logique côté `spawter-store.registerSpawt` — détecte `total_spawts === 1 && is_verified`, émet `spawt_first_completed` + flag local `is_premier_spawt_celebrated` |
| Composant `BadgePremierSpawt` ou Toast | (aucun) | ❌ | **Créer** — overlay quasi-rituel, **pas** Duolingo-style (PRD §9.3, Contrat §20.1) |
| Sheet de confirmation manuelle (passive) | (aucun) | ❌ | **Différé Story 4.5** (ReviewForm porte aussi la confirm) — Story 4.2 = juste 1-tap depuis la notif. Confirm en-app livrée 4.5 |
| Mode démo CTA manuel | Story 4.1 (alert stub) | ⚠️ Stub | **Remplacer** par vrai `registerSpawt` manuel quand mode démo |
| Events analytics | `analytics.ts` | ✅ Tous définis | **Consommer** : `guet_threshold_reached`, `guet_notification_sent`, `spawt_notification_opened`, `spawt_snoozed`, `spawt_completed`, `spawt_passive_recorded`, `spawt_first_completed` |
| `spawter-store.registerSpawt` | ✅ Existe ([app/src/store/spawter-store.ts:233-259](../../app/src/store/spawter-store.ts#L233-L259)) | **Étendre** — détection 1er spawt + émission `spawt_first_completed` (pour découpler de `guet-task`) |

**Décisions héritées non-revisitables** :

- **15 min seuil** (`ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES = 15`) — figé.
- **30 min fenêtre post-sortie** (`POST_LEAVE_WINDOW_MINUTES = 30`) — figé.
- **3 snooze max** (`MAX_SNOOZE_COUNT = 3`, `SNOOZE_DURATION_MINUTES = 15`) — figé.
- **Notif locale `expo-notifications`** (pas de push serveur V1 — architecture §3 l326).
- **Notif < 30s du trigger** quand réseau présent (NFR-PERF-04).
- **Insert spawt en < 500ms** (NFR-PERF-03) — local-first AsyncStorage, fire-and-forget Supabase.
- **Précision GPS > 30m → mode manuel** (NFR-GEO-02) `is_verified = false`.
- **Batterie < 10% → mode manuel** (NFR-GEO-04) `is_verified = false`.
- **Pas de gamification** (PRD §9.3) — badge Premier Spawt = moment quasi-rituel, **pas** Duolingo.
- **`check_in_type: passive`** + poids 0.5x (`PASSIVE_CHECKIN_WEIGHT`) si pas de réponse en fenêtre — déjà documenté.
- **Wording « Le Guet » jamais « VTC »** — invariant brand (UX spec D6, PRD §7.1).

## Acceptance Criteria

**AC #1 — Permission `expo-notifications` + channel armé**

**Given** un spawter avec `geoloc_consent_at != null` (consent géoloc déjà posé, prérequis sémantique)
**When** la session OTP est ouverte ET la première navigation post-onboarding atteint `(tabs)`
**Then** `Notifications.requestPermissionsAsync()` est appelée (foreground). Si refusée : `__DEV__` log + Le Guet ne désactive PAS l'arming (Story 4.1) — seule la notif est désactivée, le spawt sera enregistré `passive` en silence à la fenêtre +30min.
**And** Android : `ensureGuetChannel()` (Story 4.1) est appelée au boot (idempotent).
**And** la demande de permission est **gated** sur le consent géoloc — pas demandée avant `recordConsent("geoloc", true)` (cohérence ARTCI).

---

**AC #2 — Timer 15min en background**

**Given** une row `spawt_checkin` pending (créée par `onGeofenceEnter` Story 4.1) avec `arrived_at = T`
**When** le spawter reste en zone (`left_at IS NULL`) jusqu'à `T + 15min`
**Then** un mécanisme déclenche `onPresenceThresholdReached(row_id, place_id, place_name)` :
1. Émet `guet_threshold_reached` (`{ place_id, minutes_in_zone: 15 }`).
2. Update la row `spawt_checkin` : `notified_at = now()`.
3. Appelle `scheduleGuetPrompt(row_id, place_id, place_name)` qui :
   - Si batterie < 10% : skip la notif, marque `check_in_type = "passive"` direct, émet `spawt_passive_recorded`.
   - Si précision GPS dernière mesure > 30m : force `check_in_type = "manual"` au moment de la confirm, mais envoie la notif quand même.
   - Sinon : `Notifications.scheduleNotificationAsync({ content: { title, body }, identifier: GUET_PROMPT_ID(row_id), categoryIdentifier: "guet-prompt", data: { row_id, place_id } })`.

**Mécanisme du timer** — 2 implémentations possibles, **trancher en Dev Notes** :

- **Option A — `setTimeout(15*60*1000)` au moment de `onGeofenceEnter`** (JS thread).
  - Pro : simple, pas de scheduling OS.
  - Con : `setTimeout` ne survit pas à l'OS-tue-app. Si l'app est kill durant les 15min, **pas** de trigger.
- **Option B — `Notifications.scheduleNotificationAsync({ trigger: { seconds: 15*60 } })`** schedulée à `onGeofenceEnter`.
  - Pro : survit à l'OS-kill (OS scheduler).
  - Con : la notif est envoyée même si le spawter est parti (`left_at` set entre-temps) → faux positifs. Il faut **annuler** via `cancelGuetPrompt(row_id)` à `onGeofenceExit` si exit < 15min.
- **Option C (hybride recommandée)** : Option B (OS scheduling) + filtre côté `handleNotificationResponse` qui re-vérifie l'état de la row avant de prompt. Si `left_at != null && now - arrived_at < 15min` → notif dismissed silencieusement.

**Décision recommandée : Option C** — voir Dev Notes §1.

---

**AC #3 — Notif locale envoyée < 30s du trigger réseau-OK**

**Given** `scheduleGuetPrompt` appelée
**When** le device a réseau et `expo-notifications` permission accordée
**Then** la notif locale arrive sur l'écran de verrouillage / le drawer en < 30s (NFR-PERF-04, validation alpha — test manuel, pas testable unit).
**And** la notif :
- Title : `t("notif.guet.prompt.title")` → « Le Guet a sonné »
- Body : `t("notif.guet.prompt.body", { place_name })` → « Comment c'était chez {{place_name}} ? Le Chat attend ton avis. »
- **NB voix Chat** : la body intègre le ton **complice** par défaut (pas de mention « VTC »). Pour le V1, **pas** de mapping stade × moment dans le body — le ton est neutre complice (cf. §2 Dev Notes pour justification).
- Données : `{ row_id, place_id }` dans `data` pour le tap handler.
- Actions iOS/Android (catégories notif) : « Confirmer » / « Snooze 15min » / « Plus tard » (cf. AC #4 / #5 / #6).

**And** émet `guet_notification_sent` (`{ place_id }`).

---

**AC #4 — Tap sur la notif → confirmation `active` < 500ms**

**Given** la notif affichée
**When** le spawter tape sur la notif (sans action spécifique) OU action « Confirmer »
**Then** :
1. Émet `spawt_notification_opened` (`{ place_id, delay_seconds }` = `now - notified_at` en secondes).
2. App ouvre la fiche lieu via `router.push({ pathname: "/place/[id]", params: { id: place_id } })` — comportement standard expo-router routing depuis notif.
3. `confirmSpawt(row_id, "active")` est appelée (helper à créer dans `lib/guet/guet-spawt-actions.ts`) :
   - Update row `spawt_checkin` : `checked_in_at = now()`, `check_in_type = "active"`, `session_duration_minutes = (now - arrived_at) en minutes`, `is_verified = (accuracy_meters <= 30 && battery_ok)`.
   - Latence : `<500ms` (NFR-PERF-03) — local-first via `appendSpawtLocal(updated)` + `void saveSpawter`/`registerSpawt` côté store + fire-and-forget Supabase update.
   - Émet `spawt_completed` (`{ place_id, check_in_type: "active", is_verified, session_duration_minutes, had_review: false }`).
4. Si c'est le **tout premier** spawt verified (`spawter.total_spawts === 0 && is_verified`) : déclenche le badge Premier Spawt (AC #7).

**Given** précision GPS dernière mesure > 30m
**When** `confirmSpawt` est appelée
**Then** `is_verified = false`, `check_in_type = "manual"` (override), `geolocation_source = "manual"`. Émet `spawt_completed` avec `is_verified: false`. Poids 0.5x applicable côté ADN (Story 4.7).

**Given** batterie < 10% au moment du trigger
**When** `scheduleGuetPrompt` est appelée
**Then** elle skip la notif, force directement `confirmSpawt(row_id, "passive")` (cf. AC #6 mode passive).

---

**AC #5 — Snooze ×3 (15min chacun)**

**Given** la notif affichée
**When** le spawter tape sur l'action « Snooze 15min »
**Then** :
1. Update row : `snoozed_at = now()`, `snooze_count = snooze_count + 1`.
2. Émet `spawt_snoozed` (`{ place_id, snooze_count }`).
3. **Si `snooze_count < 3`** : reprogramme `Notifications.scheduleNotificationAsync` à `now + 15min`. Re-issue la même notif (idempotent identifier).
4. **Si `snooze_count >= 3`** : pas de reprogrammation. La row reste pending. À la fenêtre +30min après `left_at`, bascule en `passive` (AC #6).

---

**AC #6 — Mode passive si pas de réponse en fenêtre +30min**

**Given** la row pending toujours non confirmée et `left_at` set (`onGeofenceExit`) ou `now > arrived_at + 15min + (3 × 15min)` (snooze épuisé)
**When** la fenêtre `left_at + 30min` (= `POST_LEAVE_WINDOW_MINUTES = 30`) est dépassée
**Then** la row est finalisée en mode passive :
1. Si toujours pending (no `checked_in_at`) : `confirmSpawt(row_id, "passive")` qui set `checked_in_at = now()`, `check_in_type = "passive"`, `is_verified = (was_verified_when_arrived && accuracy_ok)`. **Pas** de note attachée (`note_etoiles = null`).
2. Émet `spawt_passive_recorded` (`{ place_id, session_duration_minutes }`).
3. Le poids ADN passif (0.5x via `PASSIVE_CHECKIN_WEIGHT`) sera appliqué Story 4.7 côté agrégation — pas Story 4.2.

**Mécanisme** : un job de cleanup côté `guet-task.ts` (lancé à chaque `onGeofenceExit` + au boot si pending rows en AsyncStorage). Voir Dev Notes §3.

---

**AC #7 — Badge « Premier Spawt » + déverrouillage avis détaillés**

**Given** un spawter avec `total_spawts === 0`
**When** son premier spawt est confirmé avec `is_verified === true`
**Then** :
1. `spawter-store.registerSpawt` détecte la transition `total_spawts: 0 → 1` ET `is_verified`.
2. Un flag local `is_premier_spawt_celebrated` (AsyncStorage `spawt:badge:premier_spawt_celebrated`) est set à `true` après le rendu de la célébration (anti-replay).
3. Émet `spawt_first_completed` (`{ place_id, time_since_onboarding_hours }` — calculé via `spawter.created_at`).
4. UI : un overlay `<BadgePremierSpawt />` apparaît **en post-confirmation** (sur la fiche lieu après le tap notif ou sur HomeD si retour app retardé). Pattern : Modal full-screen, fond `theme.colors.surface.dark`, badge SVG simple (cf. UX spec §1340), title `t("badge.premier_spawt.title")` → « Premier Spawt », body `t("badge.premier_spawt.body")` → « Le Chat sait que tu es passé chez {{place_name}}. La Meute s'enrichit d'un palais. » — voix Chat solennelle (mais **pas** confettis, pas de son ding).
5. CTA « Continuer » → ferme l'overlay, navigate à la fiche (si pas déjà ouverte). Pattern non-bloquant pour le funnel `review` Story 4.5.
6. **Déverrouillage avis détaillés** : V1 = aucun gate explicite sur les avis (Story 4.5 ouvre `ReviewForm` librement après tout `spawt_completed`). La doc PRD §3.1 Feature 5 mentionne « verrou levé » — interprété V1 comme métaphore (« premier passage débloque l'engagement »), pas une feature gate technique. **Pas** d'implémentation gate dans cette story.

**Anti-replay** : si `is_premier_spawt_celebrated === true` dans AsyncStorage, ne pas re-afficher (reinstall app => le flag est reset, c'est OK).

**< 5s** : la latence entre `spawt_completed` (event émis) et le rendu de `<BadgePremierSpawt />` est **< 5s** (mesurée par instrumentation simple `console.timeEnd` en `__DEV__`). Local-first + Modal natif → trivial à respecter.

---

**AC #8 — Mode démo (Expo Go, Le Guet non armé)**

**Given** `dataSourceMode === "fallback"` OU `Constants.appOwnership === "expo"` (cohérent Story 4.1)
**When** le spawter tape « Je spawt ici (aperçu du geste) » Story 4.1 stub (existe déjà)
**Then** Story 4.2 **remplace** le `Alert.alert` stub par un vrai `registerSpawtManual(place_id)` :
1. Crée une row `SpawtCheckin` locale (UUID via `randomUUID` côté `expo-crypto`) : `check_in_type = "manual"`, `geolocation_source = "manual"`, `is_verified = false`, `arrived_at = now()`, `checked_in_at = now()`, `session_duration_minutes = null` (single-point), `note_etoiles = null`.
2. Appelle `spawter-store.registerSpawt(row)` (existant).
3. Émet `spawt_completed` (`{ place_id, check_in_type: "manual", is_verified: false, session_duration_minutes: null, had_review: false }`).
4. Si c'est le 1er spawt verified → **non**, en mode démo `is_verified = false`, donc pas de badge Premier Spawt (cohérent : le badge récompense la présence physique, pas une simulation).
5. Affiche un Toast/Alert post-action : `t("guet.cta_manual_demo_success")` → « Spawt enregistré (aperçu). En live, ton Palais s'enrichirait après ton avis. »

---

**AC #9 — Events analytics + non-régression analytics**

**Given** `analytics.ts`
**When** Story 4.2 est livrée
**Then** les events suivants sont émis aux bons moments :

| Event | Trigger | Properties |
|---|---|---|
| `guet_threshold_reached` | Timer 15min atteint sur row pending | `{ place_id, minutes_in_zone: 15 }` |
| `guet_notification_sent` | `scheduleGuetPrompt` après succès `expo-notifications` API | `{ place_id }` |
| `spawt_notification_opened` | Tap sur la notif | `{ place_id, delay_seconds }` |
| `spawt_snoozed` | Action « Snooze 15min » | `{ place_id, snooze_count: 1\|2\|3 }` |
| `spawt_completed` | Confirm `active`/`manual` (et passif final) | `{ place_id, check_in_type, is_verified, session_duration_minutes, had_review: false }` |
| `spawt_passive_recorded` | Fin de fenêtre +30min sans confirm | `{ place_id, session_duration_minutes }` |
| `spawt_first_completed` | 1er spawt `total_spawts: 0→1` ET `is_verified` | `{ place_id, time_since_onboarding_hours }` |

**And** `had_review: false` dans `spawt_completed` — cohérent : Story 4.5 livrera la review attachée et émettra un 2e event `review_submitted` (pas re-émettre `spawt_completed` avec `had_review: true`). Le coupling `spawt → review` est analytique, pas event-rewrite.

---

**AC #10 — Tests + triple gate + smoke compile**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`confirmSpawt` helper pur** (`app/src/lib/guet/__tests__/guet-spawt-actions.test.ts`) :
   - `confirmSpawt(row_id, "active", { accuracy: 15, battery: 80 })` → `is_verified: true`, `check_in_type: "active"`.
   - `confirmSpawt(row_id, "active", { accuracy: 45, battery: 80 })` → `is_verified: false`, `check_in_type: "manual"` (NFR-GEO-02).
   - `confirmSpawt(row_id, "active", { accuracy: 15, battery: 8 })` → forced `passive` (NFR-GEO-04).
   - `confirmSpawt(row_id, "manual", {})` → toujours `is_verified: false`, mode démo.
   - Snooze counter capped at 3.
2. **`spawter-store.registerSpawt`** test 1er spawt :
   - `total_spawts: 0` + register `is_verified: true` → `spawt_first_completed` émis.
   - 2e spawt → pas de re-émission.
   - Anti-replay : si AsyncStorage `is_premier_spawt_celebrated === true`, no event re-émis même si reset state.
3. **i18n** : `npm run i18n:check` matche les nouvelles clés `notif.guet.*` + `badge.premier_spawt.*` + `chat.{stade}.guet_prompt`.
4. **`BadgePremierSpawt.tsx`** (`app/__tests__/components/BadgePremierSpawt.test.tsx`) :
   - Render avec props `{ visible: true, place_name: "Bô Zinc" }` → label interpolé.
   - Pas de snapshot pixel.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile (smoke).

## Tasks / Subtasks

- [ ] **Task 1 — Permission `expo-notifications` + initialisation** (AC: #1)
  - [ ] Créer helper `app/src/lib/guet/guet-permissions.ts` exportant `ensureNotifPermissionPostOTP()` (gated sur `geoloc_consent_at`).
  - [ ] Câbler dans `(tabs)/_layout.tsx` `useEffect` après hydrate du spawter store.
  - [ ] Confirmer que `ensureGuetChannel()` (Story 4.1) est bien appelée au boot (depuis `_layout.tsx` Root).

- [ ] **Task 2 — Timer 15min Option C** (AC: #2)
  - [ ] Dans `guet-task.ts:onGeofenceEnter`, après création de la row pending, scheduler une notif `expo-notifications` 15min plus tard (Option B).
  - [ ] Stocker `prompt_notification_id` sur la row pending locale (AsyncStorage map `spawt:guet:pending_prompts`).
  - [ ] `onGeofenceExit` : si `now - arrived_at < 15min`, `Notifications.cancelScheduledNotificationAsync(promptId)` + emit nothing.
  - [ ] À la réception notif (handler), re-vérifier l'état row : si `left_at != null && session < 15min` → cancel + emit `spawt_passive_recorded` direct.

- [ ] **Task 3 — `guet-notifications.ts` étendu** (AC: #3)
  - [ ] Ajouter `scheduleGuetPrompt(row_id, place_id, place_name)` : schedule trigger 15min, content i18n interpolé.
  - [ ] Ajouter `cancelGuetPrompt(row_id)`.
  - [ ] Ajouter `setupNotificationCategories()` : catégorie `"guet-prompt"` avec 2 actions (`confirm`, `snooze`) — déclaré au boot.
  - [ ] Ajouter `Notifications.addNotificationResponseReceivedListener(...)` qui route :
    - Action `confirm` ou tap général → `confirmSpawt(row_id, "active", measurements)`.
    - Action `snooze` → `scheduleSnooze(row_id, snooze_count)`.

- [ ] **Task 4 — `lib/guet/guet-spawt-actions.ts`** (AC: #4, #5, #6, #8)
  - [ ] Créer module avec helpers : `confirmSpawt(row_id, type, measurements)`, `scheduleSnooze(row_id, count)`, `finalizePassive(row_id)`, `registerSpawtManual(place_id)`.
  - [ ] Tous les helpers local-first + fire-and-forget Supabase (architecture invariant).
  - [ ] Émission des events analytics aux endroits canoniques.

- [ ] **Task 5 — `spawter-store.registerSpawt` étendu pour 1er spawt** (AC: #7)
  - [ ] Détecter la transition `total_spawts: 0 → 1` ET `is_verified`.
  - [ ] Lire flag AsyncStorage `spawt:badge:premier_spawt_celebrated`.
  - [ ] Si pas encore célébré → set un transient state Zustand `pendingBadge: { place_id, place_name }` consommé par le mount root.
  - [ ] Après render du badge, set flag AsyncStorage à `true`.

- [ ] **Task 6 — Composant `BadgePremierSpawt`** (AC: #7)
  - [ ] Créer `app/src/components/BadgePremierSpawt.tsx`.
  - [ ] Modal full-screen Reanimated fade-in (300ms), pas de confettis, pas de son.
  - [ ] Title + body i18n + CTA « Continuer » fermant via prop `onDismiss`.
  - [ ] Mount conditionnel dans `app/app/_layout.tsx` consommer `pendingBadge` from spawter-store.

- [ ] **Task 7 — Mode démo : remplacer Alert.alert par `registerSpawtManual`** (AC: #8)
  - [ ] Éditer [app/app/place/[id].tsx](../../app/app/place/%5Bid%5D.tsx) — handler du CTA secondaire (Story 4.1 Task 8).
  - [ ] Appeler `registerSpawtManual(place_id)` (helper Task 4) au tap.
  - [ ] Afficher Toast/`Alert.alert` post-action avec wording success.

- [ ] **Task 8 — i18n clés + voix Chat moment `guet_prompt`** (AC: #3, #7)
  - [ ] Éditer [app/src/i18n/fr.json](../../app/src/i18n/fr.json) :
    - `notif.guet.prompt.title` : « Le Guet a sonné »
    - `notif.guet.prompt.body` : « Comment c'était chez {{place_name}} ? Le Chat attend ton avis. »
    - `notif.guet.action_confirm` : « Confirmer »
    - `notif.guet.action_snooze` : « Snooze 15min »
    - `badge.premier_spawt.title` : « Premier Spawt »
    - `badge.premier_spawt.body` : « Le Chat sait que tu es passé chez {{place_name}}. La Meute s'enrichit d'un palais. »
    - `badge.premier_spawt.cta` : « Continuer »
    - `guet.cta_manual_demo_success` : « Spawt enregistré (aperçu). En live, ton Palais s'enrichirait après ton avis. »
    - **chat.{stade}.guet_prompt** (×5 stades) — laisser vide pour `touriste`/`explorateur`/`detective`/`djidji`, et silence pour `guide` (cf. `isChatSilent`). V1 n'utilise pas ces clés dans le body de notif (cf. §2 Dev Notes) — réserve pour V2 si Alexandre veut.
  - [ ] Éditer `app/src/lib/chat-voice.ts` `CHAT_MOMENTS` : ajouter `"guet_prompt"`.

- [ ] **Task 9 — Tests + triple gate + smoke** (AC: #10)
  - [ ] `guet-spawt-actions.test.ts` (4-5 cas confirmSpawt + snooze cap).
  - [ ] `spawter-store.test.ts` extension (test 1er spawt detect).
  - [ ] `BadgePremierSpawt.test.tsx` (render).
  - [ ] Triple gate verte.
  - [ ] `expo export --platform android` compile.
  - [ ] CHANGELOG `feat(spawt)` Story 4.2.

## Dev Notes

### 1. Décision D1 — Timer Option C (OS scheduler + re-vérif handler)

Option A (`setTimeout`) **ne survit pas** à l'OS-kill — invalidé pour le defining-experience de l'app (Story 4.2 est la story #1 à clouer, retrospective Epic 3 §6).

Option B pure (notif schedulée d'avance + cancel à exit) peut **faux-positiver** si :
- L'app est kill entre `onGeofenceEnter` et `onGeofenceExit` (cancel pas exécuté).
- La permission notif est révoquée entre-temps.

**Option C** = B + re-vérification au handler (`handleNotificationResponse` lit l'état row, si exit < 15min ou row absente → dismiss silencieux). Robuste OS-kill + auto-corrige les drifts.

**Trade-off** : la notif peut s'afficher même si pas en zone. Mitigation : la body de la notif est innocuous (« Comment c'était chez {{place_name}} ? ») — pas un faux blockage UX.

### 2. Décision D2 — Pas de chat-voice mapping dans le body de notif V1

`notif.guet.prompt.body` reste **stade-neutral** V1 :
- Le body de notif a un cap caractères iOS/Android (~178c title+body), mapping × 5 stades = bruit i18n + risque drift.
- Le ton **complice** est universel (PRD §9.3 — explorateur+ ton complice neutre).
- L'évolution stade × moment est plus visible **dans l'app** (badge body, ChatBubble HomeD) que dans la lock screen.

**Defer V2** : si Alexandre veut un ton stade-aware dans la notif → ajouter dans chat-voice mapping + `scheduleGuetPrompt` lit `spawter.stade` + interpole. À tracer en defer D-411.

### 3. Décision D3 — Job de cleanup passive (`finalizePassive`)

Le `passive` (AC #6) doit s'activer **sans** event externe — c'est un timer. **3 options** :

- **A** — Background fetch (`expo-task-manager` background fetch task) toutes les 15min. Cher batterie.
- **B** — À chaque `onGeofenceExit` + au boot : iterer les rows pending locales (AsyncStorage), check si `left_at + 30min < now`, si oui → `finalizePassive`.
- **C** — Lazy à chaque interaction app (foreground) : check pending au mount du HomeD ou de la fiche.

**Recommandation : B + C combinés** — couvre 90% des cas (l'app rouverte → cleanup ; geofence exit → cleanup), sans cost batterie.

**Edge case** : si le spawter n'ouvre jamais l'app après son repas, le passive reste pending **jusqu'à la prochaine ouverture**. À ce moment, le timestamp `checked_in_at = now()` peut être > 1 jour après `arrived_at` — anti-fraude NFR-FRAUD-06 (`session < 5min ET active`) ne fait pas faux-positif (passive, pas active). Acceptable.

### 4. Décision D4 — `Premier Spawt` célébré côté store, pas côté UI

L'event `spawt_first_completed` est **émis côté store** dans `registerSpawt`, pas côté UI. Pourquoi : la détection est purement state (`total_spawts: 0 → 1`), pas une décision UX. Le composant `<BadgePremierSpawt>` ne fait que **consommer** le state — pure render.

**Conséquence positive** : si Story 4.5 (avis) déclenche aussi un `registerSpawt` (avec note attachée), le 1er spawt est célébré une seule fois (state-driven, pas event-driven).

### 5. Non-régression Story 4.1

- `guet-task.ts` étendu (nouveau callback `onPresenceThresholdReached`). Pas de breaking sur les exports existants (`GUET_TASK`, `armGuet`, etc.).
- `lib/guet/guet-notifications.ts` étendu (`scheduleGuetPrompt`, `cancelGuetPrompt`, `setupNotificationCategories`). API existante préservée.
- `spawter-store.registerSpawt` étendu (nouveau `pendingBadge` state). Signature publique inchangée.
- `place/[id].tsx` CTA stub remplacé par vrai handler — pas une régression mais une **complétion**.

### 6. Sign-off

- **Stéphanie** (tech) : revue Option C timer (OS-kill survival), revue passive job cleanup, revue NFR-PERF-03 (`<500ms` confirm latency), revue NFR-PERF-04 (`<30s` notif latency).
- **Kidam** (analytics) : confirmation `spawt_first_completed` métriques (funnel cold start §16.1 PRD), confirmation `spawt_completed.had_review` reste `false` ici (Story 4.5 enrichit).
- **Alexandre** (brand) : audit copy `notif.guet.prompt.body` + `badge.premier_spawt.body` — Test Tantie Rose (Premier Spawt = moment narratif clé). Pas de Duolingo, pas de « VTC », ton complice neutre.

### 7. Defers identifiés

- **D-408** — Ton chat-voice stade-aware dans le body de notif (V2 si Alexandre demande).
- **D-409** — Background fetch task de cleanup passive (Option A §3) si l'alpha montre que les passive en attente sont nombreux.
- **D-410** — Snooze custom (5min, 1h) — V1 = 15min fixe.
- **D-411** — Action « Plus tard » (= je donnerai mon avis depuis la fiche) distincte du snooze (= rappel notif). V1 = pas exposé, on traite « Plus tard » comme un dismiss → bascule passive après fenêtre.
- **D-412** — Notification permissions onboarding-driven (Story 2.x amendment) — V1 = lazy à `(tabs)` mount.
- **D-413** — Badge replay (« Premier Spawt » re-célébré si rejouer onboarding) — V1 = flag AsyncStorage, replay sur reinstall accepté.

### 8. Risk

- **Risque #1** : Notif scheduling cancelée par OS Tecno/Infinix avant les 15min (battery saver). Mitigation : test devices alpha (priorité Tecno).
- **Risque #2** : `spawt_first_completed` émis 2× si bug state (race condition register). Mitigation : flag AsyncStorage `is_premier_spawt_celebrated` set-once (idempotent).
- **Risque #3** : Latence > 30s notif sur 3G (NFR-PERF-04). Mitigation : notif est **locale** (pas serveur), latence indépendante du réseau côté send. Côté event analytics `guet_notification_sent`, **est** dépendant du réseau → potentiellement queue offline (Story 4.3).
- **Risque #4** : Tap sur notif quand l'app n'est pas en mémoire (cold start). Le routing `router.push` peut échouer si root layout pas encore hydraté. Mitigation : retry une fois après `hydrating: false` du store (helper `routeAfterHydration(path)`).

### Project Structure Notes

- **1 nouveau module lib** : `app/src/lib/guet/guet-spawt-actions.ts` + `guet-permissions.ts`.
- **1 nouveau composant** : `app/src/components/BadgePremierSpawt.tsx`.
- **Étendus** : `app/src/lib/guet/guet-task.ts`, `guet-notifications.ts`, `app/src/lib/chat-voice.ts` (+1 moment), `app/src/store/spawter-store.ts` (+`pendingBadge` state), `app/src/i18n/fr.json` (+8 clés).
- **Modifiés** : `app/app/_layout.tsx` (mount BadgePremierSpawt), `app/app/(tabs)/_layout.tsx` (permission boot), `app/app/place/[id].tsx` (CTA mode démo).
- **Pas de migration SQL** — la table `spawt_checkin` reste celle de Story 4.1.
- **Pas de nouvelle dépendance** — `expo-notifications` déjà installée (Story 4.1).

### References

- [_bmad-output/planning-artifacts/epics.md#L858-L881](../planning-artifacts/epics.md#L858-L881) Story 4.2
- [_bmad-output/planning-artifacts/PRD.md §7.1 + §3.1 Feature 5 + Feature 13](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §16.1](../planning-artifacts/PRD.md) Activation funnel (spawt_first_completed)
- [_bmad-output/planning-artifacts/architecture.md#L366-L374](../planning-artifacts/architecture.md#L366-L374) Le Guet stack
- [_bmad-output/planning-artifacts/ux-design-specification.md#L737-L754](../planning-artifacts/ux-design-specification.md#L737-L754) Defining experience — Le Spawt
- [_bmad-output/planning-artifacts/ux-design-specification.md#L1340](../planning-artifacts/ux-design-specification.md#L1340) Animation badge (pas Duolingo)
- [_bmad-output/project-context.md §Voix du Chat — pas de gamification + §Anti-patterns produit](../project-context.md)
- [documentation/analytics/events.md §6 Le Guet + §3 Activation premier spawt](../../documentation/analytics/events.md)
- [app/src/types/spawt.ts](../../app/src/types/spawt.ts) `ANTIFRAUD_RULES`
- [app/src/store/spawter-store.ts:233-259](../../app/src/store/spawter-store.ts#L233-L259) `registerSpawt` actuel
- [app/src/lib/guet/](../../app/src/lib/guet/) Story 4.1 (consommé)
- [app/app.json](../../app/app.json) permissions notif (à valider Android `POST_NOTIFICATIONS`)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Completion Notes List

- `app/src/lib/guet/guet-permissions.ts` créé — `ensureNotifPermissionPostOTP(hasGeolocConsent)` gated set-once geoloc consent (ARTCI Story 2.2).
- `app/src/lib/guet/guet-spawt-actions.ts` créé — helpers purs `computeConfirmPatch` (NFR-GEO-02 accuracy > 30m → manual, NFR-GEO-04 battery < 10% → passive), `computeSnoozePatch` (cap MAX_SNOOZE_COUNT=3), `computePassivePatch` (fenêtre +30min finalize), `buildManualSpawt` (mode démo).
- `app/src/lib/guet/guet-notifications.ts` étendu — `setupGuetCategories` (Confirmer/Snooze 15min), `scheduleGuetPrompt(payload, delaySeconds=900)` Option C (OS scheduler + re-vérif handler), `cancelGuetPrompt`, `guetPromptId`, `registerNotificationResponseHandler` (listener tap → route confirm/snooze/default).
- `app/src/components/BadgePremierSpawt.tsx` créé — Modal full-screen Reanimated fade-in 300ms, **pas** de confettis, **pas** de son ding (PRD §9.3 anti-Duolingo).
- `app/src/store/spawter-store.ts` étendu — `pendingBadge: PendingBadge | null` state + `consumePendingBadge` action set-once AsyncStorage flag `spawt:badge:premier_spawt_celebrated` + détection 1er spawt verified (transition `total_spawts: 0 → 1` + emit `spawt_first_completed`).
- Câblage `app/app/_layout.tsx` — mount `<BadgePremierSpawt>` consume `pendingBadge` + `setupGuetCategories` au boot.
- Refactor `app/app/place/[id].tsx` `handleSpawt` → utilise `buildManualSpawt` (factorisation, plus de construction inline avec `Crypto.randomUUID`).
- i18n : `notif.guet.prompt_title/body/action_confirm/action_snooze`, `badge.premier_spawt_title/body/cta`, + `chat.{stade}.guet_prompt` vides (V1 body neutre, D-408 stade-aware Sprint 2).
- `chat-voice.ts` `CHAT_MOMENTS` étendu avec `guet_prompt` (14 moments total, test `chat-voice-coverage.test.ts` toujours vert).
- **Defers Story 4.2 PASS 2** : wire end-to-end `onPresenceThresholdReached` côté `guet-task.ts` (Option C complète : schedule notif à `onGeofenceEnter` + cancel à `onGeofenceExit` + re-vérif state row à la réception). V1 expose les primitives (`scheduleGuetPrompt`, `cancelGuetPrompt`, `registerNotificationResponseHandler`) — câbler PASS 2 quand les rows pending Story 4.1 sont effectivement créées au runtime (Story 4.4 anti-fraude + Story 4.3 offline queue intégrés).
- Tests : `app/src/lib/guet/__tests__/guet-spawt-actions.test.ts` (8 cas — NFR-GEO-02/04, snooze cap, passive, mode démo) + `app/__tests__/store/spawter-store-premier-spawt.test.ts` (4 cas — 1er spawt detect, 2e silent, non-verified, anti-replay AsyncStorage).

### File List

**Nouveau** :
- `app/src/lib/guet/guet-permissions.ts`
- `app/src/lib/guet/guet-spawt-actions.ts`
- `app/src/components/BadgePremierSpawt.tsx`
- `app/src/lib/guet/__tests__/guet-spawt-actions.test.ts`
- `app/__tests__/store/spawter-store-premier-spawt.test.ts`

**Modifié** :
- `app/src/lib/guet/guet-notifications.ts` (+ scheduleGuetPrompt/cancelGuetPrompt/setupGuetCategories/registerNotificationResponseHandler)
- `app/src/lib/guet/index.ts` (re-exports Story 4.2)
- `app/src/lib/chat-voice.ts` (+`guet_prompt` moment)
- `app/src/store/spawter-store.ts` (+pendingBadge state + consumePendingBadge + Premier Spawt detect)
- `app/app/_layout.tsx` (mount BadgePremierSpawt + setupGuetCategories)
- `app/app/place/[id].tsx` (refactor handleSpawt → buildManualSpawt)
- `app/src/i18n/fr.json` (+notif.guet.* + badge.premier_spawt.* + chat.{stade}.guet_prompt vides)
- `app/__tests__/lib/chat-voice.test.ts` (count update 9→10 / 13→14)
