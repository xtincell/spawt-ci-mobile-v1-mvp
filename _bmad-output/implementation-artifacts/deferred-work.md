# Deferred Work — SPAWT Mobile CI

Tracks issues surfaced during reviews that were intentionally deferred (pre-existing, out-of-scope, or scheduled for a later story). Each entry: short description + originating story + suggested follow-up target.

---

## Deferred from: code review of story-1-1 (2026-05-15)

- **`border.subtle` opaque → translucent affects disabled-CTA backgrounds** — `border.subtle` went from `tone.cream[70]` (opaque `#DCD5C2`) to `rgba(10,10,10,0.10)` (translucent) in commit `979ee2d`. Affected disabled-CTA backgrounds in `app/app/(onboarding)/consent.tsx`, `phone.tsx`, `profile.tsx`. → Validate visually in **Story 1.4** (Re-dérivation des 4 composants) or in the relevant onboarding stories (Epic 2).
- **`chat.*` semantics flipped (guide `cream→black`, detective `gold→green`, djidji `emerald→greenChatDeep`)** — Introduced by 979ee2d. No current consumers reference `theme.colors.chat.*`. Risk: future ChatBubble using `chat.guide` as a light bg with `text.primary` (black) would render black-on-black. → Re-evaluate when **Story 1.4** re-derives `ChatBubble → CatBubble`.
- **`elevation.glow` gold halo is iOS-only** — Android's `elevation` numeric ignores `shadowColor`/`shadowOpacity`; the "halo or des CTA dorés" will render as a generic grey shadow on Android. → Add `Platform.select(...)` when the first gold CTA wires `elevation.glow`.
- **`elevation.md/.lg` shadow radii inflated 2–2.5× vs pre-realignment** — `md.shadowRadius` 8 → 16, `lg.shadowRadius` 16 → 40, `lg.shadowOffset.height` 4 → 12. Components inherit larger, lower shadows without code change. → Validate visual rendering on the 4-device matrix during **QA alpha** (Cahier §5.7).
- **Klinsman/Gotham font wiring still incomplete** — `typography.family` points to `"Klinsman"` / `"Gotham"`, but the `.otf`/`.ttf` files in `documentation/ux/fonts/` are not yet loaded via `expo-font`. iOS resolves `fontFamily` by PostScript name (e.g., `Gotham-Book`), not family name + weight — RN won't synthesize weights. `family.voice == family.brand` (both Klinsman) is also semantically redundant; `family.mono == "Gotham"` is proportional and breaks columnar data alignment. → All addressed by **Story 1.2** (Intégration des polices Klinsman & Gotham + échelle typographique).
- **`gradient.gold` 3-tuple vs `gradient.night/.sand` 2-tuples — shape heterogeneity; `Theme` type widens with `gradient`** — Consumers typed for a fixed `[string, string]` tuple will break; subset types mirroring `Theme` shape pre-`gradient` won't assign. → Defer until the first `<LinearGradient>` consumer wires up — that's the moment to unify the typing.
- **Story 1.1 commit not yet made** — Work is in the working tree on `theme/align-canonical-tokens`; merge target is `spawt/v1-bmad`. → Commit after the open `decision_needed` and `patch` findings are resolved.

---

## Deferred from: code review of stories 1-2 / 1-3 / 1-4 (2026-05-16)

- **`useAppFonts` log warn `__DEV__`-only, aucun Sentry/telemetry en prod** — drift typographique en prod indétectable. → Lié à l'install Sentry (deferred-work brut Sprint 1). [story 1.2]
- **`tokens.ts.lineHeight` fractionnaires (35.7, 28.6, …) — Android sub-pixel rounding** — alignement vertical possiblement divergent iOS/Android. → Tester explicitement sur la matrice 4 devices alpha. [story 1.2]
- **`tokens.ts.textTransform: "uppercase"` + caractères non-Latin / emoji** — `toUpperCase()` JS peut produire des artefacts sur signaux (`❤️ Coup de Cœur`). → Smoke test avec strings réelles signaux/cuisine. [story 1.2]
- **Story 1.2 AC #10 — smoke device manuel PENDING** — tracé pending dans CHANGELOG v1.1.5, non bloquant pour merge `spawt/v1-bmad`, bloquant pour merge `main` (sign-off Stéphanie + matrice 4 devices). [story 1.2]
- **`_layout.tsx` early-return `null` côté web** — `expo-splash-screen` est no-op sur web et `useFonts` peut tarder ; comportement actuel = écran blanc bref toléré. → Audit en cible web Sprint 2 si web devient un canal. [story 1.2]
- **`<Pattern>` `react-native-svg 15.x` Android driver bug connu** — combinaison `<Pattern>` + `<Rect fill="url(#dots)">` peut rendre noir uni ou vide. Aucun fallback documenté. → Fallback `<Circle>` répétés en boucle si reproduit en alpha. [story 1.3]
- **`Pin` dot central `theme.colors.surface.inverse` — break dark mode futur** — point blanc sur fond or si la surface inverse change. → Re-évaluer quand la palette dark mode est introduite. [story 1.3]
- **`PalaisRadar.fontSize=9` non tokenisé** — dérogation à `preset.overline` documentée inline. → Tokeniser `typography.size.micro` ou similaire en design system pass futur. [story 1.3]
- **`Chip` borderWidth 2.5 magic number pour `dark` selected** — pas de token, pas de commentaire. → Tokeniser en `theme.border.width.toggle` lors du pass design system. [story 1.3]
- **Casts type suspects `as unknown as readonly [string, string, ...string[]]` + `as ViewStyle`** — révèlent un déficit de typage dans `tokens.ts` (`gradient.gold` tuple non-empty, `elevation.glow` shape). → Type cleanup pass dédié sur `tokens.ts`. [story 1.3]
- **`Ico` / `PalaisRadar` `size <= 0` ou non-finite** — viewBox malformé possible (animated value en transition). → Garde `Math.max(size, 1)` à ajouter si un caller introduit un Reanimated value. [story 1.3]
- **`PalaisRadar` labels positionnés à 1.18r — clipping risk sur petites tailles** — pas d'`overflow="visible"` sur le Svg. → Ajouter si reproduit visuellement. [story 1.3]
- **`Ico.pin` filled : le dot central ignore la prop `color`** — incohérence visuelle si caller surcharge la couleur. → Patch si l'usage filled+color custom apparaît. [story 1.3]
- **`PalaisRadar.stroke` variable mal nommée (sert de `fill` ET `stroke`)** — confusion lecture, pas un bug. → Renommer en cleanup pass. [story 1.3]
- **`PlaceCard.SIGNAL_LABELS[s] ?? s` fallback brut snake_case** — un nouveau signal backend non mappé affiche `coup_de_coeur` brut. → Humaniser via i18n quand le set de signaux s'agrandit. [story 1.4]
- **AA contraste `state.warning` + `text.onBrand` non formellement validé** — pairing introduit par `DataSourceBanner` re-skin, visuellement probablement AA-clean mais non bookkeepé. → Tracer la validation contrast dans `_bmad-output/planning-artifacts/ux-design-specification.md`. [story 1.4]

---

## Deferred from: code review of stories 1-5 / 1-6 / 1-7 / 1-8 (2026-05-16)

- **`spawters.country_code` / `origin_country_code` CHECK fermé sur 10 codes CIV-region** — un 11ème pays (Mauritanie, Niger) requiert une migration. Acceptable V1 (scope CIV). → Re-évaluer si onboarding multi-pays Sprint 2+. [story 1.5]
- **`phone_e164` regex permissif (`^\+[1-9]\d{1,14}$`)** — accepte un `+22512345` invalide CIV. Validation client + provider OTP (Termii/Twilio) filtreront. → Pas un bug fonctionnel V1. [story 1.5]
- **`spawters.gender` vocab FR-locale (`homme/femme/autre/non_renseigne`) côté DB** — couplage UI ↔ DB. Acceptable V1, à re-considérer si i18n EN/PT s'ajoute. [story 1.5]
- **`customers` UNIQUE `(spawter_id, customer_type)` — race insert concurrent depuis 2 devices renvoie `23505` opaque** — caller adapter doit faire `INSERT ... ON CONFLICT DO NOTHING`. → Implémenter quand l'adapter customers atterrit (post-Epic 2 paywall). [story 1.6]
- **`plans.price_ht = 0 AND period = 'lifetime'` non bloqué** — création accidentelle d'un « Gold gratuit à vie » possible. → Ajouter CHECK ou whitelist `plan_code` quand l'admin panel de plans landera. [story 1.6]
- **`currencies` FK `ON DELETE RESTRICT` → lock-in opérationnel** — une currency référencée ne peut jamais être supprimée. Probablement voulu mais pas documenté. → Tracer dans `supabase/README.md` ou architecture doc lors d'un cleanup pass. [story 1.6]
- **`analytics.ts` import direct de `./data-source.supabase` (pas via `data-source.ts`)** — règle d'or = écrans passent par `data-source.ts`. `analytics.ts` est `lib/`, pas un screen, exception admissible mais inconsistance notable. → Standardiser dans un cleanup pass (déplacer `insertUserSignal` derrière `data-source.ts`). [story 1.7]
- **`UNIQUE NULLS NOT DISTINCT` requiert PG 15 — pas de guard `DO $$ assert version $$`** — `config.toml` déclare `major_version = 15` donc OK en pratique, mais un projet Supabase legacy pinné PG 14 raise syntax error opaque. → Ajouter `DO` block défensif dans cleanup migration pass. [story 1.8]
- **`useFlagsPolling()` hook absent** — spec AC #6 listait le hook mais autorisait le déferrement ; completion notes le confirment. → Câbler quand le premier consumer flag (paywall, ranking toggle) atterrit. [story 1.8]
- **Web FOUT (flash of unstyled text) après `_layout.tsx` gate disabled sur web** — composants montent en fallback Roboto puis re-layout. Acceptable pour V1 mobile-first. → Audit cible web Sprint 2. [story 1.2 — post-review tweaks]

---

## Deferred from: code review of 2-1-voix-du-chat-evolutive (2026-05-17)

- **`isChatSilent(stade, moment)` vs `chatKey(moment, stade)` — ordre paramètres inversé** [`app/src/lib/chat-voice.ts:35,40`] — API du moteur pur Story 1.3. Footgun pré-existant : `chatKey` prend `(moment, stade)`, `isChatSilent` prend `(stade, moment)`. → Réactiver si un 3ème caller émerge ou si un bug d'ordre paramètres apparaît en revue.
- **`overrideText` whitespace-only rend une bulle vide visible** [`app/src/components/ChatBubble.tsx:33-37`] — edge case mineur. Le `??` ne trim pas et `if (!overrideText && ...)` est faussé par `"   "`. → Réactiver si un consumer passe du contenu dynamique non-trimmed (notif Story 4.2, pavé baseline Story 3.3c).
- **Mismatched `(stade, stade_up_X)` callers — pas de dev-warn** [`app/src/components/ChatBubble.tsx:35`] — caller error swallowed (e.g. `(touriste, stade_up_djidji)` → `""` → null). Cohérent avec design matrice mais silencieux. → Ajouter assert dev-only si un consumer Sprint 2+ produit ce bug.
- **`jest.moduleDirectories` collision risk avec nested expo node_modules** [`app/package.json:55-63`] — infra fix accepté pour débloquer Jest (jest-expo nested module non-hoisté). → Monitor : si dual-React ou hooks-mismatch error apparaît, migrer vers `jest.config.js` avec `moduleNameMapper` explicite.
- **`(tabs)/index.tsx:27` `useSpawterStore((s) => s.spawter)` non-granulaire** [`app/app/(tabs)/index.tsx:27`] — déjà documenté en Defer dans Story 2.1 Task 5 + Dev Notes §3. Optim perf, hors scope (anti-scope-creep retro Epic 1 §3.5). → Réactiver via follow-up dédié si rerenders excessifs détectés au profilage Sprint 2.

---

## Deferred from: batch Epic 2 dev (Stories 2.2 → 2.6) (2026-05-17)

- **Story 2.3a — Google/Apple Sign-In secondary buttons** — Stories 2.3 AC #3 + #4. Deps natives non installées (`expo-auth-session`, `expo-apple-authentication`, `expo-crypto`, `expo-web-browser`). UX Story 2.3 reste fonctionnelle OTP-only. → Spawner une story dédiée 2.3a quand on est prêt à installer les deps + tester sur device.
- **Édition `otp-verify` Edge Function — émission session JWT direct** [`supabase/functions/otp-verify/index.ts`] — Supabase v2.45 n'expose pas `auth.admin.createSession`. V1 retourne `{user_id}`. Client mobile ne peut pas ouvrir la session Supabase live sans pattern complémentaire (`magiclink + verifyOtp` côté client OU JWT signé serveur). → Durcir avant ouverture beta publique. Pas un bloquant Sprint 1 alpha (mode démo Expo Go reste OK).
- **Tests Deno Edge Functions** (`supabase/functions/otp-send/index.test.ts`, `otp-verify/index.test.ts`) — Story 2.3 AC #8-3, #8-4. Runtime Deno non installé localement, suite Jest mobile reste séparée. → CI Supabase functions dédiée requise (workflow `.github/workflows/supabase-functions.yml`).
- **PGlite devDep `@electric-sql/pglite`** — Tests `__tests__/integration/migrations.test.ts` (Stories 2.2 + 2.5) sont skipped si dep absente. Pattern Epic 1 retro §4 #1 documenté mais artifacts non committés. → Ajouter `npm i -D @electric-sql/pglite` puis activer les suites en CI.
- **Re-entry handling — onboarding interrompu post-OTP** — Story 2.3 Dev Notes §3 + Story 2.6 AC #2. Si user kill l'app entre OTP success et finalize Story 2.6 : session auth active mais `spawter === null` → RouteGuard redirige Splash → re-OTP forcé (re-utilise même auth.users row, finalize créera le spawter au prochain bouclage). UX dégradé accepté V1. → Story Sprint 2 « onboarding resume after auth » si data alpha montre dropoff.
- **Persistance AsyncStorage du draft `onboarding-draft`** — Stories 2.2 §7, 2.5 §7. Permettrait resume mid-calibration. V1 = draft éphémère mémoire. → Sprint 2 si dropoff alpha mesurable entre consent et finalize.
- **Migration `collection_titres` (FR-008 collection permanente)** — Story 2.6 Dev Notes §1. V1 = `premier titre = label stade` (« Touriste »). Pas de table `collection_titres`. → Epic 5 Sprint 2 — Story 5.2 « Collection de titres + titre affiché ».
- **Edge Function `finalize-onboarding` (transaction atomique serveur)** — Story 2.6 Dev Notes §4. V1 = 2 INSERTs serial fire-and-forget (spawters + user_palais). Risque théorique : spawter sans palais en DB si network blip entre les 2. AsyncStorage local-first mitige. → Sprint 2 si fail rate > 0.5% alpha.
- **Job de réconciliation spawter ↔ user_palais** (orphelins) — Story 2.6 Dev Notes §4. Cron côté backend qui recreate user_palais empty si manquant. → Sprint 2 conditionnel.
- **`<GrNightScreen>` primitive wrapper** — Story 2.6 §7. V1 = pattern `LinearGradient gradient.night` inline dans 2 écrans (Splash + PalaisReveal). À promouvoir si 3+ consumers (StadeCelebration Story 5.4). → Sprint 2.
- **Cartes calibration canoniques wording** — Story 2.5 §2. 24 cartes draft V1 (4-6 par axe × 5 axes), wording à valider Test Tantie Rose Alexandre + sign-off final. Itération i18n possible sans migration (pas de schema lock).
- **Anti-régression test « splash CTA set started_at »** — Story 2.6 AC #8-3. Pas explicitement asserté dans `SplashScreen.test.tsx` (testable indirectement via `finalize-onboarding.test.ts`). → Étendre le test si Stéphanie en review identifie un risque de régression.
- **Test PalaisRevealScreen — affichage erreur** — Story 2.6 test couvre `finalize throw → pas de navigation` mais ne vérifie pas que l'erreur i18n est visible dans le DOM. → Ajouter assertion `findByProps` sur le `<Text>` d'erreur si Stéphanie le demande.
- **Légal placeholder `[pending juriste]` dans strings consent `cgv_body` + `geoloc_body`** — Story 2.2 §7. À remplacer par rédaction juriste DR-CGV-01 avant lancement public.
- **`demographics_consent_request` ChatMoment** — Story 2.2 §7. Conservé dans `chat-voice.ts` matrice mais inutilisé après FR-040. → Supprimer si aucun caller n'émerge d'ici Sprint 2 (code mort à nettoyer).
- **`tokens.ts` commentaire obsolète sur `expo-linear-gradient`** — corrigé Story 2.2 Task 7 (« non installée à ce jour » → « installé Story 2.2 `~55.0.14` »).
- **Re-calibration depuis Profil** (FR-002 sous-jacent) — Story 2.5 §7. V1 = pas d'écran de re-cal ; le Palais apprend via les spawts. → Sprint 2 si data alpha montre besoin de reset.
- **OnbStep primitive** — Story 2.5 §7. V1 = pattern inline `ProgressSegments` dans calibration.tsx. Promouvoir si autre flow multi-step émerge Sprint 2 (Premium upsell?).
