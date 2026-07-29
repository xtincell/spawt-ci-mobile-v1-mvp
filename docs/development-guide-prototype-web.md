# Development Guide — `prototype-web` (Vite/React)

> ⚠️ Le prototype est figé en référence visuelle. Pas d'ajout de feature métier (cf. [`data-models-prototype-web.md`](./data-models-prototype-web.md) §6). Garde-le pour : étudier le flux UX, piocher des composants, voir l'inventaire d'archétypes (Sprint 2).

---

## 1. Prérequis

| Outil | Version |
|---|---|
| Node.js | ≥ 18 |
| npm | ≥ 9 |

---

## 2. Setup

```bash
# racine du repo
npm install
```

---

## 3. Scripts npm

| Commande | Effet |
|---|---|
| `npm run dev` | Vite dev server (HMR) → http://localhost:5173 |
| `npm run build` | Build production → `dist/` |
| `npm run preview` | Serve le build local |

Aucun lint / typecheck / test installé sur le prototype (JS pur).

---

## 4. Stack

- **Vite** ^5.4 + `@vitejs/plugin-react`
- **React** 18.3 + `react-router-dom` 6.22
- **maplibre-gl** 5.19 (carte explorée pour V1.5 — non utilisée en MVP mobile)
- **vite-plugin-pwa** 0.20 — manifest SPAWT (theme `#1A1610`, standalone, portrait)

PWA configurable via [`vite.config.js`](../vite.config.js).

---

## 5. Routes

| Path | Composant | Note |
|---|---|---|
| `/` | `pages/Home.jsx` | feed |
| `/discover` | `pages/Discover.jsx` | exploration archétype/carte |
| `/spot/:id` | `pages/SpotDetail.jsx` | fiche lieu |
| `/profile` | `pages/Profile.jsx` | radar Palais + badges + collection titres |
| (toutes) | `pages/Onboarding.jsx` | gate tant que `user.onboarded === false` |

Gate dans [`src/App.jsx:34`](../src/App.jsx#L34).

---

## 6. Bottom-sheet "Spawt"

[`src/components/SpawSheet.jsx`](../src/components/SpawSheet.jsx) — modal global piloté depuis `App.jsx` :

- `setSpawSheetSpotId(spotId)` → preview lieu pré-sélectionné
- `setSpawSheetOpen(true)` → ouvre la sheet
- CTA centré dans `BottomNav` ([`src/components/BottomNav.jsx`](../src/components/BottomNav.jsx))

---

## 7. État (localStorage)

Pas de Redux / Zustand — `useState` dans [`UserContext`](../src/context/UserContext.jsx). Hydratation au mount, persistance via `useEffect` global.

Reset : `resetUser()` (helper dev) — supprime `spawt_user` et `spawt_community_menu`.

---

## 8. Build PWA

```bash
npm run build
npm run preview   # test du SW localement
```

Manifest : `SPAWT — La carte du bon goût` (icons 192/512, theme `#1A1610`, scope racine). Workbox cache : JS/CSS/HTML/images/woff2.

---

## 9. Pourquoi pas d'investissement

- Vocabulaire désynchronisé du PRD V1 (cf. [data-models-prototype-web §2](./data-models-prototype-web.md#divergences-notables-vs-canonical-mobile))
- Pas de typage
- Pas d'audit anti-drift (vocab, i18n)
- Public visé V1 est mobile, pas web

Pour piocher dans le prototype : extraire un composant, le **re-typer** en TS, et le déposer dans `app/src/components/` après audit vocab.
