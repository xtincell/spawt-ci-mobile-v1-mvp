---
project_name: 'Spawt mobile CI'
user_name: 'X-tin'
date: '2026-05-13'
sections_completed:
  - technology_stack
  - language_typescript
  - framework_rules
  - testing_and_dod
  - code_quality_style
  - workflow_rules
  - critical_donts
status: complete
rule_count: 120
optimized_for_llm: true
language: 'fr'
canonical_part: 'app/'
canonical_delivery: 'eas-apk-android'
existing_patterns_found: 12
---

# Project Context pour agents IA — SPAWT

_Ce fichier contient les règles, patterns et invariants critiques que tout agent IA doit respecter en écrivant du code dans ce repo. On se concentre sur les détails non-évidents qu'un LLM peut rater. Sources amont : [PRD V1](../documentation/SPAWT_PRD_V1.docx), [cahier Sprint 1](../documentation/SPRINT_1_CAHIER_DES_CHARGES.md), [docs/index.md](../docs/index.md)._

---

## Repo layout — non-évident

- **Multi-part** : code à la racine = `prototype-web` (Vite/React 18) **figé** = référence visuelle. Tout code mobile V1 = `app/` (Expo SDK 55 / RN 0.83 / TS strict). Ne jamais éditer la racine pour livrer V1.
- **Canonical** = `app/`. Quand le doc dit « le code », c'est `app/` sauf mention explicite.
- Branche active : `spawt/v1-bmad`. Le mainline V1 vit ici, pas sur `main`.

---

## Technology Stack & Versions

> Canonical = `app/`. Versions exactes (cf. `app/package.json`, `app/app.json`, `app/tsconfig.json`).

### Core
- **Runtime** : React Native `0.83.6` + React `19.2.0`
- **Framework** : Expo SDK `^55.0.19` (`newArchEnabled: true`)
- **Routing** : `expo-router ~55.0.13` — file-based, `experiments.typedRoutes: true`
- **Langage** : TypeScript `~5.9.2` — strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride`
- **State** : `zustand ^4.5.0` (pas de Redux)
- **Storage local** : `@react-native-async-storage/async-storage 2.2.0`
- **Backend (optionnel)** : `@supabase/supabase-js ^2.45.0` — chargé en **import dynamique**
- **i18n** : `i18next ^23.16` + `react-i18next ^15.1` + `expo-localization ~55.0.13`
- **Animation** : `react-native-reanimated 4.2.1` (requis par expo-router, plugin Babel)
- **SVG** : `react-native-svg 15.15.3` (radars Palais & ADN)
- **Géoloc** : `expo-location ~55.1.8` — *Le Guet* (PRD §7.1)
- **Notifs** : `expo-notifications ~55.0.22` — push « Comment c'était ? »
- **Gestures** : `react-native-gesture-handler ~2.30.0`
- **Safe area / screens** : `react-native-safe-area-context ~5.6.2`, `react-native-screens ~4.23.0`
- **Tests** : `jest ^29.7` + `jest-expo ~55.0` (preset `jest-expo`)

### Identité plateforme
- iOS bundleId : `com.upgraders.spawt` (buildNumber `1`)
- Android package : `com.upgraders.spawt` (versionCode `1`)
- Scheme deep link : `spawt`
- Cibles : iOS 13+ / Android 10+ — *iOS-first* en démo, Android testé Galaxy S23

### Contraintes
- **Node ≥ 20** (Expo SDK 55), **npm ≥ 10**. `yarn`/`pnpm` non testés.
- React `19.x` + jest-expo génèrent des warnings peer-deps cosmétiques → `npm install --legacy-peer-deps` si besoin.
- 16 vulnérabilités npm transitives héritées Expo SDK 55 (12 mod + 4 low) — connues, à auditer en hardening, **ne pas modifier les versions Expo pour les corriger** sans validation.
- `tsconfig` étend `expo/tsconfig.base`. Path aliases : `@/* → ./src/*`, `@app/* → ./app/*`. Module resolution = `bundler`.
- **Prototype-web** (racine) tourne sur Vite 5 + React 18 — stack séparée, **ne pas y appliquer les règles mobile**.

---

## Critical Implementation Rules

### TypeScript

- **Strict mode complet activé** : `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride`. Implications **non-évidentes** :
  - `arr[0]` est typé `T | undefined` — **toujours narrower** avant usage (`if (item) { … }`), pas `arr[0]!`.
  - `exactOptionalPropertyTypes` interdit `{ foo: undefined }` quand le type dit `foo?: string`. Soit on omet la clé, soit on type `foo?: string | undefined` explicitement.
  - `override` obligatoire sur toute méthode qui en surcharge une autre.
- **`any` proscrit**. Si l'inférence ne tient pas → `unknown` + narrowing, ou type discriminé.
- **Imports** : aliases `@/*` (= `./src/*`) et `@app/*` (= `./app/*`) **préférés** aux chemins relatifs profonds (`../../../`). Les imports relatifs courts dans un même dossier restent OK.
- **Exports** : **export nommé** par défaut, **pas** `export default`. Exception : les entry screens Expo Router (`app/app/**/*.tsx`) qui **doivent** être `export default function` (contrainte du file-based routing).
- **Imports dynamiques pour Supabase** : `data-source.ts` charge `data-source.supabase.ts` via `await import(...)` pour ne pas alourdir le bundle quand le mode démo tourne. Ne jamais importer `@supabase/supabase-js` en statique depuis un écran.
- **Barrels (`index.ts`)** autorisés dans `src/types/` uniquement. Pas de barrel par dossier ailleurs (perf bundler + cycles).
- **Erreurs** : pas de `throw new Error(string)` brut dans les moteurs purs (`lib/matching.ts`, `lib/palais-engine.ts`) — ils doivent rester totaux (retour `null`/valeur par défaut documentée). Les erreurs I/O (Supabase, AsyncStorage) sont **catch-and-log**, jamais propagées en plein écran utilisateur.
- **Pas de `console.log` qui leak** en prod — utiliser un wrapper conditionnel (`__DEV__`). Aucune lib de logging structuré n'est encore branchée (Sentry non installé — cf. CHANGELOG).
- **Dates absolues** dans le code et la doc — pas de `"il y a 2 jours"` codé en dur, calcul à l'affichage.

### Expo Router (file-based routing)

- **Entry** : `app/app.json` → `main: "expo-router/entry"`. Tout fichier `.tsx` sous `app/app/` devient une route. **Export default obligatoire** pour ces fichiers (sinon route invisible).
- **Routes typées** activées (`experiments.typedRoutes: true`) → `router.push({ pathname: "/place/[id]", params: { id } })`, pas de string concaténée.
- **Groupes parenthésés** : `(onboarding)/` et `(tabs)/` n'apparaissent pas dans l'URL — c'est juste de l'organisation de stack. Structure : Stack racine → `(onboarding)` Stack → `(tabs)` Tabs → `place/[id]`.
- **`RouteGuard` est passif** ([`app/_layout.tsx:12-33`](../app/app/_layout.tsx#L12-L33)) : observe le store Zustand, redirige selon présence `spawter`, **n'orchestre rien**. Ne pas y mettre de logique métier.
- **Layouts hiérarchiques** : `app/_layout.tsx` (Root) monte `SafeAreaProvider` + `ThemeProvider` + `GestureHandlerRootView` + `RouteGuard` — ne pas dupliquer ces wrappers ailleurs.

### React Native + React 19

- **Hooks** : standard React 19. Pas de `useEffect` qui déclenche un fetch sans cleanup — utiliser `AbortController` ou flag `cancelled` pour les async.
- **`StyleSheet.create({})`** ou inline avec `theme` — **pas** de `styled-components` ni `nativewind` dans ce projet.
- **Pas de logique métier dans les composants** — déléguée à `lib/*` (moteurs purs) et stores Zustand. Composants dumb-as-possible.
- **Animation** : `react-native-reanimated 4.x` impose le plugin Babel (déjà dans `babel.config.js`). Hooks `useSharedValue`/`useAnimatedStyle`, pas `Animated.Value` legacy.
- **Gestures** : `GestureHandlerRootView` monté au Root, accessible partout.
- **SVG** : `react-native-svg` pour les radars (cf. [`AxisRadar.tsx`](../app/src/components/AxisRadar.tsx)) — composant universel partagé entre 5 axes Palais ET 5 axes ADN.

### Zustand stores

- **2 stores** : [`spawter-store.ts`](../app/src/store/spawter-store.ts) (durable, persisté AsyncStorage) + [`onboarding-draft.ts`](../app/src/store/onboarding-draft.ts) (éphémère).
- **Mutations via actions exportées** (`finalizeOnboarding`, `recordConsent`, `registerSpawt`) — pas de `set()` direct depuis un composant.
- **Persistance locale d'abord** : toute écriture met à jour le store + AsyncStorage **avant** sync Supabase. Sync = fire-and-forget (`void saveSpawter(spawter)`) — ne **jamais** `await` Supabase dans une action user-facing.
- **Recompute dérivés côté client** après chaque mutation : `unique_spots = Set(spawts.filter(is_verified).map(place_id)).size`, puis `stade = getStade(unique_spots)` ([`spawter-store.ts:114-133`](../app/src/store/spawter-store.ts#L114-L133)).
- **Sélecteurs spécifiques** dans les composants : `useSpawterStore((s) => s.spawter)` plutôt que `useSpawterStore()` (rerenders).

### Data source adapter (règle d'or)

- **Les écrans ne touchent JAMAIS Supabase directement.** Toujours via [`lib/data-source.ts`](../app/src/lib/data-source.ts).
- L'adapter retourne `{ mode: "supabase" | "fallback", data }` — pas d'exception en bordure, fallback transparent vers les seeds.
- `data-source.supabase.ts` est chargé par **`await import()`** — un import statique casserait le mode démo (binding Supabase au démarrage même sans env vars).
- Détection mode : `isSupabaseConfigured = Boolean(EXPO_PUBLIC_SUPABASE_URL && EXPO_PUBLIC_SUPABASE_ANON_KEY)`.
- En mode démo, [`DataSourceBanner`](../app/src/components/DataSourceBanner.tsx) **doit** rester monté — ne pas le cacher conditionnellement.

### Supabase / PostgREST

- **Pas d'endpoints REST custom** — on consomme directement les tables via le SDK. Les "contrats" sont les shapes de SELECT/upsert.
- **Lecture lieux** : `select("*, place_adn(*)").eq("is_published", true)` → mappé en `PlaceWithAdn`. Filtre `is_published` client-side dans l'adapter ([`data-source.supabase.ts:14`](../app/src/lib/data-source.supabase.ts#L14)) — la RLS serveur doit aussi le faire.
- **Upserts** avec `on_conflict` : `spawters` → `on_conflict=id`, `user_palais` → `on_conflict=spawter_id`.
- **RLS attendu** (à livrer Sprint 1 Phase 0) : `spawter_id = auth.uid()` sur `spawt_checkin`, `user_palais`, `spawters`.
- **Anti-fraude `ANTIFRAUD_RULES`** ([`app/src/types/spawt.ts:81-100`](../app/src/types/spawt.ts#L81-L100)) : duplication client purement **informative**. Les 6 règles sont des **triggers SQL** côté Supabase (Phase 1.3) — ne pas s'y fier côté client seul.
- **Auth OTP non implémenté** — `(onboarding)/phone.tsx` est un stub. Provider attendu : Twilio Verify ou Termii (CIV-friendly), session JWT Supabase Auth.
- **`detectSessionInUrl: false`** — expo-router gère son propre routing, ne pas réactiver cette option.

### i18n (i18next + expo-localization)

- **Toutes les strings UI vivent dans [`app/src/i18n/fr.json`](../app/src/i18n/fr.json)** — accès via `const { t } = useTranslation(); t("scope.key")`.
- Audit bloquant : `npm run i18n:check` détecte toute string FR hardcodée hors `fr.json`.
- Une seule langue active (FR-CI) en V1 — la structure i18next est prête pour multi-langue (Sprint 2+).
- **Pas de pluralisation manuelle** — utiliser les règles i18next.

### Testing Rules

> État Sprint 1 : suites unit en scaffold, E2E **non installé**, validation terrain primordiale (Cahier §5.7-5.8).

#### Outils
- **Unit** : Jest `^29.7` + preset `jest-expo ~55.0` (cf. `app/package.json`). Lancer : `cd app && npm test`.
- **E2E** : pas de framework choisi. Décision Maestro vs Detox **ouverte** — ne pas en ajouter sans validation Stéphanie.
- **Test manuel obligatoire** : matrice 4 devices avant chaque merge.

#### Quoi tester (par ordre de priorité)
1. **Moteurs purs `lib/`** — cible #1 des tests unit :
   - `matching.ts` (`computeRawScore`, `displayedScore`) → contrats PRD §8.1, score affiché ∈ [50, 99].
   - `palais-engine.ts` (`learningFactor`, `updateAxis`, `dominantAxes`, `computeConfidence`) → exponentielles, valeurs `< 0.3` = « En construction ».
   - `chat-voice.ts` → mapping `(stade × moment)` → clé i18n.
2. **Constantes anti-fraude** ([`spawt.ts:81-100`](../app/src/types/spawt.ts#L81-L100)) — gel des invariants `ANTIFRAUD_RULES` (snapshot test recommandé). Toute modification doit casser le test → review obligatoire.
3. **`getStade(uniqueSpots)`** — bornes 11 / 21 / 31 / 51, propriété **« ne recule jamais »** à tester côté store (`registerSpawt` ne peut pas downgrade).
4. **Adapter `data-source.ts`** — comportement fallback quand `EXPO_PUBLIC_SUPABASE_URL` absent : `mode === "fallback"`, data = seeds.

#### Règles d'écriture des tests
- **Pas de mock Supabase global** — l'adapter doit tomber en mode `fallback` naturellement quand les env vars manquent. Les tests unit ne touchent jamais le réseau.
- **Moteurs purs = tests sans I/O** (pas d'AsyncStorage, pas de timer). Si un moteur a besoin d'I/O, c'est qu'il faut le séparer.
- **Tests Zustand stores** : utiliser `act()` autour des actions, vérifier l'état final + l'effet AsyncStorage (mock léger `@react-native-async-storage/async-storage`).
- **Pas de snapshot UI pixel-perfect** — fragile sur RN. Plutôt tester comportement (radar affiche « En construction » quand `confidence < 0.3`).
- **Coverage non imposé** (pas de seuil), focus qualité > quantité.

#### Matrice devices imposée (Cahier §5.7 — Définition de Done)
Test manuel **avant merge** sur les 4 devices :
- 1× Tecno Spark (Android low-end)
- 1× Infinix Hot (Android mid-range)
- 1× Samsung A-series (Android mid-range)
- 1× iPhone récent + 1 modèle ~2 ans

Documentation matrice : `documentation/qa/device_matrix.md` (à créer Phase 0).

#### Budget perf (Cahier §5.7)
- **Time to first feed P95 < 3s** sur 3G simulé + Android mid-range
- **Bundle JS initial < 500 KB gzippé**
- **APK < 50 MB**

#### Alpha terrain (Cahier §5.8 — fin Sprint 1)
- 5 spawters × 1 semaine, focus exclusif fiabilité du Guet
- Métriques : % check-ins déclenchés / GPS médiane / crashs par device / latence notif
- Si KO → pivot manuel (QR code check-in) avant Sprint 2

### Définition de Done — triple sign-off (Cahier §8)

Une feature n'est mergeable sur `main` qu'avec :

1. **[Stéphanie]** Unit + manuel 4 devices + 3G simulé + Sentry vert 48h en alpha
2. **[Kidam]** Events analytics émis + dashboard métrique cible visible + cohorte mesurée
3. **[Alexandre]** Audit verbal (vocab SPAWT) + voix du Chat conforme stade + Test Tantie Rose passé
4. **[Tech Lead]** Code reviewé + migrations réversibles + feature flag opérationnel + i18n extrait
5. **Triple sign-off** explicite des 3 personas avant merge

**Aucun raccourci.** Pas de merge « petite feature, on saute la matrice ».

### Code Quality & Style Rules

#### Design tokens (PRD §15.1, dev guide §5.1)

- **Source unique** : [`app/src/theme/tokens.ts`](../app/src/theme/tokens.ts). Tout autre fichier qui contient un hex `#[0-9A-Fa-f]{3,6}` est un bug brand.
- Accès via `useTheme()` → `theme.colors.brand.primary`, `theme.colors.surface.base`, etc. **Pas** `palette.goldSpawt` direct.
- Toute nouvelle nuance passe par revue **Alexandre** (brand) + **Stéphanie** (contraste WCAG).
- Audit post-merge (Moka Phase 9.3) : `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"` doit ressortir vide.

#### Vocabulaire SPAWT (lint-vocab — bloquant)

Liste canonique source : [`app/scripts/lint-vocab.mjs`](../app/scripts/lint-vocab.mjs) + PRD §19 + persona Moka §4.3.

| Concept | Code (DB / type) | UI / copy | À ne JAMAIS utiliser |
|---|---|---|---|
| Utilisateur final mobile | `spawter` | « spawter », « la Meute » | `user` (sauf `customers`/`customer_id`) |
| Établissement | `place` | « lieu », « spot » | `restaurant`, `business` |
| Action de check-in | `spawt_checkin` | « spawt » | `check_in`, `checkin`, `visit` |
| Évaluation | `review` (technique) | « avis » | `rating`, `feedback` |
| Profil de goût | `palais` | « Palais » | `taste profile`, `preferences` |
| Profil de lieu | `place_adn` | « ADN », « Terroir » | `restaurant profile` |
| 4ème stade | `djidji` | « Djidji » | `expert`, `power user` |
| 5ème stade | `guide` | « Guide » | `expert`, `master` |
| Communauté | `meute` (concept) | « la Meute », « la Tribu » | `community`, `users base` |
| Vote rare | `coup_de_coeur` | « Coup de Cœur » | `like`, `super_like`, `favorite` |
| Mécanisme | `Le Guet` | « Le Guet » | `VTC`, `Uber`, `Bolt` |

**Aucun mot de gamification compétitive** : `leaderboard`, `ranking`, `classement`, `points`, `level up`, `gamif*` sont interdits (Contrat à la Tribu §20.1).

**Exceptions** :
- Type `SpawtCheckin` autorisé (table SQL canonique `spawt_checkin`).
- Table commerciale `customers` / `customer_id` reste autorisée (amendement 4.2 — entité séparée du B2C).
- `user_palais`, `user_signals` = noms de tables historiques figés côté DB.

#### Voix du Chat (PRD §9.3)

- Toute string UI passe par [`chat-voice.ts`](../app/src/lib/chat-voice.ts) si elle représente une voix (notif, onboarding, célébration). Mapping `(stade × moment)` → clé i18n.
- Tonalité évolue avec le stade : `enjoue_taquin` (Touriste) → `complice` (Explorateur) → `grave_respectueux` (Détective) → `solennel` (Djidji) → `rare_sacre` (Guide).
- **Pas de copy générique** type « Welcome » / « Thanks for your review ». Le Chat parle, ou il ne parle pas.
- Pas de célébration de stade type gamification (Duolingo-style). Ton recherché : moment quasi-rituel.

#### Convention de naming / organisation

- **Fichiers TS** : `kebab-case.ts` (`palais-engine.ts`, `data-source.ts`). Composants : `PascalCase.tsx`.
- **Folders** : `src/types/`, `src/lib/`, `src/store/`, `src/components/`, `src/i18n/`, `src/data/seed/`, `src/theme/`. Pas de variantes (`utils/`, `helpers/`, `core/` → interdits).
- **Préfixe `Spawt`** dans les noms de composants techniques : interdit (réservé au métier).
- Constantes UPPER_SNAKE_CASE (`SEED_PLACES`, `ANTIFRAUD_RULES`).
- Types `PascalCase` (`Spawter`, `UserPalais`, `PlaceWithAdn`).

#### Documentation inline

- **Pas de JSDoc verbeux**. Les noms doivent parler.
- **Commentaire = WHY non-évident**, pas WHAT. Mauvais : `// increment counter`. Bon : `// PRD §8.1 : pondération recency = 1 - days/90`.
- **Référence systématique au PRD** pour les invariants : `// PRD §7.1 — Le Guet : geofence 10m + timer 15min`.
- **Pas de TODO sans owner + date** : `// TODO(@spawter, 2026-05-20): wire OTP provider`.

#### Audits automatiques (bloquants en local)

| Audit | Commande | Détecte |
|---|---|---|
| TypeScript | `cd app && npx tsc --noEmit` | erreurs strict |
| Vocab | `cd app && npm run lint:vocab` | mots interdits dans `app/src/**` et `app/app/**` |
| i18n | `cd app && npm run i18n:check` | strings FR hardcodées hors `fr.json` |

**Triple gate** = les 3 en série, dans cet ordre. À lancer **avant chaque commit**, pas seulement avant le push.

#### Format / Lint

- Pas d'ESLint config custom à ce jour. Pas de Prettier config explicite — formatter d'IDE défault.
- **Si ajout d'un linter** : passe par décision team (Stéphanie), pas par initiative unilatérale.

#### Test Tantie Rose (Alexandre)

Avant tout merge front, l'écran passe les 3 questions :
1. *Tantie Rose comprend-elle ?* (lisibilité, non-jargon, langue accessible)
2. *Brice Konan (Pro Établi Cocody) le partagerait-il sans honte ?* (qualité, premium feeling)
3. *Dominic (Jeune Fêtard Yopougon) sent-il qu'il appartient ?* (modernité, vibration locale, nouchi accepté)

Si un seul **non** → retravail.

### Development Workflow Rules

#### Branches & politique main

- **Branche active dev** : `spawt/v1-bmad` (cf. memory). `main` est protégée — pas de push direct.
- **Branche par feature** depuis `spawt/v1-bmad` (pattern `<scope>/<short-desc>`, ex : `auth/otp-twilio`, `feed/scroll-perf`).
- **Pas de merge `main` sans triple sign-off** explicite Stéphanie + Kidam + Alexandre (Cahier §8).
- **Pas de force-push** sur des branches partagées.
- **Pas de `--no-verify`** ni bypass de hook. Si un hook casse, on fixe la cause.

#### Commits — Conventional Commits

Format Moka (cf. persona Moka §5 Phase 7) :

```
<type>(<scope>): <résumé une ligne>

<corps : pourquoi, comment, impacts>

PRD ref: §<numéro>
Sprint 1 feature: <#>
Triple sign-off: <Stéphanie | Kidam | Alexandre>
Verify: <résultats des audits Phase 5>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

**Scopes valides Sprint 1** : `auth`, `onboarding`, `feed`, `place`, `spawt`, `review`, `profile`, `stade`, `favorites`, `search`, `share`, `admin`, `theme`, `i18n`, `analytics`, `infra`, `deps`, `docs`, `vocab`.

**Types** : `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.

#### Staging

- **Stager explicitement** (`git add <file>`), **jamais** `git add -A` / `git add .` (risque secrets, `.env`, binaires).
- Le repo a un dossier `node_modules/` lourd à la racine ET dans `app/` — surtout pas le stager.

#### CHANGELOG.md — règle de Moka

- **Obligatoire** pour tout commit `feat(...)`, `fix` impactant, `refactor` structurel ou `chore` significatif.
- Une entry en tête de [CHANGELOG.md](../CHANGELOG.md), format :
  ```md
  ## v<MAJEURE>.<SPRINT>.<ITERATION> — <Titre court> (YYYY-MM-DD)

  **<Phrase punchy 1 ligne>**

  - `feat(<scope>)` <description>
  - `fix(<scope>)` <description>
  ```
- **Versioning** : MAJEURE = `1` jusqu'au lancement public. SPRINT = numéro de sprint courant. ITERATION incrémente sinon.
- Inclure une section `### Verify` listant les résultats `tsc --noEmit` / `lint:vocab` / `i18n:check`.
- Inclure `### Triple sign-off` quand le commit touche du fonctionnel mergeable.

#### EAS Build profiles ([`app/eas.json`](../app/eas.json))

| Profil | Android | iOS | Usage |
|---|---|---|---|
| `development` | APK + dev client | — | dev interne |
| `preview` | APK | simulator | alpha / QA interne |
| `production` | App Bundle (AAB) | (à compléter) | Play Store / App Store |

- **EAS gratuit** : 30 builds/mois sur plan free.
- Commandes : `npx eas-cli build --profile preview --platform android|ios`.

#### Chemin de livraison canonical Sprint 1 — **Option B : EAS APK Android**

Décidé : la voie principale de livraison alpha est **EAS Build APK Android sideloadable**.

- **Rationale (inféré)** :
  - Cahier §5.7 impose 4 devices Android (Tecno / Infinix / Samsung) — APK natif requis (Expo Go n'autorise pas geoloc background = Le Guet).
  - 100% gratuit (EAS free tier 30 builds/mois, pas de compte Apple Developer 99 $/an).
  - Alpha Cahier §5.8 = 5 spawters, focus fiabilité du Guet → exige geoloc background → exige `.apk` natif.
- **Conséquences pour les agents IA** :
  - Tout nouveau code mobile **doit** rester compatible build `preview` Android (`buildType: apk`).
  - Pas de feature dépendante uniquement de iOS sans fallback Android.
  - Tester les permissions Android (`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` — cf. `app.json`).
  - Les écarts comportementaux OS-tue-app (Tecno/Infinix) sont **prioritaires** — cf. PRD §14.3 + Cahier §5.7.
- **Expo Go (Option A)** reste OK pour démo rapide / scan QR / itération UI, **pas** pour valider Le Guet.
- **iOS `.ipa` (Option C)** = chemin secondaire, déclenché manuellement quand un device iOS doit être inclus dans une session alpha. Aucune dépendance produit V1 ne doit reposer sur iOS-only.

#### Variables d'environnement

- **Préfixe `EXPO_PUBLIC_*`** = **inliné dans le bundle JS** lu par tous les spawters. **Jamais de secret** sous ce préfixe.
- Secrets serveur (`SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `CINETPAY_API_KEY`) → Edge Functions Supabase uniquement, jamais côté mobile.
- `.env` dans `app/` n'est pas commit (vérifier `.gitignore`).
- Variables Expo lues via `Constants.expoConfig?.extra` ou `process.env` (cf. [`supabase.ts`](../app/src/lib/supabase.ts)).

#### CI/CD

- **Aucun pipeline CI actif** à ce jour. Cible : `.github/workflows/mobile-ci.yml` qui lance `tsc --noEmit` + `lint:vocab` + `i18n:check` + `npm test` sur chaque PR (cf. [deployment-guide §4](../docs/deployment-guide.md#4-cicd-à-mettre-en-place)).
- En attendant : la **triple gate locale** est la barrière, à exécuter avant chaque commit.
- EAS Build peut être déclenché via webhook sur merge `main` (à câbler).

#### Hooks & automatismes

- **Pre-commit hook** ciblé : triple gate (à câbler, pas encore actif côté repo).
- **Post-merge audit** (Moka Phase 9) : rescan vocab + tokens + i18n + Contrat. Si drift → commit `chore(<dim>)` direct (séparé des features).

### Critical Don't-Miss Rules

> Les pièges qui font basculer une feature de « techniquement OK » à « rejet brand/qualité/conformité ». Drift garanti si on les rate.

#### Anti-patterns produit (rejet immédiat par Alexandre)

- ❌ **Mécanique compétitive** (leaderboard, ranking, classement, compteur public de Coups de Cœur, badge « top spawter du mois ») → violation Contrat §20.1.
- ❌ **Coup de Cœur traité comme un like** : compteur visible, push « X coups de cœur reçus », inflation. C'est de la **monnaie sociale rare** (PRD §7.3), quota mensuel par stade (Touriste 1 → Guide 3).
- ❌ **Stade célébré en mode Duolingo** (animation gamifiée, confettis, son « ding »). Ton recherché = quasi-rituel.
- ❌ **Copy générique** (« Welcome », « Thanks for your review », « Find a place »). Le Chat parle, ou il ne parle pas.
- ❌ **Influenceur traité comme power user** — Vanessa = canal d'acquisition, pas client cœur (PRD §18.1 décision #6). Statut Ambassadrice séparé du Palais.
- ❌ **Premium positionné comme « gain de fonctionnalités »** — Premium = appartenance + reconnaissance + accès géographique élargi. La fonctionnalité est secondaire.

#### Anti-patterns techniques (rejet par Stéphanie / tech lead)

- ❌ **Toucher Supabase depuis un écran** — passer toujours par [`lib/data-source.ts`](../app/src/lib/data-source.ts). Un import statique de `@supabase/supabase-js` dans un screen casse le mode démo.
- ❌ **`await` sur Supabase dans une action user-facing** — toute écriture est local-first + fire-and-forget (`void saveSpawter(...)`). L'utilisateur ne doit jamais attendre le réseau pour voir son geste pris en compte.
- ❌ **Désactiver `is_published` filter** côté client en mode démo — la RLS serveur doit aussi le faire, mais ne pas s'y fier seule.
- ❌ **Couleur hex en dur** hors `tokens.ts` — bug brand.
- ❌ **String FR hardcodée** hors `fr.json` — bug i18n.
- ❌ **`stade` qui recule** dans un calcul ou une SQL : PRD §5.2 invariant — la maturité ne recule jamais.
- ❌ **`SpawtCheckin` créé sans passer par `registerSpawt` du store** — bypasse le recompute `unique_spots` + `stade`.
- ❌ **Anti-fraude implémentée uniquement côté client** — les 6 règles `ANTIFRAUD_RULES` sont des **triggers SQL** côté Supabase (Phase 1.3). Le client = informatif seulement.
- ❌ **Modifier `ANTIFRAUD_RULES`** ([`spawt.ts:81-100`](../app/src/types/spawt.ts#L81-L100)) sans review tech lead + Stéphanie + Kidam — ce sont des invariants techniques.
- ❌ **Importer du prototype Vite legacy** (`/src/`) dans `app/` sans réécriture — le proto a des stades périmés (Chaton/Chat/Matou) vs canonical (Touriste/Explorateur/...). Lire avant de copier.

#### Edge cases à gérer côté UI

- ✅ **`confidence_score < 0.3`** → afficher **« En construction »** sur le radar Palais ET sur le radar ADN. Anti-mensonge user (Stéphanie). Cf. [`AxisRadar.tsx`](../app/src/components/AxisRadar.tsx) prop `underConstruction`.
- ✅ **ADN avec `total_reviews < 5`** → afficher « ADN en construction » sur la fiche lieu, même si `confidence` calculée est OK. Seed de 3 avis fondateurs (Claude amendment 5.4) compense côté ADN sans gonfler le compteur public (`is_seed: true`).
- ✅ **Mode démo (`dataSourceMode === "fallback"`)** → bandeau jaune `DataSourceBanner` **monté en permanence**, jamais conditionné par « ne pas embêter le user ».
- ✅ **Pas de geoloc** sur un spawt → `is_verified = false`, poids 0.5x (`PASSIVE_CHECKIN_WEIGHT`). Pas de blocage du spawter, juste flag interne.
- ✅ **Onboarding interrompu** (app fermée entre 2 étapes) → `onboarding-draft` est éphémère mais la prochaine ouverture doit reprendre proprement (`RouteGuard` redirige).
- ✅ **`useEffect` async** → toujours `cancelled` flag ou `AbortController` pour éviter les setState après unmount.
- ✅ **Bandeau « Mode démo » + photo manquante** → fallback gracieux (placeholder image, pas crash).

#### Security & privacy

- 🔒 **Aucun secret côté mobile**. Toute variable préfixée `EXPO_PUBLIC_*` est inlinée dans le bundle JS livré au spawter.
- 🔒 **RLS obligatoire** sur `spawt_checkin`, `user_palais`, `spawters` : `spawter_id = auth.uid()`. Pas de table accessible en SELECT * sans RLS.
- 🔒 **PII** (`gender`, `age_range`, `origin_country_code`) → consent ARTCI explicite à la collecte (Claude amendment 5.2, écran [`(onboarding)/consent.tsx`](../app/app/%28onboarding%29/consent.tsx)). Mention dans la politique de confidentialité.
- 🔒 **Géolocalisation** → consent ARTCI / Loi 2013-450 obligatoire, wording explicite : usage spawt uniquement.
- 🔒 **`DELETE /me`** (soft-delete + anonymisation J+30) et export self-service JSON → à livrer avant ouverture beta publique (Cahier §5.2).
- 🔒 **Photos d'avis** (Phase 1.3) → bucket Storage `place-photos`, RLS limite l'écriture au sous-dossier `<spawter_id>/<spawt_id>/`.
- 🔒 **OTP** → provider Twilio Verify ou Termii via Edge Function, jamais OTP custom maison.
- 🔒 **Logs** → pas de `console.log` qui leak des données spawter en prod. Wrapper `__DEV__`.

#### Performance gotchas

- ⚡ **Bundle JS initial < 500 KB gzippé** (Cahier §5.7) — éviter d'embarquer Supabase en statique en mode démo (déjà fait via dynamic import — ne pas casser).
- ⚡ **Time to first feed P95 < 3s** sur 3G + Android mid-range — pas de SELECT massif au boot, paginer si Sprint 2 ajoute du volume.
- ⚡ **APK < 50 MB** — pas d'asset image > 200 KB sans compression. Photos lieux servies depuis CDN (Supabase Storage), pas bundled.
- ⚡ **OS-tue-app sur Tecno / Infinix** (PRD §14.3) — Le Guet en background doit survivre. Identifié comme risque #1 alpha. Tester explicitement.
- ⚡ **Sélecteurs Zustand granulaires** : `useSpawterStore((s) => s.spawter)` plutôt que `useSpawterStore()` (sinon rerender sur tout changement).
- ⚡ **SVG radars** : éviter les rerenders inutiles, mémoiser les paths calculés si la prop `axes` est stable.
- ⚡ **Reanimated** : animations sur le UI thread (`useSharedValue`), pas via `setState` dans une boucle.

#### Drift signals (Moka §7 — auto-correction immédiate)

Si l'un de ces patterns apparaît, c'est un drift à patcher dans le **commit suivant** (pas mélanger avec une feature) :

| Drift | Détection |
|---|---|
| `user` en couche métier (hors `customers`) | `grep -rnE "\buser_id\b\|\bUser\b" app/src/` |
| `restaurant` dans le code | `grep -rni "restaurant" app/src/` |
| `check-in`/`checkin` (hors type `SpawtCheckin`) | `grep -rn "check-in\|checkin" app/src/components app/app` |
| Hex en dur | `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app \| grep -v "tokens.ts"` |
| String FR hors `fr.json` | `npm run i18n:check` |
| Mécanique compétitive | `grep -rniE "leaderboard\|ranking\|classement\|points\|level\s*up\|gamif" app/src/` |

Tous ces audits sont **bloquants en local** via la triple gate.

---

## Décisions historisées — à trancher avant kickoff Sprint 1

> Cahier §10. Historisé ici pour qu'un agent IA ne tranche pas seul et qu'un humain ne croie pas la décision figée.

1. **8 amendements Claude `[pending]`** (Cahier §5.1–5.8) — accepter / modifier / rejeter au cas par cas (events.md, ARTCI, anti-fraude L1, cold start, feature flags, i18n, perf budget, alpha).
2. **`session_duration_minutes`** (Cahier §4.7) — formule proposée : temps réel `now() - checked_in_at` jusqu'à `left_at`. À confirmer tech lead.
3. **Définition « fin de session »** (Cahier §4.7) — proposée : `left_at` = sortie périmètre 10m OU expiration fenêtre +30min, premier survenu. Logout app ne termine **pas** la session. À confirmer tech lead.
4. **Formules KPIs** (Cahier §6) — Engagement / Activation / Rétention à figer avec Madame Sun + Kidam + Tech Lead.
5. **Allocation devices** (Cahier §10.4) — qui possède quoi pour la matrice de test.
6. **Budget consent juridique** (Cahier §10.5) — qui rédige les CGU/CGV conformes droit ivoirien.
7. **Provider analytics** — PostHog vs Mixpanel, décision Kidam + Madame Sun (référencé dans project-overview §8).
8. **Framework E2E mobile** — Maestro vs Detox, décision Stéphanie.
9. **iOS profil `production` EAS** (`eas.json`) — à compléter quand Apple Developer disponible.
10. **OTA Expo Updates** — non configuré, à activer pour push correctifs JS.

> Un agent IA qui rencontre l'un de ces points : **ne tranche pas**, signale-le, propose le déblocage minimal et continue ailleurs.

---

## Liens canoniques

- PRD : `documentation/SPAWT_PRD_V1.docx` (John BMad, 9 avril 2026)
- Cahier Sprint 1 : [`documentation/SPRINT_1_CAHIER_DES_CHARGES.md`](../documentation/SPRINT_1_CAHIER_DES_CHARGES.md)
- Personas : [Stéphanie](../documentation/personas/stephanie.md) · [Kidam](../documentation/personas/kidam.md) · [Alexandre](../documentation/personas/alexandre.md) · [Moka](../documentation/personas/moka.md)
- Analytics events : [`documentation/analytics/events.md`](../documentation/analytics/events.md)
- Docs techniques : [docs/index.md](../docs/index.md)
- Dev guide opérationnel : [`app/README.md`](../app/README.md)
- CHANGELOG : [`CHANGELOG.md`](../CHANGELOG.md)

---

## Usage Guidelines

### Pour les agents IA

- **Lire ce fichier avant toute implémentation** dans `app/`. Pas de raccourci.
- **Suivre toutes les règles exactement** comme documentées — ce ne sont pas des "guidelines", ce sont des invariants.
- **En cas de doute, choisir l'option la plus restrictive** (ex : un nouveau mot suspect → check le glossaire vocabulaire avant de l'utiliser).
- **Triple gate avant chaque commit** : `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check`.
- **Décisions historisées (§ ci-dessus)** : ne pas trancher seul, signaler et continuer ailleurs.
- **Multi-part repo** : `app/` est canonical ; le code à la racine (`/src/`) est le prototype-web figé — ne pas y livrer.
- **Si un pattern nouveau et durable émerge**, le faire remonter pour mise à jour de ce fichier (pas inventer un détour pour le contourner).

### Pour les humains

- Garder ce fichier **lean** et orienté agents IA — pas une doc générale.
- **Mettre à jour quand le stack évolue** (bump SDK Expo, ajout d'une lib, refonte d'un pattern).
- **Revue trimestrielle** (cadre cohérent avec le rythme Sprint BMAD) pour retirer les règles qui sont devenues évidentes, ajouter les pièges nouveaux découverts.
- Pour toute évolution structurelle (refonte d'un moteur, changement d'adapter, etc.), créer un ADR dans `documentation/adr/` plutôt que de l'enfouir ici.
- **Source canonique** des règles brand / vocab / Contrat reste le PRD + les 4 personas — ce fichier en est une projection opérationnelle, pas la source.

---

_Dernière mise à jour : 2026-05-13_



