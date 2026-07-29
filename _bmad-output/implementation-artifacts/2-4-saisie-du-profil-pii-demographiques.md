# Story 2.4: Saisie du profil & PII démographiques

Status: review

<!-- 3e story d'Epic 2 — collecte nom + quartier + 4 PII (country_code, origin_country_code, gender, age_range). Persiste en draft éphémère. La création de la ligne `spawters` reste Story 2.6. -->

## Story

As a nouveau spawter,
I want renseigner mon nom, mon quartier et 4 données démographiques (pays, origine, genre, tranche d'âge),
so that mon identité de base est posée et que le produit puisse mesurer ses cohortes (KPIs Madame Sun § PRD §16.1).

## ⚠️ Brownfield context — read first

**`profile.tsx` existe et est partiellement implémenté** (Moka bootstrap commit `2eed5e2`). Il capture déjà nom + quartier + age_range + gender, mais **il manque** `country_code` et `origin_country_code` (les 2 derniers des 4 PII attendus). Wording PII non explicite. Pas d'event `onboarding_step_completed{step:"profile"}` émis. Validation incomplète (le bouton « Continuer » exige seulement `name + neighborhood`, ignore les PII obligatoires).

| Élément | Fichier existant | État | Action Story 2.4 |
|---|---|---|---|
| Profile screen | [app/app/(onboarding)/profile.tsx](../../app/app/(onboarding)/profile.tsx) | ⚠️ 4 champs/6 implémentés ; pas d'event step_completed ; wording PII pas assez explicite | **Étendre** : ajouter `country_code` + `origin_country_code` UI ; émettre `onboarding_step_completed` ; renforcer wording |
| `useOnboardingDraft` | [app/src/store/onboarding-draft.ts](../../app/src/store/onboarding-draft.ts) | ✅ Champs `display_name`, `neighborhood`, `country_code`, `origin_country_code`, `gender`, `age_range` présents (Story 2.2 a ajouté `consent`) | **Pas touché** structurel — utiliser les setters existants `setField` |
| Type `OnboardingDraft` | [app/src/types/spawter.ts:43-53](../../app/src/types/spawter.ts#L43-L53) | ✅ Aligné post-Story 2.2 (avec `consent`) | **Pas touché** |
| Type `Spawter` | [app/src/types/spawter.ts:13-40](../../app/src/types/spawter.ts#L13-L40) | ✅ Champs cibles existent (`country_code` NOT NULL default `'CI'`, `origin_country_code` nullable, `gender`, `age_range`) | **Pas touché** |
| Migration schéma | [supabase/migrations/0001_create_spawters_spawt_staff.sql](../../supabase/migrations/0001_create_spawters_spawt_staff.sql) | ✅ Colonnes présentes (Story 1.5) | **Pas touché** — l'INSERT du row spawters reste Story 2.6 (`finalizeOnboarding`) |
| Analytics events | [app/src/lib/analytics.ts:78-84](../../app/src/lib/analytics.ts#L78-L84) | ✅ `onboarding_step_completed.step` accepte `"profile"` et `step_index: 3` | **Émettre** au tap Continuer |
| Pre-fill depuis Apple `fullName` | (aucun) | ⚠️ Story 2.3 peut prefiller `display_name` via Apple `credential.fullName` | **Lire** `draft.display_name` initial (déjà fait via `useState(draft.display_name)`) |
| RouteGuard | [app/app/_layout.tsx](../../app/app/_layout.tsx) | ✅ Passif | **Pas touché** |
| Strings i18n | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) `onboarding.*` | ⚠️ Strings `name_title`, `name_placeholder`, `neighborhood_*`, `demographics_age_title`, `demographics_gender_title` existent — pas de strings pour `country_code` ni `origin_country_code` ni wording PII renforcé | **Ajouter** : `country_title`, `country_body`, `origin_country_title`, `origin_country_body`, `gender_body`, `age_body` + renforcer body de l'écran |
| CountryCode UI primitive | (aucun) | ❌ Pas de picker pays | **Réutiliser** le pattern `<Choice>` existant pour une liste compacte (10 codes CIV-region) |

**Décisions héritées :**

- **Cuisine préférée + budget habituel + contexte** mentionnés dans l'epic 2.4 sont **encodés via les 5 axes Palais** (Story 2.5), **pas** comme champs séparés de profil. UX spec ligne 228-229 spécifie « Profile (nom + quartier + 4 PII) » — 4 PII = country_code, origin_country_code, gender, age_range. Pas de scope creep sur ces 3 champs.
- **`country_code` default `"CI"`** (FR-027 + DB DEFAULT) — l'UI peut **pré-sélectionner CI** mais doit permettre le changement (10 codes CIV-region acceptés cf. Story 1.5).
- **`origin_country_code` nullable** — l'utilisateur peut sauter (« Préfère ne pas dire »).
- **`age_range` nullable** mais le bouton Continuer **exige** son choix (UX choice — pas de skip silencieux ; un bouton « Préfère ne pas dire » explicite est OK).

**Décision critical path Epic 2 §5.2 — état avant 2.4 :**

- **#5 Smoke device matrice 4** : pending pour merge `main` (pas bloquant `spawt/v1-bmad`).

## Acceptance Criteria

**AC #1 — Écran Profile capture les 6 champs requis (nom + quartier + 4 PII)**

**Given** l'écran [app/app/(onboarding)/profile.tsx](../../app/app/(onboarding)/profile.tsx) monté
**When** il s'affiche (post-OTP success Story 2.3)
**Then** un titre explicite `t("onboarding.profile_title")` = « Présente-toi » est rendu en tête
**And** un body `t("onboarding.profile_body")` rappelle que ces infos servent la Meute (« 6 trucs rapides pour que je te reconnaisse. Tu choisis ce que tu partages. ») — wording validé Test Tantie Rose Alexandre
**And** les 6 champs suivants sont rendus dans cet ordre vertical :

1. **Nom** — `TextInput` (capture `display_name`, prefilled `draft.display_name` si Story 2.3 Apple `credential.fullName` l'a écrit), placeholder `t("onboarding.name_placeholder")`. Validation : `trim().length >= 2`.
2. **Quartier** — `TextInput` (capture `neighborhood`), hint `t("onboarding.neighborhood_body")` = « Cocody, Yopougon, Marcory… On t'affichera des lieux proches. ». Validation : `trim().length >= 2`.
3. **Pays de résidence** — `<Choice>` row (10 codes CIV-region per [app/src/types/spawter.ts:11](../../app/src/types/spawter.ts#L11) `CountryCode`), pré-sélection `"CI"`, labels affichés `t("onboarding.country.CI")` etc. (10 nouvelles clés i18n). Validation : non-NULL (toujours OK car prefilled).
4. **Pays d'origine** — `<Choice>` row identique + 1re option « Préfère ne pas dire » qui set `null`. Validation : peut être null.
5. **Genre** — pattern existant (`femme`, `homme`, `autre`, `non_renseigne`). Validation : non-NULL (default `non_renseigne` accepté).
6. **Tranche d'âge** — pattern existant (`18-24`, `25-34`, `35-44`, `45-54`, `55+`). Validation : **non-null required** (le bouton Continuer reste désactivé tant que `age_range === null`).

**Given** chaque modification de champ
**When** l'utilisateur tape/sélectionne
**Then** `useOnboardingDraft.setField(key, value)` est appelé (pattern existant — pas de re-implémentation)
**And** les valeurs persistent à travers un re-render (Zustand) mais pas à travers un kill de l'app (draft éphémère — cohérent UX spec line 1112-1113 pour le calibrage, étendu ici)

**Given** la collecte de PII
**When** chaque section démographique est rendue
**Then** un body explicatif court (caption, `theme.typography.preset.caption` `text.secondary`) explique l'usage **avant** les options — wording conforme FR-040 « explicite leur usage » :
- `t("onboarding.country_body")` = « Pour t'afficher les lieux du bon pays. »
- `t("onboarding.origin_country_body")` = « D'où tu viens — utile pour comprendre les communautés culinaires. Tu peux dire non. »
- `t("onboarding.gender_body")` = « Pour mieux représenter la Meute dans nos décisions. Aucune diffusion publique. »
- `t("onboarding.age_body")` = « Tranche, pas date exacte — moins intrusif. »

---

**AC #2 — Validation : bouton « Continuer » désactivé tant que les champs requis ne sont pas remplis**

**Given** l'écran profile
**When** `display_name.trim().length < 2 || neighborhood.trim().length < 2 || age_range === null`
**Then** le bouton « Continuer » est désactivé (`disabled`, fond `border.subtle`, label `text.tertiary`) — pattern Story 2.2 consent
**And** un tap sur le bouton désactivé ne déclenche aucune action

**Given** les champs requis remplis (nom ≥2 + quartier ≥2 + age_range non-null)
**When** `country_code` est non-null (par default `"CI"`) ET `gender` est non-null (par default `"non_renseigne"`)
**Then** le bouton devient actif
**And** `origin_country_code` peut rester null (le bouton reste actif) — c'est le seul champ skippable

**Given** un tap sur le bouton actif « Continuer »
**When** la validation passe
**Then** **avant** la navigation, `track({ name: "onboarding_step_completed", properties: { step: "profile", step_index: 3 } })` est émis
**And** `router.push("/(onboarding)/calibration")` (entrée Story 2.5)

---

**AC #3 — Pre-fill robuste depuis le draft (cas reprise post-Apple Sign-In ou Google)**

**Given** Story 2.3 a écrit `display_name` dans `draft` via Apple `credential.fullName.givenName + familyName` (ou Google `name`)
**When** Profile screen monte
**Then** le champ « Nom » est prefilled avec cette valeur (déjà géré par `useState(draft.display_name)`)
**And** l'utilisateur peut modifier la valeur (les setters écrivent via `setField`)

**Given** un retour utilisateur sur Profile depuis un step ultérieur (cas hors V1 mais à anticiper)
**When** `draft` est déjà rempli
**Then** tous les champs reflètent l'état actuel du draft (les sélecteurs Zustand sont granulaires — `useOnboardingDraft((s) => s.draft.gender)` etc., pour éviter les re-renders en cascade)

**Given** une réouverture de l'app après kill avant validation Profile
**When** `RouteGuard` détecte `spawter === null` et `auth.session !== null` (cas edge post-Story 2.3 OTP)
**Then** la redirection actuelle (`spawter === null → /` Splash) recommence le funnel ; le `draft` éphémère est perdu — **comportement accepté V1** (cf. Story 2.3 Dev Notes §3 + Defer §7).

---

**AC #4 — Strings i18n complètes, audit vocab + i18n verts**

**Given** les nouvelles strings i18n
**When** ajoutées dans `fr.json` section `onboarding`
**Then** au minimum les clés suivantes existent :
```
"onboarding": {
  "profile_title": "Présente-toi",
  "profile_body": "6 trucs rapides pour que je te reconnaisse. Tu choisis ce que tu partages.",
  "name_title": "Comment tu t'appelles",
  "name_placeholder": "Ton prénom",
  "neighborhood_title": "Ton quartier",
  "neighborhood_body": "Cocody, Yopougon, Marcory… On t'affichera des lieux proches.",
  "country_title": "Pays de résidence",
  "country_body": "Pour t'afficher les lieux du bon pays.",
  "origin_country_title": "Tes origines",
  "origin_country_body": "D'où tu viens — utile pour comprendre les communautés culinaires. Tu peux dire non.",
  "origin_country_skip": "Préfère ne pas dire",
  "gender_title": "Comment tu t'identifies",
  "gender_body": "Pour mieux représenter la Meute dans nos décisions. Aucune diffusion publique.",
  "age_title": "Ta tranche d'âge",
  "age_body": "Tranche, pas date exacte — moins intrusif.",
  "country": {
    "CI": "Côte d'Ivoire",
    "NG": "Nigeria",
    "SN": "Sénégal",
    "CM": "Cameroun",
    "TG": "Togo",
    "BJ": "Bénin",
    "BF": "Burkina Faso",
    "ML": "Mali",
    "GN": "Guinée",
    "GH": "Ghana"
  }
}
```

**Given** la triple gate
**When** lancée
**Then** `cd app && npm run i18n:check` vert (aucune string FR hardcodée hors `fr.json` — toutes les nouvelles strings passent par `t()`)
**And** `cd app && npm run lint:vocab` vert (aucun mot interdit : pas de « user », « profile generic », « gamif* »)

---

**AC #5 — Audit visuel + WCAG + design tokens**

**Given** l'écran profile
**When** une revue Stéphanie est lancée
**Then** **aucun hex en dur** : `grep -nE '#[0-9A-Fa-f]{3,6}' app/app/(onboarding)/profile.tsx` vide (tous les couleurs/bords/fonds via `theme.*`)
**And** le contraste des `<Choice>` sélectionnés respecte WCAG AA (or `#C8A44E` sur blanc cassé `#FAFAF8` validé Story 1.4, mais re-tester `gold` sur `surface.raised` qui est `pureWhite #FFFFFF`)
**And** la cible tactile minimum 44×44 est respectée pour les `<Choice>` (le `paddingHorizontal: base + paddingVertical: sm` donne ~36×32, **à augmenter** avec `minHeight: 44, hitSlop: 8` si insuffisant)

**Given** le scroll
**When** le clavier s'ouvre sur un `TextInput`
**Then** le `KeyboardAvoidingView` ou `ScrollView keyboardShouldPersistTaps="handled"` permet de continuer à scroller et de taper « Continuer » sans dismiss du clavier (déjà partiellement géré — vérifier sur Tecno low-end)

**Given** le Test Tantie Rose (3 questions Alexandre)
**When** l'écran est revu
**Then** :
1. **Tantie Rose comprend ?** — pas de jargon (« PII », « démographiques »), wording concret.
2. **Brice Konan le partage ?** — design propre, pas de pression intrusive.
3. **Dominic ressent l'appartenance ?** — ton inclusif (« la Meute »), pas de juridique froid.

---

**AC #6 — Tests unit + composant**

**Given** `<ProfileScreen />` (RTL)
**When** `cd app && npm test` est lancé
**Then** la suite couvre :
1. Mount : titre + body + 6 sections affichés.
2. Bouton « Continuer » désactivé tant que name vide ou neighborhood vide ou age_range null.
3. Saisie nom 2 chars + quartier 2 chars + age_range click → bouton actif.
4. Tap Continuer → `track({ name: "onboarding_step_completed", properties: { step: "profile", step_index: 3 } })` émis + `router.push("/(onboarding)/calibration")` appelé.
5. Pre-fill : `useOnboardingDraft.setField("display_name", "Yann")` avant mount → name input value = "Yann".
6. `origin_country_code` peut rester null sans bloquer Continue.
7. `country_code` default à "CI" visible/sélectionné au mount.

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert
**And** `cd app && expo export --platform web` compile sans erreur.

## Tasks / Subtasks

- [x] **Task 1 — Étendre l'UI Profile avec `country_code` + `origin_country_code`** (AC: #1)
  - [x] Dans [app/app/(onboarding)/profile.tsx](../../app/app/(onboarding)/profile.tsx), ajouter 2 `<Field>` :
    - « Pays de résidence » : `<Choice>` row mappée sur les 10 `CountryCode`. Pré-sélection visuelle `country_code === "CI"` au mount.
    - « Tes origines » : `<Choice>` row identique + 1re option « Préfère ne pas dire » qui set `origin_country_code = null`.
  - [x] Réutiliser `<Choice>` existant (pas de nouveau primitive).
  - [x] Wirer `setField("country_code", ...)` et `setField("origin_country_code", ...)`.
  - [x] Ajouter `body` court sous chaque champ démographique (Country, OriginCountry, Gender, Age) — wording AC #4.

- [x] **Task 2 — Renforcer le titre + body écran + validation Continuer** (AC: #1, #2)
  - [x] Remplacer le titre actuel (qui réutilise `name_title`) par `t("onboarding.profile_title")` + body `t("onboarding.profile_body")` en tête.
  - [x] Étendre la condition `valid` : `name.trim().length >= 2 && neighborhood.trim().length >= 2 && draft.age_range !== null`.
  - [x] Sur tap Continuer : émettre `track({ name: "onboarding_step_completed", properties: { step: "profile", step_index: 3 } })` **avant** `router.push`.

- [x] **Task 3 — Strings i18n** (AC: #4)
  - [x] Ajouter dans [app/src/i18n/fr.json](../../app/src/i18n/fr.json) section `onboarding` les clés listées AC #4.
  - [x] Ajouter sous-section `onboarding.country.<CountryCode>` (10 codes).
  - [x] Audit `npm run i18n:check` + `npm run lint:vocab` verts.

- [x] **Task 4 — Pre-fill robuste** (AC: #3)
  - [x] Vérifier que `useState(draft.display_name)` au mount capture bien le draft (cas Apple `fullName` pré-écrit Story 2.3).
  - [x] Si besoin, lire le draft via sélecteur Zustand granulaire pour les champs (`draft.country_code` direct au lieu de prop `draft` entière → évite re-renders en cascade).

- [x] **Task 5 — Audit WCAG + hit area** (AC: #5)
  - [x] `grep -nE '#[0-9A-Fa-f]{3,6}' app/app/(onboarding)/profile.tsx` doit retourner vide.
  - [x] `<Choice>` : ajouter `minHeight: 44` ou hitSlop si insuffisant.
  - [x] Vérifier que `<ScrollView>` + `keyboardShouldPersistTaps="handled"` (déjà présent) suffit ; sinon wrap `KeyboardAvoidingView` (cohérent phone.tsx).

- [x] **Task 6 — Tests** (AC: #6)
  - [x] Créer [app/__tests__/components/ProfileScreen.test.tsx](../../app/__tests__/components/ProfileScreen.test.tsx) couvrant les 7 cas AC #6.
  - [x] Mock `expo-router` (`useRouter`), Zustand stores (Story 1.7 pattern test).

- [x] **Task 7 — Triple gate + smoke + CHANGELOG** (AC: #5, #6)
  - [x] `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
  - [x] `cd app && expo export --platform web` vert.
  - [x] CHANGELOG v1.2.4 entry (Sprint 1 Story 2.4).
  - [x] Commit `feat(onboarding)` scope `onboarding`, FR-002, triple sign-off pending.

## Dev Notes

### 1. Pourquoi pas cuisine/budget/contexte dans Profile

L'epic 2.4 mentionne « nom, quartier de résidence, cuisine préférée, budget habituel, contexte (solo/groupe), `country_code`, `origin_country_code`, `gender`, `age_range` » — 9 champs au total.

**Mais** :
- UX spec ligne 228-229 spécifie « Profile (nom + quartier + 4 PII) » — **6 champs**, pas 9.
- Le type `Spawter` (Story 1.5) **n'a pas** `preferred_cuisine`, `preferred_budget`, `preferred_context`. Migrer pour les ajouter serait du scope creep important (migration, RLS, validation).
- Les 5 questions de calibrage Palais (Story 2.5) capturent ces préférences via les **axes** (Maquis/Table = formel/informel proche du budget ; Foule/Secret = contexte social ; Racines/Horizons = cuisine local/exotique).

**Décision** : Story 2.4 livre **6 champs** (nom + quartier + 4 PII). Les 3 champs « cuisine/budget/contexte » de l'epic sont **encodés implicitement** dans le calibrage Palais (Story 2.5). Si une telemtry ou Madame Sun montre besoin de capture explicite Sprint 2, créer une story dédiée avec migration.

### 2. Pre-fill `display_name` cas Apple Sign-In

Story 2.3 (Apple) peut écrire `draft.display_name` si l'utilisateur autorise le partage du nom à la 1re auth Apple (politique Apple : seulement la 1re fois). Profile.tsx lit `useState(draft.display_name)` au mount → prefilled. **Edge case** : si l'utilisateur s'est désinscrit puis se réinscrit, Apple ne re-partage pas le nom → `draft.display_name` reste vide → l'utilisateur tape manuellement. UX standard. Pas de Defer.

### 3. CountryCode UI compactness

10 options en `<Choice>` flex-wrap peuvent prendre 3 lignes sur mobile portrait. Acceptable mais à valider visuellement (smoke device). **Alternative** : `<Picker>` natif (`@react-native-picker/picker` ~2.x compatible Expo SDK 55) si la densité visuelle pose problème. **Defer §6** si feedback alpha.

### 4. Quartier free-text vs picker

Le quartier reste un `TextInput` libre (V1) plutôt qu'un picker. Risque : variabilité orthographique (« Cocody » vs « cocody » vs « COCODY ») → l'analytics agrège mal en Sprint 2. **Defer §6** : normalisation + autocomplete quartiers Abidjan en Sprint 2 (besoin d'une liste canonique cf. PRD §17.1).

### 5. Validation des saisies — pas de Zod ici

Profile reste un formulaire simple — pas besoin de Zod (la validation est inline). Cohérent project-context « Validation runtime = Zod à la frontière de l'adapter `data-source` » — la validation Zod arrive au moment du finalize (Story 2.6) avant l'INSERT spawters.

### 6. Defers identifiés

- **Picker pays natif** si flex-wrap 3 lignes pose problème UX alpha.
- **Autocomplete quartier Abidjan** Sprint 2 (anti-typo).
- **Privacy nutrition labels iOS** (PTR-STORE-01 §5.1.1) : déclarer `gender`, `age_range`, `origin_country_code` comme « App Functionality » + « Analytics » dans App Store Connect avant Apple Review. → Hors story (config store, pas code).
- **Cuisine/budget/contexte champs explicites** si data alpha le justifie.
- **Re-auth + draft refresh** si user kill app entre OTP et Profile finalize.

### 7. Sign-off

- **Stéphanie** : pas de migration ; review UX seulement (touch zones, WCAG).
- **Kidam** : confirmation que `onboarding_step_completed{step:"profile", step_index:3}` est conforme events.md (ligne 35-36 — déjà listé). Pas de modif events.md.
- **Alexandre** : Test Tantie Rose obligatoire — surtout sur le wording PII (gender + origin) qui peut paraître intrusif sans le bon ton.

### Project Structure Notes

- **Aucun nouveau fichier** créé (un seul fichier modifié : `profile.tsx`).
- **Pas de nouveau primitive** — réutilisation `<Choice>` interne.
- **Pas de nouvelle dépendance**.
- **EAS Build profile** non impacté.

### References

- [_bmad-output/planning-artifacts/PRD.md FR-002](../planning-artifacts/PRD.md) — saisie quartier + 4 PII
- [_bmad-output/planning-artifacts/PRD.md §20.7 DR-ARTCI-02](../planning-artifacts/PRD.md) — collecte PII conformité Loi 2013-450
- [_bmad-output/planning-artifacts/PRD.md PTR-STORE-01 §5.1.1](../planning-artifacts/PRD.md) — privacy labels iOS
- [_bmad-output/planning-artifacts/epics.md:591-610 Story 2.4 epic](../planning-artifacts/epics.md#L591-L610)
- [_bmad-output/planning-artifacts/ux-design-specification.md:228-229 4 PII](../planning-artifacts/ux-design-specification.md#L228-L229)
- [documentation/analytics/events.md:35-36 onboarding_step_completed](../../documentation/analytics/events.md#L35-L36)
- [_bmad-output/implementation-artifacts/2-3-authentification-par-otp-google-sign-in.md](2-3-authentification-par-otp-google-sign-in.md) — Apple `credential.fullName` prefill
- [_bmad-output/implementation-artifacts/1-5-schema-supabase-entites-spawter-staff-rls.md](1-5-schema-supabase-entites-spawter-staff-rls.md) — schéma spawters (champs cibles)

### Previous story intelligence

- **Story 2.2** : `useOnboardingDraft.consent.{cgv,geoloc}_consent_at` est rempli. Story 2.4 ne lit pas ce sous-objet (Story 2.6 le lira au finalize).
- **Story 2.3** : `useOnboardingDraft.phone_e164` est rempli après OTP success. Apple `credential.fullName` peut prefiller `display_name`.

### Latest tech information

Aucune nouvelle lib requise. Tout est déjà installé (RN core, `useTranslation`, `expo-router`, Zustand).

### Project context reference

Voir `_bmad-output/project-context.md` — règles invariantes inchangées. À noter :
- §i18n : toutes les strings via `t()`.
- §Design tokens : pas de hex en dur.
- §Vocab : pas de « user », pas de « profile » générique.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (2026-05-17 — batch Epic 2 dev)

### Debug Log References

— Aucun blocage. Story autonomes (réécriture profile.tsx + strings i18n + test composant).

### Completion Notes List

- **`profile.tsx` réécrit** : ajout des 2 champs `country_code` (`<Choice>` row 10 CountryCode, pré-sélection CI) + `origin_country_code` (skip = `null`). Titre `onboarding.profile_title` + body `onboarding.profile_body` en tête. Validation étendue : `name>=2 + neighborhood>=2 + age_range non-null + country_code non-null + gender non-null`. Émission `onboarding_step_completed{step:"profile", step_index:3}` avant `router.push`.
- **`<Choice>`** : `minHeight: 44` ajouté + `accessibilityRole="radio"` + `accessibilityState.selected`.
- **`fr.json`** : ajout des clés `onboarding.profile_*`, `country_*`, `origin_country_*`, `gender_*`, `age_*` + sous-section `onboarding.country.<code>` (10 codes).
- **`__tests__/components/ProfileScreen.test.tsx`** : 7 cas (CTA disabled, validation, push calibration + emit, origin nullable, CI pré-sélection, prefill display_name, mutation country/gender).
- **Aucune migration ni dépendance** ajoutée. Aucun fichier supprimé.
- **Aucun event analytics nouveau** — `onboarding_step_completed` déjà déclaré (analytics.ts L78-84).

### File List

**Modifiés :**
- `app/app/(onboarding)/profile.tsx` — UI étendue, validation 5 champs requis, emit step_completed
- `app/src/i18n/fr.json` — onboarding.profile_*, country.*, gender_*, age_*, origin_country_*

**Créés :**
- `app/__tests__/components/ProfileScreen.test.tsx`

### Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-17 | claude-opus-4-7[1m] | Story 2.4 livrée : profile complet 6 champs + emit step_completed + tests. |
| 2026-05-17 | code-review | Review Epic 2 — 3 findings sur cette story (3 patches mineurs, sinon clean). Détail : [code-review-2026-05-17-epic2.md](code-review-2026-05-17-epic2.md). |

### Review Findings (2026-05-17)

Source consolidée : [`code-review-2026-05-17-epic2.md`](code-review-2026-05-17-epic2.md). Story la plus propre d'Epic 2 — uniquement des patches mineurs.

- [ ] [Review][Patch] **P24** — `OnbCard.tsx` prop `altKey` required mais jamais utilisée dans le body [app/src/components/primitives/OnbCard.tsx:7319-7329]
- [ ] [Review][Patch] **P25** — `profile.tsx` validation `country_code !== null` + `gender !== null` sont dead (types non-null garantis) [app/app/(onboarding)/profile.tsx:55-60]
- [ ] [Review][Patch] **P26** — `display_name` sans `maxLength` cap ni filtre emoji-only [app/app/(onboarding)/profile.tsx:6722]
- [x] [Review][Defer] **hitSlop=4 au lieu de 8 spec** — minor a11y, polish ultérieur
- [x] [Review][Defer] **`OnboardingDraft.gender` defaulted `non_renseigne`** — biaise KPI ; decision Kidam pendante

