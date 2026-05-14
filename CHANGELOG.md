# SPAWT — Changelog

Toutes les modifications notables du repo. Format : Conventional Commits versionné par Sprint.

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
