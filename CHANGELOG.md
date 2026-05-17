# SPAWT — Changelog

Toutes les modifications notables du repo. Format : Conventional Commits versionné par Sprint.

---

## v1.2.2 — Epic 2 livré : funnel onboarding complet (Splash → Palais initial) (2026-05-17)

**Batch des 5 stories d'Epic 2 (2.2 → 2.6) livré en review en une seule itération. Le funnel onboarding est complet de bout en bout : Splash `gr-night` → Consent ARTCI bloquant → Phone OTP → OTP 6 cases → Profile 6 champs (nom + quartier + 4 PII) → Calibration 5 questions `OnbMidfi` cartes visuelles → Palais Reveal `gr-night` + premier titre Touriste → `(tabs)`. Mode démo Expo Go traversable sans Supabase ni Termii (`123456` accepte OTP). Mode live consomme migrations 0006 (rename `data_consent_at` → `cgv_accepted_at`), 0007 (`otp_attempts` rate-limit + Termii pin_id), 0008 (`user_palais` 5 axes + RLS). Edge Functions Deno `otp-send` / `otp-verify` scaffoldées en `supabase/functions/` (non déployées, READMEs livrés). `finalizeOnboarding` réécrit : `auth.uid()` + persist `cgv_accepted_at`/`geoloc_consent_at` + reset draft. Triple gate verte + 90 tests passent + smoke web compile (bundle 2.6 MB).**

- `feat(onboarding)` Story 2.2 — Splash `gr-night` (`LinearGradient gradient.night`) + CTA « Entrer dans la Meute » émettant `onboarding_started`. Consent ARTCI bloquant : 2 checkboxes (`ConsentCheckbox` interne, `accessibilityRole="checkbox"`, hit slop 8), CatBubble intro Touriste, bouton « Continuer » gated tant que `!cgv || !geoloc`. Émissions ordonnées `consent_recorded(cgv) → consent_recorded(geoloc) → onboarding_step_completed{step:"consent"}`.
- `feat(onboarding)` Story 2.3 — `phone.tsx` réécrit (regex CIV stricte `+225(0[157]|2)\d{8}` + fallback étranger, `fetch /functions/v1/otp-send`, 429/500 toasts, démo bypass). `otp.tsx` créé (6 cases auto-advance, autoFocus cell-0, backspace retro, auto-submit, mode démo `123456`, panneau friction après 3 essais, cooldown 30s renvoi). Google/Apple buttons reportés Story 2.3a (deps natives non installées).
- `feat(onboarding)` Story 2.4 — `profile.tsx` étendu de 4 à 6 champs (ajout `country_code` + `origin_country_code` avec « Préfère ne pas dire »). Validation 5 champs requis, `accessibilityRole="radio"` sur Choice, `minHeight: 44`. Émet `onboarding_step_completed{step:"profile"}`.
- `feat(onboarding)` Story 2.5 — Migration `0008_create_user_palais.sql` (PK `spawter_id` overwrite, 5 axes `real CHECK BETWEEN -1 AND 1`, RLS, trigger updated_at). Primitive `OnbCard` (grille 2 colonnes selected gold). Moteur pur `calibration-mapping.ts` (`CALIBRATION_QUESTIONS` 5 axes × 24 cartes, `resolveDirection` 0→neutral, all-neg→neg, all-pos→pos, mix→neutral). `calibration.tsx` réécrit OnbMidfi multi-select + progress bar 5 segments. Émet `calibration_answered` par question puis `onboarding_step_completed{step:"calibration"}` puis push `palais-reveal`. **Critical path Epic 2 §5.2 #4 résolu**.
- `feat(onboarding)` Story 2.6 — `palais-reveal.tsx` créé : `gr-night` plein écran + ChatBubble `post_calibration` variant `edito` + PalaisRadar `underConstruction` (confidence=0) + premier titre « Touriste » `palette.gold` + CTA. `OnboardingDraft.started_at: number | null` ajouté. Splash CTA écrit `started_at = Date.now()`. `finalizeOnboarding` réécrit : `auth.uid()` en mode live (fallback `SAMPLE_SPAWTER.id` démo), persist `cgv_accepted_at`/`geoloc_consent_at`, local-first + fire-and-forget Supabase, reset draft. Émet `onboarding_completed` avec `time_to_complete_seconds` + `palais_initial_dominant_axes`. **Clôt Epic 2**.
- `feat(infra)` Migration `0006_rename_data_consent_to_cgv_accepted.sql` — rename `spawters.data_consent_at` → `cgv_accepted_at`, recréation du trigger set-once `assert_consent_set_once`. Down migration restaure version 0005. `supabase/README.md` table « État Sprint 1 » mise à jour : 0006 (2.2), 0007 (2.3 `otp_attempts`), 0008 (2.5 `user_palais`), 0009-0014 décalées d'1 cran.
- `feat(infra)` Edge Functions Deno scaffoldées :
  - `supabase/functions/otp-send/{index.ts, README.md}` — Termii bridge + rate-limit (5 envois/phone/h, 20/IP/h) + `MOCK_TERMII=true` mode CI.
  - `supabase/functions/otp-verify/{index.ts, README.md}` — Termii verify + provisioning user via `auth.admin.createUser({phone, phone_confirm:true})`. Stub V1 : retourne `{user_id}`, l'émission session JWT direct est traçée Defer (Story 2.3 §7).
- `feat(infra)` Naming `data_consent_at` → `cgv_accepted_at` propagé end-to-end : DB (0006), TS types (`Spawter`, `OnboardingDraft`), seed, storage (`setConsent` kind `cgv | geoloc`), store action `recordConsent`, analytics wrapper `ConsentRecorded.kind`, events.md ligne `consent_recorded`. Sign-off Kidam ASYNC documenté.
- `feat(theme)` `OnbCard` primitive ajoutée au barrel `primitives/index.ts`. Icône `check` (24×24 stroke 1.6) ajoutée à `IconName`.
- `feat(i18n)` `fr.json` : sections `consent.*` restructurée (cgv_label/body, geoloc_label/body), `auth.*` (19 clés OTP/Google/Apple), `onboarding.*` étendue (profile_title/body, country_*, gender_*, age_*, origin_country_*, `country.<code>` 10 entrées), `calibration.q_*.card.<altKey>` (24 cartes), `palais_reveal.*` (4 clés), `chat.touriste.geoloc_consent_request` reformulé.
- `test(onboarding)` 12 nouveaux fichiers de tests (Stories 2.2 → 2.6) + 1 audit anti-fuite secrets — couvrent storage, store actions, draft, composants (Splash, Consent, Phone, OTP, Profile, OnbCard, Calibration, PalaisReveal), `finalizeOnboarding` (mode live + démo + throw), `calibration-mapping` (5 axes × 3 cas), `audits/no-secret-leak.test.ts`. Scaffold PGlite `__tests__/integration/migrations.test.ts` (skip si `@electric-sql/pglite` absent — pattern Epic 1 retro §4 #1).

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- `npm test` : 90 tests passent / 17 suites + 3 skipped (PGlite dep manquante) ✓
- `npx expo export --platform web` : bundle 2.6 MB généré sans erreur ✓
- **Smoke device matrice 4** : pending pour merge `main` (cf. Epic 1 retro §3.6).

### Triple sign-off
- **Alexandre** (brand + voix du Chat + Test Tantie Rose) : pending — réviser wording `consent.*`, `auth.*`, `profile_*`, cartes `calibration.q_*.card.*` (24 cartes), `palais_reveal.*`.
- **Stéphanie** (tech) : pending — review migration 0006/0007/0008 + Edge Functions scaffolds + `finalizeOnboarding` réécriture.
- **Kidam** (analytics) : pending — sign-off events.md ligne `consent_recorded` (cgv | geoloc), props `auth_otp_sent.phone_masked`, `onboarding_completed.palais_initial_dominant_axes`.

### Résidus / à suivre (deferred-work.md)
- **Story 2.3a — Google/Apple Sign-In buttons** : deps natives `expo-auth-session`, `expo-apple-authentication`, `expo-crypto`, `expo-web-browser` à installer + 2 nouveaux composants `<GoogleButton/>` + `<AppleButton/>` + wiring `supabase.auth.signInWithIdToken`.
- **Édition `otp-verify` Edge Function** : émission JWT session direct (Supabase v2.45 n'expose pas `auth.admin.createSession` direct ; pattern V1 = stub `{user_id}`). À durcir avant ouverture beta publique (`magiclink + verifyOtp` OU JWT signé serveur).
- **Tests Deno Edge Functions** (`supabase/functions/*/index.test.ts`) : non livrés (runtime Deno non installé). CI Supabase functions dédiée requise.
- **PGlite dep** : `@electric-sql/pglite` à ajouter en devDep pour activer 3 tests skipped (`migrations.test.ts` Stories 2.2 + 2.5).
- **Smoke device matrice 4** : pending merge `main` — cohérent retro Epic 1 §3.6.
- **Re-entry handling** : user qui kill l'app entre OTP success et finalize a un draft éphémère perdu. UX dégradé accepté V1, story Sprint 2 « onboarding resume after auth ».
- **Persistance AsyncStorage du draft `onboarding-draft`** : pour resume mid-calibration. Defer Sprint 2 si data alpha montre dropoff.
- **Migration `collection_titres` (FR-008)** : V1 titre = label stade, collection permanente arrive Sprint 2 / Epic 5.
- **Edge Function `finalize-onboarding` atomique** : V1 = 2 INSERTs serial fire-and-forget. Risque spawter sans palais en cas de network blip — mitigé par AsyncStorage local-first. Defer Sprint 2 si fail rate > 0.5% alpha.

---

## v1.2.1 — Voix du Chat évolutive — fermeture du système (2026-05-17)

**Story 2.1 ferme le système de voix du Chat avant que les Stories 2.2-2.6 et 3.x ne le consomment massivement. La matrice `chat.*` dans `fr.json` est complétée pour les 55 combinaisons (5 stades × 11 moments), avec décision « SILENT volontaire » documentée. Les 3 variants visuels de la primitive `CatBubble` (`bubble`/`lockscreen`/`edito`) ne sont plus des stubs — ils rendent réellement des styles distincts (corner, padding, layout) tous dérivés du `theme`. Le wrapper `ChatBubble` expose la prop `variant` en additif non-breaking ; les 2 callers existants (`(tabs)/index.tsx`, `(tabs)/profile.tsx`) n'ont aucune modification à subir.**

- `feat(theme)` `CatBubble.tsx` — implémentation réelle des 3 variants : `bubble` (coin asymétrique 16/16/16/4 inchangé), `lockscreen` (coin uniforme 12px, padding `sm`, icône 14px, layout row align flex-start — destiné Story 4.2 `SpawtNotif`), `edito` (coin `theme.radius.lg`, padding `lg`, icône 22px en tête, layout column, marginVertical `base` — destiné Story 3.3c `UneCarousel`). Suppression du `console.warn` stub Story 1.3. `void stage` conservé — modulation visuelle par stade réservée Epic 5 (décision Alexandre 2026-05-16).
- `feat(theme)` `ChatBubble.tsx` — prop `variant?: "bubble" | "lockscreen" | "edito"` ajoutée (défaut `bubble`), passe-plat vers `CatBubble`. En `lockscreen`, le `<Text>` interne reçoit `numberOfLines={2}` + `ellipsizeMode="tail"` pour respecter la contrainte notif système.
- `feat(i18n)` `fr.json chat.*` — matrice complète pour les 55 combinaisons (5 stades × 11 moments). 11 entrées non-vides (8 Touriste gold standard validé Alexandre + 1 Explorateur + 1 Détective + 1 Djidji + 1 Guide `stade_up_guide` "Tu es Guide. 51 spots, ton territoire. La Meute te suit." — ton marketing/social proof, sans sacralisation, validé Alexandre 2026-05-17). Les 44 autres sont `""` explicite (silent volontaire, pas de trou structurel). Filet anti-régression : ajouter un `ChatMoment` à l'union TS sans entrée correspondante casse le test de coverage.
- `feat(theme)` `chat-voice.ts` — export du tableau `CHAT_MOMENTS` (11 entrées `as const`) pour réutilisation dans les tests, évite le drift entre l'union TS et la matrice i18n. `ChatMoment` reste typé comme `(typeof CHAT_MOMENTS)[number]`.
- `test(theme)` `__tests__/lib/chat-voice.test.ts` — couvre `chatKey` × 55 combinaisons + `isChatSilent` × 3 invariants (guide silent hors stade_up, stade_up jamais silent, autres stades jamais silent).
- `test(i18n)` `__tests__/i18n/chat-voice-coverage.test.ts` — contract test sur `fr.json` : chaque `(stade, moment)` résout une string définie (peut être `""`, jamais `undefined`). Touriste ≥ 8 entrées non-vides, chaque stade non-Guide a ≥ 1 entrée non-vide, Guide silent partout sauf `stade_up_guide`.
- `test(theme)` `__tests__/components/CatBubble.test.tsx` — smoke des 3 variants sans `console.warn`, vérification que les styles racines diffèrent réellement (coin asymétrique pour bubble, uniforme + row pour lockscreen, column + marginVertical pour edito).
- `test(theme)` `__tests__/components/ChatBubble.test.tsx` — AC #3 réactivité stade-up : `react-test-renderer` + `jest.mock("react-i18next")` démontrent qu'un changement de prop `stade` (1) requête la nouvelle clé `chat.<stade>.<moment>` via `t()`, (2) propage le nouveau `stage` à la primitive `<CatBubble>` enfant. Ajouté post-review Alexandre 2026-05-17 (D2).
- `chore(infra)` `app/package.json` jest config — `moduleDirectories` inclut `node_modules/expo/node_modules` (résolution de `expo-modules-core` qui n'est pas hoisté en racine `app/`) + `testPathIgnorePatterns` exclut `.test-d.ts` (tests de typage compile-time, non-runtime). Débloque l'exécution Jest dans le repo — sans cette config, aucune suite ne tournait.

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- `npm test` : 20 tests passent / 4 suites ✓ (chat-voice, chat-voice-coverage, CatBubble, ChatBubble)
- Audit hex `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components/primitives/CatBubble.tsx` : vide ✓
- Audit literal `grep -rnE 'CatBubble[^>]*>\s*<Text\s+[^>]*>["A-Za-z]' app/src app/app | grep -v ChatBubble.tsx` : vide ✓ (la seule consommation directe de `CatBubble` est `ChatBubble.tsx` lui-même)
- Smoke web (`npx expo export --platform web`) : Metro bundle compile cleanly, 4 bundles JS générés ✓
- **Smoke device matrice 4** : pending — non bloquant pour merge `spawt/v1-bmad`, bloquant pour merge ultérieur sur `main`.

### Triple sign-off
- **Alexandre** (brand + voix du Chat) : matrice « SILENT volontaire vs PARLE » conforme PRD §9.3, Guide silencieux hors stade_up, `stade_up_guide` reformulé post-review pour retirer la sacralisation et passer en ton marketing/social proof ("Tu es Guide. 51 spots, ton territoire. La Meute te suit.") ✓
- **Stéphanie** (lisibilité + non-régression) : signature publique `ChatBubble` non-breaking, 2 callers existants intacts, smoke device matrix **pending** sur les variants `lockscreen`/`edito` (consommés seulement par Stories 4.2 / 3.3c à venir).
- **Kidam** : N/A (aucun événement analytics introduit par cette story).

### Résidus / à suivre
- Smoke device matrice 4 (rendu visuel des 3 variants, font scaling) — pending, voir Verify.
- Sélecteur non-granulaire `useSpawterStore((s) => s.spawter)` dans `(tabs)/index.tsx:27` et `(tabs)/profile.tsx:17` — pattern accepté V1, fonctionne pour la réactivité stade-up (rerend large mais correct). Defer follow-up dédié pour optim perf (anti-scope-creep, cf. Story 1.4 retro §5.5).

### Code review (2026-05-17)
- 3 reviewers parallèles (Blind Hunter / Edge Case Hunter / Acceptance Auditor) — 4/5 ACs PASS + 1 PARTIAL résolu en patch.
- D1 résolu : `guide.stade_up_guide` reformulé en ton marketing/social proof (cf. ci-dessus).
- D2 résolu : test de réactivité AC #3 ajouté (`__tests__/components/ChatBubble.test.tsx`).
- P1 résolu : assertion `isChatSilent` resserrée à `toHaveLength(7)` + commentaire corrigé.
- P2 résolu : `CatBubbleVariant` importé au lieu du literal dupliqué dans `CatBubble.test.tsx`.
- 5 defers tracés dans `_bmad-output/implementation-artifacts/deferred-work.md` (paramètres inversés `isChatSilent`/`chatKey`, `overrideText` whitespace, mismatched `(stade, stade_up_X)`, `moduleDirectories` collision risk, sélecteur non-granulaire).

---

## v1.1.7 — Re-dérivation des 4 composants RN existants (2026-05-16)

**Les 4 composants `ChatBubble`, `AxisRadar`, `PlaceCard`, `DataSourceBanner` consomment désormais les primitives canoniques livrées par Story 1.3 — wrapper-pattern : APIs publiques inchangées, callers (`(tabs)/index.tsx`, `place/[id].tsx`, `(tabs)/profile.tsx`) non modifiés. Plus aucun composant SPAWT en drift visuel vs `midfi-kit.jsx`. Drift i18n corrigé : la string `DataSourceBanner` est migrée dans `fr.json`.**

- `refactor(theme)` `ChatBubble` délègue le rendu visuel à la primitive `CatBubble` (fond noir, coin `16/16/16/4`, `CatIcon` or). La logique domain (résolution `chatKey × Stade × ChatMoment` + `isChatSilent` + `overrideText`) reste dans `ChatBubble.tsx` — primitive consumer-agnostic préservée.
- `refactor(theme)` `AxisRadar` délègue à `PalaisRadar` avec mapping bipolaire `[-1, 1]` → unipolaire `[0, 1]` documenté : `values[i] = Math.abs(axis.value)`, `labels[i] = value >= 0 ? posLabel : negLabel`. **Drift visuel corrigé** : l'ancien lerp `((value + 1) / 2) * radius` rendait un vertex près du centre pour `value = -0.8` (strongly negative) tout en affichant `negLabel` — contradictoire. Le nouveau mapping est cohérent : `|value|` = distance vertex/centre, label = pôle dominant.
- `refactor(theme)` `PlaceCard` consomme `MatchScore` (chip vert ≥85 + `●` doublon), `Stars` (max=5, drift D7), `Chip` (variant `default` pour distance/rating/prix), `Ico walk` (icône distance). Suppression du composant inline `Pill` (mort code). Typographie passée sur `preset.h2`/`preset.body`/`preset.small`.
- `refactor(theme)` `DataSourceBanner` migré sur `preset.caption` (Gotham-Medium 11 uppercase, ls 0.44). String hardcodée FR détectée pendant l'audit → migrée dans `fr.json` sous `common.dataSourceBanner` (fix i18n drift incidental).
- `fix(i18n)` `common.dataSourceBanner` ajouté à `fr.json`. Consommé par `DataSourceBanner` via `useTranslation()`.
- `fix(theme)` `AxisRadar` respecte `exactOptionalPropertyTypes` (`fill` / `underConstructionLabel` passés via spread conditionnel quand définis, omis sinon).

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- Audit hex `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v tokens.ts` : vide ✓
- Smoke web (`expo export --platform web`) : Metro bundle compile cleanly, 4 composants re-dérivés résolus ✓
- **Smoke device matrice 4** (non-régression visuelle bloquante AC #6 epic Story 1.4) : pending — bloquant pour merge ultérieur sur `main`, non bloquant pour `spawt/v1-bmad`.

### Triple sign-off
- **Alexandre** (brand) : 4 composants consomment désormais les primitives canoniques, plus aucun drift vs `midfi-kit.jsx` ✓
- **Stéphanie** (lisibilité + non-régression visuelle) : confirmation matrice 4 devices — **pending** (3 écrans à smoke : `(tabs)/index`, `place/[id]`, `(tabs)/profile`).
- **Kidam** : N/A (aucun événement analytics introduit).

### Résidus / à suivre
- **Smoke device matrice 4** sur les 3 écrans consommateurs.
- **Translucidités** : 4 sites des primitives (`MatchScore`, `PatternDots`, `Button` ghost, `PalaisRadar` axes radiaux) utilisent toujours des rgba inline — pas modifié par cette story, story design system distincte à formaliser si on veut un audit translucidité strict.

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
