# Architecture — `mobile-app` (Expo / React Native)

> Canonical V1 SPAWT. Stack mobile-first (iOS + Android), TypeScript strict, file-based routing Expo Router, état Zustand local + Supabase optionnel.
>
> Tous les invariants (vocabulaire, design tokens, anti-fraude, voix du Chat) sont **vérifiés en CI/local par scripts** avant merge.

---

## 1. Executive Summary

| | |
|---|---|
| **Type de projet** | mobile (Expo SDK 55) |
| **Pattern** | App-shell + file-based routing + state local persistant + adapter pattern pour la data source |
| **Cible plateformes** | iOS 13+, Android 10+ — *iOS-first* en démo, Android testé sur Galaxy S23 |
| **Mode dual** | démo (seed local + AsyncStorage) ↔ live (Supabase) — bascule via env vars, sans toucher aux écrans |
| **Sprint actif** | Sprint 1 — Phase 0 terminée, Phase 1.1 à venir (cf. [`app/README.md`](../app/README.md) §état) |

---

## 2. Stack technique

| Catégorie | Choix | Version | Justification |
|---|---|---|---|
| Runtime | React Native | 0.83.6 | bumped en CHANGELOG v1.1.2 (cascade Expo SDK 55) |
| Framework | Expo | ^55.0.19 | shippé par Expo Go côté store ; PRD §12.1 dit "SDK 52+" |
| Routing | expo-router | ~55.0.13 | file-based, typed routes activé |
| Langage | TypeScript | ~5.9.2 | strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes |
| State global | zustand | ^4.5.0 | léger, pas de boilerplate Redux |
| Storage local | @react-native-async-storage/async-storage | 2.2.0 | mode démo + cache offline |
| Backend | @supabase/supabase-js | ^2.45.0 | option live (chargée en dynamic-import) |
| i18n | i18next + react-i18next + expo-localization | ^23.16 / ^15.1 / ~55.0.13 | Claude amendment 5.6 |
| UI primitive | react-native-svg | 15.15.3 | radars Palais & ADN |
| Animation | react-native-reanimated | 4.2.1 | requis par expo-router |
| Permissions | expo-location | ~55.1.8 | géoloc — Le Guet (PRD §7.1) |
| Notifications | expo-notifications | ~55.0.22 | push "Comment c'était ?" (Phase 1.3) |
| Tests | jest + jest-expo | ^29.7 / ~55.0 | scaffold |

Vulnérabilités npm résiduelles : 16 (12 modérées + 4 low) issues des transitives Expo — à auditer en hardening.

---

## 3. Pattern d'architecture

```
                  ┌──────────────────────────┐
                  │   Expo Router (app/)     │
                  │   - file-based screens   │
                  │   - RouteGuard (hydrate) │
                  └────────────┬─────────────┘
                               │ subscribes
                  ┌────────────▼─────────────┐
                  │   Zustand stores         │
                  │   - spawter-store        │
                  │   - onboarding-draft     │
                  └────────────┬─────────────┘
                               │ uses
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐
    │  lib/        │  │  data-source │  │  storage        │
    │  - matching  │  │  (adapter)   │  │  (AsyncStorage) │
    │  - palais    │  └──────┬───────┘  └─────────────────┘
    │  - chat-voice│         │ dynamic import
    └──────────────┘         ▼
                    ┌─────────────────┐
                    │ data-source.    │
                    │   supabase.ts   │ ◀── SDK supabase-js
                    └─────────────────┘
```

**Principes** :
- Les écrans **ne touchent jamais** Supabase directement → toujours via `lib/data-source.ts`.
- Le store **persiste localement avant** sync distante → l'app reste responsive même hors-ligne.
- Le moteur Palais (`palais-engine.ts`) est **pur** (pas d'IO) → testable unitairement, réutilisable serveur si besoin.
- Le `RouteGuard` est passif : il observe le store et redirige, il n'orchestre pas.

---

## 4. Data architecture

Cf. [data-models-mobile-app.md](./data-models-mobile-app.md) pour le détail des entités (`Spawter`, `UserPalais`, `Place`, `PlaceAdn`, `SpawtCheckin`, `Stade`).

**Politique d'écriture** :
- Onboarding : commit atomique du `Spawter` + `UserPalais` (Promise.all) en local **puis** fire-and-forget Supabase.
- Spawt : append au store + recompute `unique_spots` + `stade` côté client → snapshot vers Supabase.
- Anti-fraude : flags client purement informatifs ; **les invariants sont des triggers SQL** côté Supabase (à livrer Phase 1.3).

**Politique d'historisation** (amendement team 4.6) :
- `spawter`, `user_palais`, `spawter_progression` → overwrite
- `collection_titres` → append (mémoire identité)
- `user_signals` → append-only (matière première ML — PRD §13.3)

---

## 5. Score composite (cœur valeur produit)

[`app/src/lib/matching.ts`](../app/src/lib/matching.ts) — implémente PRD §8.1 :

```
score_brut = 0.15·cosine(palais, adn)
           + 0.30·distance(spawter, lieu)
           + 0.30·note(weighted_rating)
           + 0.10·recency(last_spawt_at)
           + 0.15·novelty(visited_place_ids)

score_affiché = 50 + score_brut × 49     # → [50, 99] entiers
```

Détails composantes :

| Composante | Définition |
|---|---|
| `cosine` | similarité cosine 5D entre vecteur Palais et vecteur ADN, normalisée [0,1] |
| `distance` | rampe linéaire 1km→3km→5km→+∞ ; haversine |
| `note` | `weighted_rating / 5` clampé |
| `recency` | `1 - days/90` clampé |
| `novelty` | 0.2 si déjà visité, 1 sinon |

---

## 6. Le Guet — mécanisme spawt (PRD §3.1 #5)

```
   Spawter approche  ──────────►  geofence (10m) déclenché
                                    │
                                    ▼
                         armed → guet_geofence_triggered
                                    │ patiente 15 min
                                    ▼
                         threshold_reached → guet_notification_sent
                                    │ snooze x3 max (15min)
                                    ▼
                         spawt_completed (active)
                                                OU
                         left_at expire (passive, poids 0.5x)
                                                OU
                         fenêtre +30min dépasse → no spawt
```

Constantes : [`app/src/types/spawt.ts:81-100`](../app/src/types/spawt.ts#L81-L100) — `ANTIFRAUD_RULES`.

En mode démo : le guet n'est pas armé. CTA manuel "Je spawt ici" sur la fiche lieu pour valider la mécanique côté store ([`app/app/place/[id].tsx:65-97`](../app/app/place/%5Bid%5D.tsx#L65-L97)).

Implémentation Phase 1.3 (Feature 5 + anti-fraude L1 Claude amendment 5.3).

---

## 7. Source tree

Cf. [source-tree-analysis.md §3](./source-tree-analysis.md#3-partie-mobile-app-app).

---

## 8. Workflow dev

Cf. [development-guide-mobile-app.md](./development-guide-mobile-app.md).

Triple gate à respecter avant chaque commit :

```bash
cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check
```

---

## 9. Déploiement

Cf. [deployment-guide.md §1](./deployment-guide.md#1-mobile--expo--eas).

3 chemins de livraison : Expo Go (démo) · EAS Build APK (Android sideload) · EAS Build IPA (Apple Dev requis).

---

## 10. Stratégie de test

| Niveau | Outil | Statut |
|---|---|---|
| Unit (engines purs) | Jest | scaffold — étoffer `palais-engine` et `matching` |
| Component | jest-expo | scaffold |
| E2E | (à choisir Maestro/Detox) | non installé |
| Manuel devices | matrice 4 devices imposée pré-merge (Stéphanie) | définition de Done — cf. cahier §5.7 |
| Alpha terrain | 5 spawters · 1 semaine fin Sprint 1 (Claude amendment 5.8) | planifié |

---

## 11. Risques & invariants à protéger

| Risque | Mitigation actuelle |
|---|---|
| Drift vocabulaire (`restaurant`, `check-in`, `leaderboard`) | `lint-vocab.mjs` bloquant ; cf. [`scripts/lint-vocab.mjs`](../app/scripts/lint-vocab.mjs) |
| Strings hardcodées | `i18n-check.mjs` bloquant |
| Couleurs en dur | tokens en source unique + revue |
| Spawts fictifs poisonnent ADN | `ANTIFRAUD_RULES` côté client + triggers SQL Phase 1.3 |
| Dérive perfs Android low-end | Définition de Done : test 4 devices + budget perf P95 < 3s sur 3G (Claude 5.7) |
| Conformité ARTCI | Écran consent à l'onboarding + flux DELETE/me + export self-service (Claude 5.2) |
| OS-tue-app (Tecno/Infinix) | Identifié — alpha terrain Phase 1.5 valide la fiabilité du Guet |

---

## 12. Liens

- README opérationnel : [`app/README.md`](../app/README.md)
- Cahier Sprint 1 : [`documentation/SPRINT_1_CAHIER_DES_CHARGES.md`](../documentation/SPRINT_1_CAHIER_DES_CHARGES.md)
- PRD V1 : `documentation/SPAWT_PRD_V1.docx`
- Analytics events : [`documentation/analytics/events.md`](../documentation/analytics/events.md)
- Personas : [`documentation/personas/`](../documentation/personas/)
- Data models : [data-models-mobile-app.md](./data-models-mobile-app.md)
- API contracts : [api-contracts-mobile-app.md](./api-contracts-mobile-app.md)
- Components : [component-inventory-mobile-app.md](./component-inventory-mobile-app.md)
- Dev guide : [development-guide-mobile-app.md](./development-guide-mobile-app.md)
- Deploy guide : [deployment-guide.md](./deployment-guide.md)
- Cross-part : [integration-architecture.md](./integration-architecture.md)
