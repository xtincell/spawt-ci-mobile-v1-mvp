# Architecture — `prototype-web` (Vite + React 18)

> Référence visuelle/UX précédant la décision méthode produit (PRD V1). Live à la racine du repo. **Pas la baseline V1** — la cible canonique est `mobile-app`.

---

## 1. Executive Summary

| | |
|---|---|
| **Type de projet** | web (PWA) |
| **Pattern** | SPA + react-router + Context API + localStorage persistance |
| **Build** | Vite 5 + plugin React + plugin PWA (workbox) |
| **Statut** | Figé — référence visuelle, pas d'évolution feature |
| **Vocabulaire** | ⚠️ pré-PRD V1 (`gargote`, `chaton/chat/matou`) — divergence documentée |

---

## 2. Stack

| Catégorie | Choix | Version |
|---|---|---|
| Build | Vite | ^5.4.0 |
| UI | React + ReactDOM | ^18.3.1 |
| Routing | react-router-dom | ^6.22.0 |
| Carte (exploré) | maplibre-gl | ^5.19.0 |
| PWA | vite-plugin-pwa | ^0.20.0 |

Pas de TypeScript, pas de tests, pas de linter.

---

## 3. Pattern

```
   index.html
       │
       ▼
   src/main.jsx  ── ReactDOM.createRoot
       │
       ▼
   App.jsx
   ├── BrowserRouter
   ├── UserProvider          ← state global (localStorage-backed)
   ├── Routes
   │     /            → Home
   │     /discover    → Discover
   │     /spot/:id    → SpotDetail
   │     /profile     → Profile
   │     /onboarding  → Onboarding (gate si !user.onboarded)
   ├── BottomNav
   └── SpawSheet (modal global)
```

L'unique source de vérité d'état est [`UserContext`](../src/context/UserContext.jsx) (Context + `useState` + `useEffect` de persistance). Chaque mutation déclenche `localStorage.setItem("spawt_user", JSON.stringify(user))`.

---

## 4. Data architecture

Cf. [data-models-prototype-web.md](./data-models-prototype-web.md). Tout en `localStorage`, schémas en JS lâche.

Datasets statiques :

| Dataset | Fichier | Contenu |
|---|---|---|
| Lieux | [`src/data/restaurants.js`](../src/data/restaurants.js) | 573 LoC — catalogue Abidjan, schémas ADN |
| Archétypes | [`src/data/archetypes.js`](../src/data/archetypes.js) | 13 archétypes × 5 stades + matcher `findArchetype()` |
| Badges | [`src/data/badges.js`](../src/data/badges.js) | 5 badges + `checkBadges()` |

---

## 5. Composants

Cf. [component-inventory-prototype-web.md](./component-inventory-prototype-web.md).

---

## 6. PWA

[`vite.config.js`](../vite.config.js) — manifest "SPAWT — La carte du bon goût", standalone, portrait, theme `#1A1610`. Workbox cache les assets statiques (JS/CSS/HTML/images/woff2).

---

## 7. Workflow dev

Cf. [development-guide-prototype-web.md](./development-guide-prototype-web.md).

```bash
npm install        # racine
npm run dev        # → http://localhost:5173
npm run build      # → dist/
```

---

## 8. Déploiement

Pas de cible prod. Cf. [deployment-guide.md §5](./deployment-guide.md#5-web-prototype).

---

## 9. Risques

| Risque | Mitigation |
|---|---|
| Ré-injection accidentelle dans la canonical mobile | Documenter divergence (déjà fait — cf. data-models §2) ; lint-vocab côté mobile attrape `restaurant`/`check-in`/`leaderboard` mais **pas** `gargote`/`chaton` |
| Confusion brand (vocab archétypes obsolète) | Le prototype reste hors-prod ; revue brand avant tout port d'archétype vers Sprint 2 |

---

## 10. Liens

- Données : [data-models-prototype-web.md](./data-models-prototype-web.md)
- Composants : [component-inventory-prototype-web.md](./component-inventory-prototype-web.md)
- Dev guide : [development-guide-prototype-web.md](./development-guide-prototype-web.md)
- Cross-part : [integration-architecture.md](./integration-architecture.md)
