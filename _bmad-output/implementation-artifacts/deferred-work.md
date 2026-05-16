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
