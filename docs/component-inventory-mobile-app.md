# Component Inventory — `mobile-app`

> 4 composants UI réutilisables + 8 écrans Expo Router. Tous typés strict, tous référencés via `useTheme()` (pas de couleur en dur), tous textes via `t()` i18n.

---

## 1. Composants partagés (`app/src/components/`)

| Composant | Fichier | Rôle | Props clés |
|---|---|---|---|
| `ChatBubble` | [`ChatBubble.tsx`](../app/src/components/ChatBubble.tsx) | Voix du Chat (PRD §9.3) — texte i18n par stade × moment | `stade: Stade`, `moment: ChatMoment` |
| `PlaceCard` | [`PlaceCard.tsx`](../app/src/components/PlaceCard.tsx) | Carte du feed — nom, signaux, score, distance | `place`, `matchScore`, `distanceKm`, `onPress` |
| `AxisRadar` | [`AxisRadar.tsx`](../app/src/components/AxisRadar.tsx) | Radar SVG 5 axes universel — affiche Palais ET ADN, mode "En construction" si `confidence < 0.3` | `axes: { value, negLabel, posLabel }[]`, `underConstruction?: bool` |
| `DataSourceBanner` | [`DataSourceBanner.tsx`](../app/src/components/DataSourceBanner.tsx) | Bandeau jaune "Mode démo" — visible quand `dataSourceMode === "fallback"` | (no props) |

### Conventions composants

- Export nommé (pas default) sauf entry screens Expo Router
- Style via `StyleSheet.create({})` ou inline avec `theme` (pas de styled-components)
- Pas de logique métier — délégué aux moteurs `lib/*` et stores

---

## 2. Écrans Expo Router (`app/app/`)

### Stack racine

| Route | Fichier | Notes |
|---|---|---|
| `/` | [`index.tsx`](../app/app/index.tsx) | Splash "Entrer dans la Meute" |
| `/(onboarding)/consent` | [`consent.tsx`](../app/app/%28onboarding%29/consent.tsx) | ARTCI / Loi 2013-450 (Claude amendment 5.2) |
| `/(onboarding)/phone` | [`phone.tsx`](../app/app/%28onboarding%29/phone.tsx) | Stub OTP (mode démo) |
| `/(onboarding)/profile` | [`profile.tsx`](../app/app/%28onboarding%29/profile.tsx) | Nom + quartier + démographique (PII) |
| `/(onboarding)/calibration` | [`calibration.tsx`](../app/app/%28onboarding%29/calibration.tsx) | 5 questions Palais → axes initiaux |
| `/(tabs)/index` | [`(tabs)/index.tsx`](../app/app/%28tabs%29/index.tsx) | Feed personnalisé (PRD §3.1 #3) |
| `/(tabs)/profile` | [`(tabs)/profile.tsx`](../app/app/%28tabs%29/profile.tsx) | Profil + radar Palais (PRD #7) |
| `/place/[id]` | [`place/[id].tsx`](../app/app/place/%5Bid%5D.tsx) | Fiche lieu + ADN radar (PRD #4) — CTA "Je spawt ici" (manuel mode démo) |

### `_layout.tsx`

| Layout | Rôle |
|---|---|
| [`app/_layout.tsx`](../app/app/_layout.tsx) | RootLayout : SafeAreaProvider + ThemeProvider + GestureHandlerRoot + RouteGuard (hydrate + redirect) |
| [`(onboarding)/_layout.tsx`](../app/app/%28onboarding%29/_layout.tsx) | Stack interne onboarding |
| [`(tabs)/_layout.tsx`](../app/app/%28tabs%29/_layout.tsx) | TabBar Accueil / Moi (theme.colors.surface.inverse + brand.primary) |

### RouteGuard

[`app/_layout.tsx:12-33`](../app/app/_layout.tsx#L12-L33) — redirige selon `useSpawterStore`:
- spawter présent + sur splash/onboarding → `/(tabs)`
- spawter absent + dans tabs → `/`

---

## 3. Patterns

### 3.1 Theme

```tsx
const theme = useTheme();
<View style={{ backgroundColor: theme.colors.surface.base }}>...</View>
```

Source unique : [`app/src/theme/tokens.ts`](../app/src/theme/tokens.ts).

### 3.2 i18n

```tsx
const { t } = useTranslation();
<Text>{t("splash.tagline")}</Text>
```

Source unique : [`app/src/i18n/fr.json`](../app/src/i18n/fr.json).

### 3.3 Voix du Chat

```tsx
<ChatBubble stade={spawter.stade} moment="welcome_back" />
```

Mapping (`stade`, `moment`) → clé i18n via [`chat-voice.ts`](../app/src/lib/chat-voice.ts).

### 3.4 Score affiché

```tsx
displayedScore(rawScore)   // [50, 99] entiers — PRD §8.3
```

[`matching.ts`](../app/src/lib/matching.ts).

---

## 4. Roadmap composants à venir (Sprint 1)

Issus du périmètre 12 features (cf. cahier §3.1) — pas encore en code :

| Composant | Pour | Source |
|---|---|---|
| `OtpInput` | Feature 1 (auth) | Phase 1.1 |
| `SearchBar` + `FilterChips` | Feature 10 (recherche/filtres) | Phase 1.2 |
| `ReviewForm` (note + tags + texte 500c + 3 photos) | Feature 6 (avis structuré) | Phase 1.3 |
| `GuetIndicator` (pulse "Le Chat fait le guet…") | Feature 5 (geofence actif) | Phase 1.3 |
| `CoupDeCoeurStamp` | Feature 12 (V1.5) | reporté |
| `ShareSheet` (deep link WhatsApp) | Feature 16 (partage) | Phase 1.4 |

Aucun ne doit introduire de mécanique compétitive (Contrat §20.1).
