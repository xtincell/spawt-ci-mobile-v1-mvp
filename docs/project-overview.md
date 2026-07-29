# SPAWT — Project Overview

> SPAWT est une app de découverte culinaire à Abidjan (Côte d'Ivoire). Mécanisme central : **Le Guet** — le Chat fait le guet quand tu approches d'un lieu, patiente pendant que tu manges, te demande ton avis à la sortie. Pas de check-in déclaratif, pas de leaderboard.
>
> Repository multi-part : un prototype Vite (référence visuelle, figé) à la racine, et l'app Expo mobile canonique dans `app/`.

---

## 1. Snapshot

| | |
|---|---|
| **Projet** | SPAWT — *La carte du bon goût* |
| **Cible** | Spawters d'Abidjan (CIV), V1 mobile (iOS + Android) |
| **Méthode** | BMAD-METHOD v6.6.0 (BMM module) — branche `spawt/v1-bmad` |
| **Sprint actif** | Sprint 1 (figé 2026-05-03) — 12 features prio + 7 amendements team + 8 amendements Claude |
| **Repository type** | Multi-part (monorepo lâche) |
| **Statut documentation** | Initial scan généré le 2026-05-13 |

---

## 2. Stack par partie

| Partie | Path | Type | Stack | Statut |
|---|---|---|---|---|
| **mobile-app** | `app/` | mobile | Expo SDK 55 · RN 0.83 · TS strict · Zustand · AsyncStorage · Supabase (opt.) · i18next · expo-router | 🟢 Actif — canonical V1 |
| **prototype-web** | racine | web (PWA) | Vite 5 · React 18 · react-router · localStorage · maplibre-gl | ⚪ Figé — référence |

---

## 3. Architecture en une image

```
┌────────────────────────────────────────────────────────┐
│ documentation/   ← PRD V1, cahier Sprint 1, personas   │
└─────────────┬──────────────────────────────────────────┘
              │ source de vérité produit
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
   prototype-web  mobile-app   ← deux apps, pas de comm runtime
       │             │
       │             ├─► Supabase (live)  — optionnel
       │             └─► AsyncStorage (démo)
       │
       └─► localStorage
```

Détails : [integration-architecture.md](./integration-architecture.md).

---

## 4. Concepts produit canoniques

| Concept | Définition | Réf |
|---|---|---|
| **Spawter** | Utilisateur public B2C (renommé `users` → `spawters`) | PRD §13.1 + amendement 4.1 |
| **Spawt** | Une visite confirmée dans un lieu (mécanisme du Guet) | PRD §3.1 #5 |
| **Le Guet** | Geofence 10m + timer 15min + notif "Comment c'était ?" | PRD §7.1 |
| **Palais** | Profil gustatif 5 axes [-1, 1] (Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table) | PRD §5.1 |
| **ADN du lieu** | 5 axes [-1, 1] (Local/International, Informel/Établi, Budget/Premium, Populaire/Privé, Décontracté/Habillé) | PRD §6 |
| **Stade** | 5 paliers Touriste → Explorateur → Détective → Djidji → Guide ; ne recule jamais | PRD §3.1 #8, §5.2 |
| **Voix du Chat** | Ton qui évolue avec le stade (enjoué → solennel → silencieux pour Guide) | PRD §9.3 |
| **Coup de Cœur** | Quota mensuel par stade — preuve d'identité, pas de score | PRD §3.1 #12, §7.3 |

Vocabulaire interdit côté code (audit `lint-vocab`) : `restaurant`, `check-in`, `leaderboard`, `gamif*`, `user`, `VTC`/`Uber`/`Bolt`.

---

## 5. Plan Sprint 1 (résumé)

11 semaines estimées (cf. cahier §7). 12 features, 7 amendements team de schéma DB, 8 amendements qualité Claude (`[pending team validation]`).

| Phase | Sem. | Livrables clés |
|---|---|---|
| **Phase 0** | 1-2 | Monorepo, design tokens, schéma DB v1, **+ feature flags, i18n setup, events.md, device matrix** |
| **Phase 1.1** | 3-4 | Auth OTP + Onboarding (incl. consent ARTCI) |
| **Phase 1.2** | 4-6 | Lieux + Feed + Recherche + Favoris (+ seed avis fondateurs) |
| **Phase 1.3** | 6-8 | Le Guet + Avis structuré (+ anti-fraude L1) |
| **Phase 1.4** | 8-10 | Profil + Stades + Partage WhatsApp + Admin panel |
| **Phase 1.5** | 10-11 | Alpha 5 spawters (focus check-in) |

État actuel ([CHANGELOG](../CHANGELOG.md) v1.1.2) : Phase 0 quasi-terminée côté mobile (bootstrap + tokens + types + moteurs Palais/Matching + i18n + lint-vocab + onboarding scaffold + feed + place + profil + spawt manuel mode démo). Pas encore de migrations DB versionnées ni d'OTP réel.

---

## 6. Quick reference

| Tu veux... | Va voir |
|---|---|
| Lancer la démo en 5 min | [`app/README.md`](../app/README.md) → Option A (Expo Go) |
| Comprendre les data models | [data-models-mobile-app.md](./data-models-mobile-app.md) |
| Comprendre le score de matching | [architecture-mobile-app.md §5](./architecture-mobile-app.md#5-score-composite-cœur-valeur-produit) |
| Comprendre le mécanisme du Guet | [architecture-mobile-app.md §6](./architecture-mobile-app.md#6-le-guet--mécanisme-spawt-prd-31-5) |
| Voir les events analytics | [`documentation/analytics/events.md`](../documentation/analytics/events.md) |
| Connaître les invariants vocab | [development-guide-mobile-app.md §5](./development-guide-mobile-app.md#5-conventions-non-négociables) |
| Comprendre les amendements team / Claude | [`documentation/SPRINT_1_CAHIER_DES_CHARGES.md`](../documentation/SPRINT_1_CAHIER_DES_CHARGES.md) §4 + §5 |
| Architectures par partie | [architecture-mobile-app.md](./architecture-mobile-app.md) · [architecture-prototype-web.md](./architecture-prototype-web.md) |
| Coexistence des deux apps | [integration-architecture.md](./integration-architecture.md) |

---

## 7. Personas

| Persona | Rôle | Fichier |
|---|---|---|
| **Stéphanie** | Qualité (terrain, devices, conformité) | [`documentation/personas/stephanie.md`](../documentation/personas/stephanie.md) |
| **Kidam** | Performance produit (AARRR, instrumentation) | [`documentation/personas/kidam.md`](../documentation/personas/kidam.md) |
| **Alexandre** | Stratégie & marque (vocabulaire SPAWT, brand) | [`documentation/personas/alexandre.md`](../documentation/personas/alexandre.md) |
| **Moka** | Opérateur expert SPAWT (8 phases, mantra "grep avant écrire") | [`documentation/personas/moka.md`](../documentation/personas/moka.md) |

Toute feature mergée passe la **triple porte** Stéphanie / Kidam / Alexandre.

---

## 8. Liens externes (à câbler)

| Ressource | Statut |
|---|---|
| Linear / Jira | non créé |
| Slack / WhatsApp | conversations team produit (informelles) |
| Sentry | non installé |
| PostHog/Mixpanel | décision provider en attente (Kidam + Madame Sun) |
| EAS dashboard | en attente compte |
| Supabase dashboard | en attente provisionnement Phase 0 |
