# Story 1.4: Re-dérivation des 4 composants RN existants

Status: review

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

1. **`ChatBubble.tsx` rend via `CatBubble`** : fond noir, coin `16/16/16/4`, `CatIcon` or à gauche, texte en `theme.typography.preset.h3` (Klinsman uppercase) ou `preset.body` selon le moment. Signature publique inchangée (`{ stade, moment, overrideText? }`).
2. **`AxisRadar.tsx` rend via `PalaisRadar`** : 5 axes pentagonal, fill `theme.colors.brand.accent` 18%, labels = pôle dominant par axe (mapping bipolaire→unipolaire documenté dans le code). Signature publique inchangée (`{ axes, size?, color?, underConstruction? }`).
3. **`PlaceCard.tsx` consomme `MatchScore` + `Stars` + `Chip` + `Ico`** : le `${matchScore}%` passe par `MatchScore` (chip vert ≥85), les étoiles via `Stars max={5}`, la distance via `Chip` + `Ico walk`, le prix via `Chip`. Signature publique inchangée.
4. **`DataSourceBanner.tsx` re-skin** : `theme.typography.preset.caption` (Gotham-Medium 11 uppercase), string déplacée dans `fr.json` sous `common.dataSourceBanner`, contraste AA validé sur `state.warning`.
5. **Aucun caller modifié** sauf si strictement nécessaire (théoriquement aucun, vu le wrapper-pattern).
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
