# SPAWT — Changelog

Toutes les modifications notables du repo. Format : Conventional Commits versionné par Sprint.

---

## v1.1.6 — Portage des primitives midfi-kit en RN (2026-05-16)

**Les 12 primitives canoniques du `documentation/ux/midfi-kit.jsx` sont portées en composants React Native dans `app/src/components/primitives/` — Ico (29 icônes), Wordmark, Pin, CatIcon, CatBubble, Stars (max=5 / D7), MatchScore (chip vert ≥85 + ● doublon), PalaisRadar (5 axes pentagonal), PatternDots (default/gold), TabBar (Feed/Carte/[FAB]/Meute/Palais), Chip (5 variants), Button (5 variants dont gold-grad via expo-linear-gradient). Toute primitive consomme `useTheme()` — `theme.colors.*` + `theme.typography.preset.*` (livré Story 1.2). Préfixe `Spawt` purgé : `SpawtPin` → `Pin`. Aucun composant existant touché (réservé Story 1.4).**

- `feat(theme)` 12 primitives portées : `Ico` (29 cases du switch SVG), `Wordmark` (Klinsman Bold + ls 2%), `Pin` (drop or + point noir), `CatIcon` (silhouette mascotte), `CatBubble` (fond noir + coin `16/16/16/4`), `Stars` (max=5 par défaut — drift D7 corrigé), `MatchScore` (chip vert ≥85 + `●` doublon de couleur), `PalaisRadar` (5 axes pentagonal + underConstruction overlay), `PatternDots` (variants default/gold via `<Pattern>` SVG), `TabBar` (5 onglets + FAB central débord -22), `Chip` (5 variants union typée), `Button` (5 variants — `gold-grad` via `expo-linear-gradient`).
- `feat(theme)` Barrel `app/src/components/primitives/index.ts` — `import { Ico, Chip, Button } from "@/components/primitives"`.
- `feat(i18n)` Bloc `nav` ajouté dans `fr.json` : `feed`, `map`, `fab`, `meute`, `palais`. Consommé par `TabBar` via `useTranslation()`. Toutes les autres strings primitives restent injectées par le caller (consumer-agnostic).
- `chore(deps)` `expo-linear-gradient ~55.0.14` ajouté (résolveur Expo SDK 55, peer-clean). Consommé uniquement par `Button` variant `gold-grad`.
- `chore(theme)` Préfixe `Spawt` purgé : `SpawtPin` du kit canonique JSX renommé `Pin` côté RN (project-context « Convention de naming » — préfixe Spawt interdit sur primitives techniques).
- `docs(theme)` rgba inline documentés (`MatchScore`, `PatternDots`, `Button` ghost, `PalaisRadar` grille radiale) — la translucidité d'overlay n'a pas d'équivalent token canonique. Justifié dans chaque fichier ; si on veut ramener ces translucidités dans `tokens.ts` plus tard, c'est une story design system distincte.
- Aucun composant existant touché : `ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner` restent intacts — re-dérivation = Story 1.4. Coexistence temporaire (`PalaisRadar` neuf à côté d'`AxisRadar` ancien) acceptée.

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- Audit hex `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v tokens.ts` : vide ✓
- Smoke web (`expo export --platform web`) : Metro bundle compile, 13 nouveaux fichiers + `expo-linear-gradient` + `react-native-svg Pattern`/Defs résolus ✓
- **Smoke device matrice 4 (rendu visuel SVG, FAB débord, gradient, font scaling)** : pending — à valider en alpha (Cahier §5.7), non bloquant pour merge `spawt/v1-bmad`.

### Triple sign-off
- **Alexandre** (brand) : primitives canoniques sans gamif, sans préfixe `Spawt`, Klinsman/Gotham consommés via `useTheme().typography.preset.*` ✓
- **Stéphanie** (lisibilité + cible 44pt + a11y) : confirmation matrice 4 devices — **pending** (rendu visuel SVG + FAB débord + gradient à vérifier sur device).
- **Kidam** : N/A (aucun événement analytics introduit par cette story).

### Résidus / à suivre
- **Smoke device matrice 4** : voir Verify.
- **Story 1.4** : re-dériver les 4 composants existants sur les primitives canoniques ; supprimer `ChatBubble`/`AxisRadar` (remplacés par `CatBubble`/`PalaisRadar`), re-skin `PlaceCard` sur `MatchScore`/`Stars`, re-skin `DataSourceBanner`.
- **Translucidités** : 4 sites utilisent des rgba inline (`MatchScore`, `PatternDots`, `Button` ghost, `PalaisRadar` axes) faute de tokens dédiés — à formaliser en story design system distincte si on veut un audit translucidité strict.

---

## v1.1.5 — Polices Klinsman/Gotham + échelle typographique (2026-05-16)

**Klinsman (Light/Regular/Bold) et Gotham (Book/Medium/Bold) sont chargées au démarrage via `expo-font`, derrière un splash gate qui ne libère l'UI qu'une fois les polices prêtes — ou en erreur (fallback système, jamais d'écran bloquant). L'échelle typo canonique (`t-display`/`h1`/`h2`/`h3`/`body`/`small`/`caption`/`data`/`overline`) est exposée comme `theme.typography.preset.*`. Découverte tardive (review code) : les fichiers Klinsman embarquent un nom PostScript `KlinsmanTypeface{Light,Regular,Bold}` (PAS `Klinsman-{Light,Regular,Bold}` comme leur nom de fichier) — les clés `useFonts` ont été ré-alignées sur les noms PS embarqués pour court-circuiter la couche d'alias `expo-font` et garantir la résolution iOS. Deux items du `deferred-work.md` Story 1.1 se ferment ici (font wiring + redondance `family.voice`/`family.mono`).**

- `feat(theme)` Hook `useAppFonts` (`app/src/theme/useAppFonts.ts`) — `useFonts` d'expo-font avec une clé par fichier alignée sur le **nom PostScript embarqué** (vérifié programmatiquement via lecture de la table `name` OpenType, nameID=6). Erreur de chargement loggée en `__DEV__` uniquement, jamais propagée à l'UI.
- `feat(theme)` Splash gate dans `app/app/_layout.tsx` — `SplashScreen.preventAutoHideAsync()` au module-load, `hideAsync()` dès que `fontsLoaded || fontError`, avec dev-warn sur erreur de hide. Le `RootLayout` retourne `null` (splash natif persistant) tant que ni l'un ni l'autre n'est résolu.
- `feat(theme)` `typography.preset` (9 entrées `TextStyle`) ajouté à `tokens.ts` — valeurs `lineHeight` et `letterSpacing` pré-calculées depuis `spawt-tokens.css` (conversion CSS em → RN px), `textTransform: 'uppercase'` sur `h3`/`caption`/`overline`, `fontVariant: ['tabular-nums']` sur `data`. Type-safe via `satisfies Record<PresetKey, TextStyle>` (TS 4.9+) — la narrowing contextuelle valide la shape et préserve les types littéraux pour les consumers downstream (Story 1.4).
- `refactor(theme)` `typography.family` réaligné sur les noms PostScript embarqués : `family.brand` → `"KlinsmanTypefaceBold"`, `family.body` → `"Gotham-Book"`. **Suppressions** : `family.voice` (redondant — la voix du Chat passe par `preset.h*`) et `family.mono` (proportionnel — le tabulaire passe par `preset.data` + `fontVariant`). Aucun consumer ne référençait ces alias.
- `chore(theme)` 6 fichiers de police copiés de `documentation/ux/fonts/` → `app/src/theme/fonts/` (Klinsman ~1,15 MB + Gotham ~160 KB ≈ 1,3 MB d'assets — sous le budget APK < 50 MB). `documentation/ux/fonts/` reste la source canonique amont.
- `chore(theme)` `size`/`weight`/`lineHeight` numériques **préservés tels quels** — les 12 fichiers existants qui les consomment (`PlaceCard`, `ChatBubble`, `AxisRadar`, `DataSourceBanner`, 8 écrans `app/**`) ne subissent aucune régression. Leur migration vers `preset.*` est Story 1.4.
- `chore(types)` Export d'un nouveau type `TypographyPreset = typeof typography.preset` à côté de `Typography`.

### Code review patches (intégrés en amont du commit)
- `useAppFonts.ts` : suppression du commentaire `// eslint-disable-next-line no-console` (aucun ESLint installé — dead weight).
- `useAppFonts.ts` : suppression de l'export inutile `AppFontsState` (la shape est inlinée dans la signature de retour).
- `tokens.ts` : passage du typage explicite `_preset: { display: TextStyle; ... }` à `_preset = { ... } satisfies Record<PresetKey, TextStyle>` — préserve la narrowing contextuelle des consumers downstream sans flatten.
- `_layout.tsx` : `.catch(() => {})` sur `SplashScreen.hideAsync` remplacé par un dev-warn aligné sur le pattern d'`useAppFonts` — les erreurs réelles ne sont plus silenced.
- `useAppFonts.ts` + `tokens.ts` : clés `useFonts` + `family.brand` + `preset.*.fontFamily` ré-alignées sur les noms PostScript embarqués (`KlinsmanTypefaceBold` etc.) au lieu des noms de fichiers (`Klinsman-Bold`) — découverte review.

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- Audit hex `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v tokens.ts` : vide ✓
- **Smoke launch device (AC #10)** : pending — à valider manuellement via `cd app && npm start` puis Expo Go (vérifier que le splash reste affiché brièvement, l'app monte sans écran blanc bloquant, et qu'un `<Text style={theme.typography.preset.h1}>` rend en Klinsman et pas en fallback système — démo à retirer avant commit).

### Triple sign-off
- **Alexandre** (brand) : Klinsman + Gotham confirmés canoniques depuis Story 1.1 ; échelle typo conforme au brandbook v1.0 ✓
- **Stéphanie** (lisibilité + font scaling) : confirmation on-device matrice 4 devices (Tecno / Infinix / Samsung / iPhone) — **pending**, non bloquant pour le merge sur `spawt/v1-bmad` ; bloquant pour le merge ultérieur sur `main`.
- **Kidam** : N/A (pas d'impact analytics).

### Deferred-work résolus (Story 1.1)
- ✅ « Klinsman/Gotham font wiring still incomplete » — résolu par `useAppFonts` + splash gate.
- ✅ « `family.voice == family.brand` redondant ; `family.mono == "Gotham"` proportionnel » — résolu par suppression des deux alias.

### Résidus / à suivre
- **Smoke device (AC #10)** : voir Verify ci-dessus.
- **Migration des 12 consumers vers `preset.*`** : différée à Story 1.4 (re-dérivation des 4 composants RN existants).
- **`expo-linear-gradient`** : toujours pas installé — la consommation de `gradient.gold` 3-tuple reste en attente d'un premier consumer.

---

## v1.1.4 — Finalisation du token alert-red (2026-05-15)

**Le token `--alert-red`, absent du brandbook v1.0 mais référencé par les mid-fi screens, est tranché et câblé — Story 1.1 close (confirmation Stéphanie sur matrice 4 devices pending, non bloquante).**

- `feat(theme)` `tokens.state.danger` passe du placeholder `#D4603A` à **`#C0392B`** — rouge chaud cohérent avec la palette canonique, distinct de `--amber-warm` (`state.warning`), contraste **WCAG AA** (≈5,2:1 sur `--bg`, ≈5,5:1 sous texte blanc). Le placeholder précédent ne tenait que ≈3,8:1 — sous le seuil AA pour du texte normal.
- `feat(theme)` Ajout du token `--alert-red: #C0392B` à `documentation/ux/spawt-tokens.css` pour que le kit canonique rattrape `tokens.ts` (UX-DR2 résolue).
- `fix(theme)` Pairing `brand.accent` + `text.onBrand` (noir) sub-AA (≈3,3:1) corrigé sur 7 sites — les CTAs Splash, Place, Consent (×2), Phone, Profile et le Pill match-score `PlaceCard` passent maintenant `text.inverse` (blanc cassé, AA ≈6,3:1 sur Vert Chat). Sémantique de `text.onBrand` clarifiée dans `tokens.ts` (« sur `brand.primary` Or uniquement »).
- `docs(theme)` `TODO(brand)` remplacé par un commentaire WHY traçant la décision (Alexandre, 2026-05-15). Commentaire `expo-linear-gradient` adouci (paquet non installé à ce jour).

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- Audit hex `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v tokens.ts` : vide ✓

### Triple sign-off
- **Alexandre** (brand) : valeur `#C0392B` tranchée 2026-05-15 ✓
- **Stéphanie** (contraste WCAG) : confirmation on-device en QA matrice 4 devices — pending
- **Kidam** : N/A (pas d'impact analytics)

---

## v1.1.3 — Réalignement des tokens sur le brandbook canonique (2026-05-14)

**Le kit UX canonique (`SPAWT.zip` → `documentation/ux/`) a été découvert tardivement pendant le workflow `bmad-create-ux-design`. `tokens.ts` et le PRD §15 étaient en drift. Décision X-tin : `documentation/ux/spawt-tokens.css` (brandbook v1.0) est la source canonique UX/brand.**

- `refactor(theme)` `app/src/theme/tokens.ts` réaligné sur `documentation/ux/spawt-tokens.css`. Couleurs corrigées : Or `#D4AF37` → **`#C8A44E`**, Vert Chat `#50C878` → **`#2D6B4F`** (vert forêt), Blanc cassé `#F8F6F0` → **`#FAFAF8`**. Ajout `goldLight`, `greenChatDeep`, `amberWarm`, `cremeSable`, `pureWhite`, `graphite`, `grisMoyen`. Polices `Nunito`/`DM Serif Text`/`Manrope`/`JetBrains Mono` → **`Klinsman` (display + voix du Chat) + `Gotham` (corps + data)**.
- `feat(theme)` Ajout des gradients signature (`gradient.night` / `.gold` / `.sand` — `gr-night`/`gr-gold`/`gr-sand` du kit), du radius `card` (20px) et de l'élévation `glow` (halo or des CTA dorés). Exposés via `ThemeProvider`.
- `chore(theme)` Structure des tokens sémantiques **préservée à l'identique** (`brand`/`surface`/`text`/`border`/`state`/`chat`) — les 4 composants existants (`PlaceCard`, `ChatBubble`, `AxisRadar`, `DataSourceBanner`) héritent de la palette canonique sans modification de leur code.
- `docs(ux)` Kit canonique sécurisé dans `documentation/ux/` (brandbook v1.0, `spawt-tokens.css`, wireframes, mid-fi, polices, logos). Spec UX complète : `_bmad-output/planning-artifacts/ux-design-specification.md` (14 steps) + showcase `ux-design-directions.html`.

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée

### Résidus / à suivre
- **PRD §15.1/§15.3 à amender** pour refléter la palette + les polices canoniques (drift PRD, hors scope code).
- **Polices Klinsman + Gotham** : `typography.family` pointe sur les bons noms, mais les fichiers `.otf`/`.ttf` (`documentation/ux/fonts/`) restent à charger via `expo-font` — story Sprint 1 Phase 0.
- **Token `--alert-red`** absent du brandbook v1.0 alors que les mid-fi screens y réfèrent. `state.danger` garde un placeholder paprika `#D4603A` avec `TODO(brand)` — à valider Alexandre + Stéphanie.
- **Composants à re-dériver structurellement** sur les primitives `midfi-kit.jsx` (forme `CatBubble`, `PalaisRadar`, etc.) — le réalignement tokens ne couvre que la palette/typo, pas la refonte des composants. Couvert par les epics/stories Sprint 1.
- 11 décisions kit ↔ PRD ↔ Contrat (D1-D11) tranchées le 2026-05-14 — voir spec UX § « Canonical Sources & Reconciliation ». D2/D3 (« paws » / « reconnaissances ») à re-challenger en revue Contrat.

---

## v1.1.2 — Bump Expo SDK 52 → 55 (2026-05-04)

**Alignement avec le SDK shippé par Expo Go côté store. PRD §12.1 dit "SDK 52+" — 55 reste dans le contrat.**

- `chore(deps)` Expo `^55.0.19` (était 52.0.0). Cascade : React 19.2.0, React Native 0.83.6, Reanimated 4.2.1, react-native-screens ~4.23.0, expo-router ~55.0.13, jest-expo ~55.0.0, @types/react ~19.2.10, TypeScript ~5.9.2.
- `chore(deps)` `expo-asset` ajouté (peer dep que SDK 55 attend explicitement, pas auto-installé en bootstrap).
- `chore(deps)` `npm install --legacy-peer-deps` parce que jest-expo et React 19 ont des conflits de peer deps cosmétiques (rien de runtime).
- `fix(infra)` Cleanup `package.json` : `@types/react` et `typescript` étaient en doublon (deps + devDeps après `expo install`). Re-rangés en devDependencies uniques.

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- `npx expo install --check` : aligned ✓

### Résidus
- 16 vulnérabilités npm dont 12 modérées et 4 low (héritées des transitives Expo). À auditer en Sprint 1 phase de hardening.
- Doc `app/README.md` mentionne encore "SDK 52" en stack — à corriger par Moka en post-merge sync (Phase 9).

---

## v1.1.1 — Le Guet + premier livrable cliquable (2026-05-03)

**Renommage VTC → Le Guet (anti-jargon Uber/Bolt). App fonctionnelle en mode démo, scannable depuis Expo Go sur iPhone OU Galaxy S23.**

- `chore(vocab)` Renommage **VTC → Le Guet** dans 9 occurrences sur 6 fichiers (PRD ref + personas + cahier des charges + code + Moka). « Le Chat fait le guet » — métaphore féline native, plus de fuite de marque externe (Uber/Bolt).
- `feat(data)` Adaptateur de source de données `lib/data-source.ts` qui bascule entre seed local et Supabase selon `EXPO_PUBLIC_SUPABASE_URL`. L'app fonctionne sans Supabase — pas de paiement requis pour la démo. Implé Supabase chargée dynamiquement (`data-source.supabase.ts`).
- `feat(seed)` 12 lieux Abidjan dans `data/seed/places.ts` (Bô Zinc, Bushman, Tantie Rose, Chez Ambroise, Norias, Sushi Lounge, etc.) avec ADN [-1, 1] aligné PRD §6.1, signaux spéciaux (Pépite vérifiée, Institution, Coup de Cœur, Noctambule). Permet un cold start qualitatif (Claude amendment 5.4).
- `feat(storage)` Wrapper AsyncStorage + Zustand store (`spawter-store.ts`) pour persister spawter + Palais + spawts entre les ouvertures, sans backend. Mode démo entièrement opérationnel.
- `feat(onboarding)` Onboarding complet : consent ARTCI → phone (stub OTP) → profile (nom + quartier + démographique) → calibration (5 questions Palais → axes initiaux). Brouillon éphémère via `onboarding-draft.ts`.
- `feat(feed)` Écran Accueil avec 12 lieux triés par score composite (PRD §8.1), radar de distance, signaux UI, voix du Chat selon stade. Refresh-to-reload.
- `feat(profile)` Écran Moi avec radar Palais SVG 5 axes (mode "En construction" si confidence < 0.3), stade actuel, total spawts, bouton reset démo.
- `feat(place)` Fiche lieu avec ADN radar 5 axes, signaux, infos pratiques (téléphone + WhatsApp tap-to-call), bouton « Je spawt ici » qui enregistre un spawt manuel et met à jour stade automatiquement.
- `feat(components)` `ChatBubble` (voix du Chat i18n par stade), `PlaceCard` (feed), `AxisRadar` (SVG 5 axes universel — Palais ET ADN), `DataSourceBanner` (bandeau jaune mode démo).
- `feat(infra)` `RouteGuard` dans `_layout.tsx` qui hydrate le store au boot et redirige automatiquement vers tabs si onboarding fait, vers splash sinon.
- `chore(deps)` Ajout `@react-native-async-storage/async-storage`, types Zustand déjà présent. `i18next` consommé par tous les écrans.
- `docs(app)` README app/ refondu avec 3 chemins de livraison concrets : (A) Expo Go scan QR — gratuit, iPhone+Android, (B) EAS Build APK Android sideloadable — gratuit, vrai .apk, (C) iOS .ipa nécessite Apple Developer 99 $/an. Flow démo détaillé en 5 min.

### Triple sign-off
- *Stéphanie* : tokens en source unique ✓ — TypeScript strict ✓ — i18n setup ✓ — radar ADN affiche "En construction" si <5 avis (anti-mensonge user) ✓ — matrice devices à valider en alpha
- *Kidam* : flow onboarding instrumentable (events à câbler Sprint 1 amendement 5.1) ✓ — score composite déjà fonctionnel ✓ — funnel onboarding → 1er spawt jouable
- *Alexandre* : voix du Chat par stade dans tout le flow ✓ — vocabulaire SPAWT strict (Le Guet, spawter, lieu) ✓ — pas de leaderboard / points compétitifs ✓ — Test Tantie Rose : la fiche Maquis Chez Tantie Rose existe en seed avec note 4.8 et badge Pépite vérifiée ✓

---

## v1.1.0 — Bootstrap iOS Expo + Persona Moka (2026-05-03)

**Moka démarre. Premier scaffold de l'app iOS, alignée PRD V1 et cahier des charges Sprint 1.**

- `feat(infra)` Init git repo + branche `moka/ios-bootstrap` pour développer en autonomie
- `feat(persona)` Moka — opérateur expert SPAWT, adapté de NEFER (LAFUFU/ADVE-project) au contexte SPAWT. Protocole 8 phases, mantra "grep avant écrire", 4 interdits absolus, vocabulaire SPAWT strict, triple sign-off Stéphanie/Kidam/Alexandre. Cf. `documentation/personas/moka.md`
- `feat(app)` Bootstrap Expo SDK 52 + TypeScript strict + Expo Router v4 dans `app/`. iOS-first avec Info.plist conformes ARTCI (geoloc usage description en français)
- `feat(theme)` Tokens canoniques `app/src/theme/tokens.ts` — palette PRD §15.1 (#0A0A0A / #D4AF37 / #50C878 / #F8F6F0) + nuances WCAG-compliant héritées du prototype Vite
- `feat(types)` Modèles métier TypeScript alignés PRD §13 + amendements team 4.x : `spawter` (avec country_code, origin_country_code, gender, age_range), `place` + `place_adn`, `palais` (5 axes), `stade` (5 stades canoniques Touriste→Guide), `spawt_checkin` (mécanisme du Guet + drapeaux anti-fraude)
- `feat(palais)` Moteur Palais `app/src/lib/palais-engine.ts` — apprentissage exponentiel (PRD §5.6), confidence_score, axes dominants
- `feat(matching)` Score composite `app/src/lib/matching.ts` — 0.15·cos + 0.30·dist + 0.30·note + 0.10·rec + 0.15·nov, affichage [50%, 99%] (PRD §8.1, §20.6)
- `feat(i18n)` Setup `i18next` + `expo-localization` + `fr.json` initial avec voix du Chat par stade (PRD §9.3) — Claude amendment 5.6
- `feat(onboarding)` Écran consentement ARTCI / Loi 2013-450 (geoloc + démographique) — Claude amendment 5.2. Splash screen avec voix du Chat
- `chore(scripts)` Audits anti-drift `lint-vocab.mjs` (vocabulaire SPAWT — interdit `restaurant`, `check-in`, `leaderboard`...) et `i18n-check.mjs` (strings FR hardcodées hors `fr.json`)
- `docs(governance)` `.gitignore` + `app/README.md` (état Sprint 1 + structure)

### Hors scope (intentionnel, à venir)
- Pas d'auth OTP fonctionnelle (UI scaffold seulement)
- Pas de connexion Supabase active (env vars à fournir)
- Pas de Mapbox / CinetPay (Phase 0 PRD §17)
- Pas de migrations DB versionnées (à venir Sprint 1 Phase 1)

### Triple sign-off
- *Stéphanie* : tokens en source unique ✓ — TypeScript strict ✓ — i18n setup ✓ — lint scripts ✓
- *Kidam* : taxonomie events à venir (Claude amendment 5.1) — funnel onboarding scaffolded
- *Alexandre* : voix du Chat par stade dans `fr.json` ✓ — vocabulaire SPAWT strict ✓ — audit anti-leaderboard ✓
