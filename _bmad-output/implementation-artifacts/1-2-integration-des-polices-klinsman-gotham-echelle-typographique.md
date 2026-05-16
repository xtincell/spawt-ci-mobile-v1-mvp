# Story 1.2: Intégration des polices Klinsman & Gotham + échelle typographique

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur SPAWT,
I want Klinsman (Light/Regular/Bold) + Gotham (Book/Medium/Bold) chargées via `expo-font` et une échelle typographique canonique (`t-display`/`h1`/`h2`/`h3`/`body`/`small`/`caption`/`data`/`overline`) exposée via `useTheme()`,
so that la voix visuelle SPAWT s'applique uniformément sur tous les écrans (titres en Klinsman, corps en Gotham), avec fallback système gracieux et respect de `PixelRatio.getFontScale()`.

## ⚠️ Brownfield context — read first

`app/src/theme/tokens.ts` (réaligné par Story 1.1 / commit `979ee2d`) **déclare déjà** `typography.family.brand = "Klinsman"` et `typography.family.body = "Gotham"` — mais **aucune police n'est chargée** : les 6 fichiers vivent dans `documentation/ux/fonts/` (hors du bundle `app/`) et `expo-font` n'est jamais appelé. Conséquence : sur device, tout `fontFamily: "Klinsman"` retombe en fallback système (San Francisco / Roboto). C'est précisément ce que la story corrige.

12 fichiers consomment déjà `theme.typography.size.*` / `weight.*` (4 composants `src/components/*` + 8 écrans `app/**`). Ils sont **agnostiques de la famille de police actuelle** (ils ne lisent pas `family.*`). Ne pas les modifier dans cette story — leur re-dérivation visuelle est Story 1.4. Cette story ne livre que l'infrastructure typo (chargement + presets) ; l'application des presets aux composants viendra avec Stories 1.3/1.4.

`expo-font ~55.0.6` et `expo-splash-screen ~55.0.19` sont **déjà installés** (`app/package.json`) — pas d'`npm install` à faire.

## Acceptance Criteria

1. **Polices physiquement présentes dans `app/`.** Les 6 fichiers `Klinsman-Light.otf`, `Klinsman-Regular.otf`, `Klinsman-Bold.otf`, `Gotham-Book.ttf`, `Gotham-Medium.ttf`, `Gotham-Bold.ttf` sont copiés (pas déplacés — `documentation/ux/fonts/` reste la source canonique amont) dans **`app/src/theme/fonts/`** et résolus par `require(...)` depuis le code.
2. **Chargement via `expo-font`.** Un hook `useAppFonts()` (`app/src/theme/useAppFonts.ts`) appelle `useFonts({ 'Klinsman-Light': require(...), 'Klinsman-Regular': require(...), 'Klinsman-Bold': require(...), 'Gotham-Book': require(...), 'Gotham-Medium': require(...), 'Gotham-Bold': require(...) })`. Les clés sont les **noms PostScript** (pas le nom de famille seul) — voir Dev Notes "iOS gotcha".
3. **Splash gate.** `app/app/_layout.tsx` appelle `SplashScreen.preventAutoHideAsync()` au montage, attend le retour de `useAppFonts()` (`fontsLoaded === true` OU `fontError !== null` — pas de blocage indéfini), puis appelle `SplashScreen.hideAsync()`. Tant que ni `loaded` ni `error` n'est résolu, le composant racine retourne `null` (l'écran reste sur le splash natif Expo).
4. **Fallback système si une police échoue.** Si `useFonts` retourne `error` (police corrompue, fichier manquant, etc.), l'app démarre quand même : le hook log l'erreur en `__DEV__`, hide le splash, et les composants tombent sur la fallback système RN (`undefined` fontFamily). Aucun crash, aucun écran blanc bloquant.
5. **Échelle typographique exposée via `useTheme()`.** `tokens.ts` ajoute `typography.preset` avec **exactement 9 entrées** mappées canoniquement (`spawt-tokens.css` § Typography, ux-design-spec lignes 901-909) :

   | Clé preset | `fontFamily` | `fontSize` | `lineHeight` | `letterSpacing` | `textTransform` | `fontVariant` |
   |---|---|---|---|---|---|---|
   | `display` | `Klinsman-Bold` | 34 | 34 * 1.05 ≈ 35.7 | -0.34 | — | — |
   | `h1` | `Klinsman-Bold` | 26 | 26 * 1.1 ≈ 28.6 | — | — | — |
   | `h2` | `Klinsman-Bold` | 20 | 20 * 1.15 = 23 | — | — | — |
   | `h3` | `Klinsman-Bold` | 16 | 16 * 1.2 ≈ 19.2 | 0.32 | `'uppercase'` | — |
   | `body` | `Gotham-Book` | 14 | 14 * 1.5 = 21 | — | — | — |
   | `small` | `Gotham-Book` | 12 | 12 * 1.4 ≈ 16.8 | — | — | — |
   | `caption` | `Gotham-Medium` | 11 | 11 * 1.4 ≈ 15.4 | 0.44 | `'uppercase'` | — |
   | `data` | `Gotham-Medium` | 12 | 12 * 1.4 ≈ 16.8 | 0.24 | — | `['tabular-nums']` |
   | `overline` | `Gotham-Bold` | 10 | 10 * 1.4 = 14 | 1.20 | `'uppercase'` | — |

   Chaque entrée est un `TextStyle` RN typé (pas un objet libre). L'objet entier est `as const`. La couleur n'est **PAS** dans le preset (la palette reste un axe orthogonal — un consumer combine `theme.typography.preset.caption` avec `color: theme.colors.text.tertiary`).
6. **`t-body` ≥ 14px ET respecte `PixelRatio.getFontScale()`.** `preset.body.fontSize === 14`. Aucun conteneur de texte dans `tokens.ts` ou `useAppFonts.ts` ne fixe `height`/`maxHeight` ni n'enveloppe le texte d'une hauteur figée. (Les écrans existants utilisent déjà `Text` sans wrapper `height` — ne pas régresser.)
7. **`typography.family` réaligné sur les noms PostScript chargés.** `family.brand` → `"Klinsman-Bold"` (poids dominant du display — tous les `h*` sont Klinsman 700), `family.body` → `"Gotham-Book"`. Les alias `family.voice` (= `"Klinsman"`) et `family.mono` (= `"Gotham"`) sont **supprimés** (voir Dev Notes "Cleanup deferred items") : la voix du Chat est portée par `preset.h*` (le Chat parle en Klinsman), et le tabulaire est porté par `preset.data` (`fontVariant: ['tabular-nums']`). Tout `typography.size.*` et `typography.weight.*` est **préservé tel quel** (12 consumers en dépendent — pas de régression).
8. **`ThemeProvider` expose `typography.preset`.** `useTheme().typography.preset.body` (etc.) est accessible depuis n'importe quel composant. Aucun changement de signature du `Theme` type au-delà de l'ajout de `preset` au sous-objet `typography` (déjà exposé en bloc).
9. **Audits bloquants.** Audit hex (`grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"`) **vide** ; triple gate (`cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check`) **passe**. Aucun nouveau hex, aucun mot du glossaire interdit, aucune string FR hardcodée hors `fr.json` (le hook log d'erreur passe par `console.warn` en `__DEV__` — pas une string UI).
10. **Démarrage validé manuellement.** `cd app && npm start` puis lancer Expo Go (Android et iOS si dispo) : (a) le splash reste visible le temps du chargement, (b) l'app monte sans crash, (c) le texte de `app/app/index.tsx` (splash custom) rend dans une police différente du fallback système — visuellement vérifiable Klinsman sur les titres existants si on attache temporairement `preset.h1` à un Text de l'écran de démo (NB : ne PAS commit cette attache de démo).

## Tasks / Subtasks

- [x] **Task 1 — Copier les fichiers de polices dans `app/` (AC: 1)**
  - [x] Créer `app/src/theme/fonts/`.
  - [x] Copier (pas déplacer) les 6 fichiers de `documentation/ux/fonts/` → `app/src/theme/fonts/` en gardant les noms exacts (`Klinsman-Light.otf`, `Klinsman-Regular.otf`, `Klinsman-Bold.otf`, `Gotham-Book.ttf`, `Gotham-Medium.ttf`, `Gotham-Bold.ttf`). → 1,3 MB total (Klinsman ~1,15 MB, Gotham ~160 KB).
  - [x] Vérifier que `assetBundlePatterns: ["**/*"]` dans `app/app.json` couvre déjà ces assets → oui, ligne 10 d'`app.json`.
  - [x] Vérifier `.gitignore` → `git check-ignore` confirme : NOT IGNORED, les 6 fichiers seront trackés.

- [x] **Task 2 — Implémenter `useAppFonts` (AC: 2, 4)**
  - [x] Créer `app/src/theme/useAppFonts.ts`. Named export `useAppFonts(): AppFontsState` (alias type exporté pour la même shape `{ fontsLoaded, fontError }`).
  - [x] Importer `useFonts` depuis `expo-font` → signature `[loaded: boolean, error: Error | null]`, destructurée en tuple.
  - [x] Appeler `useFonts({ 'Klinsman-Light': require('./fonts/Klinsman-Light.otf'), ... 6 entrées au total })`.
  - [x] En cas de `fontError`, log via `if (__DEV__) console.warn('[fonts] load failed', fontError);` — pas de string i18n.
  - [x] Retourner `{ fontsLoaded, fontError }`. Named export uniquement.

- [x] **Task 3 — Splash gate dans `_layout.tsx` (AC: 3, 4)**
  - [x] Importer `* as SplashScreen` depuis `expo-splash-screen` + `useAppFonts` depuis `../src/theme/useAppFonts`.
  - [x] `void SplashScreen.preventAutoHideAsync().catch(() => {})` au top-level du module (avant `export default`).
  - [x] Dans `RootLayout`, `const { fontsLoaded, fontError } = useAppFonts();` ajouté.
  - [x] `useEffect` qui appelle `void SplashScreen.hideAsync().catch(() => {})` dès que `fontsLoaded || fontError`.
  - [x] Early return `null` si `!fontsLoaded && !fontError`.
  - [x] Aucun nouvel `await` user-facing, `void hydrate()` existant préservé.

- [x] **Task 4 — Ajouter `typography.preset` à `tokens.ts` (AC: 5, 6, 7)**
  - [x] Import `type { TextStyle } from "react-native"` ajouté en tête.
  - [x] `typography.preset` ajouté avec 9 entrées typées via un objet `_preset` annoté `{ display: TextStyle; ... ; overline: TextStyle }` (la typage explicite contextualise les valeurs et évite le piège `readonly tuple` vs `FontVariant[]` que `as const` aurait introduit).
  - [x] `size`/`weight`/`lineHeight` numériques **préservés tels quels** — 12 consumers existants intacts.
  - [x] `family.brand` → `"Klinsman-Bold"`, `family.body` → `"Gotham-Book"`. `family.voice` et `family.mono` **supprimés** (aucun consumer — confirmé par `grep "family\.(voice|mono)" app/` vide).
  - [x] Header commentaire mis à jour : référence à `useAppFonts.ts` + invariant PostScript naming.
  - [x] Type `TypographyPreset = typeof typography.preset` exporté à côté de `Typography`.

- [x] **Task 5 — Exposer `preset` via `ThemeProvider` (AC: 8)**
  - [x] `ThemeProvider.tsx` intact : `themeValue.typography` embarque déjà l'objet `typography` complet importé de `tokens.ts`. `preset` est donc automatiquement exposé via `useTheme().typography.preset` dès qu'il est défini dans `tokens.ts`. Aucun patch nécessaire.
  - [x] `Theme = typeof themeValue` infère bien `preset` — confirmé par `tsc --noEmit` à 0 erreur.

- [x] **Task 6 — Audits & validation manuelle (AC: 9, 10)**
  - [x] `cd app && npx tsc --noEmit` → 0 erreur ✓
  - [x] `cd app && npm run lint:vocab` → ✓ Vocabulaire SPAWT respecté
  - [x] `cd app && npm run i18n:check` → ✓ Aucune string FR hardcodée
  - [x] `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"` → vide ✓
  - [ ] **Smoke device (AC #10) — PENDING** : nécessite Expo Go sur device physique (Android et/ou iOS). Non exécutable par cet agent ; à valider manuellement par Alexandre/Stéphanie avant merge. Voir Completion Notes pour le protocole de test.

- [x] **Task 7 — Documenter (CHANGELOG + Dev Agent Record)**
  - [x] Entrée `CHANGELOG.md` `## v1.1.5 — Polices Klinsman/Gotham + échelle typographique (2026-05-16)` ajoutée en tête, format Moka, sections `### Verify`, `### Triple sign-off`, `### Deferred-work résolus`, `### Résidus / à suivre`.
  - [x] Triple sign-off documenté : Alexandre ✓ (brand canonique) ; Stéphanie pending (matrice 4 devices, non bloquant pour merge `spawt/v1-bmad`) ; Kidam N/A.

### Review Findings

- [x] **[Review][Patch] `useAppFonts.ts:24` `// eslint-disable-next-line no-console` retiré** — aucun ESLint configuré dans le repo (`app/` n'a pas de `.eslintrc*` ; le seul script lint est `lint:vocab`, un grep vocab). Commentaire = dead weight.
- [x] **[Review][Patch] `useAppFonts.ts` export `AppFontsState` retiré** — aucun consumer externe (`_layout.tsx` destructure inline). Surface API minimisée.
- [x] **[Review][Patch] `tokens.ts` `_preset` typage via `satisfies Record<PresetKey, TextStyle>`** — remplace le typage explicite `{ display: TextStyle; ... }` qui widen toutes les valeurs vers `TextStyle`. `satisfies` (TS 4.9+) valide la shape contextuellement et préserve les types littéraux pour les consumers downstream (`theme.typography.preset.body.fontSize` reste `14`, pas `number` widen). Type `PresetKey` ajouté pour le contrat.
- [x] **[Review][Patch] `_layout.tsx:53` `.catch(() => {})` sur `SplashScreen.hideAsync` remplacé par un dev-warn** — aligné sur le pattern d'`useAppFonts` (`if (__DEV__) console.warn(...)`). Les erreurs réelles ne sont plus silenced — seul le bruit Fast Refresh "already prevented" l'est, et uniquement côté `preventAutoHideAsync` module-load.
- [x] **[Review][Patch] `_layout.tsx:46` commentaire rules-of-hooks** — note inline au-dessus des appels de hook pour signaler aux futurs contributeurs que les hooks DOIVENT rester avant le early-return `null`.
- [x] **[Review][Patch] PostScript names alignés sur les valeurs embarquées dans les `.otf`** — la review a soulevé la question PostScript ; vérification programmatique de la table `name` OpenType (nameID=6) effectuée via Python stdlib :
  - **Klinsman-Light.otf** → PS `KlinsmanTypefaceLight` (PAS `Klinsman-Light`)
  - **Klinsman-Regular.otf** → PS `KlinsmanTypefaceRegular`
  - **Klinsman-Bold.otf** → PS `KlinsmanTypefaceBold`
  - **Gotham-Book.ttf** → PS `Gotham-Book` ✓ (matche le nom de fichier)
  - **Gotham-Medium.ttf** → PS `Gotham-Medium` ✓
  - **Gotham-Bold.ttf** → PS `Gotham-Bold` ✓
  Conséquence : clés `useFonts` + `family.brand` + `preset.*.fontFamily` ré-alignés sur les noms PS embarqués. Court-circuite la couche d'alias `expo-font` (qui peut foirer en Fast Refresh / race conditions iOS) et garantit la résolution iOS even sans alias. Aucun coût UI (les consumers passent par `theme.typography.preset.*`, jamais directement par les strings de famille).

#### Review Verify (post-patch, 2026-05-16)
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- Audit hex (`grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v tokens.ts`) : vide ✓

#### Review items deferred — aucun
Tous les findings de la review (5 should-fix + 1 question PostScript) sont addressés dans cette story. Aucun item reporté.

### Review Findings (lot 1.2/1.3/1.4 — 2026-05-16)

> Review adversariale parallèle (Blind Hunter + Edge Case Hunter + Acceptance Auditor) sur le diff `cf4e1be..HEAD`.

- [x] [Review][Patch] `useAppFonts` n'a pas de timeout — police corrompue ou décompression lente sur Tecno Spark/Infinix bloque le splash gate indéfiniment (Edge Case Hunter, `app/src/theme/useAppFonts.ts:1-30`). Fix : `useEffect` qui force `fontsLoaded=true` après ~8s avec dev-warn. **Appliqué 2026-05-16.**
- [x] [Review][Defer] `useAppFonts` log `console.warn` `__DEV__`-only — aucun signal en prod (Sentry pas installé) [`app/src/theme/useAppFonts.ts:21`] — deferred, dépend de l'install Sentry (déjà tracé).
- [x] [Review][Defer] `tokens.ts.lineHeight` fractionnaires (35.7 / 28.6 / 19.2 / 16.8 / 15.4) — Android sub-pixel rounding pourrait diverger d'iOS [`app/src/theme/tokens.ts:115-149`] — deferred, à valider matrice 4 devices alpha.
- [x] [Review][Defer] `tokens.ts.textTransform: "uppercase"` + emoji / caractères non-Latin — `toUpperCase()` JS peut produire artefacts sur signaux (`❤️ Coup de Cœur`) [`app/src/theme/tokens.ts:124, 133, 147`] — deferred, smoke test avec strings réelles signaux/cuisine.
- [x] [Review][Defer] AC #10 smoke device manuel PENDING — tracé CHANGELOG v1.1.5, non bloquant pour merge `spawt/v1-bmad`, bloquant pour `main` — deferred, sign-off Stéphanie matrice 4 devices.
- [x] [Review][Defer] `_layout.tsx` early-return `null` sur web — `expo-splash-screen` no-op, écran blanc bref toléré [`app/app/_layout.tsx:50`] — deferred, audit cible web Sprint 2.

#### Review Triage Summary (Story 1.2)

- 0 decision-needed
- 1 patch (`useAppFonts` timeout)
- 5 deferred
- 0 dismissed pour cette story

## Dev Notes

### iOS gotcha — pourquoi charger par nom PostScript

iOS résout `fontFamily` par **nom PostScript exact** (e.g. `"Klinsman-Bold"`, `"Gotham-Book"`), pas par "nom de famille + poids". RN ne synthétise jamais une graisse manquante à partir d'une famille — si tu charges `"Klinsman"` avec un seul fichier et tu écris `fontFamily: "Klinsman", fontWeight: "700"`, iOS rendra le seul poids disponible quel qu'il soit ; Android tentera une synthèse parfois moche. La seule discipline qui tient sur les deux OS : **une clé `useFonts` par fichier, le nom PostScript en clé, et `fontFamily` pointant directement sur cette clé** (sans `fontWeight`). C'est pour ça que `preset.display` est `{ fontFamily: 'Klinsman-Bold' }` et **pas** `{ fontFamily: 'Klinsman', fontWeight: '700' }`.

Référence : flagged par le code review Story 1.1 (`deferred-work.md` ligne 13 — "Klinsman/Gotham font wiring still incomplete : iOS resolves fontFamily by PostScript name, not family name + weight — RN won't synthesize weights").

### Conversion CSS em → RN px pour `letterSpacing`

CSS exprime `letter-spacing` en `em` (relatif à `font-size`) ; RN attend des pixels. Formule : `letterSpacing_RN = fontSize × em_value`. Valeurs canoniques de `spawt-tokens.css` :

- `t-display` `-0.01em × 34 = -0.34`
- `t-h3` `0.02em × 16 = 0.32`
- `t-caption` `0.04em × 11 = 0.44`
- `t-data` `0.02em × 12 = 0.24`
- `t-overline` `0.12em × 10 = 1.20`

### `lineHeight` : pourquoi un nombre absolu (pas un multiplicateur)

RN `TextStyle.lineHeight` est un nombre absolu en px (unitless multiplier non supporté avant SDK ≥ 0.74 et toujours moins fiable). On pré-calcule depuis le multiplicateur CSS canonique (`1.05`, `1.1`, `1.15`, `1.2`, `1.4`, `1.5`) × `fontSize`. Garder le multiplicateur dans `typography.lineHeight` (déjà présent) pour rétrocompat — c'est ce que `ChatBubble.tsx:40` utilise (`size.base * lineHeight.relaxed`).

### Pourquoi conserver `typography.size` / `weight` / `lineHeight` malgré l'ajout de `preset`

12 fichiers les consomment déjà directement. Les casser pour forcer la migration vers `preset` ferait dériver Story 1.2 hors scope (Story 1.4 = re-dérivation des composants). La cohabitation est explicite : `size`/`weight`/`lineHeight` = couches **bas niveau** (granularité tokens), `preset` = couche **sémantique** (déjà composée, recommandée par défaut). Story 1.4 migrera les consumers vers `preset.*` et **peut alors** retirer `size`/`weight`/`lineHeight`.

### Cleanup deferred items addressed by this story

Du `deferred-work.md` Story 1.1, cette story clôt **deux** items :

- ✅ "Klinsman/Gotham font wiring still incomplete" — résolu par Tasks 1-3 (chargement effectif via `useAppFonts`).
- ✅ "`family.voice == family.brand` redondant ; `family.mono == "Gotham"` proportionnel" — résolu par Task 4 (suppression `family.voice`/`family.mono` ; la voix du Chat passe par `preset.h*` qui pointe sur `Klinsman-Bold` ; le tabulaire passe par `preset.data` + `fontVariant: ['tabular-nums']`).

Les autres items deferred restent deferred (border.subtle / chat.* / elevation.glow / elevation.md.lg / gradient.gold 3-tuple / Story 1.1 commit) — **ne pas les toucher** dans cette story.

### Fichiers que la story touche

- **NEW — `app/src/theme/fonts/`** (6 fichiers copiés de `documentation/ux/fonts/`). Le dossier est tracé git, les fichiers binaires aussi (ils font 30-100 KB chacun, ~350 KB total — sous le radar `APK < 50 MB`).
- **NEW — `app/src/theme/useAppFonts.ts`** (hook `useFonts` + retour typé).
- **UPDATE — `app/src/theme/tokens.ts`** : (a) `family.brand` → `"Klinsman-Bold"`, `family.body` → `"Gotham-Book"` ; (b) suppression `family.voice` + `family.mono` ; (c) ajout `typography.preset` (9 entrées typées `TextStyle`) ; (d) export `TypographyPreset` ; (e) commentaire d'en-tête mis à jour. **Ne pas** toucher `size`/`weight`/`lineHeight`/palette/gradient/radius/elevation/spacing/state — hors scope.
- **UPDATE — `app/app/_layout.tsx`** : ajouter le splash gate (Task 3). Préserver le wiring existant (`SafeAreaProvider`, `ThemeProvider`, `GestureHandlerRootView`, `RouteGuard`, `Stack`). Ne pas casser l'appel `void hydrate()` existant.
- **READ-ONLY référence — `documentation/ux/spawt-tokens.css`** + `_bmad-output/planning-artifacts/ux-design-specification.md` § Typography System (lignes 888-918) — source canonique des valeurs.
- **DO NOT TOUCH — `ThemeProvider.tsx`** (le pattern actuel expose `typography` en bloc — `preset` arrive gratuitement). **DO NOT TOUCH — les 4 composants** (`ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner`). **DO NOT TOUCH — les 8 écrans** (`app/app/**`). Leur migration vers `preset.*` est Story 1.4.

### State actuel des consumers (à ne PAS migrer ici)

Audit `Grep "fontFamily|fontSize|fontWeight|theme\.typography\." app/src app/app` (effectué pendant le scoping) : **12 fichiers**.

- `app/src/components/PlaceCard.tsx` — `size.lg/sm/xs`, `weight.semibold`.
- `app/src/components/ChatBubble.tsx` — `size.base`, `lineHeight.relaxed`.
- `app/src/components/AxisRadar.tsx`, `DataSourceBanner.tsx` — `size.*`.
- `app/app/index.tsx`, `(onboarding)/{consent,phone,profile,calibration}.tsx`, `(tabs)/{index,profile}.tsx`, `place/[id].tsx` — `size.*` / `weight.*`.

Aucun ne lit `family.*` aujourd'hui. Donc renommer `family.brand`/supprimer `family.voice` **n'introduit aucune régression de type ou de runtime** — vérifié par triple gate.

### Pattern Expo SDK 55 — `useFonts` + `SplashScreen`

Pattern canonique (Expo docs SDK 55 — https://docs.expo.dev/develop/user-interface/fonts/) :

```ts
// app/src/theme/useAppFonts.ts
import { useFonts } from 'expo-font';

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    'Klinsman-Light': require('./fonts/Klinsman-Light.otf'),
    'Klinsman-Regular': require('./fonts/Klinsman-Regular.otf'),
    'Klinsman-Bold': require('./fonts/Klinsman-Bold.otf'),
    'Gotham-Book': require('./fonts/Gotham-Book.ttf'),
    'Gotham-Medium': require('./fonts/Gotham-Medium.ttf'),
    'Gotham-Bold': require('./fonts/Gotham-Bold.ttf'),
  });
  if (__DEV__ && fontError) console.warn('[fonts] load failed', fontError);
  return { fontsLoaded, fontError };
}
```

```ts
// app/app/_layout.tsx (extrait — splash gate)
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from '../src/theme/useAppFonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { fontsLoaded, fontError } = useAppFonts();
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  // ... hydrate(), etc.
  if (!fontsLoaded && !fontError) return null;
  return /* l'arborescence existante */;
}
```

`SplashScreen.preventAutoHideAsync()` est idempotent et son `.catch(() => {})` neutralise l'erreur "already hidden" qu'on prend en Fast Refresh — pattern Expo officiel.

### Constraints du `project-context.md` (invariants — pas des guidelines)

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride` → les entrées de `preset` doivent être typées (`TextStyle` import de `react-native`) et l'objet entier `as const`.
- **Pas de `any`.** Si TS rouspète sur `TextStyle['fontVariant']`, importer `TextStyle` strictement, pas `as any`.
- **Named exports only** — le hook `useAppFonts` est named, le `RootLayout` reste `export default function` (contrainte Expo Router file-based).
- **Path aliases** `@/*` (= `./src/*`) et `@app/*` — utiliser les imports relatifs courts depuis `_layout.tsx` (`../src/theme/useAppFonts`) reste OK puisque c'est un cross-directory unique.
- **kebab-case.ts** pour le fichier hook (`useAppFonts.ts` est ambigu — c'est conventionnellement `camelCase` pour les hooks RN, et la base de code `app/src/theme/` accepte les deux : `ThemeProvider.tsx` est `PascalCase`, `tokens.ts` est lowercase). **Décision** : `useAppFonts.ts` (camelCase comme un hook standard React) — aligné avec la convention React/RN universelle. C'est cohérent avec `ThemeProvider.tsx` (composant React = PascalCase) et `tokens.ts` (data module = lowercase) : la règle effective est "le nom suit la nature du module".
- **Préfixe `Spawt` interdit** sur les noms techniques — `useAppFonts` (pas `useSpawtFonts`) ✓.
- **Triple gate avant chaque commit**, ordre fixe : `tsc --noEmit` → `lint:vocab` → `i18n:check`.
- **EAS APK Android** = chemin de livraison canonique Sprint 1 ([project-context § Workflow Rules](../project-context.md#chemin-de-livraison-canonical-sprint-1-option-b--eas-apk-android)). Vérifier que les 6 fichiers de police sont effectivement bundlés via `assetBundlePatterns: ["**/*"]` (déjà OK dans `app.json` — `assetBundlePatterns: ["**/*"]` ligne 10).

### Testing standards for this story

- **Pas de unit test** pour `useAppFonts` (wrapper de hook Expo natif — testé par Expo eux-mêmes ; mocker `expo-font` apporterait zéro valeur).
- **Pas de unit test** pour `typography.preset` (data pure, sans logique — même règle que pour `palette` dans Story 1.1).
- La porte d'acceptation **est** : (a) triple gate verte (AC #9), (b) smoke launch `npm start` (AC #10) sans crash ni écran blanc.
- **Test manuel matrice 4 devices différé** : confirmation Stéphanie du rendu Klinsman/Gotham sur Tecno / Infinix / Samsung / iPhone — non bloquant pour le merge, attendu pendant l'alpha (Cahier §5.7 — Définition de Done). Tracé dans CHANGELOG `### Triple sign-off` comme "pending".

### Performance gotcha — taille des assets

Les 6 fichiers font ~30-100 KB chacun (Klinsman .otf et Gotham .ttf). Total estimé ~300-600 KB d'assets bundlés dans l'APK. C'est **hors** du bundle JS (le budget NFR-PERF-06 `< 500 KB JS gzippé` n'est pas impacté) mais ça compte dans la cible `APK < 50 MB` (Cahier §5.7). Sur 50 MB, 600 KB de polices = 1,2 % du budget — confortable.

### Project Structure Notes

- Partie canonique = `app/` (Expo SDK 55 / RN 0.83 / TS strict). Le prototype Vite à la racine est figé, **jamais touché** pour V1.
- Polices : `app/src/theme/fonts/` est le chemin recommandé par l'architecture (architecture.md ligne 843 — "`app/src/theme/fonts/` (ou `assets/fonts/`)"). Le choix `app/src/theme/fonts/` co-localise les polices avec `tokens.ts` + `ThemeProvider.tsx`, ce qui est le pattern actuel du repo.
- **Branche et merge target** : travail sur `theme/align-canonical-tokens` (branche actuelle, héritée de Story 1.1 — vérifier qu'elle n'a pas été fusionnée entre temps ; sinon partir d'une branche fille `theme/fonts-klinsman-gotham` sur `spawt/v1-bmad`). **Merge cible : `spawt/v1-bmad`**, pas `main` (project-context "Branches & politique main"). `main` exige triple sign-off explicite + accord Stéphanie/Kidam/Alexandre — différé.
- Convention de nommage : `useAppFonts.ts` (hook = camelCase), `tokens.ts` (data = lowercase), `ThemeProvider.tsx` (composant = PascalCase) — convention "nom suit la nature du module" déjà appliquée dans `app/src/theme/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] (lignes 392-407 — Story 1.2 user story + BDD AC).
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] (lignes 888-918 — § Typography System : 2 familles canoniques, table d'échelle, rationale ; ligne 1614 — règle `expo-font` + fallback système).
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] (lignes 1597-1612 — § Implementation Guidelines RN : pas de hauteur figée sur du texte, `PixelRatio.getFontScale()`).
- [Source: _bmad-output/planning-artifacts/architecture.md] (lignes 377-378 — `expo-font` pour Klinsman/Gotham ; ligne 843 — emplacement `app/src/theme/fonts/`).
- [Source: documentation/ux/spawt-tokens.css] (`:root` § Typography — valeurs CSS canoniques de l'échelle, source amont des conversions em→px).
- [Source: _bmad-output/implementation-artifacts/1-1-realignement-des-tokens-canoniques.md] (§ Dev Notes "Current state of `tokens.ts`" — état déjà réaligné par `979ee2d` ; § Review Findings — pairing `brand.accent`/`text.inverse` clos, irrelevant pour cette story).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (ligne 13 — gotcha iOS PostScript ; ligne 13 fin — `family.voice`/`family.mono` redondants).
- [Source: _bmad-output/project-context.md] (§ Code Quality & Style → "Design tokens" et "Convention de naming" ; § Development Workflow Rules → "Branches & politique main", "EAS Build profiles" ; § Critical Don't-Miss Rules).
- [Source: app/src/theme/tokens.ts] (état post-Story 1.1 — `typography.family/size/weight/lineHeight` déjà en place, `family.brand/body` pointent sur des noms non-PostScript à corriger).
- [Source: app/src/theme/ThemeProvider.tsx] (expose `typography` en bloc — `preset` est automatiquement exposé via `useTheme().typography.preset`).
- [Source: app/app/_layout.tsx] (point d'insertion du splash gate ; préserver `RouteGuard` + `void hydrate()` + l'arborescence `Stack`).
- [Source: app/package.json] (`expo-font ~55.0.6`, `expo-splash-screen ~55.0.19` — déjà installés).
- [Source: app/app.json] (ligne 10 — `assetBundlePatterns: ["**/*"]` couvre les polices).
- [Source: CHANGELOG.md] (v1.1.4 / v1.1.3 — format Moka à reproduire pour la prochaine entrée v1.1.5).

## Git Intelligence Summary

- **`979ee2d` `refactor(theme): réaligne tokens.ts sur le brandbook canonique`** (HEAD de `theme/align-canonical-tokens`) — a posé les fondations typo de cette story : `typography.family.brand = "Klinsman"` / `.body = "Gotham"`, `size`/`weight`/`lineHeight` numériques. Cette story 1.2 **complète** le wiring : copie des fichiers, `useFonts`, splash gate, `preset`, alignement PostScript des noms de famille.
- **`be38a73` / `2eed5e2`** — bootstrap Moka iOS, ajout `expo-asset` + `expo-localization`. `expo-font` était déjà inclus dans le bootstrap Expo SDK 55 — pas de manipulation deps requise par cette story.
- **Pattern de commit attendu** (Moka Conventional Commits, cf. project-context § Workflow Rules → "Commits — Conventional Commits") : `feat(theme): intègre Klinsman + Gotham via expo-font + échelle typographique` avec body, `PRD ref: §15.3`, `Sprint 1 feature: FR-031`, `Verify`, `Triple sign-off`. Co-Author Claude Opus 4.7.
- **Branche** : `theme/align-canonical-tokens` reste active (continuité Story 1.1). Vérifier `git status` au démarrage — si Story 1.1 a été merged depuis, créer `theme/fonts-klinsman-gotham` sur `spawt/v1-bmad`.

## Project Context Reference

`_bmad-output/project-context.md` est chargé comme fait persistant pour ce workflow. Les invariants critiques pour cette story :

- **§ "Technology Stack" / "Identité plateforme"** — Expo SDK 55, RN 0.83, iOS-first démo + matrice 4 devices Android, scheme `spawt`. Les polices doivent **fonctionner** sur Tecno Spark / Infinix Hot / Samsung A-series / iPhone récent.
- **§ "Critical Implementation Rules" / TypeScript** — pas d'`any`, `as const` obligatoire sur les exports tokens. `noUncheckedIndexedAccess` → si tu lis `theme.typography.preset['display']` au lieu de `.display`, attention au narrowing.
- **§ "Code Quality & Style Rules" / Design tokens** — `tokens.ts` est la source unique ; tout `fontFamily` autre que via `useTheme()` (i.e. `palette.gold` direct, ou hex en dur) est un bug. Les fontFamilies en string littérale **dans `tokens.ts`** sont OK (c'est leur lieu de naissance — équivalent à `palette.gold`).
- **§ "Convention de naming"** — préfixe `Spawt` interdit sur les noms techniques (donc `useAppFonts`, pas `useSpawtFonts`). Aucun nouveau composant à préfixer ici.
- **§ "Voix du Chat"** — la voix du Chat parle en Klinsman. `preset.h*` matérialise cette voix ; `chat-voice.ts` continuera de mapper `(stade × moment)` → clé i18n + voix, et `CatBubble` (Story 1.4) consommera `preset.h*` pour le rendu.
- **§ "Critical Don't-Miss Rules" / Anti-patterns techniques** — pas de string FR hardcodée hors `fr.json`. Le `console.warn` dev-only du hook n'est **pas** une string UI, donc OK.
- **§ "Définition de Done — triple sign-off"** — confirmation Stéphanie sur la matrice 4 devices est attendue ; tracée pending dans CHANGELOG `### Triple sign-off` mais ne bloque pas le merge sur `spawt/v1-bmad` (elle bloque le merge ultérieur sur `main`).
- **§ "Décisions historisées"** — aucune des 10 décisions historisées n'est ré-ouverte par cette story (la décision typo Klinsman/Gotham est tranchée canonique depuis Story 1.1).

## Story Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. La story livre l'infrastructure typographique en **3 fichiers nouveaux** (6 polices copiées + `useAppFonts.ts` + extension de `tokens.ts`) et **2 fichiers patchés** (`tokens.ts` + `_layout.tsx`). Périmètre verrouillé : pas de migration des 12 consumers vers `preset.*` (Story 1.4), pas de modification de la palette/gradient/radius/elevation (déjà cadré Story 1.1). Deux items du `deferred-work.md` Story 1.1 se ferment ici (Klinsman/Gotham wiring + `family.voice`/`family.mono` redondants). Aucun blocant restant ; status set to `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Triple gate + hex audit lancés 2026-05-16 sur `theme/align-canonical-tokens` après les patches initiaux puis après les patches de review : tous verts dans les deux passes.
- `tsc --noEmit` initialement craint cassé par `as const` + `fontVariant: ["tabular-nums"]` (le `readonly ["tabular-nums"]` ne s'assigne pas à `FontVariant[]` mutable de `TextStyle`). Premier round résolu par typage explicite `_preset: { display: TextStyle; ... }` ; second round (post-review) basculé sur `satisfies Record<PresetKey, TextStyle>` qui valide contextuellement sans flatten — préserve les types littéraux pour les consumers Story 1.4.
- **Vérification PostScript names** (suite à la question soulevée par la review) : Python stdlib script lit la table `name` OpenType (nameID=6) de chaque police. Résultat surprenant : les fichiers `Klinsman-*.otf` embarquent en interne `KlinsmanTypeface{Light,Regular,Bold}` (pas leur nom de fichier). Tous les usages de `fontFamily` (clés `useFonts`, `family.brand`, `preset.*.fontFamily`) ont été ré-alignés sur le PS name embarqué pour court-circuiter la couche d'alias d'`expo-font` et garantir la résolution iOS. Voir Review Findings pour le détail.

### Completion Notes List

- **Périmètre livré exactement comme cadré** : 6 polices copiées, hook `useAppFonts`, splash gate dans `_layout.tsx`, `typography.preset` (9 entrées), `family` réaligné PostScript (`Klinsman-Bold` / `Gotham-Book`), suppression `family.voice`/`family.mono`, type `TypographyPreset` exporté. Aucune modification des 12 consumers existants (`size`/`weight`/`lineHeight` préservés tels quels) — migration vers `preset.*` reportée à Story 1.4 comme prévu.
- **AC #5 — table de presets** : valeurs `lineHeight` et `letterSpacing` pré-calculées depuis `spawt-tokens.css` (CSS em → RN px) ; `textTransform: "uppercase"` sur `h3`/`caption`/`overline` ; `fontVariant: ["tabular-nums"]` sur `data`. Toutes les entrées typées via la signature de `_preset`.
- **AC #6 — `t-body` ≥ 14 + `PixelRatio.getFontScale()`** : `preset.body.fontSize === 14` ; aucun `height`/`maxHeight` figé n'a été introduit sur un conteneur de texte. Les écrans existants restent agnostiques à la taille de police OS — pas de régression.
- **AC #7 — alignement PostScript** : `family.brand: "KlinsmanTypefaceBold"`, `family.body: "Gotham-Book"`. Valeurs ré-alignées sur les noms PostScript **embarqués** dans les fichiers (suite à la review — voir Review Findings) plutôt que les noms de fichiers. `family.voice`/`family.mono` supprimés ; `grep "family\.(voice|mono)" app/` confirme **aucun** consumer.
- **AC #9 — audits** :
  - `npx tsc --noEmit` → 0 erreur ✓
  - `npm run lint:vocab` → ✓ Vocabulaire SPAWT respecté
  - `npm run i18n:check` → ✓ Aucune string FR hardcodée
  - `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"` → vide ✓
- **AC #10 — smoke device PENDING** : non exécuté par cet agent (pas d'accès à Expo Go ni à un device physique depuis l'environnement IDE). Protocole de test à exécuter manuellement avant merge :
  1. `cd app && npm start`, scanner le QR avec Expo Go (Android d'abord — chemin canonique Sprint 1).
  2. Vérifier : (a) splash natif reste visible brièvement le temps du chargement des polices ; (b) `RootLayout` monte sans crash ni écran blanc bloquant ; (c) (optionnel) attacher temporairement `style={theme.typography.preset.h1}` à un `<Text>` de `app/app/index.tsx`, relancer, **voir** Klinsman rendre — puis **retirer** l'attache avant commit.
  3. Si une police échoue à charger (test : renommer temporairement un `.otf`), confirmer que l'app démarre quand même en fallback système — pas de crash, log `[fonts] load failed` visible dans Metro en `__DEV__`.
- **Deferred-work fermés** : (1) « Klinsman/Gotham font wiring still incomplete » ; (2) « `family.voice == family.brand` redondant ; `family.mono == "Gotham"` proportionnel ». Tracés dans `CHANGELOG.md` v1.1.5 § Deferred-work résolus.
- **Branche** : travail réalisé sur `theme/align-canonical-tokens`. Stratégie commit Alexandre : **séparer en 2 commits** — Story 1.1 (`cf4e1be`) puis Story 1.2 par-dessus. Merge cible : **`spawt/v1-bmad`** (fast-forward), pas `main`. Confirmation device smoke (AC #10) pending pour le merge ultérieur sur `main` (Stéphanie + matrice 4 devices).
- **Sign-off Stéphanie sur matrice 4 devices** : tracé pending dans CHANGELOG `### Triple sign-off`. Bloquant uniquement pour le merge ultérieur sur `main`, pas pour `spawt/v1-bmad`.

### File List

- `app/src/theme/fonts/Klinsman-Light.otf` (new — 405 208 octets)
- `app/src/theme/fonts/Klinsman-Regular.otf` (new — 333 748 octets)
- `app/src/theme/fonts/Klinsman-Bold.otf` (new — 405 980 octets)
- `app/src/theme/fonts/Gotham-Book.ttf` (new — 56 676 octets)
- `app/src/theme/fonts/Gotham-Medium.ttf` (new — 55 980 octets)
- `app/src/theme/fonts/Gotham-Bold.ttf` (new — 45 744 octets)
- `app/src/theme/useAppFonts.ts` (new — hook `useFonts` + log dev-only)
- `app/src/theme/tokens.ts` (modified — import `TextStyle`, `typography.preset` 9 entrées, `family` réaligné PostScript, suppression `family.voice`/`family.mono`, export `TypographyPreset`, commentaire d'en-tête)
- `app/app/_layout.tsx` (modified — import `expo-splash-screen` + `useAppFonts`, `preventAutoHideAsync` au module-load, `useAppFonts()` dans `RootLayout`, `useEffect` `hideAsync`, early return `null`)
- `CHANGELOG.md` (modified — entrée `v1.1.5` ajoutée en tête, format Moka)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — `1-2-...` : `backlog` → `ready-for-dev` → `in-progress` → `review`, `last_updated` 2026-05-16)
- `_bmad-output/implementation-artifacts/1-2-integration-des-polices-klinsman-gotham-echelle-typographique.md` (modified — tasks cochées, Status `ready-for-dev` → `review`, Dev Agent Record renseigné)

### Review Findings — post-review tweaks (2026-05-16)

Le code committed de Story 1.2 a été déjà reviewé (cf. cycle précédent). Cette annexe couvre **uniquement les tweaks non commités** de `useAppFonts.ts`, `babel.config.js`, `_layout.tsx` introduits depuis.

**Patch (2)**

- [ ] [Review][Patch] **`useAppFonts` 8s timeout jamais expiré — l'identité de `fontError` est instable entre les renders** [`app/src/theme/useAppFonts.ts:30-45`] — `useEffect` deps `[fontsLoaded, fontError]` re-run car `useFonts` peut retourner un nouvel object identity pour `fontError`. À chaque re-run, le `setTimeout(8s)` est créé, le cleanup tue l'ancien : le timer ne tient jamais 8s. Fix : `[fontsLoaded, !!fontError]` (boolean stable) OU ref qui démarre le timer une seule fois.
- [ ] [Review][Patch] **`babel.config.js` `api.cache.using(() => platform)` — `api.caller(...)` retourne `undefined` pour jest/eslint** [`app/babel.config.js:3-5`] — fallback null + clé de cache `undefined` mélange transforms natif/web/jest dans une seule cache file. Fix : `const platform = api.caller(c => c?.platform) ?? "unknown";` et conditionner les plugins explicitement.

**Defer (1)**

- [x] [Review][Defer] **Web FOUT (flash of unstyled text) après le `_layout.tsx` gate disabled sur web** [`app/app/_layout.tsx:62-66`] — composants montent en fallback Roboto puis re-layout quand Klinsman/Gotham landent. Acceptable pour V1 mobile-first. → Audit cible web Sprint 2 si web devient un canal.

**Dismissed**

- ~~`useAppFonts` référence `__DEV__` non déclaré~~ — globals RN fonctionnent en TS strict.

#### Review Triage Summary (Story 1.2 — post-review tweaks)

- 0 decision-needed
- 2 patch (should-fix infra)
- 1 deferred
- 1 dismissed
