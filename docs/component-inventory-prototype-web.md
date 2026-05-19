# Component Inventory — `prototype-web`

> Composants vivants du prototype Vite. Référence visuelle / UX uniquement (cf. [data-models-prototype-web §6](./data-models-prototype-web.md)).

---

## 1. Composants UI (`src/components/`)

| Composant | Fichier | Rôle | Équivalent mobile |
|---|---|---|---|
| `BottomNav` | [`BottomNav.jsx`](../src/components/BottomNav.jsx) | Tab bar : Home / Discover / Profile + CTA Spawt centré | `(tabs)/_layout.tsx` (mais 2 tabs vs 3+CTA) |
| `SpawSheet` | [`SpawSheet.jsx`](../src/components/SpawSheet.jsx) | Bottom-sheet modal de check-in/avis | À créer Phase 1.3 mobile (Feature 6) |
| `SpotCard` | [`SpotCard.jsx`](../src/components/SpotCard.jsx) | Carte feed lieu | `PlaceCard.tsx` |
| `PalaisRadar` | [`PalaisRadar.jsx`](../src/components/PalaisRadar.jsx) | Radar SVG 5 axes | `AxisRadar.tsx` (mobile = générique Palais ET ADN) |
| `AxisBar` | [`AxisBar.jsx`](../src/components/AxisBar.jsx) | Barre 1D pour 1 axe | (pas porté — mobile utilise radar) |
| `ChatBubble` | [`ChatBubble.jsx`](../src/components/ChatBubble.jsx) | Voix du Chat | `ChatBubble.tsx` (mobile = i18n strict) |
| `BadgeGrid` | [`BadgeGrid.jsx`](../src/components/BadgeGrid.jsx) | Grille de badges acquis | Reportée V1.5 (Feature 18) |
| `CatSilhouette` | [`CatSilhouette.jsx`](../src/components/CatSilhouette.jsx) | Illustration mascotte | (asset à intégrer mobile selon brand) |

---

## 2. Pages (`src/pages/`)

| Page | Fichier | Équivalent / scope mobile |
|---|---|---|
| `Onboarding` | [`Onboarding.jsx`](../src/pages/Onboarding.jsx) | Réécrit en flow 4 étapes côté mobile (`consent / phone / profile / calibration`) |
| `Home` | [`Home.jsx`](../src/pages/Home.jsx) | `(tabs)/index.tsx` (feed) |
| `Discover` | [`Discover.jsx`](../src/pages/Discover.jsx) | Hors scope V1 — reporté (Feature 11 carte) |
| `SpotDetail` | [`SpotDetail.jsx`](../src/pages/SpotDetail.jsx) | `place/[id].tsx` |
| `Profile` | [`Profile.jsx`](../src/pages/Profile.jsx) | `(tabs)/profile.tsx` (radar Palais ; collection titres + badges reportés V1.5) |

---

## 3. Notes pour réutilisation

Si tu veux porter un composant prototype → mobile :

1. **Re-typer** en TS strict (pas de prop implicite).
2. **Remplacer** `useUser()` par `useSpawterStore()` (Zustand).
3. **Remplacer** les couleurs en dur par `useTheme().colors.*` (lint-vocab + manual review).
4. **Extraire** les strings vers `app/src/i18n/fr.json`.
5. **Vérifier** le vocabulaire SPAWT — le prototype contient `gargote`, `chaton/chat/matou` (axes/stades) qui ne sont **pas** la canonical PRD V1.
6. Faire passer la triple gate : `tsc --noEmit && lint:vocab && i18n:check`.

---

## 4. Hors scope

- Pas d'inventory composant à étoffer ici — le prototype est figé.
- Toute évolution UI nouvelle se fait dans `app/src/components/`.
