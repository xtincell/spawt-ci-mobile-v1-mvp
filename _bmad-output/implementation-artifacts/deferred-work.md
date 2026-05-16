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
