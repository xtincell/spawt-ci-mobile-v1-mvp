# Story 1.4: Re-dérivation des 4 composants RN existants

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur SPAWT,
I want les 4 composants RN existants (`ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner`) re-dérivés sur les primitives canoniques livrées par Story 1.3 (`CatBubble`, `PalaisRadar`, `MatchScore`, `Stars`, `Chip`, `Ico`),
so that il n'existe plus aucun composant SPAWT en drift visuel par rapport au kit canonique `documentation/ux/midfi-kit.jsx`.

## ⚠️ Brownfield context — wrapper-pattern strategy

Les 4 composants existants ont des **APIs caller stables** (consommées par `app/app/(tabs)/index.tsx`, `app/app/(tabs)/profile.tsx`, `app/app/place/[id].tsx`). La re-dérivation **NE modifie PAS leur signature publique** — elle remplace l'implémentation interne pour déléguer aux primitives canoniques :

- **`ChatBubble`** (composite domain — connaît `Stade`/`ChatMoment`/`chat-voice`) → utilise `CatBubble` primitive en interne pour le rendu visuel.
- **`AxisRadar`** (API bipolaire `[-1, 1]` + `neg/posLabel`) → utilise `PalaisRadar` primitive en interne avec mapping `values[i] = Math.abs(axis.value)` + `labels[i] = axis.value >= 0 ? posLabel : negLabel`.
- **`PlaceCard`** (composite éditorial) → utilise `MatchScore` (au lieu de `Pill` inline pour le score), `Chip` variant `default` (pour distance/rating/price), `Ico walk` (distance).
- **`DataSourceBanner`** → re-skin via `theme.colors.state.warning` (`amberWarm`) + `theme.typography.preset.caption`, **string i18n-migrée** vers `fr.json` sous `common.dataSourceBanner` (drift i18n détecté pendant l'audit).

## Acceptance Criteria

1. **`ChatBubble.tsx` rend via `CatBubble`** : fond noir, coin `16/16/16/4`, `CatIcon` or à gauche, texte en `theme.typography.preset.body` (Gotham-Book 14). Signature publique inchangée (`{ stade, moment, overrideText? }`). _(Décision review 2026-05-16 : `preset.body` uniforme V1 ; un mapping `(stade × moment) → typo` éventuel est reporté à Epic 5 — célébrations de stade.)_
2. **`AxisRadar.tsx` rend via `PalaisRadar`** : 5 axes pentagonal, fill `theme.colors.brand.accent` 18%, labels = pôle dominant par axe (mapping bipolaire→unipolaire documenté dans le code). Signature publique inchangée (`{ axes, size?, color?, underConstruction? }`).
3. **`PlaceCard.tsx` consomme `MatchScore` + `Stars` + `Chip` + `Ico`** : le `${matchScore}%` passe par `MatchScore` (chip vert ≥85), les étoiles via `Stars max={5}`, la distance via `Chip` + `Ico walk`, le prix via `Chip`. Signature publique inchangée.
4. **`DataSourceBanner.tsx` re-skin** : `theme.typography.preset.caption` (Gotham-Medium 11 uppercase), string déplacée dans `fr.json` sous `common.dataSourceBanner`, contraste AA validé sur `state.warning`.
5. **Callers : modifications strictement minimales et non-breaking.** Le wrapper-pattern garde les signatures publiques stables. _(Patch review 2026-05-16 : `(tabs)/profile.tsx:122` et `place/[id].tsx:188` ajoutent une ligne `underConstructionLabel={t("palais.underConstruction")}` pour câbler l'overlay anti-mensonge PRD §8.2 — aucun changement de signature ni de comportement existant.)_
6. **Triple gate** passe, **hex audit** vide, **smoke web** OK.

## Tasks / Subtasks

- [x] **Task 1 — Migrer la string `DataSourceBanner` dans `fr.json`** (AC: 4) — ajout de `common.dataSourceBanner` = `"Mode démo · données locales · Supabase pas encore branché"`.
- [x] **Task 2 — Re-dériver `ChatBubble`** (AC: 1) — wrapper sur `CatBubble` primitive, garde la logique `chatKey`/`isChatSilent`/`overrideText`.
- [x] **Task 3 — Re-dériver `AxisRadar`** (AC: 2) — wrapper sur `PalaisRadar` primitive, mapping bipolaire `[-1, 1]` → unipolaire `[0, 1]` + dominant label.
- [x] **Task 4 — Re-dériver `PlaceCard`** (AC: 3) — interne migré sur `MatchScore`/`Stars`/`Chip`/`Ico`, signature stable.
- [x] **Task 5 — Re-dériver `DataSourceBanner`** (AC: 4) — typo `preset.caption`, string via `t("common.dataSourceBanner")`.
- [x] **Task 6 — Audits + smoke web** (AC: 6) — triple gate, hex audit, `expo export --platform web`.
- [x] **Task 7 — CHANGELOG v1.1.7 + Dev Agent Record + sprint-status `review`**.

## Dev Notes

### Wrapper-pattern : pourquoi pas suppression ?

L'epic dit "ChatBubble devient CatBubble". Lecture stricte = rename + suppression de `ChatBubble.tsx`. Lecture pragmatique = même rendu visuel, API caller stable. La lecture pragmatique évite :
- 8 fichiers callers à modifier (`(tabs)/index.tsx`, `place/[id].tsx`, `(tabs)/profile.tsx`, etc.).
- Perte de la sémantique domain `ChatMoment × Stade` qui vit dans `ChatBubble` (la primitive `CatBubble` n'en sait rien — pure rendu).
- Refactor de `chat-voice.ts` consumers.

Le wrapper-pattern est OK car :
- Le code interne de `ChatBubble` (logique i18n + silent + override) reste là où il a du sens (composite domain).
- Le code visuel délègue à `CatBubble` (primitive canonique).
- Les callers continuent d'importer `ChatBubble` (domain) sans connaître `CatBubble` (primitive). Couplage propre.

Idem pour `AxisRadar` : la sémantique bipolaire `[-1, 1] + negLabel/posLabel` est conservée (consommée par les écrans Palais/ADN), la délégation vers `PalaisRadar` se fait avec mapping documenté.

### Mapping `AxisRadar` bipolaire → `PalaisRadar` unipolaire

- `axes[i].value ∈ [-1, 1]` → `values[i] = Math.abs(axis.value)` (range `[0, 1]`).
- `axes[i].negLabel` / `axes[i].posLabel` → `labels[i] = axis.value >= 0 ? posLabel : negLabel` (pôle dominant).
- Cas `value === 0` → label par défaut `posLabel` (convention : positif = défaut quand balanced).

Cela corrige un drift visuel de l'ancien `AxisRadar` : il faisait `r = ((value + 1) / 2) * radius` (lerp), donc value = -0.8 (strongly negative) rendait un vertex près du centre tout en affichant `negLabel` (contradictoire). Le nouveau mapping est cohérent : |value| = distance, label = pôle.

### Fichiers modifiés

- `app/src/components/ChatBubble.tsx` (UPDATE — body remplacé)
- `app/src/components/AxisRadar.tsx` (UPDATE — body remplacé + mapping doc)
- `app/src/components/PlaceCard.tsx` (UPDATE — Pill inline supprimé, primitives importées)
- `app/src/components/DataSourceBanner.tsx` (UPDATE — typo preset.caption, string i18n)
- `app/src/i18n/fr.json` (UPDATE — `common.dataSourceBanner` ajouté)
- `CHANGELOG.md` (UPDATE — v1.1.7)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE — 1-4 → review)

### References

- [Source: _bmad-output/planning-artifacts/epics.md] (lignes 427-442 — Story 1.4 AC).
- [Source: app/src/components/primitives/*.tsx] (Story 1.3 — primitives canoniques consommées).
- [Source: documentation/ux/midfi-kit.jsx] (référence visuelle canonique).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Triple gate + hex audit + smoke web lancés 2026-05-16 sur `theme/align-canonical-tokens` — tous verts.
- 1 fix i18n détecté pendant l'audit `DataSourceBanner` : la string "Mode démo · …" était hardcodée. Migration vers `fr.json` sous `common.dataSourceBanner` faite dans la même story.

### Completion Notes List

- Wrapper-pattern appliqué sur les 4 composants : APIs publiques inchangées, callers (8 fichiers) NON modifiés.
- `AxisRadar` mapping bipolaire→unipolaire documenté en commentaire dans le fichier (le rendu visuel devient cohérent avec le label dominant).
- `PlaceCard` consomme désormais `MatchScore` (chip vert ≥85), `Stars max=5`, `Chip` variant default (distance/rating/price), `Ico walk` (distance).
- `DataSourceBanner` migré sur `preset.caption` (Gotham-Medium 11 uppercase) + i18n. La string `common.dataSourceBanner` est ajoutée au `fr.json`.
- Périmètre respecté : aucun nouveau composant créé, aucun caller modifié, aucune dépendance ajoutée.

### File List

- `app/src/components/ChatBubble.tsx` (modified)
- `app/src/components/AxisRadar.tsx` (modified)
- `app/src/components/PlaceCard.tsx` (modified)
- `app/src/components/DataSourceBanner.tsx` (modified)
- `app/src/i18n/fr.json` (modified — `common.dataSourceBanner`)
- `CHANGELOG.md` (modified — v1.1.7)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 1-4 → review)
- `_bmad-output/implementation-artifacts/1-4-re-derivation-des-4-composants-rn-existants.md` (new — la story file)

### Review Findings (lot 1.2/1.3/1.4 — 2026-05-16)

> Review adversariale parallèle (Blind Hunter + Edge Case Hunter + Acceptance Auditor) sur le diff `cf4e1be..HEAD`.

**Decision-needed (4)**
- [ ] [Review][Decision] **`ChatBubble` modulation typo `preset.h3` vs `preset.body` selon `moment` (AC #1)** — Story 1.4 AC #1 dit explicitement « `preset.h3` (Klinsman uppercase) OU `preset.body` selon le moment » mais `ChatBubble.tsx:34` utilise toujours `preset.body`. Aucune logique de switch sur `ChatMoment`. **Décision** : (a) définir le mapping `(stade × moment) → typo` ; (b) accepter `preset.body` comme défaut V1 et clarifier AC ; (c) follow-up.
- [ ] [Review][Decision] **Overlay « En construction » muet faute de `underConstructionLabel` côté callers (AC #2 + PRD §8.2 anti-mensonge)** — `profile.tsx:121` et `place/[id].tsx:187` passent `underConstruction={!adnReady}` mais aucun ne passe `underConstructionLabel`. Conséquence : `PalaisRadar` rend uniquement `opacity: 0.4` sans aucun texte. Les écrans affichent déjà un `<Text>` adjacent « ADN en construction » donc le user voit un signal — mais le radar lui-même est muet (intent PRD §8.2 dégradé). **Décision** : (a) ajouter `underConstructionLabel={t("palais.underConstruction")}` dans les 2 callers (rupture AC #5 « aucun caller modifié », mais minimale) ; (b) follow-up dédié ; (c) accepter le signal Text adjacent comme suffisant et marquer le label optionnel.
- [ ] [Review][Decision] **`PlaceCard.Stars value={Math.round(place.rating_display)}` perd la précision** — `4.7` devient 5 étoiles pleines ; `4.2` devient 4 étoiles pleines. L'ancien rendu affichait `★ 4.7` en numérique (Blind, `app/src/components/PlaceCard.tsx:108`). **Décision produit** : (a) garder le round (lecture rapide, 5 étoiles canonique) ; (b) afficher la note numérique en plus des étoiles ; (c) introduire des demi-étoiles.
- [ ] [Review][Decision] **`PlaceCard.Stars` rendu seulement si `adnReady`** — la note (`rating_display`, sourcée Google/seed) est cachée tant que l'ADN (`place_adn`, sourcée spawts) n'est pas prêt. Couple sémantique infondé : un lieu sans ADN garde sa note Google. (Blind, `app/src/components/PlaceCard.tsx:108`). **Décision produit** : (a) montrer toujours la note (sépare rating de l'ADN) ; (b) garder couplé (intent UX d'une "vraie" carte spawt-validée) ; (c) défaut à 0 étoile + chip texte « pas encore évalué ».

**Should-fix**
- [x] [Review][Patch] `AxisRadar.axis.value = NaN` propagé via `Math.abs(NaN) = NaN` à `PalaisRadar.values` → SVG points `"NaN,NaN ..."` (groupé avec patch PalaisRadar côté Story 1.3, mais ici la source est `AxisRadar`) (Edge, `app/src/components/AxisRadar.tsx:43-49`). Fix : garde `Number.isFinite(v) ? Math.abs(v) : 0` côté AxisRadar.
- [x] [Review][Patch] `PlaceCard.distanceKm` négatif/NaN affiché tel quel à l'utilisateur (`"NaN km"`, `"-1.5 km"`) (Edge, `app/src/components/PlaceCard.tsx:112`). Fix : `Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm.toFixed(1) : "—"`.

**Nit**
- [x] [Review][Patch] `PlaceCard.cuisine.length === 0` → affiche `"Treichville · "` avec point centré orphelin (Edge, `app/src/components/PlaceCard.tsx:96`). Fix : `cond ? \` · ${...}\` : ""`.

**Defer**
- [x] [Review][Defer] `PlaceCard.SIGNAL_LABELS[s] ?? s` fallback brut snake_case affiche `coup_de_coeur` brut si nouveau signal backend [`app/src/components/PlaceCard.tsx:130`] — deferred, humaniser via i18n quand set s'agrandit.
- [x] [Review][Defer] AA contraste `state.warning` (`amberWarm #E89A39`) + `text.onBrand` (`black #0A0A0A`) non formellement validé — pairing introduit par re-skin `DataSourceBanner` [`app/src/components/DataSourceBanner.tsx`] — deferred, bookkeeping validation contrast à tracer dans `_bmad-output/planning-artifacts/ux-design-specification.md`.

**Dismissed (faux positifs)**
- ~~Blind Hunter `AxisRadar.underConstruction` perd l'effet quand `color` passé~~ — `PalaisRadar` applique `opacity: 0.4` indépendamment de `fill` ; l'effet visuel reste.
- ~~PS name `KlinsmanTypefaceBold` vs `Klinsman-Bold`~~ — déviation justifiée par Review Findings Story 1.2 (lecture programmatique de la table `name` OpenType).
- ~~AC #2 prop additionnel `underConstructionLabel` brisant « signature inchangée »~~ — additif non-breaking, signature étendue compat ascendante.
- ~~`AxisRadar.value === 0` → `posLabel` par défaut~~ — cohérent ancien comportement, edge cosmetic non documenté ailleurs.

#### Review Triage Summary (Story 1.4)

- 4 decision-needed
- 3 patch (2 should-fix + 1 nit)
- 2 deferred
- 4 dismissed (faux positifs)

### Review Findings — post-review tweaks (2026-05-16)

Annexe couvrant les tweaks non commités de `PlaceCard.tsx`, `seed/places.ts`.

**Patch (4)**

- [ ] [Review][Patch] **`PlaceCard` Image n'a pas de `onError` fallback** [`app/src/components/PlaceCard.tsx:53-58`] — un cover_photo_url cassé (404, offline, blocage proxy) rend un bloc `aspectRatio 16/9` vide. Le placeholder « — » ne se déclenche que pour `cover_photo_url` falsy, pas pour les erreurs réseau. Fix : `onError` handler qui swap vers un placeholder View, ou utiliser `expo-image` avec `placeholder` + cache disk.
- [ ] [Review][Patch] **Seed `places.ts` switche `cover_photo_url: null` → `picsum.photos/seed/...` external URLs** [`app/src/data/seed/places.ts`] — viole l'invariant offline-first (alpha terrain Yamoussoukro). Tous les PlaceCards demandent un round-trip réseau au démo. Fix : (a) restaurer `null` avec placeholder local ; OU (b) bundler localement quelques placeholders dans `app/assets/seed/` et référencer en `require()`.
- [ ] [Review][Patch] **`PlaceCard` ne défensive-gate pas sur `is_published`** [`app/src/components/PlaceCard.tsx:53-71`] — repose entièrement sur le filtre serveur. Un deep link vers un place non publié (ou bug d'adapter) affiche la carte. Fix : `if (!place.is_published) return null` en tête du composant. Project-context invariant : « ne pas se fier seul à la RLS serveur ».
- [ ] [Review][Patch] **`PlaceCard` Pressable `overflow: "hidden"` clip le focus ring d'accessibilité** [`app/src/components/PlaceCard.tsx`] — les indicateurs de focus a11y (Web/TV/keyboard) sont coupés. Fix : retirer `overflow: hidden` du Pressable et le mettre sur un wrapper interne, OU `outlineOffset` négatif.

**Defer (0)** / **Dismissed (0)**

#### Review Triage Summary (Story 1.4 — post-review tweaks)

- 0 decision-needed
- 4 patch (offline-first + a11y + defensive gating)
