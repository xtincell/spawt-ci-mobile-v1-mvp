# SPAWT — Documentation Index

> Entry point unique pour les agents (LLM ou humains) qui ouvrent ce repo. Généré par `bmad-document-project` le 2026-05-13. Documentation rédigée en français pour s'aligner avec le code, le PRD et la culture produit (config BMM `document_output_language: English` ignoré au profit de la cohérence projet — modifier `_bmad/bmm/config.yaml` et regénérer si besoin).

---

## Project Overview

- **Type** : multi-part repository (2 parts)
- **Primary languages** : TypeScript (mobile, canonical) + JavaScript (prototype web)
- **Architecture** : 2 applications co-hébergées sans communication runtime — voir [integration-architecture.md](./integration-architecture.md)
- **Méthode** : BMAD-METHOD v6.6.0 — branche `spawt/v1-bmad`

📄 **[Project Overview complet →](./project-overview.md)**

---

## Quick reference par partie

### 🔵 mobile-app (canonical V1)

- **Path** : `app/`
- **Stack** : Expo SDK 55 · React Native 0.83 · TypeScript strict · Zustand · AsyncStorage · Supabase (optionnel) · i18next · expo-router
- **Statut** : actif, Sprint 1 Phase 0 quasi-terminée
- **Entry** : [`app/app/_layout.tsx`](../app/app/_layout.tsx) (Root) → [`app/app/index.tsx`](../app/app/index.tsx) (Splash)
- **Démo en 5 min** : `cd app && npx expo start --tunnel` → scan QR avec Expo Go

### ⚪ prototype-web (référence figée)

- **Path** : `/` (racine)
- **Stack** : Vite 5 · React 18 · react-router-dom · localStorage · maplibre-gl · vite-plugin-pwa
- **Statut** : figé — référence visuelle/UX, vocabulaire pré-PRD V1
- **Entry** : [`src/main.jsx`](../src/main.jsx) → [`src/App.jsx`](../src/App.jsx)
- **Lancer** : `npm run dev` à la racine → http://localhost:5173

---

## Generated Documentation

### Vue d'ensemble

- 📄 [Project Overview](./project-overview.md) — résumé exec, snapshot, concepts produit, plan Sprint 1
- 🌳 [Source Tree Analysis](./source-tree-analysis.md) — arborescence annotée des deux parties
- 🔗 [Integration Architecture](./integration-architecture.md) — coexistence des deux apps, points de couplage
- 📊 [project-parts.json](./project-parts.json) — métadonnées machine-readable

### Architecture par partie

- 🔵 [Architecture — mobile-app](./architecture-mobile-app.md)
- ⚪ [Architecture — prototype-web](./architecture-prototype-web.md)

### Data & API

- 🔵 [Data Models — mobile-app](./data-models-mobile-app.md) — entités PRD §13 + amendements team 4.x
- 🔵 [API Contracts — mobile-app](./api-contracts-mobile-app.md) — Supabase PostgREST + auth attendu
- ⚪ [Data Models — prototype-web](./data-models-prototype-web.md) — localStorage + divergences vs canonical

### Composants

- 🔵 [Component Inventory — mobile-app](./component-inventory-mobile-app.md)
- ⚪ [Component Inventory — prototype-web](./component-inventory-prototype-web.md)

### Dev & Ops

- 🔵 [Development Guide — mobile-app](./development-guide-mobile-app.md) — setup, scripts, conventions, triple gate qualité
- ⚪ [Development Guide — prototype-web](./development-guide-prototype-web.md)
- 🚀 [Deployment Guide](./deployment-guide.md) — Expo/EAS, Supabase, env vars, CI/CD à mettre en place

---

## Existing Documentation (amont)

- 📕 [SPAWT_PRD_V1.docx](../documentation/SPAWT_PRD_V1.docx) — **source de vérité produit**, John BMad, 9 avril 2026
- 📋 [SPRINT_1_CAHIER_DES_CHARGES.md](../documentation/SPRINT_1_CAHIER_DES_CHARGES.md) — périmètre Sprint 1 + 7 amendements team + 8 amendements Claude
- 📊 [analytics/events.md](../documentation/analytics/events.md) — taxonomie ~80 events (Claude amendment 5.1)
- 🎭 Personas : [Stéphanie](../documentation/personas/stephanie.md) (qualité) · [Kidam](../documentation/personas/kidam.md) (data) · [Alexandre](../documentation/personas/alexandre.md) (brand) · [Moka](../documentation/personas/moka.md) (opérateur)
- 📜 [CHANGELOG.md](../CHANGELOG.md) — journal Conventional Commits versionné par Sprint
- 📱 [app/README.md](../app/README.md) — guide opérationnel mobile (3 chemins de livraison)

---

## Getting Started — par cas d'usage

| Tu veux... | Fais |
|---|---|
| Démarrer la démo mobile | `cd app && npx expo start --tunnel` puis scan QR avec Expo Go |
| Comprendre la valeur produit | Lis [Project Overview](./project-overview.md) §4 (concepts canoniques) |
| Implémenter une nouvelle feature mobile | 1. PRD V1 + cahier Sprint 1 → 2. [Architecture mobile](./architecture-mobile-app.md) → 3. triple gate `tsc --noEmit && lint:vocab && i18n:check` |
| Lancer une story BMad | Charge `documentation/` + ce dossier `docs/` dans le contexte du brownfield PRD workflow |
| Comprendre un drift entre prototype web et mobile | [Integration Architecture](./integration-architecture.md) + [Data Models prototype-web §2](./data-models-prototype-web.md#divergences-notables-vs-canonical-mobile) |
| Brancher Supabase | [Deployment Guide §2](./deployment-guide.md#2-backend--supabase) + [`app/README.md`](../app/README.md) §Brancher Supabase |

---

## State

État du scan persisté dans [project-scan-report.json](./project-scan-report.json) — utilisé par `bmad-document-project` pour reprendre/raffraîchir.

---

## Brownfield PRD command

Quand tu lances un nouveau PRD/architecture/story BMad, point le workflow vers ce fichier `docs/index.md` comme contexte d'entrée.
