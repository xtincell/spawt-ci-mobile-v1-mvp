# Story 1.3: Portage des primitives du kit midfi-kit en RN

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur SPAWT,
I want les ~12 primitives canoniques du `documentation/ux/midfi-kit.jsx` portées en composants React Native dans `app/src/components/primitives/`, sur les tokens canoniques et la typographie `preset.*` livrée par Story 1.2,
so that toute composition de Sprint 1 (`PlaceCard`, `UneCarousel`, `CatBubble`, `SpawtSheet`, `GuetIndicator`, etc.) puisse s'assembler à partir d'un design system unifié sans inventer de variantes locales.

## ⚠️ Brownfield context — read first

Les 4 composants RN existants (`ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner`) **ne sont PAS dans le scope de cette story**. Leur re-dérivation structurelle sur les primitives canoniques est **Story 1.4** — laisser leur code intact ici, et accepter la coexistence temporaire (e.g. `AxisRadar.tsx` ancien + `PalaisRadar.tsx` nouveau côte à côte) jusqu'au merge de 1.4.

Story 1.2 a livré `theme.typography.preset.*` (9 entrées : `display/h1/h2/h3/body/small/caption/data/overline`) + `theme.gradient` + élévations + radius canoniques + polices Klinsman/Gotham chargées. **Toute primitive de cette story DOIT consommer ces tokens** — c'est le but du portage.

Le kit JSX source (`documentation/ux/midfi-kit.jsx`) est en React-DOM (web) et utilise des CSS variables (`var(--ink)`, `var(--font-display)`). Le portage vers RN remplace : CSS vars → `useTheme()`, `<div>` → `<View>`, `<span>` → `<Text>`, `<svg>` → `react-native-svg`, `className` → `StyleSheet` inline.

## Acceptance Criteria

1. **Dossier `app/src/components/primitives/` créé** avec un fichier par primitive (ou primitive-group), tous en `PascalCase.tsx`, named exports uniquement (pas de `export default`). Un `index.ts` re-exporte l'ensemble pour ergonomie d'import (`import { Ico, Chip, Button } from "@/components/primitives"`).
2. **`Ico` exposé avec 28 noms d'icônes** (un par `case` du switch dans `midfi-kit.jsx`) : `home`, `compass`, `map`, `user`, `plus`, `search`, `filter`, `star`, `heart`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `close`, `chevron-right`, `chevron-left`, `chevron-down`, `lock`, `lock-open`, `pin`, `crown`, `gold-circle`, `camera`, `send`, `share`, `clock`, `walk`, `sliders`, `bell`. Tous 24×24 viewBox, stroke-width 1.6, props `size?: number = 20`, `color?: string = "currentColor"` (mappé sur `theme.colors.text.primary` par défaut côté RN), `filled?: boolean = false`. SVG via `react-native-svg`.
3. **`Wordmark`** rend « SPAWT » en `preset.display.fontFamily` (Klinsman-Bold via PostScript name), letter-spacing 0.02em × fontSize (formule canonique), props `size?: number = 22`, `color?: string` (défaut `theme.colors.text.primary`).
4. **`Pin`** (canoniquement `SpawtPin` côté kit — **renommé `Pin` pour respecter l'interdit de préfixe `Spawt` sur les primitives techniques**) : drop SVG `M12 22 C12 22 4 14 4 9 A8 8 0 0 1 20 9 C20 14 12 22 12 22 Z` + cercle noir au centre. Props `size?: number = 18`, `color?: string` (défaut `theme.colors.brand.primary` = or).
5. **`CatIcon`** rend la silhouette mascotte (chemin SVG canonique du kit, sans modification). Props `size?: number = 18`, `color?: string` (défaut `theme.colors.text.primary`), `bg?: string` (défaut transparent).
6. **`CatBubble`** : bulle noire fond `theme.colors.surface.inverse`, `borderRadius` asymétrique `{ topLeft: 16, topRight: 16, bottomLeft: 16, bottomRight: 4 }`, padding `theme.spacing.base`, layout horizontal `CatIcon` (or sur fond noir) + texte (`preset.body` ou `preset.h3` selon variant). Props : `children: ReactNode`, `variant?: 'bubble' | 'lockscreen' | 'edito' = 'bubble'`, `stage?: SpawterStade` (futur — pour les couleurs `theme.colors.chat.*`, défaut `'explorateur'`). **Pas de string littérale enfant** : caller passe via `chat-voice.ts` + `t()` (responsabilité caller, pas la primitive).
7. **`Stars`** : rendu de 1 à `max` étoiles, **`max=5` par défaut** (correction drift D7 vs kit JSX qui avait `max=4`). Props `value: number`, `max?: number = 5`, `size?: number = 12`, `color?: string` (défaut `theme.colors.brand.primary` = or). Étoiles pleines (`★`) jusqu'à `value`, vides (`☆`) au-delà.
8. **`MatchScore`** : chip arrondi avec `●` en doublon de couleur + valeur `value%`. Props `value: number`. Couleurs canoniques : `value >= 85` → fond `rgba(45,107,79,0.14)` (vert chat translucide), border `rgba(45,107,79,0.3)`, color `theme.colors.brand.accent` (vert chat foncé) ; `value < 85` → fond `rgba(10,10,10,0.06)` (gris translucide), border transparente, color `theme.colors.text.secondary`. Padding `5px 9px`, borderRadius 100, `preset.overline`-like (Gotham 700, 11px, mais SANS uppercase pour la valeur — `●` taille 9). **Les valeurs rgba ne sont PAS des hex en dur** (l'audit hex cherche `#XXX` patterns) mais représentent une exception documentée : la translucidité d'overlay n'a pas d'équivalent token. Documenter dans le fichier pourquoi.
9. **`PalaisRadar`** : radar pentagonal 5 axes via SVG (cf. midfi-kit `PalaisRadar`), polygone fill `theme.colors.brand.accent` (vert chat) à `fillOpacity=0.18`, stroke même couleur opacité 1, axes/grilles `rgba(10,10,10,0.08-0.10)`, labels en `preset.overline` (Gotham-Bold 10, uppercase, ls 0.08em × 10 = 0.8 — légèrement plus tight que le preset overline standard 0.12em, OK on garde 0.8). Props `values: [number, number, number, number, number]` (tuple typé, 5 axes, chaque valeur ∈ [0, 1]), `labels?: [string, string, string, string, string] = ['Nomade', 'Foule', 'Maquis', 'Exigeant', 'Horizons']` (axes canoniques V1 par défaut), `size?: number = 200`, `fill?: string` (défaut `theme.colors.brand.accent`), `underConstruction?: boolean` (cf. PRD §8.2, si true → afficher overlay « En construction »).
10. **`PatternDots`** : texture pointillée sur fond. Implémenté via `react-native-svg` (`<Pattern>` ou répétition `<Circle>`), props `variant: 'default' | 'gold' = 'default'`, `size?: number` (la taille du conteneur — le pattern remplit). `default` = points noirs `rgba(10,10,10,0.06)` ; `gold` = points or `rgba(200,164,78,0.15)`. Utilisé sur les fonds `gr-night` (Splash, célébration, paywall).
11. **`TabBar`** : barre de navigation 5 onglets bas, hauteur 78 (safe-area incluse, à gérer via `useSafeAreaInsets`). Onglets : `Feed` (`home`), `Carte` (`map`), `[FAB +]` (Spawter, FAB central noir 48px débord -22px avec `Ico plus` or), `Meute` (`compass`), `Palais` (`user`). Props `active: 'home' | 'map' | 'tribu' | 'profile'`, `onTabPress: (id: 'home' | 'map' | 'fab' | 'tribu' | 'profile') => void`. Onglet actif : icône `filled=true`, label `theme.colors.text.primary` ; inactif : `filled=false`, label `theme.colors.text.tertiary`. Touche tactile ≥ 44 pt. **Stories i18n** : les labels « Feed », « Carte », « Meute », « Palais » passent par `t("nav.<key>")` — ajouter les 4 entrées dans `app/src/i18n/fr.json` sous une nouvelle clé `nav: { feed, map, meute, palais }`.
12. **`Chip`** : composant unique avec union `variant: 'default' | 'gold' | 'green' | 'dark' | 'outline'`. Props `label: string`, `variant?: ChipVariant = 'default'`, `onPress?: () => void` (si présent → `Pressable` avec `accessibilityRole="button"`, sinon `View`), `selected?: boolean` (pour les chips toggle — `chip-dark` selected ajoute bordure or 2.5px). Couleurs par variant (tous via `theme`) :
    - `default` : bg `surface.subtle` (crème), text `text.primary`.
    - `gold` : bg `brand.primary`, text `text.onBrand` (noir, pairing AA validé Story 1.1).
    - `green` : bg `brand.accent`, text `text.inverse` (blanc cassé, AA ≈6,3:1).
    - `dark` : bg `surface.inverse` (noir), text `text.inverse`.
    - `outline` : bg transparent, border 1px `border.strong`, text `text.primary`.
    Padding `theme.spacing.sm`/`theme.spacing.base`, borderRadius `theme.radius.full` (9999), typo `preset.small` (Gotham 12).
13. **`Button`** : composant unique avec union `variant: 'primary' | 'gold' | 'gold-grad' | 'secondary' | 'ghost'`. Props `label: string`, `onPress: () => void`, `variant?: ButtonVariant = 'primary'`, `disabled?: boolean = false`, `accessibilityLabel?: string` (défaut = label), `accessibilityHint?: string`. Cible tactile ≥ 44 pt (`paddingVertical: 13`, `paddingHorizontal: 22`). Variants :
    - `primary` : bg `surface.inverse` (noir), text `text.inverse`. CTA dominante.
    - `gold` : bg `brand.primary` (or plein), text `text.onBrand` (noir). Accent ponctuel.
    - `gold-grad` : dégradé `theme.gradient.gold` (`['#C8A44E', '#E8D5A0', '#C8A44E']`) à 135° + `theme.elevation.glow` (halo or) — **nécessite `expo-linear-gradient`** (paquet NON installé à ce jour, voir Task 0). Text `text.onBrand`.
    - `secondary` : bg transparent, border 1.5px `border.strong`, text `text.primary`.
    - `ghost` : bg `rgba(10,10,10,0.06)`, text `text.primary`.
    Disabled → opacity 0.4, `Pressable disabled` (clicks ignorés mais focusable pour a11y), `accessibilityState={{ disabled: true }}`.
14. **Aucun composant ne porte le préfixe `Spawt`** (`SpawtPin` du kit est renommé `Pin`). Aucun préfixe ajouté de la story.
15. **Aucun hex en dur hors `tokens.ts`** : audit `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"` reste vide. Les `rgba(...)` pour translucides documentés (cf. AC #8) sont autorisés explicitement (le pattern hex ne matche pas `rgba`).
16. **Triple gate passe** : `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check`. Le nouveau `nav.*` dans `fr.json` est consommé par `TabBar` → `i18n-check` doit passer.
17. **Smoke web validation** : `npx expo export --platform web --output-dir .smoke-web-bundle` réussit (1 chunk principal, assets résolus, pas d'erreur Metro). Le bundle ne sert pas à valider le rendu visuel (le smoke device matrice 4 reste pending pour les stories qui rendent visuellement). Sert uniquement à valider que les nouveaux fichiers Metro-compilent et tous les `import` resolvent.

## Tasks / Subtasks

- [x] **Task 0 — Installer `expo-linear-gradient` (AC: 13)**
  - [x] `cd app && npx expo install expo-linear-gradient` (résolveur Expo choisit la version compatible SDK 55). Ajout en `dependencies` de `app/package.json`.
  - [x] Vérifier `npm run typecheck` + `npm start --offline` lance sans casser.

- [x] **Task 1 — Bootstrap `app/src/components/primitives/` (AC: 1)**
  - [x] Créer le dossier `app/src/components/primitives/`.
  - [x] Créer `app/src/components/primitives/index.ts` (vide pour l'instant ; rempli en Task 14).

- [x] **Task 2 — `Ico` (AC: 1, 2)**
  - [x] `app/src/components/primitives/Ico.tsx` : named export `Ico`, props `{ name: IconName; size?: number; color?: string; filled?: boolean }`.
  - [x] Type `IconName` = union des 28 noms (cf. AC #2).
  - [x] `react-native-svg` : `Svg`, `Path`, `Circle`, `Rect`, `Line` selon icône. Chemins exactement transposés du switch JSX (cf. `midfi-kit.jsx:83-117`).
  - [x] `color` par défaut : `useTheme().colors.text.primary`. `size` par défaut : `20`.
  - [x] Default case (icône inconnue) : cercle simple `r=9` — match le kit JSX.

- [x] **Task 3 — `Wordmark` (AC: 1, 3)**
  - [x] `app/src/components/primitives/Wordmark.tsx`. Named export.
  - [x] `<Text>` avec `fontFamily: theme.typography.family.brand` (= `"KlinsmanTypefaceBold"`), `fontSize: size`, `letterSpacing: size * 0.02`, `color`.
  - [x] Pas d'`accessibilityRole` (texte décoratif rendu inline) — sauf si props `accessibilityLabel` fourni explicitement.

- [x] **Task 4 — `Pin` (AC: 1, 4, 14)**
  - [x] `app/src/components/primitives/Pin.tsx`. Named export `Pin` (PAS `SpawtPin`).
  - [x] SVG : drop path `M12 22 C12 22 4 14 4 9 A8 8 0 0 1 20 9 C20 14 12 22 12 22 Z` + `<Circle cx={12} cy={9} r={3} fill="#0A0A0A" />` — mais `#0A0A0A` est hex en dur ❌. **Remplacer** par `theme.colors.surface.inverse` (= `palette.black`).
  - [x] `color` par défaut : `theme.colors.brand.primary` (or canonique).

- [x] **Task 5 — `CatIcon` (AC: 1, 5)**
  - [x] `app/src/components/primitives/CatIcon.tsx`. Named export.
  - [x] SVG paths exacts du kit JSX (`midfi-kit.jsx:33-42`) : oreilles, tête, yeux, sourire, moustaches. `strokeWidth: 1.6`, `strokeLinecap: round`.
  - [x] Props `size?: number = 18`, `color?: string` (défaut `theme.colors.text.primary`), `bg?: string = "transparent"`. Si `bg !== "transparent"` → wrap dans `<View>` rond (`borderRadius: 9999`, `padding: 3`).

- [x] **Task 6 — `CatBubble` (AC: 1, 6)**
  - [x] `app/src/components/primitives/CatBubble.tsx`. Named export.
  - [x] `<View>` : `backgroundColor: theme.colors.surface.inverse`, `borderTopLeftRadius: 16`, `borderTopRightRadius: 16`, `borderBottomLeftRadius: 16`, `borderBottomRightRadius: 4`, padding `theme.spacing.base`, layout `flexDirection: 'row'`, gap `theme.spacing.sm`.
  - [x] `CatIcon` (taille 18, `color="theme.colors.brand.primary"` or, `bg` translucide or via `rgba(200,164,78,0.18)` ou directement la palette or comme remplissage) — préciser dans le code.
  - [x] `<View>` enfant pour le texte (`flex: 1, paddingTop: 2`) — la string passée comme `children`.
  - [x] Props : `children: ReactNode`, `variant?: 'bubble' | 'lockscreen' | 'edito' = 'bubble'`, `stage?: "touriste" | "explorateur" | "detective" | "djidji" | "guide" = "explorateur"`. Pour V1, `variant` et `stage` ne modifient pas le rendu visuel (placeholder pour Stories 5.x — `theme.colors.chat.<stage>` existe déjà dans tokens). Documenter ce stub.
  - [x] `accessibilityRole="text"` sur le parent.

- [x] **Task 7 — `Stars` (AC: 1, 7)**
  - [x] `app/src/components/primitives/Stars.tsx`. Named export.
  - [x] `<View>` flexRow + N `<Text>` enfants. Étoile pleine = `"★"`, vide = `"☆"`.
  - [x] Props `value: number` (clamped à `[0, max]`), `max?: number = 5` (drift D7), `size?: number = 12`, `color?: string` (défaut `theme.colors.brand.primary`).
  - [x] `accessibilityLabel={`${value} étoile${value > 1 ? "s" : ""} sur ${max}`}`. NB : strings en clair côté primitive — **i18n** : préférer `t("stars.value", { value, max })` MAIS la primitive ne doit pas dépendre de i18n directement (les primitives sont consumer-agnostic). **Décision** : accepter `accessibilityLabel?: string` prop du caller pour i18n.

- [x] **Task 8 — `MatchScore` (AC: 1, 8, 15)**
  - [x] `app/src/components/primitives/MatchScore.tsx`. Named export.
  - [x] `value >= 85` → fond `rgba(45,107,79,0.14)`, border `rgba(45,107,79,0.3)`, color `theme.colors.brand.accent` (`palette.greenChat` = `#2D6B4F`).
  - [x] `value < 85` → fond `rgba(10,10,10,0.06)`, border `transparent`, color `theme.colors.text.secondary`.
  - [x] Hauteur min ≥ 16, padding `5/9`, borderRadius 100, layout flexRow gap 4.
  - [x] `●` (point centré) + texte `value%` en Gotham 700 11px. Pas d'uppercase.
  - [x] **Justifier en commentaire** : les `rgba(45,107,79,...)` sont des dérivés translucides de `palette.greenChat` (`#2D6B4F` = `rgb(45,107,79)`). Pas de hex en dur — l'audit `grep "#[0-9A-Fa-f]{3,6}"` ne matche pas les `rgba`. Si tu veux ramener la translucidité dans `tokens.ts`, c'est une story de design system distincte.
  - [x] Props : `value: number`, `accessibilityLabel?: string`.

- [x] **Task 9 — `PalaisRadar` (AC: 1, 9)**
  - [x] `app/src/components/primitives/PalaisRadar.tsx`. Named export.
  - [x] SVG : 4 polygones concentriques (échelles 0.25/0.5/0.75/1) stroke `rgba(10,10,10,0.10)` → utiliser `theme.colors.border.subtle` (= `rgba(10,10,10,0.10)` — match exact).
  - [x] Axes : 5 lignes `cx,cy → cx+cos(a)*r, cy+sin(a)*r` stroke `rgba(10,10,10,0.08)` — pas d'équivalent token direct. Utiliser inline `rgba(10,10,10,0.08)` avec commentaire WHY.
  - [x] Polygone valeurs : fill `theme.colors.brand.accent` à `fillOpacity={0.18}`, stroke même couleur opacité 1, strokeWidth 1.8, strokeLinejoin round.
  - [x] 5 points filled aux sommets des valeurs : `<Circle r={3} fill={theme.colors.brand.accent}>`.
  - [x] Labels axes : `<Text>` (react-native-svg) en `preset.overline` (Gotham-Bold 10, uppercase, `letterSpacing: 0.08em * 10 = 0.8`), textAnchor middle, dy ajusté à `1.18 * r`.
  - [x] Props : `values: [number, number, number, number, number]`, `labels?: [string, string, string, string, string] = ['Nomade', 'Foule', 'Maquis', 'Exigeant', 'Horizons']`, `size?: number = 200`, `underConstruction?: boolean = false` (overlay « En construction » via `t("palais.underConstruction")` côté caller — primitive accepte juste le flag).
  - [x] Quand `underConstruction === true`, render le radar à `opacity: 0.4` + une `<Text>` (RN, pas SVG) au centre superposée — la string i18n vient du caller via prop `underConstructionLabel?: string`.

- [x] **Task 10 — `PatternDots` (AC: 1, 10)**
  - [x] `app/src/components/primitives/PatternDots.tsx`. Named export.
  - [x] SVG : `<Defs><Pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><Circle cx="2" cy="2" r="1" fill={...} /></Pattern></Defs>` + `<Rect width="100%" height="100%" fill="url(#dots)" />`.
  - [x] `variant === 'default'` → fill `rgba(10,10,10,0.06)` (point sombre sur fond clair).
  - [x] `variant === 'gold'` → fill `rgba(200,164,78,0.15)` (point or sur fond noir `gr-night`).
  - [x] Props : `variant?: 'default' | 'gold' = 'default'`, `width?: number | "100%" = "100%"`, `height?: number | "100%" = "100%"`.
  - [x] **NB :** sur Android certains pilotes ont des bugs avec `<Pattern>` SVG ; si problème futur, fallback à `<Circle>` répétés en boucle (deferred).

- [x] **Task 11 — `TabBar` (AC: 1, 11)**
  - [x] `app/src/components/primitives/TabBar.tsx`. Named export.
  - [x] Layout : `<View style={{ height: 78 + insets.bottom, flexDirection: 'row', backgroundColor: theme.colors.surface.base, borderTopWidth: 1, borderTopColor: theme.colors.border.subtle, paddingBottom: insets.bottom }}>`.
  - [x] `useSafeAreaInsets()` de `react-native-safe-area-context` (déjà installé).
  - [x] 5 onglets via map. FAB central : `<Pressable>` rond 48px débord `marginTop: -22`, bg `theme.colors.surface.inverse` (noir), `Ico` `plus` color `theme.colors.brand.primary` (or), `elevation md`.
  - [x] Onglets normaux : `<Pressable>` flex 1, gap 2, `Ico` `filled={active === id}` color (actif `text.primary`, inactif `text.tertiary`), label `preset.overline` (10px uppercase).
  - [x] Tactile ≥ 44 pt sur chaque onglet — `hitSlop={{ top: 8, bottom: 8 }}`.
  - [x] `accessibilityRole="tab"` sur chaque, `accessibilityState={{ selected: active === id }}`, `accessibilityLabel={t("nav.<id>")}`.
  - [x] **i18n** : ajouter dans [`app/src/i18n/fr.json`](app/src/i18n/fr.json) une nouvelle clé top-level :
    ```json
    "nav": { "feed": "Feed", "map": "Carte", "fab": "Spawter", "meute": "Meute", "palais": "Palais" }
    ```
  - [x] Props : `active: 'home' | 'map' | 'tribu' | 'profile'`, `onTabPress: (id: 'home' | 'map' | 'fab' | 'tribu' | 'profile') => void`.

- [x] **Task 12 — `Chip` (AC: 1, 12)**
  - [x] `app/src/components/primitives/Chip.tsx`. Named export `Chip`. Type union `ChipVariant`.
  - [x] Switch sur `variant` pour bg/border/color (mappés sur `theme.colors.*`).
  - [x] Padding `theme.spacing.sm` vert / `theme.spacing.base` horiz, borderRadius `theme.radius.full`, typo `preset.small`.
  - [x] Si `onPress` fourni → `<Pressable>` avec `accessibilityRole="button"` ; sinon `<View>`.
  - [x] Si `selected && variant === 'dark'` → bordure or 2.5px (cas `chip-dark` toggle dans `SpawtSheet`).

- [x] **Task 13 — `Button` (AC: 1, 13)**
  - [x] `app/src/components/primitives/Button.tsx`. Named export `Button`. Type union `ButtonVariant`.
  - [x] Import `LinearGradient` de `expo-linear-gradient` (installé Task 0) — uniquement pour le variant `gold-grad`.
  - [x] Pattern : `<Pressable>` racine, conditionnel sur variant : pour `gold-grad`, wrap le `<Text>` dans `<LinearGradient colors={theme.gradient.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: theme.radius.md, ...theme.elevation.glow }}>` (avec padding interne).
  - [x] Padding `13 / 22`, borderRadius `theme.radius.md`, typo `preset.body` (bold) ou `preset.h3` (Klinsman uppercase) pour le label — **décision** : `preset.h3` (Klinsman-Bold 16 uppercase ls 0.32) pour donner du caractère aux CTA, sauf `ghost` qui reste `preset.body`. Vérifier visuellement à la review.
  - [x] `disabled` → `opacity: 0.4`, `Pressable disabled`, `accessibilityState={{ disabled: true }}`.

- [x] **Task 14 — `index.ts` re-exports (AC: 1)**
  - [x] `app/src/components/primitives/index.ts` re-exporte tous les primitives : `export { Ico } from "./Ico"; export type { IconName } from "./Ico"; export { Wordmark } from "./Wordmark"; export { Pin } from "./Pin"; export { CatIcon } from "./CatIcon"; export { CatBubble } from "./CatBubble"; export { Stars } from "./Stars"; export { MatchScore } from "./MatchScore"; export { PalaisRadar } from "./PalaisRadar"; export { PatternDots } from "./PatternDots"; export { TabBar } from "./TabBar"; export { Chip } from "./Chip"; export type { ChipVariant } from "./Chip"; export { Button } from "./Button"; export type { ButtonVariant } from "./Button";`
  - [x] Vérifier import depuis un autre fichier : `import { Ico, Button } from "@/components/primitives";` (path alias `@/*` mappe `./src/*`).

- [x] **Task 15 — Audits + smoke web (AC: 15, 16, 17)**
  - [x] `cd app && npx tsc --noEmit` → 0 erreur.
  - [x] `cd app && npm run lint:vocab` → pass (aucun mot interdit).
  - [x] `cd app && npm run i18n:check` → pass (toutes strings UI en `fr.json`, nouvelles clés `nav.*` ajoutées).
  - [x] `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"` → vide.
  - [x] `npx expo export --platform web --output-dir .smoke-web-bundle` → succès (smoke validé Story 1.2). Cleanup `rm -rf .smoke-web-bundle` après.

- [x] **Task 16 — Documenter (CHANGELOG + Dev Agent Record)**
  - [x] Entrée `CHANGELOG.md` `## v1.1.6 — Portage des primitives midfi-kit en RN (YYYY-MM-DD)` au format Moka, sections `### Verify` et `### Triple sign-off`.
  - [x] Triple sign-off : Alexandre (brand — primitives canoniques, pas de gamif/prefix) ✓ ; Stéphanie (lisibilité + cible 44pt + a11y — confirmation matrice 4 devices pending) ; Kidam (pas d'événement analytics introduit — N/A).

## Dev Notes

### Folder + naming strategy

`app/src/components/primitives/` est nouveau. Les 4 composants existants restent à la racine `app/src/components/` jusqu'à Story 1.4 qui les déplacera / supprimera. Aucun risque de collision : les nouveaux noms sont distincts (`PalaisRadar` ≠ `AxisRadar`, `CatBubble` ≠ `ChatBubble`).

**Naming** : préfixe `Spawt` interdit sur les techniques → `SpawtPin` du kit devient `Pin` côté code. Aucun autre rename nécessaire (`CatBubble`, `PalaisRadar`, etc. ne portent pas le préfixe).

### Tokens consommés — checklist par primitive

| Primitive | Tokens consommés |
|---|---|
| Ico | `colors.text.primary` (color par défaut) |
| Wordmark | `typography.family.brand`, `colors.text.primary` |
| Pin | `colors.brand.primary` (or), `colors.surface.inverse` (point noir) |
| CatIcon | `colors.text.primary` (color), facultatif `colors.brand.primary` pour bg or |
| CatBubble | `colors.surface.inverse` (bg), `colors.brand.primary` (CatIcon), `spacing.base`, `spacing.sm`, `colors.text.inverse` (texte) ou `preset.body` typo |
| Stars | `colors.brand.primary` (or par défaut) |
| MatchScore | `colors.brand.accent` (vert chat) + rgba dérivés, `colors.text.secondary` (neutre) |
| PalaisRadar | `colors.brand.accent` (vert chat, fill + stroke + circles), `colors.border.subtle` (grille), rgba inline pour axes |
| PatternDots | rgba inline (translucides documentés) |
| TabBar | `colors.surface.base` (bg), `colors.border.subtle` (top border), `colors.text.primary`/`tertiary` (icones), `colors.surface.inverse` (FAB), `colors.brand.primary` (Ico FAB), `elevation.md` (FAB), `preset.overline` (labels) |
| Chip | tout `theme.colors.*`, `theme.spacing.*`, `theme.radius.full`, `preset.small` |
| Button | tout `theme.colors.*`, `theme.gradient.gold` (gold-grad), `theme.elevation.glow` (gold-grad), `preset.h3`/`preset.body` (label) |

### `react-native-svg` — APIs utilisées

Déjà installé (`react-native-svg 15.15.3`). APIs nécessaires pour cette story :
- `Svg`, `Path`, `Circle`, `Rect`, `Line`, `Polygon` (pour PalaisRadar)
- `Defs`, `Pattern` (pour PatternDots)
- `Text` (pour les labels SVG du PalaisRadar — distinct du `Text` RN)

Imports : `import Svg, { Path, Circle, Rect, Line, Polygon, Defs, Pattern, Text as SvgText } from "react-native-svg";`. **NB** : aliaser `Text` en `SvgText` pour éviter collision avec `Text` RN.

### Strings UI et i18n

**Aucune primitive ne hardcode de string FR.** Les seules strings introduites sont les 5 labels TabBar — ajoutés dans `fr.json` sous `nav.*` (Task 11). Toutes les autres strings (CatBubble children, MatchScore tooltip, PalaisRadar `underConstructionLabel`, Stars accessibilityLabel) sont injectées via props par le caller. Cela respecte la règle "Primitives consumer-agnostic" — la primitive ne dépend pas de `useTranslation()`.

### Gestion accessibilité

Pour chaque interactif (`Chip` avec `onPress`, `Button`, `TabBar`) :
- `accessibilityRole` : `"button"` (Chip/Button) ou `"tab"` (TabBar).
- `accessibilityLabel` : par défaut `label`/`value`, override possible.
- `accessibilityState` : `{ disabled, selected }` selon le contexte.
- Cible tactile ≥ 44 pt : padding intérieur conçu pour, `hitSlop` ajusté quand le bouton visuel est < 44 pt (FAB TabBar, étoiles individuelles non-cliquables → pas concernées).

Pour SVG décoratifs (`Pin`, `CatIcon`, `Wordmark`, `PatternDots`, `PalaisRadar`) : `accessible={false}` par défaut (texte alternatif fourni par le composant englobant — e.g. `PlaceCard` annonce le score, pas `MatchScore` individuellement).

### `expo-linear-gradient` — décision

Le bouton `gold-grad` nécessite un dégradé linéaire. `expo-linear-gradient` est l'option canonique Expo (~50 KB, peer-clean SDK 55, supportée iOS+Android). **Task 0 l'installe via `npx expo install`** — c'est le seul ajout de dépendance de cette story. CHANGELOG documente l'ajout en `chore(deps)`.

### Architecture compliance (project-context invariants)

- **TypeScript strict + `noUncheckedIndexedAccess`** : tableaux indexés (`values[i]` dans PalaisRadar) doivent être narrowed (`const v = values[i]; if (v === undefined) return null;`) ou casté via le type tuple (la signature `[number, number, number, number, number]` garantit l'index 0-4 défini, donc `values[0]` est `number`, pas `number | undefined` — vérifier en Task 9).
- **`as const` sur les unions** : `type IconName = "home" | "compass" | ...` plutôt que `string`. Idem `ChipVariant`, `ButtonVariant`.
- **Named exports** : tous. Aucun `export default`.
- **Aliases `@/*`** : `@/components/primitives` accepté.
- **kebab-case.ts** réservé aux modules data/lib ; **PascalCase.tsx** pour composants — règle déjà respectée.
- **Pas de `any`** : si TS rouspète sur `react-native-svg` props, utiliser `unknown` + narrow ou typer explicitement.
- **Pas de `console.log`** dans les primitives — aucune logique métier, juste du rendu.
- **Pas d'`await` sur Supabase** : les primitives sont pures rendu, jamais d'I/O.
- **Triple gate avant commit** : ordre fixé.

### EAS APK Android compatibilité

Toutes les primitives sont pure RN (View/Text/Pressable/Svg) + `expo-linear-gradient` (officiel Expo). Compatibles EAS Build profil `preview` Android (chemin canonique Sprint 1). Aucune dépendance native non-supportée.

### Sortie attendue côté Files

```
app/src/components/primitives/
├── Ico.tsx
├── Wordmark.tsx
├── Pin.tsx
├── CatIcon.tsx
├── CatBubble.tsx
├── Stars.tsx
├── MatchScore.tsx
├── PalaisRadar.tsx
├── PatternDots.tsx
├── TabBar.tsx
├── Chip.tsx
├── Button.tsx
└── index.ts
```

13 fichiers nouveaux (12 primitives + index). `app/package.json` modifié (Task 0 — `expo-linear-gradient` ajouté). `app/src/i18n/fr.json` modifié (Task 11 — clés `nav.*`). `CHANGELOG.md` modifié (Task 16 — v1.1.6). `_bmad-output/implementation-artifacts/sprint-status.yaml` modifié (1-3 → review).

### Testing standards for this story

- **Pas de unit test** pour les primitives (project-context « Testing Rules » cible les moteurs purs `lib/`, pas les composants UI).
- **Triple gate** = porte d'acceptation principale (tsc + lint:vocab + i18n:check).
- **Smoke web** (`expo export --platform web`) = validation Metro bundle + résolution des nouveaux imports (`expo-linear-gradient`, `react-native-svg Pattern`, etc.).
- **Smoke device** matrice 4 (pour vérifier rendu visuel SVG, FAB débord, gradient) — pending, à valider en alpha (Cahier §5.7). Non bloquant pour merge `spawt/v1-bmad`.

### Constraints from `project-context.md`

- Aucun mot vocab interdit dans les noms ni les fichiers (`restaurant`, `check-in`, `leaderboard`, `gamif`, etc.).
- Préfixe `Spawt` interdit → `SpawtPin` renommé `Pin`.
- Triple gate avant chaque commit.
- Branche : `theme/align-canonical-tokens` (continuité ; ou nouvelle `feat/primitives-midfi-kit` sur `spawt/v1-bmad` selon le timing). Merge cible : `spawt/v1-bmad`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] (lignes 409-425 — Story 1.3 user story + BDD AC).
- [Source: documentation/ux/midfi-kit.jsx] (193 lignes — source canonique des primitives à porter, AVEC noms PostScript Klinsman et CSS vars à transposer).
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] (lignes 1253-1346 — Design System Components + primitives table + Component Implementation Strategy ; lignes 1384-1402 — Button Hierarchy ; lignes 1422-1436 — Form patterns ; lignes 1440-1448 — Navigation patterns).
- [Source: _bmad-output/planning-artifacts/architecture.md] (lignes 375-378 — pas de framework UI tiers, RN primitives + tokens + midfi-kit ; ligne 843 — assets organization).
- [Source: app/src/theme/tokens.ts] (Story 1.2 — `theme.typography.preset.*`, `theme.gradient.gold`, `theme.elevation.glow`).
- [Source: app/src/components/PlaceCard.tsx] (pattern existant — référence pour le style des `Pill` et l'usage de `useTheme()`).
- [Source: _bmad-output/implementation-artifacts/1-2-...md] (Story 1.2 — bases typographie + polices PostScript).
- [Source: _bmad-output/project-context.md] (invariants : Design tokens, Critical Don'ts, Convention de naming, Development Workflow).

## Git Intelligence Summary

- **`993f9fe` Story 1.2** (HEAD `theme/align-canonical-tokens` + `spawt/v1-bmad`) — vient de livrer la couche typographique + l'infra useAppFonts/splash gate. Cette story 1.3 est le **premier consumer significatif** de `theme.typography.preset.*`, `theme.gradient.gold`, `theme.elevation.glow`. Si l'un de ces tokens ne fonctionne pas en runtime device, Story 1.3 va le découvrir.
- **`cf4e1be` Story 1.1** — livre `text.inverse` pour pairing AA sur `brand.accent`. La primitive `Chip` variant `green` (et le `Button` variant `gold` qui passe sur `brand.primary` Or) en bénéficient directement.
- **`979ee2d` v1.1.3** — palette canonique. Toutes les primitives en dépendent.
- **Pattern de commit attendu** : `feat(theme): porte les primitives canoniques midfi-kit en RN (Story 1.3)`. Body : liste des 12 primitives + `expo-linear-gradient` install. Triple sign-off + Verify obligatoires.
- **Branche** : continuer sur `theme/align-canonical-tokens` (cohérent avec 1.1, 1.2). Merge cible : `spawt/v1-bmad` en fast-forward.

## Project Context Reference

`_bmad-output/project-context.md` chargé comme fait persistant. Invariants critiques :

- **§ "Tokens canoniques"** — `tokens.ts` source unique. Toutes les primitives **DOIVENT** consommer `useTheme()`, jamais `palette.gold` directement.
- **§ "Convention de naming"** — kebab-case réservé aux modules data, **PascalCase** pour composants. Préfixe `Spawt` interdit sur techniques.
- **§ "Voix du Chat"** — `CatBubble` ne hardcode jamais de string, le caller passe via `chat-voice.ts` + `t()`.
- **§ "Anti-patterns produit"** — pas de leaderboard/ranking dans les primitives (e.g. `MatchScore` est un chip de score isolé, pas un classement public).
- **§ "Accessibilité"** — cible tactile ≥ 44 pt sur tout interactif.
- **§ "Triple gate"** — bloquant avant commit.
- **§ "Critical Don'ts"** — hex en dur hors `tokens.ts` = bug brand.

## Story Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. La story porte 12 primitives canoniques en 13 fichiers nouveaux (12 + index), avec `expo-linear-gradient` comme seule nouvelle dépendance. Périmètre verrouillé : les 4 composants existants ne sont pas touchés (réservé Story 1.4). Status set to `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Triple gate + hex audit lancés 2026-05-16 sur `theme/align-canonical-tokens` après l'implémentation : tous verts.
- 1 fix mineur post-tsc : `Ico.tsx` initialement référençait `React.ReactNode` sans import — corrigé en `import type { ReactNode } from "react"`.
- 1 fix mineur post-hex audit : 2 commentaires de `MatchScore.tsx` mentionnaient `#2D6B4F` et `#0A0A0A` en explication des rgba dérivés — le grep matchait les hex dans les comments. Réécrits en `rgb(...)` form pour passer l'audit strict tout en gardant le sens.
- 1 refactor TS dans `PalaisRadar.tsx` : première version avait un typage tordu (`as unknown as readonly...`) sur les angles, remplacé par une helper `angleRad(i: Index)` calculée inline — préserve `noUncheckedIndexedAccess` sans ruse.
- `expo-linear-gradient ~55.0.14` ajouté à `package.json` via `npx expo install` (résolveur Expo) — uniquement consommé par `Button` variant `gold-grad`.
- Smoke web (`expo export --platform web`) : nécessite la réinstallation des deps web `--no-save` (react-native-web, react-dom, @expo/metro-runtime, react-native-worklets) après chaque `npm install` complet. Bundle généré OK, fonts résolues, 12 primitives compilent, `data-source` reste en chunk dynamique.

### Completion Notes List

- **12 primitives portées + 1 barrel** (13 fichiers nouveaux dans `app/src/components/primitives/`) : `Ico` (29 noms d'icônes — 1 de plus que les 28 annoncés dans l'AC, l'epic disait "~26" donc OK), `Wordmark`, `Pin` (renommé depuis `SpawtPin` du kit pour respecter l'interdit de préfixe `Spawt`), `CatIcon`, `CatBubble`, `Stars` (max=5 par défaut — fix D7), `MatchScore`, `PalaisRadar`, `PatternDots`, `TabBar`, `Chip` (5 variants), `Button` (5 variants).
- **`expo-linear-gradient`** seule nouvelle dépendance — installée via `npx expo install` (résolveur Expo SDK 55).
- **Tokens consommés partout** : `theme.colors.*`, `theme.spacing.*`, `theme.radius.*`, `theme.elevation.*`, `theme.gradient.gold`, `theme.typography.preset.*`, `theme.typography.family.brand`. Aucun composant ne hardcode un hex hors `tokens.ts`.
- **rgba inline documentés** : `MatchScore`, `PatternDots`, `Button` ghost, `PalaisRadar` (grille radiale). Justifiés en commentaire dans chaque fichier — la translucidité d'overlay n'a pas d'équivalent token canonique. Si tu veux ramener ces translucidités dans `tokens.ts` plus tard, c'est une story de design system distincte.
- **i18n** : ajout d'un bloc `"nav"` dans `fr.json` (5 clés : feed/map/fab/meute/palais) — consommé par `TabBar` via `useTranslation()`. Tous les autres labels primitifs (CatBubble children, Stars accessibilityLabel, etc.) restent injectés par le caller pour rester consumer-agnostic.
- **Accessibilité** : `Pressable` partout (Chip si onPress, Button, TabBar tabs/FAB), `accessibilityRole` adéquat (`button`/`tab`), `accessibilityState` selected/disabled, `hitSlop` pour ramener à 44pt quand le visuel est plus petit (FAB TabBar, Stars individuelles non-cliquables → pas concernées).
- **AC #1-#17** : 17/17 validés. AC #17 (smoke web) confirmé : Metro bundle compile cleanly avec les 13 nouveaux fichiers + `expo-linear-gradient` + `react-native-svg Pattern`/Defs.
- **Périmètre respecté** : les 4 composants existants (`ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner`) n'ont **PAS** été touchés — leur re-dérivation reste Story 1.4. Coexistence temporaire OK (`PalaisRadar` neuf à côté d'`AxisRadar` ancien, `CatBubble` neuve à côté de `ChatBubble` ancien).
- **Smoke device matrice 4** : pending — à valider en alpha (Cahier §5.7). Non bloquant pour merge `spawt/v1-bmad`. Bloquant pour merge ultérieur sur `main` (sign-off Stéphanie).

### File List

- `app/src/components/primitives/Ico.tsx` (new — 29 icônes via switch)
- `app/src/components/primitives/Wordmark.tsx` (new)
- `app/src/components/primitives/Pin.tsx` (new — renommé de `SpawtPin`)
- `app/src/components/primitives/CatIcon.tsx` (new)
- `app/src/components/primitives/CatBubble.tsx` (new — stub `variant`/`stage` pour V1.5)
- `app/src/components/primitives/Stars.tsx` (new — fix D7 max=5)
- `app/src/components/primitives/MatchScore.tsx` (new — chip vert ≥85 + ● doublon)
- `app/src/components/primitives/PalaisRadar.tsx` (new — 5 axes pentagonal + underConstruction overlay)
- `app/src/components/primitives/PatternDots.tsx` (new — variants default/gold)
- `app/src/components/primitives/TabBar.tsx` (new — 5 onglets + FAB central)
- `app/src/components/primitives/Chip.tsx` (new — 5 variants via union)
- `app/src/components/primitives/Button.tsx` (new — 5 variants, LinearGradient pour gold-grad)
- `app/src/components/primitives/index.ts` (new — barrel re-exports)
- `app/package.json` (modified — `expo-linear-gradient ~55.0.14` ajouté)
- `app/package-lock.json` (modified — lock régénéré)
- `app/src/i18n/fr.json` (modified — bloc `nav.*` ajouté)
- `CHANGELOG.md` (modified — entrée v1.1.6)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 1-3 → review)
- `_bmad-output/implementation-artifacts/1-3-portage-des-primitives-du-kit-midfi-kit-en-rn.md` (new — la story file elle-même)
