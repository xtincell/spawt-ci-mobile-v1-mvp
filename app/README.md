# SPAWT — App mobile (Expo / iOS + Android)

App mobile SPAWT — React Native + Expo. iOS d'abord, Android dans le scope (Galaxy S23 testé).

> Le prototype Vite à la racine du repo = référence visuelle/data, **pas** la base de code mobile.

---

## 🚀 Premier livrable (mode démo, sans Supabase)

L'app est **fonctionnelle dès le premier lancement** avec des données seed locales (12 lieux d'Abidjan + Assinie). Aucun compte Supabase requis pour la démo.

Le mode bascule automatiquement en *Supabase live* quand tu fournis les variables d'env (cf. plus bas).

### Option A — Le plus simple : Expo Go (iPhone + Galaxy S23)

C'est la voie recommandée pour la première démo. Aucun build, aucune compilation.

**Sur ta machine de dev** :

```bash
cd app
npm install
npx expo start --tunnel
```

Un QR code s'affiche dans le terminal.

**Sur ton iPhone** :
1. App Store → installer **Expo Go**
2. Caméra iOS → scanner le QR code
3. L'app s'ouvre dans Expo Go

**Sur ton Galaxy S23** :
1. Play Store → installer **Expo Go**
2. Ouvrir Expo Go → onglet "Scan QR" → scanner le QR
3. L'app s'ouvre

⚠️ Limitation Expo Go : pas de geolocation en background (Le Guet automatique). Pour la démo Sprint 1 c'est OK — un bouton "Je spawt ici" déclenche le check-in manuel.

### Option B — APK Android sideloadable (Galaxy S23, fichier `.apk`)

Pour avoir un **vrai fichier `.apk`** que tu installes manuellement sur ton Galaxy S23 (sans dev server) :

```bash
cd app
npm install
npx eas-cli login                          # 1ère fois — compte Expo gratuit
npx eas-cli build:configure                # 1ère fois — génère eas.json
npx eas-cli build --profile preview --platform android
```

EAS lance un build cloud (gratuit jusqu'à 30 builds/mois). Tu reçois un lien → télécharge le `.apk` → transfère sur le Galaxy S23 → ouvre le fichier → "Installer". Galaxy demande l'autorisation "sources inconnues" la 1ère fois.

### Option C — iPhone sans dev server (.ipa)

Ça demande un compte Apple Developer (99 $/an) pour signer le `.ipa` distribuable. **Non gratuit.** Pour la démo, **utilise Expo Go (option A)** sur iPhone.

Si tu veux quand même le .ipa plus tard :
```bash
npx eas-cli build --profile preview --platform ios
# nécessite Apple Developer + provisioning profile
```

---

## Brancher Supabase plus tard (sans toucher au code)

Quand tu seras prêt à payer / activer Supabase :

1. Crée un projet sur supabase.com
2. À la racine de `app/`, créer `.env` :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=ey...
   ```
3. Relance `npx expo start --clear`

Le bandeau jaune "Mode démo" disparaît, l'app lit les `places` / `place_adn` en base.

Schémas DB et migrations à venir (Sprint 1 Phase 1, alignés amendements team §4).

---

## Stack

- **React Native** 0.83 + **Expo SDK 55** (PRD §12.1 dit "SDK 52+")
- **Expo Router** v4 (file-based routing)
- **TypeScript strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Supabase** (optionnel, basculable via env)
- **i18next** + **expo-localization** (Claude amendment 5.6)
- **Zustand** (state local)
- **AsyncStorage** (cache local mode démo)
- **React Native SVG** (radar Palais, ADN)

---

## Structure

```
app/
├── app/                              # Expo Router — file-based routing
│   ├── _layout.tsx                   # Root + RouteGuard (onboarding done?)
│   ├── index.tsx                     # Splash
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── consent.tsx               # Claude amendment 5.2 — ARTCI/Loi 2013-450
│   │   ├── phone.tsx                 # Stub OTP en mode démo
│   │   ├── profile.tsx               # Nom + quartier + démographique
│   │   └── calibration.tsx           # 5 questions Palais
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab nav : Accueil + Moi
│   │   ├── index.tsx                 # Feed personnalisé (PRD §3.1 #3)
│   │   └── profile.tsx               # Profil + radar Palais (PRD #7)
│   └── place/[id].tsx                # Fiche lieu + ADN radar (PRD #4)
├── src/
│   ├── theme/
│   │   ├── tokens.ts                 # SOURCE UNIQUE couleurs/typos (PRD §15.1)
│   │   └── ThemeProvider.tsx
│   ├── types/                        # PRD §13 + amendements 4.x
│   │   ├── spawter.ts
│   │   ├── place.ts
│   │   ├── palais.ts
│   │   ├── stade.ts
│   │   ├── spawt.ts                  # Le Guet (mécanisme spawt) + anti-fraude
│   │   └── index.ts
│   ├── lib/
│   │   ├── supabase.ts               # Client Supabase (lazy)
│   │   ├── data-source.ts            # Adaptateur Supabase ↔ seed
│   │   ├── data-source.supabase.ts   # Implé Supabase (chargée si configurée)
│   │   ├── storage.ts                # AsyncStorage wrapper
│   │   ├── chat-voice.ts             # Voix du Chat par stade (PRD §9.3)
│   │   ├── palais-engine.ts          # Moteur Palais (PRD §5.6)
│   │   └── matching.ts               # Score composite (PRD §8.1)
│   ├── data/
│   │   └── seed/
│   │       ├── places.ts             # 12 lieux Abidjan (PRD axes [-1, 1])
│   │       └── sample-spawter.ts
│   ├── store/
│   │   ├── spawter-store.ts          # Zustand : spawter actif + Palais + spawts
│   │   └── onboarding-draft.ts       # Brouillon onboarding éphémère
│   ├── components/
│   │   ├── ChatBubble.tsx            # Voix du Chat
│   │   ├── PlaceCard.tsx             # Carte du feed
│   │   ├── AxisRadar.tsx             # Radar SVG 5 axes (Palais ET ADN)
│   │   └── DataSourceBanner.tsx      # Bandeau "mode démo"
│   └── i18n/
│       ├── index.ts
│       └── fr.json                   # Toutes les strings UI
└── scripts/
    ├── lint-vocab.mjs                # Audit vocabulaire SPAWT (Moka §4.3)
    └── i18n-check.mjs                # Détection strings hardcodées
```

---

## Scripts npm

| Commande | Effet |
|---|---|
| `npm start` | Expo Dev Server (QR code) |
| `npm run ios` | iOS Simulator (macOS uniquement) |
| `npm run android` | Android Emulator |
| `npm run typecheck` | TypeScript strict |
| `npm run lint:vocab` | Audit anti-drift vocabulaire (interdit `restaurant`, `check-in`, `leaderboard`...) |
| `npm run i18n:check` | Détection strings FR hardcodées hors `fr.json` |
| `npm test` | Jest |

---

## Conventions (résumé Moka)

- **Aucune couleur en dur** hors `src/theme/tokens.ts` (PRD §15.1)
- **Aucune string FR hardcodée** hors `src/i18n/fr.json` (Claude amendment 5.6)
- **Vocabulaire SPAWT** strict : `spawter` ≠ user, `lieu/spot` ≠ restaurant, `spawt` ≠ check-in, `Le Guet` ≠ VTC (PRD §19, Moka §4.3)
- **Pas de mécanique compétitive** : leaderboard, ranking, points compétitifs interdits (Contrat §20.1)
- **TypeScript strict** : pas de `any` libre, `noUncheckedIndexedAccess` activé

Cf. [`documentation/personas/moka.md`](../documentation/personas/moka.md) pour le protocole complet.

---

## Sprint 1 — état d'avancement

Cf. [`documentation/SPRINT_1_CAHIER_DES_CHARGES.md`](../documentation/SPRINT_1_CAHIER_DES_CHARGES.md) pour le périmètre complet.

**Phase 0 (terminée)** :
- [x] Bootstrap Expo + TypeScript strict
- [x] Theme tokens canoniques (PRD §15.1)
- [x] Types métier (PRD §13 + amendements team 4.x)
- [x] Moteur Palais (`palais-engine.ts`)
- [x] Score matching (`matching.ts`)
- [x] i18n setup + `fr.json` initial
- [x] Lint vocabulaire + i18n check (scripts)
- [x] Adaptateur data-source Supabase ↔ seed
- [x] AsyncStorage + Zustand stores
- [x] Seed data (12 lieux Abidjan)
- [x] Composants : ChatBubble, PlaceCard, AxisRadar, DataSourceBanner
- [x] Splash + écrans consentement + phone + profile + calibration
- [x] Tab nav + Feed + Profile + Place detail
- [x] Spawt manuel (mode démo, sans geofence) → met à jour stade

**Phase 1 (à venir)** :
- [ ] OTP réel (Twilio/Termii)
- [ ] Schémas DB Supabase + RLS + migrations versionnées
- [ ] Le Guet (geofencing background avec expo-location)
- [ ] Avis structuré complet (note + tags + texte + photos)
- [ ] Recherche + Filtres
- [ ] Carte interactive (Mapbox)
- [ ] Partage WhatsApp (deep link)
- [ ] Admin panel (web séparé)

---

## Tester maintenant en 5 minutes

```bash
cd app
npm install
npx expo start --tunnel
# Scanne le QR avec Expo Go (iPhone ou Galaxy)
```

Flow attendu :
1. **Splash** → "Entrer dans la Meute"
2. **Consentement** → accepter géoloc + démographique → Continuer
3. **Téléphone** → +225 07 XX XX XX XX → Continuer
4. **Profil** → Nom + quartier + tranche d'âge + genre → Continuer
5. **Calibration** → 5 questions (Palais initial)
6. **Feed** → 12 lieux triés par score (Palais × distance × note)
7. Tap une fiche → ADN radar + signaux + "Je spawt ici" (mode démo)
8. Onglet **Moi** → ton Palais radar + stade Touriste

Bandeau jaune en haut = rappel "Mode démo, données locales".
