# Story 1.1: Réalignement des tokens canoniques

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur SPAWT,
I want `app/src/theme/tokens.ts` réaligné sur `documentation/ux/spawt-tokens.css` (brandbook v1.0),
so that tous les écrans consomment la palette de marque canonique via `useTheme()` sans aucune couleur en dur.

## ⚠️ Brownfield context — read first

**Most of this story is already implemented.** Commit `979ee2d` (`refactor(theme): réaligne tokens.ts sur le brandbook canonique`, branch `theme/align-canonical-tokens`, CHANGELOG v1.1.3) already rewrote `tokens.ts` onto the canonical palette, fonts, gradients, radius and elevations, and the hex audit + triple gate already pass.

Your job is **not** to rewrite `tokens.ts` from scratch. It is to:
1. **Verify** the current `tokens.ts` against every clause of the Acceptance Criteria below — clause by clause — and patch any gap.
2. **Wire the one resolved open item**: set the `--alert-red` token to its decided value `#C0392B` (see AC #7 and the Resolved Decision note — the value is no longer blocked).
3. **Re-confirm** the hex audit + triple gate still pass.

Do not regress the existing token structure (`brand` / `surface` / `text` / `border` / `state` / `chat` / `gradient` / `typography` / `spacing` / `radius` / `elevation`). The 4 existing components consume it as-is — see Dev Notes.

## Acceptance Criteria

1. **Palette canonique present.** `tokens.ts` carries the canonical palette with these exact hex values: Noir `#0A0A0A`, Or `#C8A44E`, Or clair `#E8D5A0`, Vert Chat `#2D6B4F`, Vert Chat foncé `#1F4D39`, Blanc cassé `#FAFAF8`, Ambre `#E89A39`, Crème sable `#EFE8DC`, Graphite `#333333`, Gris moyen `#8A8A8A`. (Pure white `#FFFFFF` is also retained as `--bg-card`.)
2. **Semantic tokens present.** The semantic concepts of `spawt-tokens.css` are all represented: `--bg` (blanc cassé), `--bg-card` (blanc pur), `--bg-warm` (crème sable), `--ink` / `--ink-soft` / `--ink-mute`, `--line` / `--line-strong`. They may keep the existing by-usage structure (`surface.base/raised/subtle`, `text.primary/secondary/tertiary`, `border.subtle/strong`) — see Dev Notes "Semantic naming".
3. **Gradients present.** `gr-night` (`#0A0A0A → #1A1A2E`, 180°), `gr-gold` (`#C8A44E → #E8D5A0 → #C8A44E`, 135°), `gr-sand` (`#EFE8DC → #FAFAF8`, 135°) and `sh-glow` (`0 0 20px rgba(200,164,78,.30)` — gold halo on gold CTAs) are all available.
4. **Radius present.** `r-s` (4), `r-m` (8), `r-l` (16), `r-card` (20) are all available.
5. **Elevations present.** `sh-s` (offset 0/2, radius 4, opacity .12), `sh-m` (0/4, 16, .10), `sh-l` (0/12, 40, .18) are all available.
6. **All tokens reach components via `ThemeProvider` / `useTheme()`** — no token added that is not exposed through the theme value.
7. **`--alert-red` token added with a contrast-validated value.** `tokens.state.danger` carries `#C0392B` — a warm red distinct from `--amber-warm` (`state.warning`), with contrast ≈5.2:1 on `--bg` (`#FAFAF8`) and ≈5.5:1 under white text, both **WCAG AA for normal text**. Value decided by Alexandre on 2026-05-15 (see Resolved Decision); Stéphanie confirms on-device during the 4-device matrix (non-blocking). Token reaches components via `useTheme()` → `theme.colors.state.danger`.
8. **Hex audit empty.** `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"` returns nothing.
9. **Triple gate passes.** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check` all pass.

## Tasks / Subtasks

- [x] **Task 1 — Audit current `tokens.ts` against AC #1–#6 (AC: 1,2,3,4,5,6)**
  - [x] Open `app/src/theme/tokens.ts` and `documentation/ux/spawt-tokens.css` side by side.
  - [x] Verify every hex in `palette` matches AC #1 exactly. Patch any mismatch. → all 10 canonical hex match; no patch needed.
  - [x] Verify the semantic mapping covers `--bg`/`--bg-card`/`--bg-warm`/`--ink`/`--ink-soft`/`--ink-mute`/`--line`/`--line-strong`. → all concepts present under the by-usage structure; no rename, no patch.
  - [x] Verify `gradient.night/gold/sand` values and `elevation.glow` match AC #3. → match.
  - [x] Verify `radius.sm/md/lg/card` = 4/8/16/20 and `elevation.sm/md/lg` match AC #4–#5. → match.
  - [x] Verify `ThemeProvider.tsx` exposes every token group (`colors`, `typography`, `spacing`, `radius`, `elevation`, `gradient`). → all exposed; no patch.
- [x] **Task 2 — Wire the `--alert-red` token (AC: 7)** — value decided, see Resolved Decision
  - [x] Set `tokens.state.danger` to `#C0392B` (replacing the `#D4603A` placeholder).
  - [x] Replace the `TODO(brand, 2026-05-21)` comment with a one-line WHY tracing the Alexandre 2026-05-15 decision + AA contrast.
  - [x] Confirm it stays exposed via `useTheme()` (`theme.colors.state.danger`). No other `state` token changed.
- [x] **Task 3 — Re-run the audits (AC: 8,9)**
  - [x] Hex audit → empty ✓
  - [x] `npx tsc --noEmit` → 0 errors ✓
  - [x] `npm run lint:vocab` → pass ✓
  - [x] `npm run i18n:check` → pass ✓
- [x] **Task 4 — Document the change**
  - [x] Added CHANGELOG entry `v1.1.4 — Finalisation du token alert-red (2026-05-15)` with `### Verify` + `### Triple sign-off` sections, Moka format.

### Review Findings

- [x] **[Review][Patch] `text.onBrand` (noir) sub-AA on `brand.accent` (#2D6B4F)** — flipped to `text.inverse` (blanc cassé, AA ≈6,3:1) on the 7 confirmed pairings: `app/app/index.tsx:59`, `app/app/place/[id].tsx:217`, `app/app/(onboarding)/consent.tsx:111` + `:206`, `phone.tsx:82`, `profile.tsx:116`, `app/src/components/PlaceCard.tsx:73`. `text.onBrand` comment in `tokens.ts:52` now clarifies it's for `brand.primary` (Or) only.
- [x] **[Review][Patch] CHANGELOG v1.1.4 wording** [CHANGELOG.md] — header now reads "Story 1.1 close (confirmation Stéphanie sur matrice 4 devices pending, non bloquante)".
- [x] **[Review][Patch] `--alert-red: #C0392B;` ajouté au kit canonique** [documentation/ux/spawt-tokens.css] — bloc « Semantic — states (ajout post-brandbook v1.0) » avec WHY comment. UX-DR2 résolue.
- [x] **[Review][Patch] `tokens.ts:79` gradient comment softened** — « via une lib gradient (ex: expo-linear-gradient — non installée à ce jour). »
- [x] **[Review][Patch] Staging discipline** [process] — commit stage to include only the Story 1.1 files (`app/src/theme/tokens.ts`, `app/src/components/PlaceCard.tsx`, `app/app/index.tsx`, `app/app/place/[id].tsx`, `app/app/(onboarding)/consent.tsx`, `phone.tsx`, `profile.tsx`, `CHANGELOG.md`, `documentation/ux/spawt-tokens.css`, the story file, `sprint-status.yaml`, `deferred-work.md`). `.claude/settings.local.json` + `_bmad/bmm/config.yaml` excluded — commit separately if desired.

#### Review Verify (post-patch, 2026-05-15)

- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- Audit hex (`grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v tokens.ts`) : vide ✓
- [x] **[Review][Defer] `border.subtle` opaque → translucent affects disabled-CTA backgrounds** [app/app/(onboarding)/consent.tsx, phone.tsx, profile.tsx] — deferred, pre-existing (introduced by 979ee2d, validate visually in Story 1.4 or the onboarding stories).
- [x] **[Review][Defer] `chat.*` semantics flipped (guide cream→black, detective gold→green, djidji emerald→deep)** [app/src/theme/tokens.ts:69-75] — deferred, pre-existing (introduced by 979ee2d, no current consumers; re-evaluate when CatBubble re-derivation lands in Story 1.4).
- [x] **[Review][Defer] `elevation.glow` gold halo is iOS-only — Android elevation ignores `shadowColor`** [app/src/theme/tokens.ts:168-174] — deferred, pre-existing (Platform.select needed when first gold CTA wires `elevation.glow`).
- [x] **[Review][Defer] `elevation.md/.lg` shadow radii inflated 2–2.5× vs pre-realignment** [app/src/theme/tokens.ts:154-167] — deferred, pre-existing (validate visual rendering on the 4-device matrix during QA).
- [x] **[Review][Defer] Klinsman/Gotham PostScript naming, `family.voice == family.brand`, `family.mono` proportional** [app/src/theme/tokens.ts:91-95] — deferred to Story 1.2 (intégration des polices via `expo-font`).
- [x] **[Review][Defer] `gradient.gold` is a 3-tuple while `gradient.night`/`gradient.sand` are 2-tuples; Theme type widens with `gradient`** [app/src/theme/tokens.ts:80-84, ThemeProvider.tsx:10] — deferred until the first gradient consumer lands.
- [x] **[Review][Defer] Story 1.1 commit not yet made on `theme/align-canonical-tokens`** [process] — deferred, already noted in Dev Agent Record line "Changes not yet committed — awaiting user".

## Dev Notes

### Current state of `tokens.ts` (already realigned by `979ee2d`)

`app/src/theme/tokens.ts` exports: `palette` (raw canonical hex — the only place hex may appear), `tokens` (semantic, structured `brand`/`surface`/`text`/`border`/`state`/`chat`), `gradient` (`night`/`gold`/`sand` as RN-ready color arrays for `expo-linear-gradient`), `typography`, `spacing`, `radius`, `elevation`. Types `Tokens`, `Typography`, `Gradient` are exported.

`app/src/theme/ThemeProvider.tsx` builds `themeValue = { colors: tokens, typography, spacing, radius, elevation, gradient }` and exposes it via `useTheme()`. **Any token group must be added to `themeValue` or components cannot reach it.**

### Semantic naming — keep the by-usage structure (do NOT rename)

The AC lists the canonical CSS variable names (`bg`, `bg-card`, `ink`, `line`…). `tokens.ts` deliberately uses a **by-usage** structure instead (`surface.base`, `text.primary`, `border.subtle`…). This was a conscious decision in `979ee2d` ("structure des tokens sémantiques préservée à l'identique") so the 4 existing components inherit the canonical palette **without code changes**. The mapping is 1:1:

| `spawt-tokens.css` | `tokens.ts` |
|---|---|
| `--bg` | `surface.base` |
| `--bg-card` | `surface.raised` |
| `--bg-warm` | `surface.subtle` |
| `--ink` | `text.primary` |
| `--ink-soft` | `text.secondary` |
| `--ink-mute` | `text.tertiary` |
| `--line` / `--line-strong` | `border.subtle` / `border.strong` |

Treat AC #2 as "every canonical semantic concept is represented", **not** "rename to CSS names". Renaming would break `ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner` for zero brand benefit.

### Files this story touches

- **UPDATE — `app/src/theme/tokens.ts`** — the only file expected to change, and only if Task 1 finds a gap or Task 2 lands a validated `--alert-red`. Current state: realigned, all palette/gradient/radius/elevation values canonical, `state.danger` is a `#D4603A` placeholder with `TODO(brand, 2026-05-21)`.
- **READ-ONLY reference — `documentation/ux/spawt-tokens.css`** — the canonical source. `:root` block (lines 41–92) holds the values to match.
- **POSSIBLY UPDATE — `app/src/theme/ThemeProvider.tsx`** — only if a token group is added that is not yet in `themeValue`. Currently complete.
- **DO NOT TOUCH — the 4 components** (`ChatBubble.tsx`, `PlaceCard.tsx`, `AxisRadar.tsx`, `DataSourceBanner.tsx`). They consume the theme as-is; their structural re-derivation is **Story 1.4**, not this story. They already inherit the canonical palette through the theme.

### Consumers of `state.danger` / alert-red

No component references `state.danger` or `alert-red` today (`AxisRadar`/`ChatBubble`/`PlaceCard` use `brand`/`surface`/`text`/`border`; `DataSourceBanner` uses `state.warning`). The mid-fi kit (`documentation/ux/midfi-kit.jsx`) references `var(--alert-red)` for error states and the "trending" badge — those primitives are ported in **Story 1.3**, which is why the token must exist and be valid now.

### Testing standards for this story

- No unit test is required for a pure token-data file — `tokens.ts` has no logic (project-context "Testing Rules" targets pure engines in `lib/`, not theme data).
- The acceptance gate **is** the audit gate: hex grep empty + triple gate green (AC #8–#9). Run them; do not assume they still pass.
- Manual visual check is optional here since no component code changes — but if any palette hex was patched in Task 1, smoke-launch the app (`cd app && npm start`) and confirm the 4 existing screens still render with no obviously wrong color.

### Constraints from `project-context.md` (invariants — not guidelines)

- `tokens.ts` is the **single source of truth**. Any file other than `tokens.ts` containing `#[0-9A-Fa-f]{3,6}` is a brand bug.
- Access is always via `useTheme()` → `theme.colors.brand.primary` etc. — never `palette.gold` directly from a component.
- Any new shade goes through Alexandre (brand) + Stéphanie (WCAG contrast) review — this directly governs AC #7.
- Exports: **named exports only**, no `export default` (already respected in `tokens.ts`).
- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride` — the `as const` assertions on every export must stay (they give the literal types `Tokens`/`Gradient` depend on).
- Triple gate runs **before each commit**, in order: `tsc --noEmit` → `lint:vocab` → `i18n:check`.

### ✅ Resolved Decision — `--alert-red` value (AC #7)

This was a historised gap (`ux-design-specification.md` "Gap token à combler", `architecture.md` "Nice-to-Have Gaps"): the brandbook v1.0 / `spawt-tokens.css` does **not** define `--alert-red`, yet the mid-fi screens reference it (error states, "trending" badge).

**Decision (Alexandre, 2026-05-15): `--alert-red` = `#C0392B`.** Rationale:
- **Brand fit** — a warm red, coherent with the warm canonical palette (gold/amber), not a cold crimson.
- **Distinct from warning** — clearly separable from `--amber-warm #E89A39` (`state.warning`), so error ≠ warning at a glance.
- **Contrast** — ≈5.2:1 on `--bg` (`#FAFAF8`) and ≈5.5:1 with white text on top, both **WCAG AA for normal-size text**. The previous placeholder `#D4603A` only reached ≈3.8:1 — below AA for normal text — which is why it could not stand.

Stéphanie's role is now a **confirmation, not a gate**: validate the rendering on the 4-device matrix during QA. Implementation is unblocked — set `tokens.state.danger = "#C0392B"`.

### Project Structure Notes

- Canonical part is `app/` (Expo SDK 55 / RN 0.83 / TS strict). The Vite prototype at repo root is **frozen** — never edit it for V1.
- Theme files live in `app/src/theme/` only — no other folder holds design tokens.
- **Branch & merge target (confirmed):** work is on `theme/align-canonical-tokens`, which was branched from `spawt/v1-bmad` (merge-base `be38a73`) and is exactly 1 commit ahead (`979ee2d`). `spawt/v1-bmad` is the V1 BMAD mainline (`project-context.md` + versioning memory). **Merge this feature branch into `spawt/v1-bmad`, not `main`.** `main` is protected and requires the triple persona sign-off. Continue committing on `theme/align-canonical-tokens`.
- File naming: `tokens.ts` is `kebab-case.ts` ✓, `ThemeProvider.tsx` is `PascalCase.tsx` ✓ — keep convention.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — user story + BDD acceptance criteria.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color System] (lines 840–886) — canonical palette table, gradients, and the `--alert-red` gap note.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Canonical Sources & Reconciliation] (lines 54–112) — why `spawt-tokens.css` is canonical above PRD §15 and `tokens.ts`.
- [Source: _bmad-output/planning-artifacts/architecture.md] (lines 137–138, 963–964, 1049–1053) — token realignment is the blocking prerequisite of the whole design system (UX-DR1); `--alert-red` listed as a Nice-to-Have gap requiring Alexandre + Stéphanie review.
- [Source: _bmad-output/project-context.md#Design tokens] (lines 197–202) — single-source rule, `useTheme()` access, new-shade review process, post-merge hex audit.
- [Source: documentation/ux/spawt-tokens.css] (`:root`, lines 41–92) — canonical values to match.
- [Source: app/src/theme/tokens.ts] / [app/src/theme/ThemeProvider.tsx] — current realigned state.
- [Source: CHANGELOG.md#v1.1.3] — what `979ee2d` already shipped and the listed residuals.

## Git Intelligence Summary

- **`979ee2d` `refactor(theme): réaligne tokens.ts sur le brandbook canonique`** (current branch `theme/align-canonical-tokens`) — already did the bulk of this story: rewrote `tokens.ts` on the canonical palette/fonts, added `gradient.night/gold/sand`, `radius.card`, `elevation.glow`, wired them through `ThemeProvider`. Touched only `CHANGELOG.md`, `ThemeProvider.tsx`, `tokens.ts`. Its `Verify` line confirms `tsc --noEmit` / `lint:vocab` / `i18n:check` all passed at commit time. Triple sign-off was marked `pending` (Alexandre brand + Stéphanie contrast review still required before merging to `main`).
- **`be38a73` / `2eed5e2`** — earlier WIP/bootstrap commits (Moka iOS bootstrap, `@expo/ngrok`, `expo-asset` plugin); not relevant to tokens.
- **Pattern to follow**: `979ee2d` preserved the semantic token structure and kept all component code untouched — replicate that discipline. Commit message format is the Moka Conventional Commits format documented in `project-context.md` (`type(scope): …` + body + `PRD ref` + `Verify` + `Triple sign-off`).

## Project Context Reference

`_bmad-output/project-context.md` is loaded as a persistent fact for this workflow and is an **invariant ruleset** the dev agent must follow — in particular the "Design tokens" rules (§ Code Quality & Style), the "Critical Don't-Miss Rules" (hex en dur hors `tokens.ts` = brand bug), and the "Décisions historisées" section (do not settle the `--alert-red` value alone). Read it before implementing.

## Story Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. Story scoped accurately to its brownfield reality: the realignment shipped in `979ee2d`; remaining work is verification against the AC checklist plus wiring the `--alert-red` token to its decided value `#C0392B`. All three open questions resolved (alert-red value, semantic naming kept by-usage, merge target `spawt/v1-bmad`) — no blockers remain. Status set to `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Triple gate + hex audit run 2026-05-15 — all green (see Completion Notes).

### Completion Notes List

- **Brownfield confirmed:** commit `979ee2d` had already realigned `tokens.ts` (palette, gradients, radius, elevations, `ThemeProvider` wiring). Task 1 audit found AC #1–#6 fully satisfied — **no patch needed** to those clauses.
- **Only change applied:** `tokens.state.danger` `#D4603A` → `#C0392B` (AC #7), with the `TODO(brand)` comment replaced by a WHY comment tracing the Alexandre 2026-05-15 decision. The previous placeholder failed WCAG AA for normal text (≈3.8:1); `#C0392B` reaches ≈5.2:1 on `--bg` and ≈5.5:1 under white text.
- **AC #2:** semantic concepts kept under the by-usage structure (`surface.*`/`text.*`/`border.*`) — no rename, so the 4 existing components are untouched and inherit the canonical palette.
- **Audits (AC #8–#9):** `tsc --noEmit` 0 errors · `lint:vocab` pass · `i18n:check` pass · hex audit empty.
- **Stéphanie sign-off** on `#C0392B` contrast is a non-blocking on-device confirmation during the 4-device QA matrix.
- Branch `theme/align-canonical-tokens` → merges into `spawt/v1-bmad` (not `main`). Changes not yet committed — awaiting user.

### File List

- `app/src/theme/tokens.ts` (modified — `state.danger` value + comments)
- `CHANGELOG.md` (modified — v1.1.4 entry + post-review bullets)
- `documentation/ux/spawt-tokens.css` (modified — `--alert-red` added)
- `app/app/index.tsx` (modified — splash CTA `text.onBrand` → `text.inverse`)
- `app/app/place/[id].tsx` (modified — « Je spawt ici » CTA `text.onBrand` → `text.inverse`)
- `app/app/(onboarding)/consent.tsx` (modified — 2 sites `text.onBrand` → `text.inverse`)
- `app/app/(onboarding)/phone.tsx` (modified — Continue CTA `text.onBrand` → `text.inverse`)
- `app/app/(onboarding)/profile.tsx` (modified — Continue CTA `text.onBrand` → `text.inverse`)
- `app/src/components/PlaceCard.tsx` (modified — Pill match-score `text.onBrand` → `text.inverse`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (new — tracks 7 defer items from review)
