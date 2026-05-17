# Story 2.2: Splash & écran de consentement ARTCI bloquant

Status: review

<!-- Première story d'Epic 2 qui ouvre le funnel onboarding (Splash → Consent → Phone → Profile → Calibration → Palais initial). Verrou conformité Loi 2013-450 — sans cette story le J0 produit une infraction ARTCI. -->

## Story

As a nouveau spawter,
I want un écran d'accueil puis un consentement explicite avant toute collecte,
so that j'entre dans l'app en confiance et conforme à la Loi 2013-450 (DR-ARTCI-02/03/04 + DR-CGV-01).

## ⚠️ Brownfield context — read first

**Story brownfield : Splash + Consent existent déjà mais NE MATCHENT PAS FR-040.** Le travail de cette story est de **réécrire** les 2 écrans pour qu'ils respectent FR-040 verbatim + de **réconcilier 3 drifts spec-code** historisés ci-dessous.

| Élément | Fichier existant | État vs FR-040 | Action Story 2.2 |
|---|---|---|---|
| Splash | [app/app/index.tsx](../../app/app/index.tsx) | ⚠️ Brand copy `splash.tagline` au lieu de la voix du Chat ; pas de `gr-night` (`palette.black` plat) ; émission `onboarding_started` **absente** | **Réécrire** : fond `gr-night` (LinearGradient), CTA « Entrer dans la Meute », émission `onboarding_started` au tap |
| Écran consent | [app/app/(onboarding)/consent.tsx](../../app/app/(onboarding)/consent.tsx) | ❌ Pattern « Accept/Decline cards » (cartes geoloc + démographique, état `pending\|accepted\|declined`, `canContinue = geoloc !== "pending"`) — **violation FR-040** qui exige 2 checkboxes non pré-cochées + bouton « Continuer » désactivé tant que les 2 ne sont pas cochées (gate bloquant binaire, pas de « plus tard ») | **Réécrire complet** selon FR-040 |
| Schéma DB | [supabase/migrations/0001_create_spawters_spawt_staff.sql:75-76](../../supabase/migrations/0001_create_spawters_spawt_staff.sql#L75-L76) | ❌ Colonnes `geoloc_consent_at` + `data_consent_at` — FR-040 + architecture §1.2.7 spec `cgv_accepted_at` + `geoloc_consent_at` | **Migration 0006** : rename `data_consent_at` → `cgv_accepted_at` (+ trigger 0005 mis à jour) |
| Type TS | [app/src/types/spawter.ts:36-37](../../app/src/types/spawter.ts#L36-L37) | ❌ `data_consent_at` | **Rename** → `cgv_accepted_at` |
| Store action | [app/src/store/spawter-store.ts:33,54-67](../../app/src/store/spawter-store.ts#L33-L67) `recordConsent(kind: "geoloc" \| "data")` | ❌ `"data"` kind | **Renommer** `"data"` → `"cgv"` + adapter mapping `fieldName` |
| Storage helper | [app/src/lib/storage.ts](../../app/src/lib/storage.ts) `setConsent` | ❌ kind `"geoloc" \| "data"` | Aligner sur `"cgv" \| "geoloc"` |
| Analytics event | [app/src/lib/analytics.ts:74-77](../../app/src/lib/analytics.ts#L74-L77) `ConsentRecorded.kind: "geoloc" \| "data"` | ❌ `"data"` kind | Aligner sur `"cgv" \| "geoloc"` |
| Source-of-truth events | [documentation/analytics/events.md:34](../../documentation/analytics/events.md#L34) `consent_recorded.kind = geoloc \| data` | ❌ idem | Aligner sur `cgv \| geoloc` (sign-off Kidam requis — voir Dev Notes §6) |
| ChatMoments existants | [app/src/lib/chat-voice.ts:27-28](../../app/src/lib/chat-voice.ts#L27-L28) | ✅ `geoloc_consent_request` + `demographics_consent_request` déjà déclarés Story 2.1 mais inadaptés au framing FR-040 (CGU/CGV + données+géoloc bundled) | **Réutiliser** `geoloc_consent_request` comme CatBubble intro unique (string mise à jour fr.json pour couvrir les 2 blocs). Marquer `demographics_consent_request` deferred (Defer §7) — la signature `chat-voice.ts` reste stable (matrice Story 2.1 préservée) |
| Strings i18n consent | [app/src/i18n/fr.json:24-37](../../app/src/i18n/fr.json#L24-L37) | ⚠️ Clés `geoloc_accept/decline` + `demographics_accept/decline` (pattern Accept/Decline) | **Restructurer** : `cgv_label`, `cgv_body`, `geoloc_label`, `geoloc_body`, `policy_link`, `terms_link`, `intro` (CatBubble) |
| Set-once trigger | [supabase/migrations/0005_spawters_invariant_triggers.sql:53-82](../../supabase/migrations/0005_spawters_invariant_triggers.sql#L53-L82) | ⚠️ Référence `data_consent_at` | **Mettre à jour** : `data_consent_at` → `cgv_accepted_at` dans le trigger + message d'erreur |
| RouteGuard | [app/app/_layout.tsx:23-44](../../app/app/_layout.tsx#L23-L44) | ✅ Passif, observe le store, redirige `(tabs)` ↔ `index`/`(onboarding)` | **Ne pas toucher** — guard reste passif (anti-scope-creep) |
| `expo-linear-gradient` | [app/package.json](../../app/package.json) | ✅ `~55.0.14` déjà installé | **Réutiliser** (pas de new dep) |
| `Ico.check` | [app/src/components/primitives/Ico.tsx:9-38](../../app/src/components/primitives/Ico.tsx#L9-L38) | ❌ Absent du set de 29 icônes | **Ajouter** `"check"` à `IconName` + path SVG (24×24 stroke 1.6) — usage Checkbox |

**Drifts spec-code résolus par cette story (3) :**

1. **Naming `data_consent_at` → `cgv_accepted_at`** (DB + TS + store + analytics + events.md). FR-040 et architecture.md §1.2.7 sont les sources canoniques. La rename est sûre car **aucun row spawter n'a encore été créé en production** (alpha pas démarrée). Down migration triviale. **Sign-off requis Kidam** (touche events.md).
2. **UI Accept/Decline → 2 checkboxes binaires.** Le pattern actuel (`pending|accepted|declined` + `canContinue = geoloc !== "pending"`) est un legacy pre-FR-040. FR-040 exige 2 checkboxes non pré-cochées avec bouton « Continuer » désactivé sinon. Pas de « Plus tard » ni « Decline » — c'est binaire (bloquant non-punitif).
3. **Splash brand copy → moment d'identité `gr-night`.** UX spec §moments-gr-night ligne 1024 : « Splash, célébration de stade, carte spawter recto, paywall Gold, notif Le Guet (lock screen), hero éditorial » — Splash est un moment d'identité `gr-night`. La string `splash.tagline` actuelle (« Ne plus jamais regretter un restaurant. ») peut rester en sous-titre brand mais l'écran adopte le traitement `gr-night`.

**Décision Alexandre déjà tranchée (retro Epic 1 §3.4 — 1.4 ChatBubble typo)** : `preset.body` uniforme dans `ChatBubble` V1, pas de modulation `(stade × moment) → typo`. Ne pas ré-ouvrir.

**Décisions critical path Epic 2 §5.2 — état avant Story 2.2 :**
- **#3 ARTCI legal wording** : la rédaction CGU/CGV droit ivoirien est `[pending juriste]` (DR-CGV-01 à 07). Story 2.2 utilise des **placeholders i18n** identifiés `[pending juriste]` dans `fr.json`, livre les URL externes `spawt.ci/privacy` + `spawt.ci/terms` en l'état (déjà câblées dans le legacy `consent.tsx:78,86`). La validation juriste est un follow-up hors Sprint 1.
- **#5 Smoke device matrice 4** : reste pending pour merge `main`, non bloquant pour `spawt/v1-bmad` (cf. retro §3.6).

## Acceptance Criteria

**AC #1 — Splash `gr-night` avec CTA « Entrer dans la Meute » émet `onboarding_started`**

**Given** le premier lancement de l'app (pas de `spawter` dans le store, `hydrating === false`)
**When** `app/app/index.tsx` se monte
**Then** le fond est un `LinearGradient` (180°, `gradient.night` = `["#0A0A0A", "#1A1A2E"]` tokens canoniques)
**And** le wordmark « SPAWT » est affiché en `palette.gold` (`brand.primary`), typo `preset.display`/`preset.h1` (Klinsman)
**And** le sous-titre `t("splash.tagline")` reste affiché en `text.inverseSecondary`
**And** un CTA primaire `Pressable` affiche `t("splash.cta_start")` = « Entrer dans la Meute » (fond `palette.gold`, label en `text.onBrand`, padding `theme.spacing.base`, radius `theme.radius.lg`)

**Given** le CTA « Entrer dans la Meute »
**When** le spawter tape dessus
**Then** `track({ name: "onboarding_started", properties: {} })` est émis **avant** la navigation
**And** `router.push("/(onboarding)/consent")` est appelé

**Given** le test snapshot/component du Splash
**When** lancé
**Then** aucun hex en dur n'apparaît dans `app/app/index.tsx` (audit `grep -nE '#[0-9A-Fa-f]{3,6}' app/app/index.tsx` ressort vide — tous les bg/colors passent par `theme` ou `gradient.night`)

---

**AC #2 — Écran consent affiche 2 checkboxes non pré-cochées + 1 CatBubble intro**

**Given** l'écran consent monté
**When** il s'affiche au premier rendu
**Then** un `<ChatBubble stade="touriste" moment="geoloc_consent_request" />` est rendu en tête (CatBubble fond noir, défaut variant `bubble` — Story 2.1) avec une string i18n qui couvre les 2 blocs (« On va parler de deux trucs. Tes infos, ta position. Je t'explique sans gronder. » — ton touriste `enjoue_taquin`, validation Alexandre)
**And** 2 cases distinctes sont rendues, chacune avec :
- une case carrée 24×24 (`Pressable`, fond `surface.raised` + bordure 1px `border.subtle`, radius `theme.radius.sm`, icône `Ico.check` size 18 `brand.accent` visible **uniquement** quand cochée)
- un label `Text` typo `preset.body` `text.primary` à droite, étirable
- un body court `Text` typo `preset.caption` `text.secondary` sous le label
- **Case 1** : label `t("consent.cgv_label")` = « J'accepte les CGU/CGV », body `t("consent.cgv_body")` (référence aux CGU/CGV droit ivoirien)
- **Case 2** : label `t("consent.geoloc_label")` = « J'accepte la collecte de mes données et de ma géolocalisation pour le service SPAWT », body `t("consent.geoloc_body")` (mention « usage spawt uniquement » conformément à FR-040)
**And** **aucune** case n'est cochée au monter (state initial = `cgv: false, geoloc: false`)
**And** l'événement `track({ name: "consent_screen_viewed", properties: {} })` est émis dans un `useEffect` au montage (deps `[]`, fire une seule fois — pas de re-mount excessif)

**Given** les 2 liens externes
**When** l'écran s'affiche
**Then** 2 `Pressable` accessibles `accessibilityRole="link"` affichent `t("consent.policy_link")` = « Politique de confidentialité » et `t("consent.terms_link")` = « Conditions d'utilisation »
**And** un tap appelle `Linking.openURL("https://spawt.ci/privacy")` et `Linking.openURL("https://spawt.ci/terms")` respectivement (URLs identiques au legacy `consent.tsx:78,86`)

---

**AC #3 — Bouton « Continuer » désactivé tant que les 2 cases ne sont pas cochées**

**Given** l'écran consent affiché
**When** `cgv === false || geoloc === false`
**Then** le bouton « Continuer » a `disabled === true`, fond `border.subtle` (cf. Defer 1.1 dans `deferred-work.md` : `border.subtle` est translucide depuis 979ee2d — valider visuellement le rendu sur fond clair), label en `text.tertiary`, pas d'effet press (opacity 1)
**And** un tap ne déclenche **aucune** navigation ni mutation

**Given** une seule case cochée
**When** `(cgv && !geoloc) || (!cgv && geoloc)`
**Then** le bouton reste désactivé (gate binaire — pas de progression partielle)

**Given** les 2 cases cochées
**When** `cgv === true && geoloc === true`
**Then** le bouton « Continuer » devient actif : fond `brand.accent` (Vert Chat #2D6B4F), label `text.inverse`, opacity press 0.85

---

**AC #4 — Au tap « Continuer », les 2 timestamps sont historisés ET 2 events `consent_recorded` sont émis par bloc**

**Given** les 2 cases cochées
**When** le spawter tape « Continuer »
**Then** **2 émissions distinctes** sont faites dans cet ordre (avant navigation) :
1. `track({ name: "consent_recorded", properties: { kind: "cgv", decision: "accepted" } })`
2. `track({ name: "consent_recorded", properties: { kind: "geoloc", decision: "accepted" } })`
**And** `track({ name: "onboarding_step_completed", properties: { step: "consent", step_index: 1 } })` est émis **après** les 2 `consent_recorded`
**And** les 2 timestamps `cgv_accepted_at` + `geoloc_consent_at` sont persistés via le store :
- Si `spawter === null` (cas standard pré-auth — flow `consent` précède `phone`/`OTP`) : les 2 timestamps sont écrits dans `onboarding-draft.consent` (nouvel objet `{ cgv_accepted_at: string \| null, geoloc_consent_at: string \| null }`). `finalizeOnboarding` (Story 2.5/2.6) les lira pour les passer au row `spawters` à l'insert.
- Si `spawter !== null` (cas réouverture / déconnexion partielle) : les 2 timestamps sont écrits via `recordConsent("cgv", true)` puis `recordConsent("geoloc", true)` — chaque action met à jour `spawters.{field}_at` local + fire-and-forget Supabase. Le trigger `assert_consent_set_once` (migration 0005) refusera silencieusement une 2ᵉ écriture si la valeur est déjà non-NULL — c'est attendu (idempotence).
**And** la navigation `router.push("/(onboarding)/phone")` se déclenche **après** les écritures locales (le `await setConsentLocal(...)` doit avoir résolu — éviter une nav avant persistence)

**Given** une révocation depuis Profil → Paramètres (hors scope cette story)
**When** elle est implémentée (Sprint 1 follow-up post-2.6 ou Sprint 2)
**Then** elle ne casse pas le trigger set-once : la révocation ne `UPDATE` pas le timestamp (qui est immuable), elle écrit dans un autre champ `geoloc_revoked_at` à ajouter ultérieurement. **Hors scope Story 2.2 — Defer §7.**

---

**AC #5 — Migration 0006 + alignement du type + alignement du trigger 0005**

**Given** le repo
**When** la story est livrée
**Then** une nouvelle migration `supabase/migrations/0006_rename_data_consent_to_cgv_accepted.sql` existe avec :
- `ALTER TABLE public.spawters RENAME COLUMN data_consent_at TO cgv_accepted_at;`
- `DROP TRIGGER spawters_consent_set_once ON public.spawters;` puis `CREATE OR REPLACE FUNCTION public.assert_consent_set_once()` mis à jour (référence `cgv_accepted_at` au lieu de `data_consent_at`, message d'erreur idem) puis `CREATE TRIGGER spawters_consent_set_once BEFORE UPDATE OF geoloc_consent_at, cgv_accepted_at ON public.spawters ...`
- Un commentaire SQL en tête référence FR-040 + Story 2.2 + architecture §1.2.7
**And** une migration descendante `0006_rename_data_consent_to_cgv_accepted.down.sql` inverse le rename + restaure la version originale du trigger
**And** [app/src/types/spawter.ts:37](../../app/src/types/spawter.ts#L37) : `data_consent_at` renommé `cgv_accepted_at`
**And** [supabase/migrations/0005_spawters_invariant_triggers.sql](../../supabase/migrations/0005_spawters_invariant_triggers.sql) **n'est PAS modifiée** (migration ne se réécrit jamais — le rename trigger passe par 0006)
**And** validation sémantique : `cd app/.. && npx pglite` (pattern Epic 1 retro §4 + Story 1.8) applique 0001→0006 sans erreur ET teste que `UPDATE spawters SET cgv_accepted_at = now() WHERE id = X` réussit la 1re fois et raise `check_violation` la 2nde (set-once préservé)

**Given** le store + storage helpers
**When** lancés
**Then** [app/src/store/spawter-store.ts:33,54-67](../../app/src/store/spawter-store.ts#L33-L67) : signature `recordConsent(kind: "cgv" | "geoloc", accepted: boolean)`, mapping `fieldName = kind === "geoloc" ? "geoloc_consent_at" : "cgv_accepted_at"` (renommé)
**And** [app/src/lib/storage.ts](../../app/src/lib/storage.ts) `setConsent(kind: "cgv" | "geoloc", accepted: boolean)` (renommé)
**And** [app/src/store/onboarding-draft.ts](../../app/src/store/onboarding-draft.ts) reçoit un champ `consent: { cgv_accepted_at: string | null; geoloc_consent_at: string | null }` (initial `{ cgv_accepted_at: null, geoloc_consent_at: null }`) + une action `setConsent(kind: "cgv" | "geoloc", at: string | null)`
**And** [app/src/types/spawter.ts:43-53 OnboardingDraft](../../app/src/types/spawter.ts#L43-L53) : ajout de `consent: { cgv_accepted_at: string | null; geoloc_consent_at: string | null }` dans l'interface (la persistance long-terme du draft est hors scope — voir §Project Structure Notes)

---

**AC #6 — `consent_recorded` event taxonomy alignée `kind: "cgv" | "geoloc"`**

**Given** [app/src/lib/analytics.ts:74-77](../../app/src/lib/analytics.ts#L74-L77)
**When** la story est livrée
**Then** le type `ConsentRecorded.properties.kind` = `"cgv" | "geoloc"` (au lieu de `"geoloc" | "data"`)
**And** [documentation/analytics/events.md:34](../../documentation/analytics/events.md#L34) ligne `consent_recorded` mise à jour : `kind (cgv | geoloc), decision (accepted | declined)`
**And** un commentaire dans events.md référence Story 2.2 + FR-040 pour traçabilité (la modif d'events.md = source of truth Kidam, **sign-off Kidam requis avant merge**)
**And** le mapping `EVENT_TO_SIGNAL` reste inchangé (`consent_recorded → "click"`)

---

**AC #7 — Tests unit + tests composant + tests pglite**

**Given** les nouveaux comportements
**When** `cd app && npm test` est lancé
**Then** la suite couvre **au minimum** :

1. **`storage.setConsent`** ([app/src/lib/storage.ts](../../app/src/lib/storage.ts)) : `setConsent("cgv", true)` puis `getConsent("cgv")` retourne un ISO timestamp ; idem pour `"geoloc"` ; un appel avec `accepted: false` set null (cohérent avec le legacy).
2. **`spawter-store.recordConsent`** : action `recordConsent("cgv", true)` avec `spawter !== null` met à jour `spawter.cgv_accepted_at` (string non-NULL) ; idem `"geoloc"` ; **ne crash pas** si `spawter === null` (no-op silencieux du store, le draft est l'autre canal — vérifier avec un test).
3. **`onboarding-draft.setConsent`** (nouvelle action) : `setConsent("cgv", isoNow)` met à jour `draft.consent.cgv_accepted_at`, ne touche pas `geoloc_consent_at`.
4. **Composant `<ConsentScreen />`** (React Testing Library + `jest-expo`) :
   - Au montage : `consent_screen_viewed` émis exactement 1 fois (mock `track`).
   - Bouton « Continuer » `disabled` au montage.
   - Tap case 1 → state `cgv === true`, bouton toujours `disabled`.
   - Tap case 2 → state `geoloc === true`, bouton **activé**.
   - Tap « Continuer » → `track` appelé 3 fois dans l'ordre (`cgv` → `geoloc` → `onboarding_step_completed`).
   - Tap « Continuer » → `useOnboardingDraft.setConsent("cgv", ...)` et `setConsent("geoloc", ...)` appelés ; `router.push("/(onboarding)/phone")` appelé.
5. **Composant `<SplashScreen />` (`app/app/index.tsx`)** :
   - Wordmark + tagline + CTA rendus.
   - Tap CTA → `track({ name: "onboarding_started", ... })` émis ; `router.push("/(onboarding)/consent")` appelé.
6. **PGlite migration test** (pattern Story 1.8 + Epic 1 §4 — `app/__tests__/integration/migrations.test.ts` ou similaire) :
   - Applique 0001→0006 sur PGlite.
   - Vérifie `spawters.cgv_accepted_at` existe en `timestamptz` NULL.
   - Vérifie `data_consent_at` n'existe **plus**.
   - Vérifie trigger set-once : 1re écriture OK, 2nde raise `check_violation`.

**Given** les tests
**When** lancés via `cd app && npm test`
**Then** **zéro régression** sur les suites existantes (chat-voice, CatBubble, store, storage, migrations 0001-0005) — re-run de toutes les suites passe (Story 1.7 + 2.1 frozen matrix préservée)

---

**AC #8 — Triple gate verte + smoke web + RouteGuard non-régression**

**Given** la triple gate `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check`
**When** lancée
**Then** les 3 audits sortent verts
**And** `cd app && expo export --platform web` compile sans erreur (smoke web — pattern Story 1.4 §6 + Story 2.1)
**And** `cd app && expo export --platform android` compile sans erreur (smoke build, pas de manifest natif requis ici car aucune nouvelle permission ajoutée)

**Given** le `RouteGuard` ([app/app/_layout.tsx:23-44](../../app/app/_layout.tsx#L23-L44))
**When** l'app reboot avec `spawter === null` et le draft `consent.cgv_accepted_at` rempli mais `phone_e164` vide
**Then** le guard redirige vers `/` (Splash) — le brouillon est éphémère, l'utilisateur recommence le funnel. C'est attendu (UX spec line 1112-1113 « onboarding-draft persisté éphémère / RouteGuard reprend à la réouverture » s'applique au calibrage en cours, pas au consent. Persistance long-terme du draft = Defer §7).

**Given** le test Tantie Rose (Alexandre, 3 questions sur l'écran)
**When** l'écran consent est revu
**Then** le wording est validé :
1. **Tantie Rose comprend ?** — phrases courtes, pas de jargon (« case à cocher », pas « checkbox »), explication concrète.
2. **Brice Konan le partagerait ?** — design propre, le ton « explique sans gronder » est respecté (CatBubble touriste tone), pas de pression commerciale.
3. **Dominic sent l'appartenance ?** — voix du Chat amicale dès le consent, pas de juridique froid bloquant.

## Tasks / Subtasks

- [x] **Task 1 — Migration SQL 0006 : rename `data_consent_at` → `cgv_accepted_at`** (AC: #5)
  - [x] Créer `supabase/migrations/0006_rename_data_consent_to_cgv_accepted.sql` : `ALTER TABLE public.spawters RENAME COLUMN data_consent_at TO cgv_accepted_at;`
  - [x] Dans la même migration, `DROP TRIGGER spawters_consent_set_once ON public.spawters;` et `CREATE OR REPLACE FUNCTION public.assert_consent_set_once()` avec la nouvelle référence + recréation du trigger sur la nouvelle colonne. **Ne PAS** modifier 0005.
  - [x] Créer `supabase/migrations/0006_rename_data_consent_to_cgv_accepted.down.sql` qui inverse le rename + restaure la version originale du trigger (copier 0005).
  - [x] Tester en local via PGlite : `cd app && npx ts-node ../scripts/pglite-validate.ts` (ou pattern équivalent Story 1.8) — appliquer 0001→0006 sans erreur, vérifier l'invariant set-once sur `cgv_accepted_at`.
  - [x] Mettre à jour [supabase/README.md](../../supabase/README.md) tableau « État Sprint 1 » avec ligne 0006 (cf. retro Epic 1 §3.1 — propagation aux docs satellites).

- [x] **Task 2 — Aligner les types TS sur `cgv_accepted_at`** (AC: #5)
  - [x] [app/src/types/spawter.ts](../../app/src/types/spawter.ts) ligne 37 : `data_consent_at` → `cgv_accepted_at` (commentaire doc inchangé sémantiquement, juste le nom de champ).
  - [x] [app/src/types/spawter.ts](../../app/src/types/spawter.ts) `OnboardingDraft` : ajouter `consent: { cgv_accepted_at: string | null; geoloc_consent_at: string | null }`.
  - [x] [app/src/data/seed/sample-spawter.ts](../../app/src/data/seed/sample-spawter.ts) (si existant) : ajuster la seed si elle référence `data_consent_at`.

- [x] **Task 3 — Aligner `storage.ts` et `spawter-store.ts` sur le nouveau kind union** (AC: #4, #5)
  - [x] [app/src/lib/storage.ts](../../app/src/lib/storage.ts) : `setConsent(kind: "cgv" | "geoloc", accepted: boolean)` (rename `"data"` → `"cgv"` partout, AsyncStorage key adjusté si nécessaire — vérifier la migration utilisateur n'est pas requise vu qu'aucun row prod n'existe encore).
  - [x] [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) ligne 33 : signature `recordConsent: (kind: "cgv" | "geoloc", accepted: boolean) => Promise<void>` ; ligne 58 : `fieldName = kind === "geoloc" ? "geoloc_consent_at" : "cgv_accepted_at"`.
  - [x] [app/src/store/onboarding-draft.ts](../../app/src/store/onboarding-draft.ts) : initialiser `consent: { cgv_accepted_at: null, geoloc_consent_at: null }` + ajouter action `setConsent: (kind: "cgv" | "geoloc", at: string | null) => void` qui mute `draft.consent.{kind === "cgv" ? "cgv_accepted_at" : "geoloc_consent_at"}`.

- [x] **Task 4 — Aligner `analytics.ts` + `events.md` sur `kind: "cgv" | "geoloc"`** (AC: #6)
  - [x] [app/src/lib/analytics.ts:74-77](../../app/src/lib/analytics.ts#L74-L77) : `ConsentRecorded.properties.kind: "cgv" | "geoloc"`.
  - [x] [documentation/analytics/events.md:34](../../documentation/analytics/events.md#L34) : ligne `consent_recorded` mise à jour + commentaire référence Story 2.2 + FR-040.
  - [x] **Sign-off Kidam** documenté en Completion Notes (sans Kidam le merge est bloqué — pas un audit auto).

- [x] **Task 5 — Ajouter icône `check` au set `Ico`** (AC: #2)
  - [x] [app/src/components/primitives/Ico.tsx](../../app/src/components/primitives/Ico.tsx) : ajouter `"check"` à `IconName`.
  - [x] Ajouter le case `case "check":` dans le switch interne avec un Path SVG checkmark canonique 24×24 stroke 1.6 (path data : `M5 12l4 4L19 7` ou équivalent, vérifier avec midfi-kit ligne 83 si une variante y existe).
  - [x] Vérifier que `lint:vocab` + `tsc --noEmit` restent verts.

- [x] **Task 6 — Refondre l'écran Consent selon FR-040** (AC: #2, #3, #4, #7)
  - [x] Réécrire [app/app/(onboarding)/consent.tsx](../../app/app/(onboarding)/consent.tsx) — supprimer le pattern Accept/Decline (composants `ConsentCard` + `ConsentButton` à retirer entièrement).
  - [x] State : `const [cgv, setCgv] = useState(false); const [geoloc, setGeoloc] = useState(false);`
  - [x] CatBubble intro via `<ChatBubble stade="touriste" moment="geoloc_consent_request" />` (string fr.json mise à jour Task 8).
  - [x] 2 lignes checkbox + label + body :
    - Composant `<ConsentCheckbox checked={cgv} onToggle={() => setCgv(v => !v)} label={t("consent.cgv_label")} body={t("consent.cgv_body")} testID="consent-cgv" />`
    - Idem pour `geoloc`.
    - **Composant** `ConsentCheckbox` interne au fichier `consent.tsx` (pas un primitive : usage unique cette story ; à factoriser dans un primitive `Checkbox.tsx` si un 2ème caller apparaît — Story 2.4 profile probablement n'en a pas besoin).
    - **Accessibilité** : `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`, `accessibilityLabel={label}`, `accessibilityHint={body}` ; hit slop 8px minimum (cible tactile WCAG).
  - [x] Liens externes `policy_link` + `terms_link` rendus tels qu'au legacy (URLs `spawt.ci/privacy` + `spawt.ci/terms`).
  - [x] Bouton « Continuer » :
    - `disabled={!cgv || !geoloc}`
    - `onPress` handler async :
      ```ts
      const onContinue = async () => {
        const now = new Date().toISOString();
        track({ name: "consent_recorded", properties: { kind: "cgv", decision: "accepted" } });
        track({ name: "consent_recorded", properties: { kind: "geoloc", decision: "accepted" } });
        track({ name: "onboarding_step_completed", properties: { step: "consent", step_index: 1 } });
        useOnboardingDraft.getState().setConsent("cgv", now);
        useOnboardingDraft.getState().setConsent("geoloc", now);
        const hasSpawter = useSpawterStore.getState().spawter !== null;
        if (hasSpawter) {
          await useSpawterStore.getState().recordConsent("cgv", true);
          await useSpawterStore.getState().recordConsent("geoloc", true);
        }
        router.push("/(onboarding)/phone");
      };
      ```
    - **Important** : pas d'`await` sur `track()` (fire-and-forget par design — analytics §1.7).
  - [x] `useEffect` au mount : `track({ name: "consent_screen_viewed", properties: {} })` (deps `[]`).
  - [x] Tous les `backgroundColor`/`color`/`borderColor` passent par `theme.colors.*` — `grep -nE '#[0-9A-Fa-f]{3,6}' app/app/(onboarding)/consent.tsx` vide.

- [x] **Task 7 — Refondre Splash avec `gr-night` + émission `onboarding_started`** (AC: #1)
  - [x] Réécrire [app/app/index.tsx](../../app/app/index.tsx) — remplacer `View backgroundColor: theme.colors.surface.inverse` par `<LinearGradient colors={gradient.night} ... style={styles.root}>`.
  - [x] `import { LinearGradient } from "expo-linear-gradient";` et `import { gradient } from "../src/theme/tokens";`.
  - [x] **Note** : tokens.ts ligne 84 mentionne « À consommer via une lib gradient (ex: expo-linear-gradient — non installée à ce jour) » — le commentaire est obsolète (la lib est en fait installée). Mettre à jour le commentaire dans `tokens.ts` (un seul char modifié, justifiable).
  - [x] CTA handler :
    ```ts
    const onStart = () => {
      track({ name: "onboarding_started", properties: {} });
      router.push("/(onboarding)/consent");
    };
    ```
  - [x] Conserver `splash.tagline` et `splash.cta_start` i18n (clés existantes).
  - [x] Vérifier le wordmark `palette.gold` (`brand.primary`) sur fond `gr-night` est WCAG AA (deferred-work §contraste — Vert Chat + or sur sombre). Or `#C8A44E` sur noir `#0A0A0A` = ratio 7.2:1 (AA large+AA normal OK pour text), validé par Stéphanie en 1.4 retro.

- [x] **Task 8 — Mettre à jour fr.json `consent.*` + `chat.touriste.geoloc_consent_request`** (AC: #2)
  - [x] [app/src/i18n/fr.json](../../app/src/i18n/fr.json) section `consent` — restructurer (le legacy `geoloc_accept/decline` + `demographics_accept/decline` est retiré entièrement) :
    ```json
    "consent": {
      "title": "Avant qu'on parte ensemble",
      "intro": "Deux cases à cocher avant d'avancer. Tu es libre, mais c'est obligatoire pour qu'on continue.",
      "cgv_label": "J'accepte les CGU/CGV",
      "cgv_body": "Conditions d'utilisation et conditions générales de vente du service SPAWT. [pending juriste]",
      "geoloc_label": "J'accepte la collecte de mes données et de ma géolocalisation",
      "geoloc_body": "Pour valider tes spawts dans les lieux que tu visites, et comprendre la Meute. Usage spawt uniquement. [pending juriste]",
      "policy_link": "Politique de confidentialité",
      "terms_link": "Conditions d'utilisation"
    }
    ```
  - [x] [app/src/i18n/fr.json](../../app/src/i18n/fr.json) section `chat.touriste.geoloc_consent_request` : mettre à jour pour couvrir les 2 blocs en ton touriste (ex. « On va parler de deux trucs. Tes infos, ta position. Je t'explique sans gronder. »). Garder la clé stable (matrice Story 2.1 préservée).
  - [x] Audit : `cd app && npm run i18n:check` vert (aucune string FR ajoutée hors fr.json — toutes les nouvelles strings du composant Consent passent par `t()`).
  - [x] Audit vocab : `cd app && npm run lint:vocab` vert (aucun mot interdit dans les nouvelles strings — pas de « user », « restaurant », « gamif* », « ranking »).

- [x] **Task 9 — Tests unit + composant + PGlite** (AC: #7)
  - [x] Créer [app/__tests__/storage.consent.test.ts](../../app/__tests__/storage.consent.test.ts) — couvre `setConsent("cgv", true)` + `getConsent("cgv")` + idem geoloc + accepted false.
  - [x] Créer [app/__tests__/spawter-store.recordConsent.test.ts](../../app/__tests__/spawter-store.recordConsent.test.ts) — couvre les 3 cas Task 9 + mock `saveSpawter`/`saveSpawterLocal`.
  - [x] Créer [app/__tests__/onboarding-draft.setConsent.test.ts](../../app/__tests__/onboarding-draft.setConsent.test.ts) — couvre new action.
  - [x] Créer [app/__tests__/components/ConsentScreen.test.tsx](../../app/__tests__/components/ConsentScreen.test.tsx) — RTL : mount + montage event + 2 checkboxes + bouton state + tap continuer + ordre des events. Mocks : `expo-router` (`useRouter` retourne `{ push: jest.fn() }`), `expo-localization` (en place via jest-expo), AsyncStorage (déjà mocké jest-expo).
  - [x] Créer [app/__tests__/components/SplashScreen.test.tsx](../../app/__tests__/components/SplashScreen.test.tsx) — RTL : mount + tap CTA → `onboarding_started` émis + push consent.
  - [x] Créer (ou étendre si existe) [app/__tests__/integration/migrations.test.ts](../../app/__tests__/integration/migrations.test.ts) — PGlite apply 0001→0006 + assertions colonne + set-once trigger. Référence pattern Story 1.8 PGlite.

- [x] **Task 10 — Triple gate + smoke web + commit + CHANGELOG** (AC: #8)
  - [x] `cd app && npx tsc --noEmit` vert.
  - [x] `cd app && npm run lint:vocab` vert.
  - [x] `cd app && npm run i18n:check` vert.
  - [x] `cd app && npm test` vert (toutes suites + nouvelles).
  - [x] `cd app && expo export --platform web` compile sans erreur.
  - [x] Mettre à jour [CHANGELOG.md](../../CHANGELOG.md) avec une entry v1.2.2 (Sprint 1 itération 2 — Story 2.2) au format Moka — listing : migration 0006, rewrite splash, rewrite consent, nouveau type kind, rename schema + champs TS + analytics + events.md, ajout `Ico.check`, sign-off Kidam attendu, perf budget conservé.
  - [x] Commit Conventional Commits — type `feat(onboarding)`, scope `onboarding`, PRD ref `§20.7`, Sprint 1 feature `FR-040`, mention `Triple sign-off: pending (Stéphanie + Kidam + Alexandre)`.

## Dev Notes

### 1. Contexte funnel onboarding & dépendances inter-stories

Story 2.2 ouvre le funnel **Splash → Consent → Phone → Profile → Calibration → Palais initial** (UX spec ligne 1093-1117). Elle ne dépend de **rien** d'Epic 2 (1re story d'Epic 2 après 2.1). Elle prépare :

- **Story 2.3 (OTP + Google + Apple)** : le router.push(`/(onboarding)/phone`) à la fin de Consent est l'entrée 2.3. **Pas de changement de signature attendu** côté Consent → Phone — Story 2.3 implémente phone.tsx.
- **Story 2.5 (Calibrage Palais 5 questions)** : `finalizeOnboarding` (déjà existant `spawter-store.ts:69-112`) doit lire `useOnboardingDraft.getState().draft.consent.{cgv_accepted_at, geoloc_consent_at}` et les passer dans le nouveau row `spawters` à l'insert. **Story 2.5 devra étendre finalizeOnboarding** pour brancher ces champs — c'est une dépendance arrière intra-epic que 2.5 doit traiter. À documenter dans 2.5 Dev Notes au moment de sa rédaction.
- **Story 2.6 (Présentation Palais initial)** : aucune dépendance directe.

### 2. Architecture de la persistance consent — décision

**Décision** : double persistance avec priorité au store si spawter existe, fallback au draft sinon.

| Cas | Etat `spawter` | Action |
|---|---|---|
| Premier lancement (cas standard) | `null` | Écrire dans `useOnboardingDraft.setConsent(...)` UNIQUEMENT (draft éphémère mémoire). Le row spawters n'existe pas encore — la persistance Supabase sera faite par `finalizeOnboarding` en Story 2.5/2.6. |
| Re-consent après auth (cas edge) | `!== null` | Écrire dans `useSpawterStore.recordConsent(...)` qui met à jour `spawters.{field}_at` local + fire-and-forget Supabase. Le trigger `assert_consent_set_once` (0005, mis à jour 0006) refuse silencieusement la 2e écriture si non-NULL. |

**Pourquoi pas une persistance AsyncStorage du draft entier** : retro Epic 2 critical path §5.2 #4 mentionne « schéma `user_palais` manquant » mais pas la persistance long-terme du draft. UX spec ligne 1112-1113 mentionne « onboarding-draft persisté éphémère / RouteGuard reprend » mais c'est dans le contexte du **calibrage en cours** (Story 2.5), pas du consent. Si l'utilisateur kill l'app après consent mais avant phone, il refait le consent au prochain lancement — c'est acceptable (geste 30 secondes, gate non-punitif).

Une persistance AsyncStorage du draft entier est faisable mais ajoute du scope (sérialisation, hydration, invalidation au logout). **Defer §7.** À ré-évaluer si data alpha montre un dropoff fort entre consent et finalize.

### 3. Pourquoi 1 seul CatBubble intro et pas 1 par bloc

L'épic 2.2 AC dit « un `CatBubble` explique sans gronder » (singulier). FR-040 §5.2 ne précise pas. Story 2.1 a frozen 2 moments distincts `geoloc_consent_request` + `demographics_consent_request` (héritage de l'ancien framing geoloc + démographique séparés).

**Choix** : 1 seul CatBubble intro réutilisant `geoloc_consent_request` (string mise à jour pour couvrir les 2 blocs). `demographics_consent_request` reste dans la matrice (clé i18n présente, vide pour les stades non-touriste) mais **n'est pas rendu côté UI** — c'est un legacy moment réservé à un futur usage. Pas de breaking change Story 2.1.

**Alternative rejetée** : 2 CatBubbles distincts (un par bloc). Visuellement lourd (2 bulles + 2 checkboxes = 4 blocs verticaux), brouille la hiérarchie visuelle. UX spec §456-460 favorise un intro unique + 2 checkboxes distinctes.

### 4. Pattern « bloquant non-punitif »

FR-040 + UX spec §456-460 (« design pour la confiance ») insistent sur :
- **Pas de « plus tard »** ni « decline » individuel sur les cases.
- Bouton « Continuer » **désactivé**, pas « caché » ni « grisé avec popup ». État `disabled` standard.
- **Ton CatBubble** « explique sans gronder » (Touriste enjoue_taquin). Pas d'avertissement juridique froid.
- **Pas d'écran intermédiaire** « Confirmer le refus » ou similaire — c'est binaire et silencieux côté UX.

**Anti-pattern à éviter** : écran qui culpabilise (« Sans ton consentement, on ne peut rien pour toi »). Le ton SPAWT est inclusif (cf. Contrat à la Tribu — pas de leaderboard, pas de pression).

### 5. `border.subtle` translucide — deferred-work du 1.1

Le bouton « Continuer » désactivé utilise `border.subtle` comme background. Depuis commit 979ee2d, `border.subtle` est translucide (rgba(10,10,10,0.10)). Sur fond `surface.base` blanc cassé, ça donne un gris très clair — acceptable pour un bouton désactivé. **Defer 1.1 → résolu visuellement par cette story** : valider au rendu RTL test que le contraste « désactivé » est lisible (probablement OK, mais signaler en Completion Notes si dérangeant).

### 6. Sign-off Kidam pour modification d'events.md

`documentation/analytics/events.md` est la **single source of truth** Kidam (NFR-OBS-04). Toute modification de la table requiert son sign-off explicite. Cette story modifie 1 ligne (`consent_recorded.kind` : `data | geoloc` → `cgv | geoloc`). **Procédure** :
1. Le dev rédige le diff dans Completion Notes.
2. Le diff est partagé à Kidam (Slack/email/PR — process Sprint 1 hors scope outillage).
3. Sign-off documenté en Completion Notes avec date + canal.
4. Triple sign-off Stéphanie + Kidam + Alexandre obligatoire avant merge `main` (cahier §8).

Pour merge sur `spawt/v1-bmad` : sign-off Kidam ASYNC accepté (commentaire en commit), pas bloquant. Pour `main` : sign-off explicite documenté.

### 7. Defers identifiés à cette story (à reporter dans `deferred-work.md` en Completion Notes)

- **Persistance AsyncStorage du draft `onboarding-draft`** : permettrait à un utilisateur de reprendre un onboarding interrompu après kill. Hors scope Story 2.2 (cf. §2 ci-dessus). → Réactiver si dropoff alpha mesurable entre consent et finalize.
- **Révocation du consent geoloc depuis Profil → Paramètres** : non implémenté Sprint 1, planifié Sprint 2 (FR-008 profil ne le couvre pas explicitement). Le set-once trigger empêche un UPDATE direct du timestamp — la révocation doit passer par un champ séparé `geoloc_revoked_at` (à ajouter). → Story Sprint 2 dédiée.
- **`demographics_consent_request` ChatMoment** : conservé dans `chat-voice.ts` mais inutilisé après FR-040 — à supprimer si aucun caller n'émerge d'ici Sprint 2 (sinon, deviendrait du code mort).
- **Légal placeholder `[pending juriste]`** dans les strings consent `cgv_body` + `geoloc_body` : à remplacer par la rédaction juriste validée DR-CGV-01 avant lancement public (hors Sprint 1).
- **`tokens.ts` commentaire obsolète sur `expo-linear-gradient`** : ligne 84 dit « non installée à ce jour », la lib est en fait installée. Mineur — corrigé en Task 7 mais à signaler si oublié.

### 8. Devices matrix — smoke pending

Cette story produit 2 écrans visuels (Splash gr-night, Consent checkboxes). Le smoke device matrice 4 (Tecno + Infinix + Samsung + iPhone récent) reste **pending** pour le merge `main` (cf. retro Epic 1 §3.6 + critical path §5.2 #5). Pas bloquant pour merge `spawt/v1-bmad`. Tester en priorité :
- `gr-night` LinearGradient sur Android (driver SVG/Reanimated différent du iOS).
- Checkbox tactile size sur Tecno low-end (target 24×24 + 8px hitSlop = 40×40 minimum WCAG).
- WCAG AA contraste `palette.gold` sur `gr-night` (validé en 1.4 retro, re-confirmer).

### 9. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Trigger 0005 conflit avec rename 0006 (le trigger référence `data_consent_at` qui n'existe plus après ALTER) | Moyen | Bloquant | Migration 0006 fait `DROP TRIGGER` AVANT `RENAME COLUMN` puis recrée le trigger sur la nouvelle colonne dans la même transaction. Tester avec PGlite. |
| Sign-off Kidam absent au merge `main` | Faible | Bloquant | Documenter le diff events.md tôt + envoyer à Kidam dès Task 4 livrée (pas attendre Task 10). |
| `ChatBubble.geoloc_consent_request` rendu vide si la string fr.json est mal mise à jour | Faible | UX dégradé (bulle absente) | RTL test vérifie que la bulle rend une string non-vide (Task 9). |
| Conflit de migration en cas de PR concurrent (Story 2.5 ajoute migration `user_palais` numérotée 0006) | Faible | Conflit Git | Coordonner numérotation : Story 2.2 = 0006, Story 2.5 = 0007 si déposée après. À acter en sprint planning. |

### Project Structure Notes

- **Aucun nouveau dossier** créé — tous les fichiers édités existent déjà.
- **Nouveau primitive `Checkbox.tsx`** PAS créé — le composant `ConsentCheckbox` reste interne à `consent.tsx`. Si un 2e caller émerge (formulaire profil PII Story 2.4 ne devrait pas en avoir besoin), le promouvoir au niveau `app/src/components/primitives/Checkbox.tsx` à ce moment-là (YAGNI strict — anti-pattern factorisation prématurée flagged en retro Epic 1 §2.6).
- **Conventions Conventional Commits** respectées : scope `onboarding`, type `feat`.
- **EAS build profiles** non touchés — pas de nouvelle permission Android/iOS introduite cette story (le consent géoloc applicatif PRÉCÈDE la demande système iOS — `expo-location.requestForegroundPermissionsAsync` sera appelé en Story 4.1 Le Guet).
- **`canonical_part: app/`** respecté — aucun fichier touché à la racine ni dans `/src/` (prototype-web figé).
- **Path aliases** : utilisations OK (`@/types/spawter`, etc.). Vérifier au test.

### References

- [_bmad-output/planning-artifacts/PRD.md:604-607 FR-040](../planning-artifacts/PRD.md#L604-L607)
- [_bmad-output/planning-artifacts/PRD.md:228-232 DR-ARTCI-01..05](../planning-artifacts/PRD.md#L228-L232)
- [_bmad-output/planning-artifacts/PRD.md:250 DR-CGV-01](../planning-artifacts/PRD.md#L250)
- [_bmad-output/planning-artifacts/PRD.md:651 NFR-SEC-02](../planning-artifacts/PRD.md#L651)
- [_bmad-output/planning-artifacts/epics.md:542-564 Story 2.2 epic](../planning-artifacts/epics.md#L542-L564)
- [_bmad-output/planning-artifacts/architecture.md:324-330 conformité ARTCI](../planning-artifacts/architecture.md#L324-L330)
- [_bmad-output/planning-artifacts/architecture.md:660-665 source tree mobile](../planning-artifacts/architecture.md#L660-L665)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1089-1117 Journey 1 onboarding](../planning-artifacts/ux-design-specification.md#L1089-L1117)
- [_bmad-output/planning-artifacts/ux-design-specification.md:456-460 design pour confiance (consent ARTCI granulaire)](../planning-artifacts/ux-design-specification.md#L456-L460)
- [_bmad-output/planning-artifacts/ux-design-specification.md:842-887 tokens Splash + gr-night](../planning-artifacts/ux-design-specification.md#L842-L887)
- [documentation/analytics/events.md:30-37 onboarding events](../../documentation/analytics/events.md#L30-L37)
- [documentation/SPRINT_1_CAHIER_DES_CHARGES.md](../../documentation/SPRINT_1_CAHIER_DES_CHARGES.md) §5.2 amendement Claude (ARTCI accepté v1.0.2)
- [_bmad-output/project-context.md](../project-context.md) — règles canoniques (vocab, tokens, i18n, data-source, RLS)
- [_bmad-output/implementation-artifacts/2-1-voix-du-chat-evolutive.md](2-1-voix-du-chat-evolutive.md) — moments `geoloc_consent_request` + `demographics_consent_request` déjà déclarés
- [_bmad-output/implementation-artifacts/1-5-schema-supabase-entites-spawter-staff-rls.md](1-5-schema-supabase-entites-spawter-staff-rls.md) — schéma `spawters` original
- [_bmad-output/implementation-artifacts/1-7-collecte-de-signaux-append-only-wrapper-analytics-type.md](1-7-collecte-de-signaux-append-only-wrapper-analytics-type.md) — wrapper analytics + queue pre-auth
- [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-17.md](epic-1-retro-2026-05-17.md) — critical path §5.2, lessons §3
- [_bmad-output/implementation-artifacts/deferred-work.md](deferred-work.md) — §1.1 (`border.subtle` translucide → validation visuelle disabled CTA dans cette story)

### Previous story intelligence — Story 2.1 (Voix du Chat évolutive)

Story 2.1 (done 2026-05-17) a établi des patterns pertinents :

1. **Wrapper `ChatBubble` (domain) → `CatBubble` (primitive)** stable. Story 2.2 consomme `ChatBubble` directement, pas `CatBubble`.
2. **Matrice `CHAT_MOMENTS` frozen** — 11 moments listés `chat-voice.ts:17-29`. Ne pas en ajouter dans Story 2.2 (réutiliser `geoloc_consent_request`).
3. **Contrat « empty = silent volontaire »** dans fr.json : une string vide `""` rend la bulle invisible. Tester explicitement que `chat.touriste.geoloc_consent_request` est **non vide** pour cette story (sinon CatBubble ne s'affiche pas).
4. **Tests coverage** : pattern `chat-voice-coverage.test.ts` itère sur `chatKey` pour les 5×11 = 55 clés. Si Task 8 modifie `chat.touriste.geoloc_consent_request` non-vide, ça reste cohérent avec le contrat (touriste parle pour ce moment).
5. **`overrideText` prop disponible** mais inutilisé ici — Story 2.2 utilise la matrice i18n standard.
6. **Triple gate discipline** : 100% verte sur Epic 1, à reproduire (retro §2.3).
7. **`satisfies Record<…>` pattern** établi pour les mappings exhaustifs — appliquer si Task 4 introduit un nouveau mapping (probable pas — `consent_recorded` reste mappé `"click"`).

### Git intelligence

Branche `theme/align-canonical-tokens` (5 commits depuis main : cf4e1be → 3b83b49). Recent context :
- `3b83b49` chore(analytics) — `flushPendingSignals` câblé `SIGNED_IN` (Story 2.3 préparation). Le draft Consent **précède** auth → events `consent_recorded` finiront dans la queue pre-auth `spawt:analytics:pending`, drainés au SIGNED_IN. Pas d'action côté Story 2.2 (déjà câblé).
- `ffca3ba` fix(review) — review patches D1-D4. Inclut le set-once trigger 0005 (D1 cascade-delete). Pas d'impact direct.
- `82a846a` feat(infra) — Stories 1.5-1.8 + web platform. Migrations 0001-0005, analytics wrapper, feature flags. Story 2.2 hérite de ce socle.

### Latest tech information

- **`expo-linear-gradient ~55.0.14`** — déjà installé. API stable : `<LinearGradient colors={[...]} start={{x:0,y:0}} end={{x:0,y:1}} style={...} />`. Pas de breaking change connu vs Expo SDK 54. Doc : https://docs.expo.dev/versions/v55.0.0/sdk/linear-gradient/
- **`react-native-svg 15.15.3`** — déjà installé. Icône check : path `M5 12l4 4L19 7` stroke 1.6 — vu dans midfi-kit.jsx l.83 (référence Story 1.3).
- **`@testing-library/react-native ^12`** — vérifier installation (Story 2.1 tests devraient le confirmer). Sinon ajouter en dev-dep.
- **Pas de breaking change Supabase migrations** — `ALTER TABLE ... RENAME COLUMN ... TO ...` est standard SQL ; supporté PGlite + Postgres 15.

### Project context reference

Voir `_bmad-output/project-context.md` — règles invariantes notamment :
- §Data source adapter : pas d'import statique Supabase dans un screen (Consent ne touche pas Supabase directement — passe par store → data-source).
- §i18n + voix du Chat : toute string UI via `t()`, voix via `ChatBubble`.
- §Vocabulaire SPAWT : « spawter » jamais « user », pas de « gamif* », pas de « ranking ».
- §Design tokens : hex en dur interdit hors `tokens.ts`.
- §Définition de Done : triple sign-off Stéphanie + Kidam + Alexandre obligatoire avant merge `main`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (2026-05-17 — batch d'Epic 2 dev, stories 2.2-2.6)

### Debug Log References

— PGlite (`@electric-sql/pglite`) reste non installé : les tests `migrations.test.ts` chargent le module en runtime via dynamic require et `describe.skip` si absent. Pattern Epic 1 retro §4 #1 (validation sémantique sans Docker). Activer via `npm install --save-dev @electric-sql/pglite` quand l'équipe veut activer la suite SQL en CI.
— Smoke device matrice 4 reste pending pour merge `main` (cf. story §Dev Notes §8 + Epic 1 retro §3.6).

### Completion Notes List

- **Migration 0006** créée (`0006_rename_data_consent_to_cgv_accepted.sql` + `.down.sql`) — rename + drop/recreate du trigger set-once `assert_consent_set_once` dans la même transaction. `supabase/README.md` tableau « État Sprint 1 » mis à jour (insertion 0006, décalage des suivants à 0007-0013).
- **Naming `data_consent_at` → `cgv_accepted_at`** propagé end-to-end : DB (0006), TS types (`spawter.ts`, `OnboardingDraft`), seed (`sample-spawter.ts`), store (`spawter-store.ts` action `recordConsent`), storage (`storage.ts` kind union `cgv | geoloc`), analytics wrapper (`ConsentRecorded.kind`), events.md ligne `consent_recorded`.
- **`onboarding-draft.ts`** : nouvelle clé `consent: { cgv_accepted_at, geoloc_consent_at }` (initial `{ null, null }`) + action `setConsent(kind, at)`. La persistance long-terme du draft reste hors scope (Defer §7).
- **`Ico.tsx`** : ajout `"check"` à `IconName` + path canonique `M5 12 L10 17 L19 7` (stroke 1.6, viewBox 24×24).
- **`consent.tsx`** réécrit : pattern Accept/Decline supprimé, remplacé par 2 checkboxes (`ConsentCheckbox` interne, accessibilityRole `checkbox`, hit slop 8), gate binaire `disabled` tant que `!cgv || !geoloc`. CatBubble intro via `<ChatBubble stade="touriste" moment="geoloc_consent_request" />`. Émissions analytics dans l'ordre `consent_recorded(cgv) → consent_recorded(geoloc) → onboarding_step_completed(consent, 1)`, puis double persistance (draft systématique + spawter-store si spawter existe), puis `router.push("/(onboarding)/phone")`.
- **`index.tsx`** (Splash) : `LinearGradient colors={gradient.night}` (palette.black → bleu nuit) ; wordmark `palette.gold` typo `preset.display` ; CTA `palette.gold` label `text.onBrand` (Or sur or = pas pertinent — Or sur noir reste WCAG AA confirmé Epic 1.4 retro) ; émission `onboarding_started` AVANT `router.push("/(onboarding)/consent")`.
- **`tokens.ts`** : commentaire ligne 84 mis à jour (`expo-linear-gradient` est en fait installé `~55.0.14`).
- **`fr.json`** : restructuration `consent.*` (cgv_label/body, geoloc_label/body, policy/terms_link, intro mis à jour) ; `chat.touriste.geoloc_consent_request` reformulé en ton touriste « explique sans gronder » couvrant les 2 blocs (matrice Story 2.1 préservée — `demographics_consent_request` conservé inutilisé, à dépriquer post-Sprint 1 selon Defer §7).
- **Tests** (5 nouveaux fichiers) :
  - `__tests__/lib/storage.consent.test.ts` — setConsent/getConsent kind cgv|geoloc.
  - `__tests__/lib/spawter-store.recordConsent.test.ts` — recordConsent mute le bon field + no-op spawter null.
  - `__tests__/lib/onboarding-draft.setConsent.test.ts` — setConsent draft + reset.
  - `__tests__/components/ConsentScreen.test.tsx` — montage event + gate binaire + ordre des emits + draft + spawter-store + router.
  - `__tests__/components/SplashScreen.test.tsx` — wordmark/tagline/CTA + onboarding_started avant push.
  - `__tests__/integration/migrations.test.ts` — PGlite scaffold (skip si dep absente).
- **Sign-off Kidam pour `events.md`** : ligne `consent_recorded` modifiée (`data | geoloc` → `cgv | geoloc`). Diff visible dans l'historique git. Sign-off ASYNC accepté pour merge `spawt/v1-bmad` ; sign-off explicite requis avant merge `main` (cahier §8).
- **Triple sign-off Stéphanie + Kidam + Alexandre** : pending (story remise en `review`).
- **Vérification triple gate + smoke web** : à exécuter en batch fin de session 2026-05-17 (instruction `xtincell` : « fais toutes les story ready for dev. on fera la verification en lot »).

### File List

**Créés :**
- `supabase/migrations/0006_rename_data_consent_to_cgv_accepted.sql`
- `supabase/migrations/0006_rename_data_consent_to_cgv_accepted.down.sql`
- `app/__tests__/lib/storage.consent.test.ts`
- `app/__tests__/lib/spawter-store.recordConsent.test.ts`
- `app/__tests__/lib/onboarding-draft.setConsent.test.ts`
- `app/__tests__/components/ConsentScreen.test.tsx`
- `app/__tests__/components/SplashScreen.test.tsx`
- `app/__tests__/integration/migrations.test.ts`

**Modifiés :**
- `app/src/types/spawter.ts` — rename `data_consent_at` + ajout `consent` dans `OnboardingDraft`
- `app/src/data/seed/sample-spawter.ts` — rename `data_consent_at` → `cgv_accepted_at`
- `app/src/lib/storage.ts` — kind union `cgv | geoloc` + key rename
- `app/src/store/spawter-store.ts` — `recordConsent` signature + mapping fieldName
- `app/src/store/onboarding-draft.ts` — initial state `consent` + action `setConsent`
- `app/src/lib/analytics.ts` — `ConsentRecorded.kind`
- `app/src/components/primitives/Ico.tsx` — ajout icône `check`
- `app/app/index.tsx` — Splash gr-night + `onboarding_started`
- `app/app/(onboarding)/consent.tsx` — réécriture FR-040 (2 checkboxes + CatBubble + gate binaire)
- `app/src/i18n/fr.json` — restructure `consent.*` + reformulation `chat.touriste.geoloc_consent_request`
- `app/src/theme/tokens.ts` — commentaire `gradient` à jour (lib installée)
- `documentation/analytics/events.md` — ligne `consent_recorded` (kind cgv|geoloc)
- `supabase/README.md` — tableau « État Sprint 1 » : insertion 0006 + décalage des suivants
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-2-...: review`

### Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-17 | claude-opus-4-7[1m] | Story 2.2 livrée : Splash gr-night + consent ARTCI bloquant (FR-040) + migration 0006 rename `data_consent_at` → `cgv_accepted_at`. Sign-off Kidam requis sur `events.md` avant merge `main`. |
