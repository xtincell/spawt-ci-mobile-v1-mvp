# Source Tree Analysis

> Repository multi-part : prototype Vite à la racine + app Expo dans `app/`. Le prototype est la référence visuelle/design ; **l'app mobile (`app/`) est la baseline canonique V1**.

---

## 1. Vue d'ensemble

```
Spawt mobile CI/
├── src/                              # 🟢 Partie : prototype-web (Vite + React 18)
├── app/                              # 🔵 Partie : mobile-app (Expo + RN 0.83)
├── documentation/                    # PRD V1 + Sprint 1 + personas + analytics — source amont
├── docs/                             # Cette documentation BMad (sortie LLM)
├── _bmad/                            # BMM module (méthode BMAD-METHOD v6.6.0)
├── _bmad-output/                     # Sorties BMad (planning + implementation artifacts)
├── public/                           # Assets PWA pour le prototype Vite
├── dist/                             # Build Vite (généré)
├── index.html, vite.config.js        # Entry du prototype web
├── package.json                      # racine (Vite/React)
├── CHANGELOG.md                      # Journal Conventional Commits versionné par Sprint
└── nul                               # ⚠️ artefact Windows (à ignorer / supprimer)
```

---

## 2. Partie `prototype-web` (racine du repo)

PWA Vite — référence visuelle du flux SPAWT. **Pas la base de code mobile.**

```
/ (racine)
├── index.html                        # entry point HTML
├── vite.config.js                    # Vite + plugin PWA (manifest SPAWT)
├── package.json                      # spawt-mobile@1.0.0 — type:module
├── public/                           # icons PWA, assets statiques
└── src/
    ├── main.jsx                      # bootstrap React StrictMode
    ├── App.jsx                       # BrowserRouter + UserProvider + SpawSheet modal
    ├── theme.js                      # "Flair Design v3.2 — Écaille de Tortue" — tokens WCAG AA
    ├── context/
    │   └── UserContext.jsx           # 328 LoC — state global (user, palais, spawts, badges, archetype)
    ├── hooks/
    │   └── useUser.js                # accessor du contexte
    ├── components/
    │   ├── AxisBar.jsx               # barre 1D (axe palais)
    │   ├── PalaisRadar.jsx           # radar SVG 5 axes (équivalent AxisRadar mobile)
    │   ├── BadgeGrid.jsx             # grille badges acquis
    │   ├── BottomNav.jsx             # tab bar : Home / Discover / Profile + CTA Spawt
    │   ├── CatSilhouette.jsx         # illustration du Chat (mascotte)
    │   ├── ChatBubble.jsx            # voix du Chat (équivalent mobile)
    │   ├── SpotCard.jsx              # carte feed (équivalent PlaceCard mobile)
    │   └── SpawSheet.jsx             # bottom-sheet check-in/avis (modal)
    ├── pages/
    │   ├── Onboarding.jsx            # gate avant le reste
    │   ├── Home.jsx                  # feed
    │   ├── Discover.jsx              # navigation par archétype/carte
    │   ├── SpotDetail.jsx            # fiche lieu
    │   └── Profile.jsx               # radar Palais + collection titres + badges
    └── data/
        ├── restaurants.js            # 573 LoC — catalogue lieux Abidjan
        ├── archetypes.js             # 13 archétypes × 5 stades + matcher
        └── badges.js                 # 5 badges + checkBadges()
```

### Critical files (`prototype-web`)

- [`src/App.jsx`](../src/App.jsx) — routage `/`, `/discover`, `/spot/:id`, `/profile`, gate onboarding
- [`src/context/UserContext.jsx`](../src/context/UserContext.jsx) — TOUTE la logique état (palais, spawts, badges, sur place, community menu, marquage)
- [`src/theme.js`](../src/theme.js) — design tokens hérités par `app/src/theme/tokens.ts`

---

## 3. Partie `mobile-app` (`app/`)

**Canonical V1.** Expo SDK 55 + React Native 0.83 + TypeScript strict. Cible iOS + Android.

```
app/
├── package.json                      # spawt-app@1.0.0-sprint1.0
├── app.json                          # config Expo : bundleId com.upgraders.spawt, plugins, infoPlist ARTCI
├── eas.json                          # profils EAS : development / preview / production
├── tsconfig.json                     # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
├── babel.config.js                   # preset Expo + reanimated plugin
├── README.md                         # ⭐ entry doc : 3 chemins de livraison (Expo Go / EAS APK / iOS .ipa)
├── expo-env.d.ts
│
├── app/                              # Expo Router — file-based routing
│   ├── _layout.tsx                   # RootLayout + RouteGuard (hydrate store + redirect)
│   ├── index.tsx                     # Splash "Entrer dans la Meute"
│   ├── (onboarding)/                 # Stack 4 étapes
│   │   ├── _layout.tsx
│   │   ├── consent.tsx               # ARTCI / Loi 2013-450 (amendement 5.2)
│   │   ├── phone.tsx                 # stub OTP en mode démo
│   │   ├── profile.tsx               # nom + quartier + démographique (PII amendement 4.5)
│   │   └── calibration.tsx           # 5 questions Palais → axes initiaux
│   ├── (tabs)/                       # Tab nav
│   │   ├── _layout.tsx               # Accueil + Moi
│   │   ├── index.tsx                 # Feed personnalisé (PRD §3.1 #3)
│   │   └── profile.tsx               # Profil + radar Palais (PRD §3.1 #7)
│   └── place/
│       └── [id].tsx                  # Fiche lieu + ADN radar (PRD §3.1 #4)
│
├── src/                              # code applicatif (alias @/* → ./src/*)
│   ├── theme/
│   │   ├── tokens.ts                 # 🎨 SOURCE UNIQUE couleurs/typos (PRD §15.1)
│   │   └── ThemeProvider.tsx
│   │
│   ├── types/                        # 📦 PRD §13 + amendements 4.x
│   │   ├── spawter.ts                # CountryCode, Gender, AgeRange, Spawter, OnboardingDraft
│   │   ├── place.ts                  # CuisineCategory, PlaceSignal, Place, PlaceAdn
│   │   ├── palais.ts                 # PalaisAxis (5), UserPalais
│   │   ├── stade.ts                  # Stade (5) + STADE_DESCRIPTORS + getStade()
│   │   ├── spawt.ts                  # SpawtCheckin + AntifraudFlag + ANTIFRAUD_RULES
│   │   └── index.ts                  # barrel
│   │
│   ├── lib/                          # ⚙️ moteurs métier
│   │   ├── supabase.ts               # client createClient(), lazy
│   │   ├── data-source.ts            # ⭐ adaptateur Supabase ↔ seed (point d'entrée unique)
│   │   ├── data-source.supabase.ts   # implé Supabase (import dynamique)
│   │   ├── storage.ts                # AsyncStorage wrapper (spawter, palais, spawts, consent)
│   │   ├── chat-voice.ts             # mapping (stade × moment) → clé i18n
│   │   ├── palais-engine.ts          # learningFactor, updateAxis, dominantAxes, computeConfidence
│   │   └── matching.ts               # ⭐ computeRawScore (PRD §8.1) + displayedScore [50%, 99%]
│   │
│   ├── store/                        # 🗄️ Zustand
│   │   ├── spawter-store.ts          # hydrate, recordConsent, finalizeOnboarding, registerSpawt
│   │   └── onboarding-draft.ts       # brouillon éphémère 4 étapes
│   │
│   ├── data/
│   │   └── seed/
│   │       ├── places.ts             # 362 LoC — 12 lieux Abidjan + ADN seed
│   │       └── sample-spawter.ts     # SAMPLE_SPAWTER + EMPTY_PALAIS
│   │
│   ├── components/                   # 🧩 UI partagée
│   │   ├── ChatBubble.tsx            # voix du Chat i18n par stade
│   │   ├── PlaceCard.tsx             # carte feed
│   │   ├── AxisRadar.tsx             # radar SVG 5 axes universel (Palais ET ADN)
│   │   └── DataSourceBanner.tsx     # bandeau jaune "mode démo"
│   │
│   └── i18n/
│       ├── index.ts                  # init i18next + expo-localization
│       └── fr.json                   # ⭐ TOUTES les strings UI (Claude amendment 5.6)
│
└── scripts/                          # 🛡️ audits anti-drift
    ├── lint-vocab.mjs                # interdit "restaurant", "check-in", "leaderboard", "gamif..."
    └── i18n-check.mjs                # détecte strings FR hardcodées hors fr.json
```

### Critical files (`mobile-app`)

| Fichier | Pourquoi critique |
|---|---|
| [`app/app/_layout.tsx`](../app/app/_layout.tsx) | RouteGuard + ThemeProvider + hydratation store |
| [`app/src/lib/matching.ts`](../app/src/lib/matching.ts) | Cœur valeur produit — score composite PRD §8.1 |
| [`app/src/lib/palais-engine.ts`](../app/src/lib/palais-engine.ts) | Apprentissage Palais (PRD §5.6) |
| [`app/src/lib/data-source.ts`](../app/src/lib/data-source.ts) | Adaptateur unique Supabase ↔ seed — bascule sans toucher aux écrans |
| [`app/src/store/spawter-store.ts`](../app/src/store/spawter-store.ts) | Source de vérité spawter en mémoire + persistance |
| [`app/src/types/spawt.ts`](../app/src/types/spawt.ts) | `ANTIFRAUD_RULES` (invariants techniques) + `SpawtCheckin` (table centrale PRD §13.7) |
| [`app/src/theme/tokens.ts`](../app/src/theme/tokens.ts) | Source unique design (audit `lint-vocab` n'autorise rien d'autre) |
| [`app/src/i18n/fr.json`](../app/src/i18n/fr.json) | Source unique strings UI (audit `i18n-check` impose le passage par i18n) |

### Entry points

- **Mobile** : `app.json` → `main: "expo-router/entry"` → file-based routing depuis `app/app/`
- **Web prototype** : `index.html` → `src/main.jsx` → `App.jsx`

---

## 4. Documentation amont (`documentation/`)

```
documentation/
├── SPAWT_PRD_V1.docx                 # PRD V1.0.0 (John BMad, 9 avril 2026) — SOURCE DE VÉRITÉ PRODUIT
├── SPAWT_Presentation_Fevrier_2026_V2.{docx,pdf}
├── SPRINT_1_CAHIER_DES_CHARGES.md    # ⭐ Périmètre Sprint 1 + 7 amendements team + 8 amendements Claude
├── personas/
│   ├── alexandre.md                  # Stratégie & marque
│   ├── kidam.md                      # Performance produit (AARRR)
│   ├── stephanie.md                  # Qualité (terrain, devices, conformité)
│   └── moka.md                       # Opérateur expert (8 phases, mantra "grep avant écrire")
└── analytics/
    └── events.md                     # Taxonomie ~80 events analytics (Claude amendment 5.1)
```

---

## 5. Méthode BMad (`_bmad/` + `_bmad-output/`)

```
_bmad/                                # BMM module v6.6.0 (installé)
├── bmm/
│   └── config.yaml                   # user_name, communication_language, output paths
└── scripts/
    └── resolve_customization.py      # résout customize.toml en cascade (base → team → user)

_bmad-output/
├── planning-artifacts/               # PRDs, architectures, epics, stories à venir
└── implementation-artifacts/         # outputs des stories implémentées
```

> Note Windows / Python : le résolveur custom écrit en UTF-8 mais stdout Windows par défaut est cp1252 — exécuter avec `PYTHONIOENCODING=utf-8` (workaround).

---

## 6. Pièges & dossiers à ignorer

| Élément | Statut |
|---|---|
| `node_modules/` (racine et `app/`) | ignored (dependencies installées séparément, racine ET app/) |
| `dist/` | build Vite — généré |
| `nul` (fichier racine) | ⚠️ artefact Windows accidentel — pas suivi |
| `.expo/` | cache Expo |

---

## 7. Cross-references

- Architectures par partie : [architecture-prototype-web.md](./architecture-prototype-web.md) · [architecture-mobile-app.md](./architecture-mobile-app.md)
- Intégration entre parties : [integration-architecture.md](./integration-architecture.md)
- Composants : [component-inventory-mobile-app.md](./component-inventory-mobile-app.md) · [component-inventory-prototype-web.md](./component-inventory-prototype-web.md)
