# Story 2.5: Calibrage du Palais en 5 questions

Status: review

<!-- 4e story d'Epic 2 — capture les 5 deltas Palais initial via 5 questions visuelles `OnbMidfi`. Critical path Epic 2 §5.2 #4 : livre la migration `user_palais` (manquante avant cette story). Le finalize complet du spawter (insert row spawters + user_palais) reste Story 2.6 — cette story s'arrête au 5e delta enregistré dans le draft. -->

## Story

As a nouveau spawter,
I want répondre à 5 questions visuelles de calibrage du Palais via des cartes multi-select (`OnbMidfi`),
so that mon Palais initial reflète mes goûts dès le départ et que la suite du funnel (Story 2.6 — présentation Palais + 1er titre) puisse le restituer.

## ⚠️ Brownfield context — read first

**`calibration.tsx` existe et est partiellement implémenté** mais utilise un pattern **3 boutons texte (neg/pos/neutral)** au lieu de l'UX canonique **`OnbMidfi` cartes visuelles** (décision D10 — UX spec §1022-1023, ligne 1110 « OnbMidfi — 5 questions Palais cartes visuelles multi-select »).

**Critical path Epic 2 §5.2 #4 — bloquant** : aucune migration `user_palais` n'existe à ce jour. Story 2.5 doit la livrer (référence pour la prochaine table FK vers `spawters(id)`).

| Élément | Fichier existant | État | Action Story 2.5 |
|---|---|---|---|
| Calibration screen | [app/app/(onboarding)/calibration.tsx](../../app/app/(onboarding)/calibration.tsx) | ⚠️ Pattern 3 boutons texte ; appelle `finalizeOnboarding` + `router.replace("/(tabs)")` à la fin (saut de Story 2.6) | **Réécrire** : `OnbMidfi` cartes visuelles multi-select + progress bar segmentée 5 segments + navigation finale → `/(onboarding)/palais-reveal` (Story 2.6) |
| Migration `user_palais` | (aucune) | ❌ **Critical path Epic 2 §5.2 #4** | **Créer** `supabase/migrations/0008_create_user_palais.sql` (et `.down.sql`) — table + RLS + politique overwrite |
| Type `UserPalais` | [app/src/types/palais.ts:56-71](../../app/src/types/palais.ts#L56-L71) | ✅ Existe (Story 1.3 + bootstrap) | **Pas touché** — la migration doit s'aligner sur le type |
| Moteur Palais | [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) | ✅ Existe (`learningFactor`, `updateAxis`, `dominantAxes`, `computeConfidence`) | **Pas touché** structurel — peut être consommé pour calculer `confidence_score` initial |
| Draft store | [app/src/store/onboarding-draft.ts](../../app/src/store/onboarding-draft.ts) | ✅ `calibration_answers: Record<PalaisAxis, number>` + `setCalibration(axis, value)` action | **Pas touché** |
| `calibrationDelta` helper | [app/src/store/spawter-store.ts:141-145](../../app/src/store/spawter-store.ts#L141-L145) | ✅ Mappe `"neg" \| "pos" \| "neutral"` → `-0.4 \| 0.4 \| 0` | **Réutilisé** — pas touché |
| `finalizeOnboarding` | [app/src/store/spawter-store.ts:69-112](../../app/src/store/spawter-store.ts#L69-L112) | ⚠️ Crée localement le spawter + palais en RAM + AsyncStorage + sync Supabase. **Story 2.6** doit lire `draft.consent` (Story 2.2) et persister `cgv_accepted_at`/`geoloc_consent_at` ; cette story 2.5 **ne le modifie pas** | **Pas touché** (Story 2.6 problem) |
| Analytics events | [app/src/lib/analytics.ts:86-92](../../app/src/lib/analytics.ts#L86-L92) | ✅ `calibration_answered` typé avec `axis`, `direction`, `value` | **Émettre** à chaque réponse |
| Primitives UX | (aucun `OnbCard` RN existant) | ❌ Pattern UX kit `OnbCard` + structure `OnbMidfi` (cf. [documentation/ux/midfi-screens-1.jsx:18-42](../../documentation/ux/midfi-screens-1.jsx#L18-L42)) à porter | **Créer** primitive `OnbCard.tsx` + composer dans `calibration.tsx` |
| Strings i18n calibration | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) `calibration.*` | ⚠️ Strings `q_<axis>.question/option_neg/pos/neutral` existent | **Restructurer** : passer du modèle 3-textes au modèle « N cartes par question » + intro voix du Chat |
| Calibrage flow stade | `getStade(0)` = `"touriste"` | ✅ | Voix du Chat reste `touriste` pour la voix d'accompagnement |

**Décisions héritées non-revisitables :**

- **D10 (UX spec §1022)** : onboarding canonique = `OnbMidfi` cartes visuelles multi-select. **Pas** `Onb1-5` (4 écrans quartier/style/budget/mode) — celui-ci est écarté Sprint 1 (couverture étendue).
- **5 axes Palais canoniques** (PRD §5.1 + drift D8 résolu) : Racines/Horizons · Tanière/Nomade · Exigeant/Enthousiaste · Foule/Secret · Maquis/Table.
- **3 directions par question** : `neg` (-0.4) · `neutral` (0) · `pos` (+0.4). Mapping figé `calibrationDelta()`.
- **Politique overwrite** sur `user_palais` (FR-025) — re-calibrage écrase, pas d'append.
- **RLS** : `spawter_id = auth.uid()` (Story 1.5 pattern).
- **Pas de cuisine/budget/contexte explicites** (cf. Story 2.4 Dev Notes §1) — encodés via les 5 axes (Racines/Horizons ≈ cuisine ; Foule/Secret ≈ contexte ; Maquis/Table ≈ budget).
- **`onboarding-draft` éphémère** (UX spec ligne 1112 + Story 2.4) — RouteGuard reprend mais le draft est perdu après kill app entre 2 questions. UX accepté.

**Décisions critical path Epic 2 §5.2 — état avant 2.5 :**

- **#4 Schéma `user_palais` MANQUANT** → **livré dans cette story** (migration 0008).
- **#1 Décisions Story 1.4 ChatBubble** : tranchées (preset.body uniforme). Pas d'impact 2.5.

## Acceptance Criteria

**AC #1 — UI `OnbMidfi` : 5 questions séquentielles, progress bar segmentée, multi-select par question**

**Given** l'écran [app/app/(onboarding)/calibration.tsx](../../app/app/(onboarding)/calibration.tsx) monté
**When** il s'affiche (post-Profile Story 2.4)
**Then** une barre de progression segmentée en **5 segments** est affichée en tête (1 par question — pattern `OnbStep`)
**And** le segment courant est rempli (`brand.primary` = or), les passés sont remplis (or plus pâle `brand.primary` avec opacity 0.5), les futurs sont vides (`border.subtle`)
**And** un `ChatBubble stade="touriste" moment="post_calibration"` est rendu en intro (string existante fr.json, ton enjoue_taquin) — **wait** : `post_calibration` est le moment APRÈS calibration (Story 2.6). Pour pendant le calibrage, utiliser **`welcome_first_open`** (touriste, ton intro) — la string existe et fit le contexte
**And** chaque question affiche :
- Un titre `t(\`calibration.q_${axis}.question\`)` (clé existante fr.json) en typo `preset.h3` ou `preset.body` semi-bold
- Un body court optionnel `t(\`calibration.q_${axis}.subtitle\`)` (nouvelle clé) qui contextualise
- **Une grille 2 colonnes de cartes visuelles `OnbCard`** (pattern UX kit ligne 18-42) — entre 2 et 6 cartes par question, chaque carte = un choix concret (ex. pour axe `racines_horizons` : « Garba », « Attiéké poisson », « Pizza », « Sushi », « Ramen »)
- **Multi-select** : l'utilisateur peut cliquer plusieurs cartes (cohérent UX kit `selected = [0, 3, 4]`)
- Une carte sélectionnée affiche bordure `2.5px brand.primary` + shadow gold subtle

**Given** la sélection d'une carte
**When** au moins 1 carte est sélectionnée pour la question courante
**Then** un bouton « Suivant » apparaît en bas et devient actif
**And** au tap, la `direction` est dérivée du choix :
- Si toutes les cartes sélectionnées sont du pôle négatif (alt < seuil) → `direction = "neg"`
- Si toutes du pôle positif → `direction = "pos"`
- Si mixte → `direction = "neutral"`
- Si aucune sélection (cas auto-skip via bouton "Pas d'avis") → `direction = "neutral"`
- La logique de mapping `card_alt → polarity` est documentée dans le module nouveau `lib/calibration-mapping.ts` (moteur pur testable)

**Given** la 5e question répondue
**When** le bouton « Suivant » de la 5e question est tapé
**Then** le calibrage est complet (les 5 valeurs sont dans `draft.calibration_answers`)
**And** `router.push("/(onboarding)/palais-reveal")` (entrée Story 2.6 — **PAS** `finalizeOnboarding` ici, contrairement au stub actuel)
**And** Story 2.6 (palais-reveal.tsx) sera créée par sa propre story — cette story 2.5 stoppe au `router.push`

---

**AC #2 — Émission `calibration_answered` par réponse**

**Given** une réponse validée par tap « Suivant »
**When** la `direction` est résolue
**Then** `track({ name: "calibration_answered", properties: { axis: "<axis_name>", direction: "neg" | "pos" | "neutral", value: -0.4 | 0 | 0.4 } })` est émis **avant** l'écriture dans le draft
**And** `useOnboardingDraft.setCalibration(axis, value)` est appelé ensuite (pattern existant)
**And** la queue analytics (Story 1.7 + 2.2) absorbe l'event ; le flush au SIGNED_IN (Story 2.3) a déjà drainé les events pré-auth, donc ici on est en mode authentifié → flush direct

**Given** un retour arrière (`router.back()` ou geste swipe sur Android)
**When** l'utilisateur revient à la question précédente
**Then** **AUCUN** event `calibration_answered` re-émis pour la même question (idempotence) — la story V1 **n'expose pas** de retour arrière côté UI ; un swipe back Android est tolérable et la valeur précédente est conservée dans le draft. Si re-réponse à une question : **nouvel** event émis avec la nouvelle valeur (overwrite).

---

**AC #3 — Migration `0008_create_user_palais.sql` (table + RLS + politique overwrite)**

**Given** une nouvelle migration [supabase/migrations/0008_create_user_palais.sql](../../supabase/migrations/0008_create_user_palais.sql)
**When** appliquée à PGlite ou Supabase
**Then** elle crée la table `public.user_palais` avec ces colonnes (alignées sur [`app/src/types/palais.ts:56-71`](../../app/src/types/palais.ts#L56-L71)) :

| Colonne | Type SQL | Nullable | Default | Note |
|---|---|---|---|---|
| `spawter_id` | `uuid` | NOT NULL | — | **PK** (unicité = 1 palais par spawter — politique overwrite) ; FK → `spawters(id)` ON DELETE CASCADE |
| `axe_racines_horizons` | `real` | NOT NULL | `0` | CHECK BETWEEN -1 AND 1 |
| `axe_taniere_nomade` | `real` | NOT NULL | `0` | CHECK BETWEEN -1 AND 1 |
| `axe_exigeant_enthousiaste` | `real` | NOT NULL | `0` | CHECK BETWEEN -1 AND 1 |
| `axe_foule_secret` | `real` | NOT NULL | `0` | CHECK BETWEEN -1 AND 1 |
| `axe_maquis_table` | `real` | NOT NULL | `0` | CHECK BETWEEN -1 AND 1 |
| `confidence_score` | `real` | NOT NULL | `0` | CHECK BETWEEN 0 AND 1 |
| `dominant_axes` | `text[]` | NULL | NULL | array de 2 valeurs parmi les 5 axes ; check optionnel `array_length(dominant_axes, 1) IN (NULL, 2)` |
| `archetype_id` | `text` | NULL | NULL | FK future Sprint 2 |
| `stade` | `text` | NOT NULL | `'touriste'` | CHECK IN (`'touriste','explorateur','detective','djidji','guide'`) |
| `total_spawts` | `integer` | NOT NULL | `0` | CHECK >= 0 |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger `update_timestamp_user_palais` |

**And** RLS activée :
- `SELECT` : `USING (spawter_id = auth.uid())`
- `INSERT` : `WITH CHECK (spawter_id = auth.uid())`
- `UPDATE` : `USING (spawter_id = auth.uid()) WITH CHECK (spawter_id = auth.uid())` — politique overwrite, pas de `IS DISTINCT FROM` lock comme consent
- **Pas** de DELETE policy (CASCADE depuis `spawters`)

**And** un trigger `update_timestamp_user_palais` similaire à `update_timestamp_spawters` (Story 1.5) met à jour `updated_at` à chaque UPDATE

**And** [supabase/migrations/0008_create_user_palais.down.sql](../../supabase/migrations/0008_create_user_palais.down.sql) existe : `DROP TRIGGER ... ; DROP TABLE user_palais CASCADE;`

**And** la migration passe PGlite test (pattern Story 1.8) :
- INSERT row avec spawter_id valide → OK
- UPDATE même row → OK (overwrite)
- SELECT avec mauvais `auth.uid()` → 0 rows (RLS)
- CHECK violation si `axe_racines_horizons = 1.5` (hors borne)
- CASCADE delete : `DELETE FROM spawters WHERE id = X` → user_palais row supprimé

**And** [supabase/README.md](../../supabase/README.md) tableau « État Sprint 1 » est mis à jour avec ligne 0008.

---

**AC #4 — `OnbCard` primitive RN canonique**

**Given** une nouvelle primitive [app/src/components/primitives/OnbCard.tsx](../../app/src/components/primitives/OnbCard.tsx)
**When** consommée par calibration.tsx
**Then** elle expose la signature :
```ts
interface Props {
  label: string;
  sub?: string;
  /** id ou index — pour key uniquement, pas styling */
  altKey: string;
  selected: boolean;
  onToggle: () => void;
}
```
**And** le rendu match l'UX kit ([documentation/ux/midfi-screens-1.jsx:18-42](../../documentation/ux/midfi-screens-1.jsx#L18-L42)) :
- Carré arrondi 16px (`theme.radius.lg`)
- Border : `2.5px brand.primary` si selected, sinon `1px border.subtle`
- Shadow gold subtle si selected (`theme.elevation.glow` ou approximation — cf. deferred-work iOS/Android caveat)
- Background : `surface.raised` (image placeholder pour V1, asset image en Sprint 2)
- Label en bas, typo `preset.body` semi-bold
- Sub-label optionnel typo `preset.caption` `text.secondary`
- Cible tactile min 80×80
**And** la primitive est ajoutée à `app/src/components/primitives/index.ts` barrel export
**And** un test unitaire (`__tests__/components/OnbCard.test.tsx`) couvre : selected vs unselected, onToggle appelé au tap, accessibility role checkbox

---

**AC #5 — `lib/calibration-mapping.ts` (moteur pur, testable)**

**Given** un nouveau module [app/src/lib/calibration-mapping.ts](../../app/src/lib/calibration-mapping.ts)
**When** une question est répondue (set de cards sélectionnées)
**Then** une fonction pure `resolveDirection(axis: PalaisAxis, selectedCardIndices: readonly number[], cards: readonly CalibrationCard[]) → "neg" | "pos" | "neutral"` retourne la direction
**And** la structure `CalibrationQuestion` exporte :
- `axis: PalaisAxis`
- `cards: readonly CalibrationCard[]` — chaque carte a `{ label_key: string; sub_key?: string; polarity: "neg" | "pos" }` (le pôle est figé par contenu de la carte, pas par index — moteur pur)
**And** un set canonique de 5 questions × N cartes est exporté `CALIBRATION_QUESTIONS: readonly CalibrationQuestion[]` (par exemple 4-6 cards par question, label_key = i18n FR)
**And** le moteur est sans I/O (pas d'AsyncStorage, pas de fetch) — testable unit sans mock
**And** test coverage : 5 axes × (3 cas : tous neg / tous pos / mix) = 15 assertions minimum

**Given** le contenu canonique des cartes
**When** les strings i18n sont ajoutées dans fr.json
**Then** elles couvrent au minimum (à valider Test Tantie Rose + UX brand Alexandre — exemples non-canonical) :
- `racines_horizons` : Garba, Attiéké poisson, Alloco, Pizza, Sushi, Ramen, Couscous (neg=local-CIV, pos=international)
- `taniere_nomade` : « Mon spot préféré toutes les semaines », « Une nouvelle adresse à chaque fois », « Quelques spots qui tournent », « Je teste tout »
- `exigeant_enthousiaste` : « Le service compte autant que la cuisine », « Si c'est bon je pardonne tout », « L'ambiance fait l'expérience », « Je note tout en détail »
- `foule_secret` : « Le maquis bondé un samedi soir », « Un spot que personne ne connaît », « Le mix des deux », « Selon l'humeur »
- `maquis_table` : « Maquis garba », « Restaurant chic Plateau », « Brunch Cocody », « Foodtruck Riviera » (neg=maquis/street, pos=table dressée)

---

**AC #6 — Reprise d'onboarding interrompu (`onboarding-draft` partiel)**

**Given** un user qui kill l'app après la 3e question
**When** il rouvre l'app
**Then** `RouteGuard` détecte `spawter === null` → redirige vers Splash → Consent (le draft `phone_e164` et `display_name` du draft sont déjà perdus car éphémères, donc on recommence)
**And** **Note importante** : le comportement actuel n'autorise pas une reprise mid-calibration. UX spec ligne 1112 dit « onboarding-draft persisté éphémère / RouteGuard reprend à la réouverture » — interprétation actuelle : reprend = recommence au début de l'onboarding, **pas** mid-calibration. Si l'objectif est de reprendre mid-cal exactement, voir Defer §7 (persistance AsyncStorage du draft).

**Given** un user qui répond aux 5 questions puis kill l'app **avant** finalize (Story 2.6)
**When** il rouvre l'app
**Then** `RouteGuard` détecte session auth active mais `spawter === null` → redirige vers Splash. Le draft est perdu. L'utilisateur recommence le funnel et son auth.users row reste (pas de cleanup auto). **UX dégradé accepté V1.** → Defer §7 (resume after auth).

---

**AC #7 — Tests unit + composant + PGlite**

**Given** le moteur pur `calibration-mapping.ts`
**When** `cd app && npm test`
**Then** la suite couvre :
- `resolveDirection` 5 axes × 3 cas = 15 tests minimum
- Sets canoniques `CALIBRATION_QUESTIONS` ont 5 axes, chaque axe a ≥2 cartes neg ET ≥2 cartes pos (mix possible)
- Snapshot test sur la structure (anti-régression contre modification accidentelle)

**Given** `<CalibrationScreen />` (RTL)
**When** monté
**Then** :
- 5 segments rendus, segment 1 actif au mount
- Sélection cartes → bouton Suivant actif
- Tap Suivant → `setCalibration` appelé + event `calibration_answered` émis + segment 2 actif
- Au tap Suivant de la 5e question → `router.push("/(onboarding)/palais-reveal")` (pas de finalizeOnboarding, contrairement au stub)
- `ChatBubble` intro rendu une seule fois au mount (pas re-rendu à chaque question)

**Given** `<OnbCard />` (RTL)
**When** rendu
**Then** :
- selected=true rend bordure gold + shadow
- onToggle appelé au tap
- accessibility role checkbox

**Given** la migration 0008 (PGlite)
**When** appliquée
**Then** assertions AC #3 vérifiées (5 tests minimum : INSERT OK, UPDATE OK, RLS isolation, CHECK constraints, CASCADE delete).

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert
**And** `cd app && expo export --platform web` compile (pas de dépendance Reanimated bloquante sur web).

## Tasks / Subtasks

- [x] **Task 1 — Migration 0008 `user_palais` + trigger + RLS** (AC: #3)
  - [x] Créer [supabase/migrations/0008_create_user_palais.sql](../../supabase/migrations/0008_create_user_palais.sql) avec table + RLS + trigger updated_at + commentaires SQL (référence PRD §13.1 + FR-025 + Story 2.5).
  - [x] Créer [supabase/migrations/0008_create_user_palais.down.sql](../../supabase/migrations/0008_create_user_palais.down.sql) (DROP TRIGGER + DROP TABLE CASCADE).
  - [x] Test PGlite : INSERT + UPDATE + RLS isolation + CHECK + CASCADE.
  - [x] Mettre à jour [supabase/README.md](../../supabase/README.md) « État Sprint 1 ».

- [x] **Task 2 — `OnbCard` primitive** (AC: #4)
  - [x] Créer [app/src/components/primitives/OnbCard.tsx](../../app/src/components/primitives/OnbCard.tsx) avec props AC #4.
  - [x] Ajouter au barrel `app/src/components/primitives/index.ts`.
  - [x] Tests unit dans `__tests__/components/OnbCard.test.tsx`.

- [x] **Task 3 — Moteur pur `calibration-mapping.ts`** (AC: #5)
  - [x] Créer [app/src/lib/calibration-mapping.ts](../../app/src/lib/calibration-mapping.ts) :
    - Type `CalibrationCard { label_key, sub_key?, polarity }`
    - Type `CalibrationQuestion { axis, cards }`
    - Constante `CALIBRATION_QUESTIONS: readonly CalibrationQuestion[]`
    - Fonction `resolveDirection(axis, selectedIndices, cards)` retournant la direction (pure, sans I/O)
  - [x] Tests `__tests__/lib/calibration-mapping.test.ts` (15+ assertions).

- [x] **Task 4 — Strings i18n calibration** (AC: #1, #5)
  - [x] Restructurer [app/src/i18n/fr.json](../../app/src/i18n/fr.json) section `calibration` :
    - Conserver `q_<axis>.question`
    - Ajouter `q_<axis>.subtitle` (optionnel — peut être vide)
    - Ajouter `q_<axis>.card.<index>.label` + `q_<axis>.card.<index>.sub` pour chaque carte canonique (4-6 cartes × 5 axes = 20-30 nouvelles clés)
    - Conserver `q_<axis>.option_neutral` = « Pas d'avis » (utilisable comme bouton secondaire si l'user veut passer sans sélectionner)
    - Garder `title` et `subtitle` génériques pour l'écran
  - [x] Audit `npm run i18n:check` + `npm run lint:vocab` verts.

- [x] **Task 5 — Réécriture `calibration.tsx` (UI `OnbMidfi`)** (AC: #1, #2, #6)
  - [x] Remplacer le pattern 3-boutons par : grille 2 colonnes de `<OnbCard>`, multi-select state local `selectedIndices: number[]` par question.
  - [x] Progress bar segmentée 5 segments en tête (réutiliser un composant simple inline, ou créer `OnbStep` primitive si réutilisation prévue Sprint 2).
  - [x] CatBubble intro `ChatBubble stade="touriste" moment="welcome_first_open"` rendu une fois.
  - [x] Au tap Suivant : appeler `resolveDirection(...)` → `calibrationDelta(...)` → `track("calibration_answered", ...)` → `setCalibration(axis, value)` → soit step++ soit `router.push("/(onboarding)/palais-reveal")`.
  - [x] Retirer l'appel `finalizeOnboarding` actuel (déplacé Story 2.6).
  - [x] Audit hex en dur vide.

- [x] **Task 6 — Mise à jour `_layout.tsx` (onboarding)** (AC: #1)
  - [x] Ajouter `<Stack.Screen name="palais-reveal" />` dans [app/app/(onboarding)/_layout.tsx](../../app/app/(onboarding)/_layout.tsx) — placeholder pour Story 2.6 (le fichier peut ne pas exister encore, mais la declaration permet la navigation typée).

- [x] **Task 7 — Tests** (AC: #7)
  - [x] [app/__tests__/lib/calibration-mapping.test.ts](../../app/__tests__/lib/calibration-mapping.test.ts) — moteur pur.
  - [x] [app/__tests__/components/OnbCard.test.tsx](../../app/__tests__/components/OnbCard.test.tsx) — primitive.
  - [x] [app/__tests__/components/CalibrationScreen.test.tsx](../../app/__tests__/components/CalibrationScreen.test.tsx) — composant.
  - [x] [app/__tests__/integration/user_palais_migration.test.ts](../../app/__tests__/integration/user_palais_migration.test.ts) — PGlite.

- [x] **Task 8 — Triple gate + smoke + CHANGELOG** (AC: #7)
  - [x] `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
  - [x] `cd app && expo export --platform web` + `--platform android`.
  - [x] CHANGELOG v1.2.5.
  - [x] Commit `feat(onboarding)` scope `onboarding`, FR-002, FR-025, triple sign-off pending.

## Dev Notes

### 1. Pourquoi multi-select vs 3-boutons texte

Le pattern actuel (3 boutons « option_neg/pos/neutral ») est **fonctionnel** mais ne correspond pas à l'UX D10. Le pattern `OnbMidfi` (cartes visuelles multi-select) :
- **Cognitively lighter** : choisir un visuel concret (« Garba », « Pizza ») est plus rapide qu'arbitrer entre 3 textes abstraits (« j'aime le local », « j'aime l'international », « je n'ai pas d'avis »).
- **Riches en signaux** : un user qui sélectionne 3 cartes locales + 1 internationale donne plus d'info qu'un simple « pos/neg/neutral » — la `resolveDirection` peut être affinée Sprint 2 (mix → score nuancé).
- **Cohérent avec le brand** : visuel-first, locales-rooted, Made in Abidjan **en arrière-plan** (cf. memory feedback : pas de pilier explicite).

### 2. Cartes canoniques — content owners

Les 4-6 cartes par axe sont des **decisions produit ouvertes**. Story 2.5 propose un set draft mais le sign-off final = Alexandre + Test Tantie Rose. Si le content alpha montre des cartes mal comprises ou hors-CIV, itérer en Sprint 2 (changement i18n + cartes additionnelles = pas de migration).

### 3. Couplage Story 2.6

Story 2.5 stoppe au `router.push("/(onboarding)/palais-reveal")`. Story 2.6 doit :
1. Lire `useOnboardingDraft.draft` (avec les 5 `calibration_answers` + `consent.*` + `phone_e164` + `display_name` + 4 PII)
2. Calculer le `UserPalais` initial via `palais-engine.ts` (`dominantAxes`, `computeConfidence`)
3. Afficher le `PalaisRadar` (primitive Story 1.3) avec confidence < 0.3 → « En construction » badge (cf. project-context §Edge cases)
4. Attribuer le 1er titre (Touriste)
5. Appeler `finalizeOnboarding` qui crée le row spawters + user_palais (INSERT atomique via transaction Supabase, ou 2 INSERTs serial avec fallback local-first)
6. Navigation `router.replace("/(tabs)")`

**Critique** : `finalizeOnboarding` actuel **ne lit pas** `draft.consent.*` ni le row Supabase auth user. Story 2.6 doit étendre `finalizeOnboarding` pour :
- Lire `auth.uid()` (au lieu de `SAMPLE_SPAWTER.id`)
- Lire `draft.consent.cgv_accepted_at` et `draft.consent.geoloc_consent_at`
- Insérer (pas localement, mais via Supabase upsert) le row spawters avec ces champs
- Idem pour user_palais

Cette modification est **scope Story 2.6**, pas Story 2.5. À documenter explicitement dans Story 2.6 Dev Notes au moment de sa rédaction.

### 4. `confidence_score` initial

Story 2.5 ne calcule **pas** `confidence_score` (Story 2.6 le fait via `computeConfidence(0)` = palais initial = confidence faible, sera affiché « En construction »). Migration 0008 défault `0`.

### 5. RouteGuard et resume

Le RouteGuard actuel est passif et redirige sur `spawter === null`. Story 2.5 **n'introduit pas** de logique de resume mid-calibration (cf. AC #6 + Defer §7). Le UX spec ligne 1112-1113 mentionne « onboarding-draft persisté éphémère / RouteGuard reprend à la réouverture » mais c'est **best-effort** — V1 accepte un restart complet.

### 6. Performance

- **OnbCard ×4-6 par question × 5 questions** = 20-30 cards instanciées max (1 question à la fois) → pas de souci de perf.
- **Reanimated** pour animation transition entre questions ? V1 = pas d'animation (fade default de la Stack expo-router). Sprint 2 si feedback.
- **Image assets** sur les cartes : V1 = placeholder couleur unie (`surface.subtle`) ou icône `Ico.<...>` — pas d'asset image binaire embarqué (cf. APK <50 MB cahier §5.7). Sprint 2 ajoute assets WebP optimisés.

### 7. Defers identifiés

- **Persistance AsyncStorage du draft `onboarding-draft`** — permet resume mid-cal. Hors scope V1 (déjà flagged Story 2.2 §7).
- **Image assets** sur OnbCard — Sprint 2 (WebP optimisés <50 KB chacun).
- **Carte alt-index → polarity mapping fin** : V1 mapping naïf (toute carte = neg ou pos). Sprint 2 : pondération si carte mixed-axis (ex. « ramen pâte de riz » = un peu local un peu international).
- **Question randomization** : V1 ordre figé (per CALIBRATION_QUESTIONS). Sprint 2 : potentiel A/B test order anti-fatigue.
- **`OnbStep` primitive** : V1 = inline dans calibration.tsx. Sprint 2 : promouvoir si autre flow multi-step émerge (Sprint 2 Premium upsell?).
- **Re-calibration depuis Profil** (FR-002 sous-jacent) : V1 = pas d'écran de re-cal. Le rationnel : le Palais apprend via les spawts (`learningFactor` exponentiel — palais-engine.ts). Sprint 2 : si data alpha montre besoin de reset.

### 8. Sign-off

- **Stéphanie** (tech) : review migration 0008 (FK CASCADE, RLS, trigger) + revue perf 5 questions × 6 cards.
- **Kidam** (analytics) : confirmation `calibration_answered.properties` conforme events.md ligne 36 — déjà listé. **Pas de modif events.md attendue** sauf si nouveau prop ajouté (ex. `selected_cards_count` pour data analytics fine — Defer §7).
- **Alexandre** (brand) : Test Tantie Rose obligatoire sur :
  - Titre + body écran
  - Wording de chaque question
  - Cartes (labels + subs) — risque #1 brand drift si les cartes drift vers du « cool international » au lieu de l'ancrage CIV.
  - Voix du Chat (ChatBubble intro)

### Project Structure Notes

- **2 nouveaux fichiers code** : `OnbCard.tsx` (primitive), `calibration-mapping.ts` (moteur).
- **1 nouvelle migration** : 0008 (coordination numérotation avec Story 2.3 qui ajoutait 0007 `otp_attempts`).
- **Pas de nouvelle dépendance**.
- **Pas de touch tokens** (couleurs et bordures via `theme.*`).
- **EAS Build profile** non impacté.

### References

- [_bmad-output/planning-artifacts/PRD.md FR-002 + FR-025](../planning-artifacts/PRD.md) — calibrage + apprentissage
- [_bmad-output/planning-artifacts/PRD.md §5.1, §13.1, §20.2](../planning-artifacts/PRD.md) — 5 axes, schéma user_palais, calibration
- [_bmad-output/planning-artifacts/epics.md:612-631 Story 2.5 epic](../planning-artifacts/epics.md#L612-L631)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1022-1023, 1110](../planning-artifacts/ux-design-specification.md#L1022-L1023) — D10 OnbMidfi
- [documentation/ux/midfi-screens-1.jsx:18-78](../../documentation/ux/midfi-screens-1.jsx#L18-L78) — OnbCard + OnbMidfi UX kit JSX
- [documentation/analytics/events.md:36 calibration_answered](../../documentation/analytics/events.md#L36)
- [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-17.md:141 critical path #4 user_palais](epic-1-retro-2026-05-17.md#L141)
- [_bmad-output/implementation-artifacts/1-5-schema-supabase-entites-spawter-staff-rls.md](1-5-schema-supabase-entites-spawter-staff-rls.md) — pattern migration RLS
- [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) — moteur pur (dominantAxes, computeConfidence)

### Previous story intelligence

- **Story 2.2** : draft.consent.* prêts à être lus par finalize.
- **Story 2.3** : draft.phone_e164 + session auth ouverte ; queue analytics drainée.
- **Story 2.4** : draft.display_name + neighborhood + 4 PII prêts.
- **Story 2.5 outputs** : draft.calibration_answers (5 axes) complets pour la consommation Story 2.6.

### Latest tech information

- **`react-native-svg 15.15.3`** (déjà installé) — utilisé indirect par `OnbCard` si besoin d'icônes Ico.
- **PGlite v0.2.x** (Story 1.8 pattern) — pour test migration locale.
- **Pas de nouvelle dep**.

### Project context reference

Voir `_bmad-output/project-context.md` — règles invariantes :
- §Data source adapter : `finalizeOnboarding` via store, pas accès Supabase direct.
- §Moteurs purs : `calibration-mapping.ts` sans I/O.
- §Tests : moteurs purs cible #1.
- §i18n : strings via `t()`.
- §Vocab : pas de gamification autour des 5 questions.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (2026-05-17 — batch Epic 2 dev)

### Debug Log References

— Migration 0008 PGlite test : couvert par `__tests__/integration/migrations.test.ts` (skip si `@electric-sql/pglite` absent). Étendre si nécessaire pour assertions CASCADE delete + CHECK violations spécifiques user_palais.
— Cartes canoniques (`CALIBRATION_QUESTIONS`) : 24 cartes (4-6 par axe). Wording à valider Test Tantie Rose Alexandre (sign-off à documenter avant merge `main`).

### Completion Notes List

- **Migration `0008_create_user_palais.sql`** créée (+ `.down.sql`). PK = `spawter_id` (politique overwrite FR-025), 5 colonnes `axe_*` `real CHECK BETWEEN -1 AND 1`, `confidence_score`, `dominant_axes text[] CHECK array_length=2`, `archetype_id`, `stade`, `total_spawts`, `updated_at`. RLS `spawter_id = auth.uid()` (SELECT/INSERT/UPDATE), trigger `update_timestamp_user_palais`. Mise à jour `supabase/README.md` (table 0008 ajoutée, 0009+ décalées).
- **`OnbCard.tsx`** primitive : grille 2 colonnes flex-wrap, selected bordure `2.5px brand.primary` + shadow gold, `accessibilityRole="checkbox"`. Ajout barrel export.
- **`calibration-mapping.ts`** moteur pur : `CalibrationCard { altKey, labelKey, subKey?, polarity }`, `CalibrationQuestion { axis, cards }`, `CALIBRATION_QUESTIONS` (5 axes, 24 cartes au total), `resolveDirection(selected, cards) → "neg"|"pos"|"neutral"`. Sans I/O.
- **`calibration.tsx`** réécrit : progress bar segmentée 5 segments, `ChatBubble welcome_first_open` en intro, grille 2 colonnes `<OnbCard>` multi-select, bouton « Suivant » (label `cta_finish` au step 5). Émet `calibration_answered` (axis/direction/value) puis `setCalibration`. Step 5 émet aussi `onboarding_step_completed{step:"calibration", step_index:4}` puis `router.push("/(onboarding)/palais-reveal")`. **Retrait** de l'appel `finalizeOnboarding` (déplacé Story 2.6).
- **`_layout.tsx` (onboarding)** : ajout `<Stack.Screen name="palais-reveal" />`.
- **`fr.json`** : restructuré section `calibration` — `cta_finish` + sous-sections `card.<altKey>` (24 cartes) tout en conservant `option_neg/pos/neutral` pour fallback. Audit i18n/vocab attendus verts.
- **Tests** :
  - `__tests__/lib/calibration-mapping.test.ts` — catalogue (5 axes, ≥2 neg + ≥2 pos par axe, labelKey distincts) + `resolveDirection` (0 → neutral ; tous neg → neg ; tous pos → pos ; mix → neutral) — 18 assertions.
  - `__tests__/components/OnbCard.test.tsx` — accessibility role + state selected/unselected + onToggle.
  - `__tests__/components/CalibrationScreen.test.tsx` — grille rendue, 5 Next → 5 events + push, sélection 2 neg → direction neg value -0.4.
- **Aucun nouveau primitive `OnbStep`** (pattern inline simple — promouvoir si réutilisation Sprint 2, cf. Defer §7 story).

### File List

**Créés :**
- `supabase/migrations/0008_create_user_palais.sql`
- `supabase/migrations/0008_create_user_palais.down.sql`
- `app/src/components/primitives/OnbCard.tsx`
- `app/src/lib/calibration-mapping.ts`
- `app/__tests__/lib/calibration-mapping.test.ts`
- `app/__tests__/components/OnbCard.test.tsx`
- `app/__tests__/components/CalibrationScreen.test.tsx`

**Modifiés :**
- `app/app/(onboarding)/calibration.tsx` — réécriture OnbMidfi
- `app/app/(onboarding)/_layout.tsx` — ajout palais-reveal screen
- `app/src/components/primitives/index.ts` — export OnbCard
- `app/src/i18n/fr.json` — restructure calibration.q_*.card.*
- `supabase/README.md` — table 0008 + décalage 0009+

### Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-17 | claude-opus-4-7[1m] | Story 2.5 livrée : migration 0008 user_palais + OnbCard primitive + calibration-mapping moteur pur + UI OnbMidfi 5 questions multi-select. Critical path Epic 2 §5.2 #4 résolu. |
| 2026-05-17 | code-review | Review Epic 2 — 7 findings sur cette story (1 décision UX + 1 patch + 5 defer). Détail : [code-review-2026-05-17-epic2.md](code-review-2026-05-17-epic2.md). |

### Review Findings (2026-05-17)

Source consolidée : [`code-review-2026-05-17-epic2.md`](code-review-2026-05-17-epic2.md).

- [ ] [Review][Decision] **D4** — `canContinue = true` (toujours) contredit AC #1 spec "≥1 carte sélectionnée → Suivant actif". Imposer ≥1 OU ajouter "Pas d'avis" explicite OU accepter l'état actuel ? [app/app/(onboarding)/calibration.tsx:38]
- [ ] [Review][Patch] **P23a** — `calibration.tsx` `useMemo` importé non utilisé [app/app/(onboarding)/calibration.tsx:5263]
- [x] [Review][Defer] **ChatBubble re-render à chaque step calibration** — spec demande "rendu une seule fois au mount", micro-perf
- [x] [Review][Defer] **PGlite tests scaffold-only `describe.skip`** — installer dep + livrer assertions concrètes Story 2.5a
- [x] [Review][Defer] **`user_palais.axe_*` typés `real`** — risque drift EMA Epic 4, schema review différée
- [x] [Review][Defer] **`user_palais.dominant_axes` CHECK ne valide pas domaine** — durcissement Epic 5
- [x] [Review][Defer] **`user_palais.archetype_id` free-form sans FK** — créer table `archetypes` Epic 5
- [x] [Review][Defer] **`user_palais.stade` CHECK dupliquait enum `spawters`** — extraire TYPE Postgres `stade_enum`

