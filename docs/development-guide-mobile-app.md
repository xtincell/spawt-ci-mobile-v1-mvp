# Development Guide — `mobile-app` (Expo / iOS + Android)

> Source primaire : [`app/README.md`](../app/README.md). Ce guide consolide les commandes et les invariants que **toute** modification du code doit respecter.

---

## 1. Prérequis

| Outil | Version | Note |
|---|---|---|
| Node.js | ≥ 20 (Expo SDK 55) | nvm OK |
| npm | ≥ 10 | yarn / pnpm non testés |
| Expo Go | App Store / Play Store | option A (démo) |
| EAS CLI | `npx eas-cli` | option B (APK) |
| Compte Expo | free | EAS Build 30 builds/mois gratuits |
| Apple Developer | 99 $/an | option C — uniquement pour `.ipa` distribuable |

---

## 2. Setup

```bash
cd app
npm install            # peer-deps cosmétiques react 19 / jest-expo → ajouter --legacy-peer-deps si besoin
```

Pas de `.env` requis pour la démo. Pour Supabase live :

```bash
# app/.env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 3. Scripts npm

| Commande | Effet | Quand l'utiliser |
|---|---|---|
| `npm start` | Expo Dev Server (QR code) | dev quotidien |
| `npx expo start --tunnel` | Tunnel ngrok (mobile sur réseau différent) | démo iPhone/Galaxy à distance |
| `npm run ios` | iOS Simulator (macOS uniquement) | dev Mac local |
| `npm run android` | Android Emulator | dev Linux/Mac/Windows |
| `npm run web` | Expo Web (debug rapide) | sanity check |
| `npm run typecheck` | `tsc --noEmit` strict | **avant chaque commit** |
| `npm run lint:vocab` | Audit vocabulaire SPAWT — interdit `restaurant`, `check-in`, `leaderboard`, `gamif*` | **avant chaque commit** |
| `npm run i18n:check` | Détecte strings FR hardcodées hors `src/i18n/fr.json` | **avant chaque commit** |
| `npm test` | Jest (jest-expo preset) | suites unitaires |

### 3.1 Triple gate qualité (à respecter en pre-commit local)

```bash
npx tsc --noEmit && npm run lint:vocab && npm run i18n:check
```

Le CHANGELOG documente cet ordre comme **Verify** (cf. CHANGELOG v1.1.2).

---

## 4. Build & distribution

### Option A — Expo Go (le plus simple)

```bash
cd app
npx expo start --tunnel
```

→ scan du QR avec Expo Go (iPhone Camera ou app Android). **Limitation** : pas de geoloc en background (Le Guet automatique).

### Option B — APK Android sideloadable

```bash
npx eas-cli login                            # 1ère fois
npx eas-cli build:configure                  # 1ère fois — génère eas.json (déjà présent)
npx eas-cli build --profile preview --platform android
```

→ build cloud Expo (gratuit jusqu'à 30/mois) → `.apk` téléchargeable.

### Option C — iOS `.ipa` distribuable

```bash
npx eas-cli build --profile preview --platform ios
```

Requiert un compte Apple Developer **payant** (provisioning profile).

### Profils EAS

[`app/eas.json`](../app/eas.json) :

| Profil | Android | iOS | Note |
|---|---|---|---|
| `development` | `buildType: apk`, `developmentClient: true` | — | dev client |
| `preview` | `buildType: apk` | `simulator: true` | distribution interne |
| `production` | `buildType: app-bundle` | — | store-ready |

---

## 5. Conventions non négociables

### 5.1 Couleurs

**Aucune couleur en dur** hors [`app/src/theme/tokens.ts`](../app/src/theme/tokens.ts). Référencer les tokens sémantiques :

```ts
theme.colors.brand.primary   // pas palette.goldSpawt directement
theme.colors.surface.base    // pas "#F8F6F0"
```

Source PRD §15.1. Toute nouvelle nuance passe par revue Alexandre (brand) + Stéphanie (contraste WCAG).

### 5.2 Strings UI

**Aucune string FR hardcodée** hors [`app/src/i18n/fr.json`](../app/src/i18n/fr.json). Toujours `t("scope.key")` via `useTranslation()` (Claude amendment 5.6).

Audit auto : `npm run i18n:check`.

### 5.3 Vocabulaire SPAWT (audit `lint-vocab`)

Interdits dans `app/src/**` et `app/app/**` (sauf exceptions explicites) :

| Mot | Remplacement |
|---|---|
| `restaurant(s)` | `lieu`, `spot` |
| `check-in`, `checkin` | `spawt` (exception type `SpawtCheckin`) |
| `leaderboard`, `ranking`, `classement` | (interdit — Contrat §20.1) |
| `gamif*` | (interdit) |
| `user` | `spawter` |
| `VTC`, `Uber`, `Bolt` | `Le Guet` |

Source : [`app/scripts/lint-vocab.mjs`](../app/scripts/lint-vocab.mjs) + PRD §19 + persona Moka §4.3.

### 5.4 TypeScript

- Strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (cf. [`tsconfig.json`](../app/tsconfig.json))
- Pas de `any` libre. Utiliser `unknown` + narrowing si l'inférence ne tient pas.
- Imports relatifs OK, aliases `@/*` → `./src/*` configurés.

### 5.5 Mécanique compétitive

Pas de leaderboard, ranking, points compétitifs. Le stade et les Coups de Cœur sont des **mécaniques d'identité**, pas de score. Cf. Contrat à la Tribu PRD §20.1.

---

## 6. Tests

| Type | Outil | État Sprint 1 |
|---|---|---|
| Unit | Jest + jest-expo | scaffold, suites à étoffer |
| E2E | (à choisir : Maestro / Detox) | non installé |
| Matrice devices manuelle | 4 devices min | définition de Done — cf. Claude amendment 5.7 |

Devices imposés en pre-merge (Stéphanie) : 1× Tecno Spark, 1× Infinix Hot, 1× Samsung A-series, 1× iPhone (récent + 1 modèle 2 ans).

---

## 7. Boucle locale recommandée

```bash
# terminal 1 — dev server
cd app && npx expo start --tunnel

# terminal 2 — audits avant commit
cd app && npm run typecheck && npm run lint:vocab && npm run i18n:check && npm test
```

Flow démo (5 min) : Splash → Consent → Phone (stub) → Profile → Calibration → Feed → Place → "Je spawt ici" → Profile (radar Palais).

---

## 8. Git

- Branche active : `spawt/v1-bmad` (cf. memory)
- Commit style : **Conventional Commits** versionné par Sprint (cf. `CHANGELOG.md`)
- Triple sign-off avant merge sur `main` : Stéphanie (qualité) + Kidam (data) + Alexandre (brand) — cf. `documentation/SPRINT_1_CAHIER_DES_CHARGES.md` §8

---

## 9. Points d'attention

- **16 vulnérabilités npm** héritées des transitives Expo SDK 55 (12 modérées + 4 low). À auditer en phase hardening (CHANGELOG v1.1.2 résidus).
- **OTP non implémenté** — l'écran phone est un stub. Phase 1.1 du plan.
- **`app/README.md` mentionne SDK 52** alors qu'on est sur SDK 55 — à corriger (CHANGELOG v1.1.2 résidus).
- **Migrations DB non versionnées** — Phase 0 Sprint 1 (à créer côté Supabase).
