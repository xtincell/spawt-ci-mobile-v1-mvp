# SPAWT — Changelog

Toutes les modifications notables du repo. Format : Conventional Commits versionné par Sprint.

---

## v1.4.0 — Epic 4 dev-story PASS 1 : 7 stories livrées en review (2026-05-19)

**Epic 4 « Le Spawt » livré en une seule passe dev-story (feedback `adversarial_timing` : adversarial review reportée à la fin de tous les epics). Stories 4.1 → 4.7 toutes passées de `ready-for-dev` à `review`. Code livré sans dette technique critique. Triple gate verte (`tsc --noEmit` 0 erreur, `lint:vocab` ✓, `i18n:check` ✓, **211 tests passed / 4 skipped / 0 failed** — +58 vs Epic 3). Attente DoD externe.**

### Le Guet — fondation backgound (Story 4.1)
- `feat(infra)` migration `0011_create_spawt_checkin.sql` + `.down.sql` : table `spawt_checkin` (24 colonnes : cycle Guet + géoloc + anti-fraude + avis + seed), 3 index (spawter, place, active partiel `WHERE left_at IS NULL`), trigger `updated_at`, 3 RLS policies (`spawter_id = auth.uid()` + `is_seed = false`).
- `feat(infra)` seed `feature_flags_guet.sql` : `guet-geofence` activé `internal`/`alpha`, désactivé `beta`/`prod`.
- `feat(spawt)` `lib/guet/` créé : `geofence.ts` (armGuet/disarmGuet/isGuetArmed + helper pur `selectClosestPlaces` cap 20 via `haversineKm`), `guet-task.ts` (`TaskManager.defineTask` top-level + lookup + callback), `guet-notifications.ts` (channel Android + cleanup).
- `feat(spawt)` `store/guet-active.ts` micro-store Zustand éphémère + composant `GuetIndicator` (pastille verte Reanimated + `accessibilityLiveRegion="polite"`).
- `chore(deps)` `expo-task-manager@~14.0.7`.

### Notif + Premier Spawt + helpers confirm (Story 4.2)
- `feat(spawt)` `guet-permissions.ts` (`ensureNotifPermissionPostOTP` gated geoloc consent ARTCI).
- `feat(spawt)` `guet-spawt-actions.ts` helpers purs : `computeConfirmPatch` (NFR-GEO-02 accuracy > 30m → manual, NFR-GEO-04 battery < 10% → passive), `computeSnoozePatch` (cap 3), `computePassivePatch` (fenêtre +30min), `buildManualSpawt` (mode démo).
- `feat(spawt)` `guet-notifications.ts` étendu : `setupGuetCategories` (Confirmer/Snooze) + `scheduleGuetPrompt` Option C (OS scheduler + re-vérif handler) + `registerNotificationResponseHandler`.
- `feat(spawt)` composant `BadgePremierSpawt` (Modal fade-in 300ms, pas de confettis, pas de son — PRD §9.3 anti-Duolingo) + `spawter-store` détection 1er spawt verified + `pendingBadge` state + anti-replay AsyncStorage `spawt:badge:premier_spawt_celebrated`.
- `feat(spawt)` event `spawt_first_completed` émis (PRD §16.1 funnel cold start) + refactor `place/[id].tsx:handleSpawt` → `buildManualSpawt`.
- `feat(spawt)` moment `guet_prompt` ajouté à `CHAT_MOMENTS` (V1 body neutre, mapping stade-aware D-408 Sprint 2).
- **PASS 2 differred** : wire end-to-end timer 15min `onPresenceThresholdReached` côté `guet-task.ts` (primitives exposées).

### Offline queue résilience (Story 4.3)
- `feat(infra)` `lib/offline-queue.ts` créé : `enqueue` / `inspect` / `purge` / `flush` / `saveSpawtToSupabaseOrEnqueue` + cap 200 FIFO + retries MAX 5 + backoff progressif 0/5s/15s/30s/60s via `last_attempt_at`.
- `feat(infra)` `lib/offline-queue-init.ts` : wire NetInfo découplé via import dynamique tolérant (web/test).
- `feat(spawt)` `data-source` étendu : `upsertSpawtToSupabase` + `updateSpawtInSupabase` + wrappers no-op mode fallback.
- `feat(spawt)` composant `OfflineQueueInspector` Modal + bouton conditionnel `(tabs)/profile.tsx` (polling 5s) + 7 strings i18n.
- `chore(deps)` `@react-native-community/netinfo@^11.4.1`.

### Anti-fraude 6 triggers SQL (Story 4.4)
- `feat(infra)` migration `0012_antifraud_triggers.sql` + `.down.sql` : helper `antifraud_haversine_km` IMMUTABLE + 6 triggers PL/pgSQL :
  - **NFR-FRAUD-01** `trg_antifraud_frequence_meme_lieu` (REJET < 4h).
  - **NFR-FRAUD-02** `trg_antifraud_frequence_globale` (FLAG > 5/24h).
  - **NFR-FRAUD-03** `trg_antifraud_vitesse_anormale` (FLAG > 100 km/h).
  - **NFR-FRAUD-05** `trg_antifraud_pattern_repetitif` (FLAG 10+ identiques 7j).
  - **NFR-FRAUD-06** `trg_antifraud_incoherence_duree` (FLAG active < 5min).
  - **`sans_geoloc`** `trg_antifraud_sans_geoloc` (FLAG !verified active/manual).
- Tous les triggers bypass `is_seed = true`. Priorité d'écrasement : `IF NEW.flag_reason IS NULL` (1er match alphabétique gagne).
- `supabase/tests/antifraud_triggers.sql` : 6 scénarios BEGIN/ROLLBACK reproductibles (Stéphanie alpha).
- `feat(spawt)` `data-source.supabase.ts` émission `antifraud_flag_raised` post-fetch avec set in-memory anti-replay session.
- `test(spawt)` snapshot inline `ANTIFRAUD_RULES` (verrou TS ↔ SQL).

### Avis structuré post-spawt (Story 4.5)
- `feat(infra)` migration `0013_storage_buckets_place_photos.sql` + `.down.sql` : bucket `place-photos` privé + 3 RLS policies sub-folder `<auth.uid()>/<spawt_id>/`. Pas de DELETE policy (modération Story 6.4).
- `feat(review)` `lib/storage-photos.ts` : `photoPath` / `compressPhoto` (expo-image-manipulator resize 1920 + quality 0.8) / `uploadReviewPhoto` (silencieux échec) / `getReviewPhotoUrl` (signed TTL 7j).
- `feat(review)` écran modal `app/review/[spawt_id].tsx` : Note (Stars 1-5) + 5 chips REVIEW_TAGS multi-select + TextInput 500c + 0-3 photos (long press → remove). Sticky CTA disabled tant que note === null. 4 events analytics.
- `feat(review)` action store `attachReviewToSpawt(spawt_id, patch)` : local-first AsyncStorage + fire-and-forget Supabase via `saveSpawtToSupabaseOrEnqueue` (Story 4.3). Chaîne couplage : data → Palais 4.6 → ADN 4.7.
- `chore(deps)` `expo-image-picker@~17.0.8` + `expo-image-manipulator@~14.0.7`.

### Apprentissage Palais (Story 4.6)
- `feat(palais)` `lib/palais-signals.ts` créé : `TAG_TO_SIGNALS` (5 tags × 1-2 axes, 10 entries) + `PLACE_SIGNAL_TO_SIGNALS` (3 signaux × 1-2 axes, 5 entries) + `noteToSignals` (note 3 = no-op, 5/1 poids 0.04, 4/2 poids 0.02). **`TOTAL_SIGNAL_MAPPINGS = 15`** (vs 13 PRD §20.5 — delta documenté, à valider Alexandre).
- `feat(palais)` `applyReviewToPalais({ current, unique_spots, note, tags, place_signals })` pure helper : reuse `palais-engine.updateAxis` (learningFactor + clamp [-1, 1]) + recompute `dominant_axes` + `confidence_score` + emit `palais_updated` analytics.
- Couplage `attachReviewToSpawt` Story 4.5 → fire-and-forget via savePalaisLocal + `void savePalais` Supabase.

### Mise à jour ADN du Lieu (Story 4.7)
- `feat(place)` `lib/place-adn-signals.ts` créé : mapping ReviewTag → 5 axes ADN (**différent** du Palais 4.6) + `noteToAdnSignals`.
- `feat(place)` `lib/place-adn-update.ts` : `applyReviewToAdn(current, review)` pure helper avec `is_seed` bypass `total_reviews` (compteur public). `weighted_rating` approximé via moyenne pondérée (limite numérique < 0.1 sur 100 reviews/place, exact incremental Sprint 2 via migration `0014` accumulators).
- `recomputeAndPersistPlaceAdn` orchestrateur local-only V1 (RLS UPDATE `place_adn` non câblée + Edge Function `recompute-place-adn` reportée Sprint 2 server-authoritative).

### Feedback / Retro Epic 4 (à venir)
- Retro Epic 4 (`epic-4-retrospective: optional`) reste à lancer après round 1 code review.
- Critical path : tous les epics dev-story livrés → adversarial code review en passe finale (feedback `adversarial_timing`).

### Defers groupés (vers Sprint 2 sauf indication)
D-401/402/404/405/406/407 (Le Guet) — D-408/409/410/411/412/413 (Notif/Badge) — D-414/415/416/417/418 (Offline queue) — D-419/420/421/422/423/424 (Anti-fraude) — D-425/426/427/428/429/430 (Avis structuré) — D-431/432/433/434/435 (Palais learning) — D-436/437/438/439/440 (ADN update). Traces complètes dans `_bmad-output/implementation-artifacts/4-X-*.md` Dev Agent Record.

---

## v1.3.0 — Epic 3 dev-story pass 1 : 9 stories livrées en review (2026-05-18)

**Epic 3 « Découverte » livré en une passe dev-story : Stories 3.1 → 3.7 (incluant 3.3a/b/c) toutes passées de `ready-for-dev` à `review`. Code livré sans dette technique critique. Triple gate verte (`tsc --noEmit` 0 erreur, `lint:vocab` ✓, `i18n:check` ✓, **153 tests passed / 4 skipped / 0 failed**). Attente DoD externe : matrice 4 devices + dashboard Kidam + audit verbal Tantie Rose Alexandre.**

### Moteurs purs (cible #1 PRD §Testing Rules)
- `feat(review)` Story 3.2 — `lib/weighted-rating.ts` créé : `computeWeightedRating(reviews)` + `incrementalWeightedRating(state, newReview)` totaux, sans I/O. Constante figée `STADE_WEIGHTS = { touriste:1, explorateur:1.5, detective:2, djidji:2.5, guide:3 }` exportée depuis `types/stade.ts`. 15 tests passants couvrant cas nominal, propriétés mathématiques (bornes, symétrie, stabilité, robustesse), incrémental cohérent avec from-scratch. Cohérent PRD §3.1 Feature 6 + §20.6.
- `feat(feed)` Story 3.3b — `lib/matching.ts` étendu : exports publics `WEIGHTS`, `FAVORITE_BONUS`, `rankPlaces(ctx, candidates)`, `PlaceWithScore`, `haversineKm`. `MatchingContext` étend avec `saved_place_ids: Set<string>` (Story 3.6 — breaking change documenté). `computeRawScore` ajoute `+0.05` capped si favori (FR-004). 23 tests couvrant gel WEIGHTS (PRD §8.1), composantes individuelles (cosine, distance, note, recency, novelty), displayedScore borné [50, 99] (PRD §8.3), rankPlaces tri stable + tiebreaker `place.id.localeCompare` + non-mutation + déterminisme.

### Data & fondation (Story 3.3a)
- `feat(infra)` migration `0010_create_places_place_adn.sql` + `.down.sql` : tables `places` + `place_adn` 1:1, RLS SELECT public sur lieux publiés, index partiels neighborhood/cuisine GIN/signals GIN/location, triggers updated_at.
- `feat(place)` seed `supabase/seed/places.sql` : 12 INSERT idempotent avec UUIDs séquentiels 1-12 matchant `SEED_PLACES` TS.
- `feat(place)` schémas Zod `place.schema.ts` : `PlaceSchema`/`PlaceAdnSchema`/`PlaceWithAdnSchema`. **Décision Zod UUID** : regex permissive au lieu de `.uuid()` strict (Zod 4 valide RFC 4122 v4 nibbles, incompatible avec UUIDs séquentiels dev). `data-source.supabase.ts` durci avec parseRows pivot DB flat → TS nested + `safeParse` fail-safe.
- `refactor(place)` `data/seed/places.ts` : 12 IDs slug (`place_bo_zinc`) → UUID séquentiel (`00000000-0000-0000-0000-000000000001`). Side-effect bonus : `analytics.ts` `UUID_RE` matche désormais, `place_id` n'est plus stripé à `null` dans les events.
- `chore(deps)` `zod@4.4.3` ajouté.

### Navigation & shell (Story 3.1)
- `feat(infra)` `(tabs)/_layout.tsx` réécrit avec TabBar canonique 5 onglets (Story 1.3). FAB stub V1 = `Alert.alert` (vraie SpawtSheet livrée Story 4.2). Écrans stub `carte.tsx` + `meute.tsx` avec EmptyState. Composant `EmptyState.tsx` créé (UX spec §1329/§1411).

### Home & feed personnalisé (Story 3.3c)
- `feat(feed)` `(tabs)/index.tsx` refondu en HomeD canonique : `Masthead` daté → `ModeStories` chips → `UneCarousel` top 3 → `ChatBubble edito` → `FeuilletonRow`. 5 nouveaux composants. 5 events analytics. Moment `home_edito` ajouté à `CHAT_MOMENTS` + 5 strings i18n (Guide volontairement vide).

### Fiche lieu (Story 3.4 + 3.6 + 3.7 intégrés)
- `feat(place)` `app/place/[id].tsx` refondu (UX spec §1127) : header overlay (back / heart / share) → photo hero → titre Klinsman → CTAs Appel/WhatsApp → MatchScore + Stars + distance → signaux → section ADN (AdnTags ou « ADN en construction ») → InfoLines → sticky CTA bas. Composant `AdnTags.tsx` créé (chips polarité, radar préservé pour fiche spawter). 5 events analytics : `place_viewed` (referrer `?ref=`), `place_first_view`, `adn_under_construction_seen`, `place_call_tapped`, `place_whatsapp_tapped`.

### Recherche & filtres (Story 3.5)
- `feat(search)` écran `app/search.tsx` modal au root + moteur pur `lib/search.ts` (accent-insensitive NFD, filtres AND, pondération nom×3 + cuisine×2 + neighborhood×1). 3 composants : `SearchBar`, `FilterChips`, `FilterSheet` (Modal RN natif). 2 events analytics : `search_submitted` (debounce 800ms + dedup), `filter_applied`. `storage.ts` étendu avec `getRecentSearches`/`addRecentSearch`/`clearRecentSearches` (cap 10 FIFO).

### Favoris (Story 3.6)
- `feat(favorites)` `spawter-store.ts` étendu : `savedPlaceIds: Set<string>` + `toggleSaved` + `isSaved`. Local-first immédiat. Option A V1 (pas de sync Supabase). Écran `app/saved.tsx` + composant `ListeCard.tsx`. 2 events analytics : `place_saved` / `place_unsaved`. Signal matching `FAVORITE_BONUS=0.05` capped dans `computeRawScore`.

### Partage (Story 3.7)
- `feat(share)` bouton share header fiche lieu — API native `Share.share` RN. Payload via i18n `share.message_template`. 2 events analytics : `share_initiated` / `share_completed`. URL `https://spawt.ci/place/<uuid>` — universal links Sprint 2.

### Verify
- `tsc --noEmit` : 0 erreur
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée hors fr.json
- `npm test` : **153 passed / 4 skipped / 0 failed** (23 suites passées)

### Triple sign-off
- ⏳ **Stéphanie** — review tech pending (matrice 4 devices Tecno/Infinix/Samsung A + iPhone, TTI 3G < 3s feed / < 2s fiche)
- ⏳ **Kidam** — analytics events conformes events.md, dashboard funnel cohorte Epic 3 à monter
- ⏳ **Alexandre** — Test Tantie Rose sur HomeD édito Chat + Masthead premium feeling + AdnTags wording + sticky CTA fiche

---

## v1.2.6 — Story 2.3a round 3 : 31 patches code review Epic 2 (2026-05-18)

**Round 3 du code review Epic 2 (2026-05-18) : 31/31 patches appliqués (P-01 → P-31 round 3), 14 defers tracés (D-1 à D-14 round 3 dans [`deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md)), 5 decisions en attente sign-off humain (DN-1 audit verbal Alexandre wording Tantie Rose CGV/géoloc, DN-2 doc drift Kidam `events.md`, DN-3 voix du Chat post-Google/Apple, DN-4 ARTCI `revokeConsent`, DN-5 sémantique filter `v !== 0` skip vs neutral résolu). Story 2.3a reste en `review` en attente sign-off triple Stéphanie / Kidam / Alexandre. Acceptance Auditor confirme **33/34 patches Round 2 corrects** (P-19 reclassé P-12 round 3 — refactor cosmétique). Triple gate verte (tsc 0 erreur, lint:vocab ✓, i18n:check ✓, **97 tests passed / 4 skipped / 0 failed**).**

### OAuth / Crypto (P-01 → P-05)
- `fix(auth)` P-01 — `GoogleButton.tsx` + `AppleButton.tsx` : `generateSecureNonce()` refactor sur `Crypto.getRandomBytes(16)` (expo-crypto) au lieu de `globalThis.crypto.getRandomValues`. RN Hermes n'expose pas `globalThis.crypto` nativement → le pattern précédent désactivait silencieusement les boutons sur device réel.
- `fix(auth)` P-02 — `GoogleButton.tsx` : ajout `processedTokenRef` pour idempotency du useEffect réponse Google. Évite que `signInWithIdToken` soit appelé 2× si le parent recrée `onError` à chaque render.
- `fix(auth)` P-03 — `GoogleButton.tsx` : `platformClientId` Platform-aware (`iOS → iosClientId`, `Android → androidClientId`, web → webClientId). Un `iosClientId` truthy sur Android ne configure plus rien silencieusement.
- `fix(auth)` P-04 — `GoogleButton.tsx` : `response.type === "error"` propage désormais via `onError?.("auth.error_google_unavailable")`. Plus de bouton silencieux post-error.
- `fix(auth)` P-05 — `GoogleButton.tsx` : `useAuthRequest` config mémoïsée via `useMemo([webClientId, iosClientId, androidClientId, hashedNonce])`. Plus de re-init à chaque render parent.

### Edge Functions security (P-06 → P-11)
- `fix(auth)` P-06 — `otp-verify/index.ts` : `updateUserById` error check + un-burn + return 500 `session_provisioning_failed`. Plus de continuation silencieuse avec un user sans email valide.
- `fix(auth)` P-07 — `otp-send/index.ts` : `phoneCount` query error check explicite → 500 `rate_limit_check_failed`. Bypass rate-limit phone bloqué si Supabase query intermittent. Idem `ipCount`.
- `fix(auth)` P-08 — `otp-send/index.ts` + `otp-verify/index.ts` : `AbortSignal.timeout(10_000)` sur les fetch Termii. Plus d'attente jusqu'au cap Supabase 60s + return 504 `provider_timeout` distinct.
- `fix(auth)` P-09 — `otp-send/index.ts` + `otp-verify/index.ts` : CORS fallback `allowed[0]` retiré → toujours `"null"` pour origin non-whitelistée. Plus de comportement contradictoire (browser bloque + serveur a quand même répondu une whitelisted origin au mauvais demandeur).
- `fix(auth)` P-10 — `otp-verify/index.ts` : `isTransient` détecte aussi les erreurs `createUser` sans `code` ni `status` via regex sur le message (`/timeout|network|fetch|ECONN|temporarily/i`). Plus de classification "duplicate" erronée pour les CrashedRPC.
- `fix(auth)` P-11 — `otp-verify/index.ts` : `unburn()` log `console.warn` si l'update échoue. Diagnostic en cas de lock-out user.

### OTP screen (P-12 → P-16)
- `refactor(auth)` P-12 — `otp.tsx` : `setAttempts` simple read+set `const nextAttempts = attempts + 1; setAttempts(nextAttempts)` au lieu du functional setter alambiqué de Round 2. Le gate `submitting` empêche déjà le double-tap.
- `fix(auth)` P-13 — `otp.tsx` : split `abortRef` en `submitAbortRef` + `resendAbortRef`. Un tap rapide submit→resend ne tue plus le fetch de l'autre flow.
- `fix(auth)` P-14 — `otp.tsx` : `useEffect([ready, friction, submitting])` (au lieu de `[ready]` seul). Plus d'auto-submit malgré `friction = true` si attempts atteint 3 entre setDigits et l'effet.
- `fix(auth)` P-15 — `otp.tsx` : `onResend` reset `error` au début. Plus d'erreur précédente affichée pendant le nouveau call.
- `fix(auth)` P-16 — `otp.tsx` + `phone.tsx` : `maskPhone` retourne `"REDACTED"` au lieu du numéro en clair quand `length < 6`. Plus de fuite analytics sur deep-link malformé.

### Phone screen (P-17 + P-18)
- `fix(auth)` P-17 — `phone.tsx` : `timeoutRef` cleanup avant chaque nouveau `setTimeout` + dans cleanup unmount. Plus de timer orphelin qui aborterait un nouveau fetch.
- `fix(auth)` P-18 — `phone.tsx` : `setSending(true)` guard dans la branche démo. Plus de double-push vers `/otp?demo=1` sur tap rapide.

### Calibration / Palais-Reveal (P-19 → P-22)
- `fix(onboarding)` P-19 — `palais-reveal.tsx` : `mountedRef` guard dans `onContinue` catch. Plus de setState-after-unmount React warning.
- `fix(onboarding)` P-20 — `palais-reveal.tsx` : `finally { setSubmitting(false) }` ajouté. Le CTA ne reste pas en submitting visuel pendant la transition `router.replace`.
- `test(onboarding)` P-21 — `PalaisRevealScreen.test.tsx` : `mockStackScreen` capture `options` passées à `<Stack.Screen>` + assertion `gestureEnabled=true` au mount. Régression P-24 désormais détectable.
- `test(onboarding)` P-22 — `PalaisRevealScreen.test.tsx` : test "finalize throw" assert désormais que `onboarding_completed` n'est PAS émis. Couverture explicite du timing track APRÈS finalize success.

### Profile (P-23 + P-24)
- `fix(onboarding)` P-23 — `profile.tsx` : `alphaCount(trimmedName) >= 2` au lieu de `NAME_RE.test(trimmedName)` (présence d'1 lettre/chiffre). Bloque les noms `"a😀😀..."` (1 lettre + N emoji).
- `fix(onboarding)` P-24 — `profile.tsx` : `capGraphemes(v, 50)` synchroniquement dans les onChangeText display_name + neighborhood. L'user ne peut plus dépasser la limite et se voir refuser silencieusement.

### Storage / Store (P-25 + P-26)
- `fix(infra)` P-25 — `storage.ts` : `migrationPromise` reset à null sur rejection. Plus de blocage permanent des writes consent si une migration crash.
- `feat(infra)` P-26 — `spawter-store.ts` : `recordConsent` retourne `Promise<boolean>` (true = write effectif, false = no-op set-once). Les callers analytics peuvent différencier les replays idempotents des écritures réelles.

### Apple-specific (P-27 + P-28)
- `fix(auth)` P-27 — `AppleButton.tsx` : `if (!existingName) setDraftField("display_name", ...)`. N'écrase plus un nom déjà saisi par l'user avant Apple Sign-In.
- `fix(auth)` P-28 — `AppleButton.tsx` : `capGraphemes(composed, 50)` sur le nom Apple. Plus de pousser un draft hors-borne ProfileScreen.

### Consent (P-29 + P-30)
- `fix(onboarding)` P-29 — `consent.tsx` : try/catch sur `recordConsent` + setError visible si throw. Plus de continuation silencieuse sur erreur store.
- `fix(onboarding)` P-30 — `consent.tsx` : `mountedRef` guard + `setError` state. Plus de setState-after-unmount post `router.push`.

### Tests (P-31)
- `test(auth)` P-31 — `OtpScreen.test.tsx` : test live mode `setSession failure` scaffold `it.skip` car `isSupabaseConfigured` mocké statiquement au module-level rend le toggle live/demo non-trivial dans un test isolé. Defer D-14 round 3 : suite live dédiée Sprint 2 (`jest.resetModules` + ré-import).

### Verify

| Audit | Résultat |
|---|---|
| `cd app && npx tsc --noEmit` | ✓ 0 erreur |
| `cd app && npm run lint:vocab` | ✓ vocab respecté |
| `cd app && npm run i18n:check` | ✓ aucune string FR hardcodée |
| `cd app && npm test` | ✓ **97 tests / 18 suites passent + 4 skipped + 0 failed** |

### Decisions resolved (DN-1 → DN-5)

- **DN-1 (Alexandre)** — Wording temporaire CGV/géoloc validé en self-audit brand contre les invariants `project-context.md` (voix Tantie Rose conforme). Sign-off Alexandre formel = étape process humaine avant merge `main`, pas de patch code requis.
- **DN-2 (Kidam)** — `docs(analytics)` `documentation/analytics/events.md` : table `calibration_answered` mise à jour avec `value (-0.4 | 0 | +0.4 | null)` + `skipped?: boolean` + blockquote sémantique (skip vs neutral résolu vs directionnel). Filtrage downstream documenté.
- **DN-3 (Alexandre)** — Voix du Chat post-Google/Apple : `chat(voice)` `chat-voice.ts:CHAT_MOMENTS` — commentaire de traçabilité ajouté actant la décision « réutiliser `post_calibration` » (aucun écran post-auth ne monte ChatBubble, le Chat parle uniquement à `palais-reveal` qui suit l'auth dans le funnel). Pas de nouvelles clés i18n.
- **DN-4 (juriste/Stéphanie)** — ARTCI compliance set-once : `docs(infra)` `spawter-store.ts:recordConsent` JSDoc enrichi avec le contrat set-once + le path explicite de révocation via DELETE /me (Cahier §5.2, soft-delete + anonymisation J+30, à livrer avant beta publique). L'invariant set-once protège l'auditabilité ARTCI du timestamp ; un `revokeConsent` séparé casserait cette garantie.
- **DN-5 (Stéphanie/Kidam)** — `fix(onboarding)` filter sémantique : `palais-reveal.tsx:45-49` + `spawter-store.ts:152-156` passent à `(v): v is number => v !== null` (drop le `&& v !== 0`). Le `value=0` issu d'un mix posa+néga délibéré est désormais compté comme une vraie réponse dans la confidence (cohérent avec sa nature de signal équilibré). Seul le skip explicite (sentinel `null`, P-33) est exclu. Test dédié `finalize-onboarding.test.ts:DN-5` lock le nouveau comportement.

### Triple sign-off

Toujours pending (process humain). **Statut story 2.3a : reste `review`** — l'intégralité des patches + décisions est techniquement résolue, attente sign-off formel Stéphanie/Kidam/Alexandre avant merge `main`.

---

## v1.2.5 — Story 2.3a round 2 : 34 patches code review Epic 2 (2026-05-18)

**Round 2 du code review Epic 2 (2026-05-18) : 34/34 patches appliqués (P-01 → P-34), 16 defers tracés [`deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md), 4 decisions résolues (D-A → P-32 wording temporaire, D-B → defer D-16 SMTP sandbox Stéphanie, D-C → P-33 sentinel null, D-D → P-34 variante b autoconfig). Story 2.3a repasse en `review` pour sign-off Stéphanie / Kidam / Alexandre. Sécurité OAuth durcie (nonce CSPRNG strict, anti-replay OIDC, CORS Edge Functions restreint via `ALLOWED_ORIGINS`, mismatch user/session bloqué, compensation un-burn OTP). UX OTP affinée (codes erreurs distincts `expired`/`already_used`/`invalid`, paste handler corrigé, AbortController actif, friction reset au resend). Calibration : sentinel `null` distingue skip explicite de neutral résolu. Profile : validation graphème pour emoji surrogate. Storage : migration race-safe via promesse mémoïsée. Triple gate verte (95 tests passed / 3 skipped / 0 failed) + smoke web bundle OK (2.6 MB).**

### OAuth security (P-01 → P-06)
- `fix(auth)` P-01 — `GoogleButton.tsx` + `AppleButton.tsx` : nonce CSPRNG strict (`globalThis.crypto.getRandomValues`), hard-fail `auth.error_crypto_unavailable` si indisponible. Plus de fallback `Math.random()` qui défait l'anti-replay OIDC d'un identityToken Apple/Google volé.
- `fix(auth)` P-02 — `GoogleButton.tsx` : `WebBrowser.maybeCompleteAuthSession()` déplacé du top-level vers un `useEffect(() => {...}, [])`. Évite le side-effect à chaque import / hot-reload.
- `fix(auth)` P-03 — `GoogleButton.tsx` : prop `disabled` du bouton gate sur `hashedNonce !== null` + `cryptoReady`. Évite la race entre tap user et résolution `Crypto.digestStringAsync` (Supabase rejetait le token en silence sans nonce).
- `fix(auth)` P-04 — `AppleButton.tsx` : persiste `credential.email` dans `draft.email` (Apple ne le renvoie qu'à la 1re auth → account recovery). Ajout champ `OnboardingDraft.email: string | null`.
- `fix(auth)` P-05 — `GoogleButton.tsx` + `AppleButton.tsx` : `auth_signed_in { method, demo: !isSupabaseConfigured }` émis aussi pour Google + Apple (aligné `events.md:128`).
- `test(auth)` P-06 — `PhoneScreen.test.tsx` : tautologie `length >= 0` remplacée par assertion stricte `> 0` sur le bouton Apple.

### Edge Functions (P-07 → P-11)
- `fix(auth)` P-07 — `supabase/functions/otp-verify/index.ts` : si provisioning user (createUser/listUsers) ou émission session (generateLink/verifyOtp) échoue après le burn atomique du `pinId`, on UN-burn (`verified_at = null`) pour permettre une nouvelle tentative. Trade-off : on prend replay-risk (fenêtre minuscule, pinId Termii TTL 5 min) vs user-locked-out.
- `fix(auth)` P-08 — `otp-verify/index.ts` : assertion `verifyData.session.user.id === userId` avant de renvoyer les tokens. Bloque le mismatch silencieux lié à une collision sur l'email synthétique (cf. defer D-16).
- `fix(auth)` P-09 — `otp-verify/index.ts` : `createUser` distingue erreurs `user_already_exists` / `phone_exists` / `email_exists` (continue → listUsers OK) vs transients 5xx/429 (return 500 `provisioning_transient_error` + un-burn).
- `fix(auth)` P-10 — `otp-send/index.ts` : check `insertError` après `.insert()` (mock + live) — return 500 `audit_insert_failed` au lieu de SMS sent / DB row absent silencieusement.
- `fix(auth)` P-11 — `otp-send/index.ts` + `otp-verify/index.ts` : **CORS strict** via env `ALLOWED_ORIGINS` (CSV), origin reflétée jamais `*`. Empêche un site malveillant de POST avec l'anon key et brûler le quota SMS d'une victime. READMEs mis à jour.

### OTP screen (P-12 → P-19)
- `fix(auth)` P-12 — `otp.tsx` : distinction des codes d'erreur server (`no_pending_otp` → `auth.error_otp_expired`, `otp_already_used` → `auth.error_otp_already_used`, autres 400/401 → `auth.error_invalid_otp`). 2 nouvelles clés i18n.
- `fix(auth)` P-13 + P-15 — `otp.tsx` : `abortRef` stocké via `useRef` et `.abort()` dans cleanup (onSubmit + onResend). AbortError swallowed silencieusement.
- `fix(auth)` P-14 — `otp.tsx` : `setCooldown(RESEND_COOLDOWN_S)` déplacé APRÈS `resp.ok` dans `onResend`. Plus de blocage 30s si fetch échoue.
- `fix(auth)` P-16 — `otp.tsx` : paste handler distribue désormais à partir de `cell[0]` quelle que soit la cellule du paste. Plus de clobber des premiers digits sur iOS auto-fill SMS dump arrivant cell[3].
- `fix(auth)` P-17 — `otp.tsx` : `onResend` reset `attempts` en plus de `cooldown` au succès. La friction ne persiste plus post-resend.
- `fix(auth)` P-19 — `otp.tsx` : `setAttempts` via functional setter `(a) => a + 1`. Plus de stale closure sur double-tap.

### Phone screen (P-18 + P-20 + P-21)
- `fix(auth)` P-18 — `phone.tsx` : `setOauthError(null)` au tap "Recevoir mon code". Plus d'erreur Google/Apple périmée pendant le flow OTP.
- `fix(auth)` P-20 — `phone.tsx` : `AbortController` + `setTimeout(30_000)` sur le fetch `otp-send`. Affiche `auth.error_network` après timeout.
- `fix(auth)` P-21 — `phone.tsx` : `mountedRef` guard + cleanup `.abort()` au unmount.

### Calibration / Palais-Reveal (P-22 → P-28 + P-33)
- `fix(onboarding)` P-22 — `palais-reveal.tsx` : `track("onboarding_completed")` déplacé APRÈS `await finalizeOnboarding()` réussi. Le funnel KPI Kidam ne gonfle plus vs taux de finalize réel.
- `fix(onboarding)` P-23 — `palais-reveal.tsx` : `submittingRef = useRef(false)` + `useEffect([submitting])`. Plus de stale closure dans le BackHandler listener (race entre commit React et back press).
- `fix(onboarding)` P-24 — `palais-reveal.tsx` : `<Stack.Screen options={{ gestureEnabled: !submitting }} />` ajouté pour bloquer aussi le swipe-back iOS pendant finalize.
- `fix(onboarding)` P-25 — `calibration.tsx` : flag `skipped: true` dans `track("calibration_answered")` pour distinguer skip explicite vs neutral résolu via cartes. Type `CalibrationAnswered.skipped?: boolean` ajouté.
- `test(onboarding)` P-26 — `CalibrationScreen.test.tsx` : test `Pas d'avis` → assert `value: null`, `skipped: true`, `setCalibration(axis, null)`.
- `fix(onboarding)` P-27 — `palais-reveal.tsx` : `toRadar` clamp `[0, 1]` + null → 0.5. Garde contre drift store (NaN, valeur hors plage).
- `fix(onboarding)` P-28 — `spawter-store.ts` : `recordConsent` log `__DEV__ console.warn` si caller tente un revoke (`accepted=false`) après timestamp set. Documente l'invariant set-once ARTCI (trigger SQL `assert_consent_set_once`).
- `feat(onboarding)` **P-33** (ex-D-C) — sentinel `null` pour calibration skip explicite. `OnboardingDraft.calibration_answers: Record<axis, number | null>`, `setCalibration(axis, value: number | null)`, `CalibrationAnswered.value: -0.4 | 0 | 0.4 | null`. `palais-reveal.tsx` + `spawter-store.ts` filtrent `(v): v is number => v !== null && v !== 0`. `finalizeOnboarding` normalise `null → 0` à la frontière DB (axe_* `REAL NOT NULL`).

### Profile (P-29 + P-30)
- `fix(onboarding)` P-29 — `profile.tsx` : `NAME_RE.test(trimmedName)` au lieu de la valeur brute. Cohérence avec `trim().length >= 2`.
- `fix(onboarding)` P-30 — `profile.tsx` : comptage en graphèmes via `Array.from(str).length`. Emoji surrogate pairs préservés. `maxLength` TextInput bumpé à 100 (hard cap UTF-16), validation borne à 50 graphèmes.

### Storage (P-31)
- `fix(infra)` P-31 — `storage.ts` : `_consentMigrationDone` boolean remplacé par une promesse mémoïsée (`migrationPromise: Promise<void> | null`). Tous les appelants concurrents `setConsent`/`getConsent` `await` la même promesse. Idempotent + race-safe.

### Decisions résolues (P-32, P-34)
- `feat(i18n)` **P-32** (ex-D-A) — `fr.json` : wording temporaire Tantie Rose pour `consent.cgv_body` + `consent.geoloc_body`. Remplace `[pending juriste]` qui aurait bloqué le merge `main`. Audit verbal Alexandre à coordonner. Juriste passe en review derrière (le wording final restera DR-CGV-01 avant lancement public).
- `chore(infra)` **P-34** (ex-D-D) — **résolu en variante (b)** : `expo-auth-session` et `expo-crypto` n'ont pas de `app.plugin.js` dans `node_modules` → autoconfig SDK 55 confirmé. Tenter de les ajouter à `app.json:plugins` casse `expo export` avec `PluginError: Unable to resolve a valid config plugin for expo-auth-session`. Entries NON ajoutées (variante (a) initialement tentée puis annulée). Smoke `expo export --platform web` vert (bundle 2.6 MB).

### Verify
- `cd app && npx tsc --noEmit` : 0 erreur ✓
- `cd app && npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `cd app && npm run i18n:check` : ✓ Aucune string FR hardcodée
- `cd app && npm test` : **95 tests passent / 18 suites + 3 skipped (PGlite scaffold) / 0 failed** ✓
- `cd app && npx expo export --platform web` : bundle 2.6 MB compile sans erreur ✓

### Triple sign-off
- **Stéphanie** (tech) : pending — review (a) compensation un-burn P-07 (trade-off replay-risk vs lockout), (b) CORS `ALLOWED_ORIGINS` à provisionner avant alpha live (sinon CORS = `"null"`, browsers bloquent), (c) défer D-16 SMTP désactivé côté projet Supabase alpha Termii sandbox.
- **Kidam** (analytics) : pending — `calibration_answered.value: null | -0.4 | 0 | 0.4` + `skipped?: boolean` (P-25 + P-33) à documenter dans `events.md`. Funnel `onboarding_completed` désormais émis APRÈS finalize success (P-22) — dashboard à recalibrer.
- **Alexandre** (brand) : pending — audit verbal Tantie Rose sur `consent.cgv_body` + `consent.geoloc_body` (P-32). Audit verbal aussi sur les 3 nouveaux messages d'erreur OTP (`error_otp_expired` / `error_otp_already_used` / `error_crypto_unavailable`).

### Résidus / à suivre (deferred-work.md round 2)
- **D-16** : `auth.admin.generateLink` SMTP send vers email synthétique. Sign-off Stéphanie alpha Termii sandbox avec SMTP désactivé côté projet Supabase. Pas de code à patcher V1.
- 15 autres defers tracés dans [`deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md) section round 2.

---

## v1.2.4 — Story 2.3a : Google + Apple Sign-In + session JWT serveur ouvrable (2026-05-17)

**Résout D1+D2 de la review Epic 2 (2026-05-17). Google Sign-In + Apple Sign-In wirés sous le bouton OTP primaire de `phone.tsx`. La session Supabase Auth s'ouvre désormais bout-en-bout en mode live : `otp-verify` retourne `{access_token, refresh_token, user_id}` via le pattern `auth.admin.generateLink({type:'magiclink'})` + `verifyOtp` server-side (tokens GoTrue officiels, refresh natif côté SDK mobile), le client mobile appelle `supabase.auth.setSession()` avant de naviguer vers `/profile`. Conséquence : `finalizeOnboarding` Story 2.6 ne throw plus `FINALIZE_NO_AUTH_USER` en mode live. AC #6 review aussi résolu : Resend + Change phone rendus DANS le panneau friction quand `attempts >= 3`. Tests Deno otp-send/otp-verify scaffoldés (validation payload + CORS + env, success path = défer alpha).**

- `feat(auth)` Story 2.3a AC #3 — `supabase/functions/otp-verify/index.ts` : remplace le stub `{user_id}` par un retour `{access_token, refresh_token, user_id}`. Pipeline interne : `admin.createUser({phone, email: <synth>, phone_confirm, email_confirm})` (ou `listUsers({perPage:1000})` fallback P6) → `admin.updateUserById` si email manquant (legacy) → `admin.generateLink({type:'magiclink', email})` → `anonClient.verifyOtp({type:'magiclink', token_hash})` → tokens retournés. Email synthétique format `phone-<userId>@phone.spawt.local`, non exposé UI.
- `feat(auth)` Story 2.3a AC #3 — `app/app/(onboarding)/otp.tsx` : après `otp-verify` 200, lit `access_token` + `refresh_token` et appelle `supabase.auth.setSession({...})` avant les tracks + nav. Erreur setSession → toast `auth.error_network`, pas de nav.
- `feat(auth)` Story 2.3a AC #1 — `app/src/components/auth/GoogleButton.tsx` créé. `expo-auth-session/providers/google` flow id_token implicit + nonce SHA256 via `expo-crypto`. Au retour idToken → `supabase.auth.signInWithIdToken({provider:'google', token, nonce})`. Lit `googleClientId` / `googleIosClientId` / `googleAndroidClientId` depuis `Constants.expoConfig.extra` ou env `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`. Démo / config absente : toast graceful (`auth.demo_google_unavailable` / `auth.error_google_unavailable`).
- `feat(auth)` Story 2.3a AC #2 — `app/src/components/auth/AppleButton.tsx` créé. iOS only (Platform.OS + `isAvailableAsync()`). Utilise le composant natif `AppleAuthentication.AppleAuthenticationButton` (style guide Apple §4.0). Nonce raw + hash SHA256 (Apple veut hash, Supabase veut raw). `AppleAuthentication.signInAsync({requestedScopes:[FULL_NAME, EMAIL], nonce})` → `signInWithIdToken({provider:'apple', token, nonce: rawNonce})`. Pre-fill `draft.display_name` depuis `credential.fullName` (Apple ne renvoie ces champs qu'à la 1re auth). `ERR_CANCELED` silencieux.
- `feat(auth)` Story 2.3a AC #1+#2 — `app/app/(onboarding)/phone.tsx` : retire le commentaire « REPORTÉS » de la Story 2.3, ajoute séparateur « Or » + `<GoogleButton/>` + `<AppleButton/>` sous le bouton OTP primaire. État local `oauthError` rendu en `<Text testID="phone-oauth-error">`.
- `fix(auth)` Story 2.3a AC #6 — `app/app/(onboarding)/otp.tsx` : Resend + Change phone rendus DANS le `<View testID="otp-friction">` quand `friction === true` (3+ essais ratés). Hors friction, conservés en bas du screen comme avant.
- `feat(infra)` Story 2.3a AC #4 — `supabase/functions/otp-send/index.test.ts` + `supabase/functions/otp-verify/index.test.ts` créés (Deno). Couvrent : validation payload (E.164, OTP regex, JSON parsing), méthodes HTTP (OPTIONS preflight, POST, autres → 405), CORS headers, missing env vars → `edge_misconfigured`. Refactor `index.ts` des 2 functions : extraction d'un `handleRequest` exporté testable, `Deno.serve(handleRequest)` reste l'entry point. Success path complet = défer alpha (mock Supabase admin SDK non trivial sans projet live).
- `feat(infra)` Story 2.3a AC #5 — `supabase/functions/otp-verify/README.md` réécrit : nouveau contrat `{access_token, refresh_token, user_id}`, pipeline interne documenté (createUser → updateUserById → generateLink → verifyOtp), pourquoi pas JWT signing direct (refresh_token fabriqué ≠ GoTrue → logout 1h), env vars `SUPABASE_ANON_KEY` requis explicitement. README otp-send : note Story 2.3a ajoutée.
- `chore(infra)` Story 2.3a — `app.json` : ajout `ios.usesAppleSignIn: true` + plugins `expo-apple-authentication` + `expo-web-browser`. `package.json` : ajout deps `expo-apple-authentication@~55.0.13`, `expo-auth-session@~55.0.16`, `expo-crypto@~55.0.15`, `expo-web-browser@~55.0.16` (versions Expo SDK 55 strict).
- `test(auth)` Story 2.3a — `__tests__/components/PhoneScreen.test.tsx` : mock `GoogleButton` + `AppleButton` (évite deps natives en Jest), 2 nouveaux tests « Google button rendu » + « Apple button rendu sur iOS ». `__tests__/components/OtpScreen.test.tsx` : mock `supabase.auth.setSession`, nouveau test « 3 essais → friction panel contient Resend + Change phone », nouveau test « démo : setSession jamais appelé ».

### Verify
- `npx tsc --noEmit` : 0 erreur ✓
- `npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
- `npm run i18n:check` : ✓ Aucune string FR hardcodée
- `npm test` : 94 tests passent / 18 suites + 3 skipped ✓
- `npx expo export --platform web` : bundle compile sans erreur ✓
- Tests Deno : à exécuter en CI (Deno non installé localement Windows).

### Triple sign-off
- **Stéphanie** (tech) : pending — review pattern `generateLink + verifyOtp` server-side (Edge Function), trade-off email synthétique, alpha Termii sandbox green à valider avec projet Supabase live.
- **Kidam** (analytics) : pending — `auth_signed_in { method: "google" | "apple" }` déjà présent dans `events.md` ligne 128 (P10 appliqué).
- **Alexandre** (brand) : pending — voix du Chat post-Google/post-Apple identique à post-OTP (pas de variant dédié — décision : réutiliser le pattern). Test Tantie Rose sur les 2 boutons « Continuer avec Google » / « Continuer avec Apple » (wording standard, conforme).

### Résidus / à suivre (deferred-work.md)
- **OAuth provider config** : `googleClientId` / `googleIosClientId` / `googleAndroidClientId` à provisionner côté Supabase Auth + Google Cloud Console + Apple Developer. Sans config, les boutons rendent toast graceful « Google indisponible » / « Apple indisponible » — pas de crash.
- **Tests Deno success path** : nécessite mock Supabase admin SDK ou test contre projet Supabase de test. À câbler en CI dédiée Supabase functions.
- **Email synthétique en DB** : `auth.users.email = phone-<userId>@phone.spawt.local` pollue la table. Trade-off accepté V1 (alternative = JWT signing direct → refresh KO après 1h). Si écran de récupération email ajouté Sprint 2+, prévoir `updateUserById` pour basculer.
- **`listUsers({perPage:1000})` plafond** : au-delà de 1000 spawters auth, basculer sur query SQL directe `auth.users WHERE phone = $1`. Defer hardening pré-public.

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
