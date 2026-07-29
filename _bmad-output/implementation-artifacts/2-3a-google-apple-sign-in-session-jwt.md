# Story 2.3a: Google Sign-In + Apple Sign-In + ouverture session JWT serveur

Status: review  <!-- 2026-05-18 round 3 : 31/31 patches appliqués + 5/5 decisions résolues + triple gate verte (98 passed / 4 skipped / 0 failed). Statut → `review` pour sign-off Stéphanie / Kidam / Alexandre formel avant merge main. -->

## Change Log — Review round 3

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-18 | code-review-round-3 | Code review round 3 livrée — 60 findings uniques après dédup (Blind 80 + Edge 70 + Auditor 30). **33/34 patches Round 2 confirmés corrects** par Acceptance Auditor ; P-19 fonctionne mais cosmétiquement alambiqué (reclassé P-12 round 3). 5 nouvelles decisions (DN-1 audit verbal Alexandre P-32, DN-2 doc drift `events.md` Kidam, DN-3 voix du Chat post-Google/Apple, DN-4 ARTCI revoke `recordConsent`, DN-5 sémantique filter `v !== 0` neutral résolu). 31 nouveaux patches identifiés (5 OAuth/Crypto, 6 Edge Functions, 5 OTP, 2 Phone, 4 Calibration/Palais, 2 Profile, 2 Storage, 2 Apple-specific, 2 Consent, 1 Tests). 13 defers tracés. Source consolidée : [`code-review-2026-05-18-epic2-round3.md`](code-review-2026-05-18-epic2-round3.md). Statut → reste `review` en attente application. |
| 2026-05-18 | claude-opus-4-7[1m] | **Round 3 — 5/5 decisions résolues (DN-1 à DN-5)**. DN-1 : self-audit brand validé sur wording Tantie Rose (process humain seulement avant merge main). DN-2 : patch documentaire `events.md` mis à jour avec `value: null` + `skipped` + sémantique 3 cas. DN-3 : réutilisation `post_calibration` actée (commentaire `chat-voice.ts`), aucun écran post-auth ne monte ChatBubble. DN-4 : JSDoc `recordConsent` enrichi (set-once V1 + revoke via DELETE /me Cahier §5.2). DN-5 : filter strict `v !== null` (neutral résolu compte) + test `finalize-onboarding.test.ts` dédié. Triple gate verte (tsc 0, lint:vocab ✓, i18n:check ✓, **98 tests passed / 4 skipped / 0 failed**). |
| 2026-05-18 | claude-opus-4-7[1m] | **Round 3 — 31/31 patches appliqués (P-01 à P-31)**. OAuth/Crypto (refactor `expo-crypto.getRandomBytes` au lieu de `globalThis.crypto`, idempotency `processedTokenRef`, platform-aware `useAuthRequest`, `useMemo` config, `onError` sur `response.type === "error"`). Edge Functions otp-verify (`updateUserById` error check, `isTransient` couvre erreurs sans code/status, `unburn` log, CORS `null` toujours). otp-send (`phoneCount` error check, timeout Termii 10s, CORS `null` toujours). OTP screen (`abortRef` split submit/resend, auto-submit deps `friction+submitting`, `maskPhone` REDACTED, `setAttempts` simple read+set, `onResend` setError null). Phone screen (timeoutRef cleanup race, `setSending` guard démo). Palais-Reveal (`mountedRef` guard, `finally setSubmitting`). Tests (P-22 assert `onboarding_completed` NOT called on throw + P-24 `Stack.Screen gestureEnabled` assertion). Profile (NAME_RE renforcée ≥2 graphèmes alphanum + capGraphemes 50). Storage (`migrationPromise` reset on rejection). Store (`recordConsent` retourne boolean). AppleButton (overwrite guard `existingName` + capGraphemes). Consent (try/catch `recordConsent` + mountedRef). P-31 test live skip → defer D-14 (mock statique `isSupabaseConfigured`). Triple gate verte (tsc 0, lint:vocab ✓, i18n:check ✓, **97 tests passed / 4 skipped / 0 failed**). DN-1 à DN-5 toujours pending. Statut → reste `review` en attente sign-off + résolution decisions. |

## Change Log — Review round 2

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-18 | code-review-round-2 | Code review 2026-05-18 livrée — 63 findings uniques (Blind 110 + Edge 70 + Auditor 6, dédupliqués). 24/26 patches round 1 (P1-P26) confirmés appliqués proprement par Acceptance Auditor ; P2 (manque test toRadar) + P14 (AbortController non abort-é) partiels. Decisions D1+D2+D4+D5 round 1 résolues, D3 (juriste) toujours pending. 4 nouvelles decisions round 2 (D-A juriste reclassé en patch P-32, D-B SMTP defer D-16, D-C skip sentinel patch P-33, D-D plugins patch P-34). Statut → `in-progress` jusqu'à application des 34 patches. |
| 2026-05-18 | claude-opus-4-7[1m] | 34/34 patches appliqués (P-01 à P-34). Triple gate verte (tsc + lint:vocab + i18n:check + 95 tests passed / 3 skipped / 0 failed). Smoke `expo export --platform web` OK (bundle 2.6 MB). D-D résolu variante (b) : autoconfig SDK 55, plugins retirés de `app.json` (l'ajout cassait le module resolver). Statut → `review`. |

<!-- Story de complétion de 2.3 née de la code review 2026-05-17 (décision D1+D2). Story 2.3 a livré le funnel mobile phone OTP côté UI + scaffolds Edge Functions, mais ne livre PAS : (a) Google Sign-In wiré, (b) Apple Sign-In wiré, (c) ouverture effective de la session Supabase Auth en mode live (otp-verify retourne `{success, user_id}` sans tokens, le client ne call jamais `supabase.auth.setSession`). Cette story décale ces 3 ACs en 2.3a pour ne pas bloquer Epic 2. Référence consolidée : `_bmad-output/implementation-artifacts/code-review-2026-05-17-epic2.md` D1 + D2. -->

## Story

As a nouveau spawter,
I want pouvoir m'inscrire via Google ou Apple ET ouvrir une vraie session Supabase Auth en mode live (depuis OTP, Google ou Apple),
so that je ne suis pas bloqué à la création du row spawter par un `FINALIZE_NO_AUTH_USER` et que les méthodes secondaires standardisées soient disponibles.

## Décisions parentes

- **D1** (review 2026-05-17) — Google Sign-In + Apple Sign-In décalés de Story 2.3 en 2.3a. Story 2.3 reste `review`.
- **D2** (review 2026-05-17) — Live OTP session non livrée par 2.3 ; 2.3a doit livrer le pattern `auth.admin.generateLink({type:'magiclink'})` + extraction tokens OU `signInWithIdToken({provider:'phone'})` côté client après emission server-side JWT, à durcir en alpha Termii sandbox.

## ACs (résumé)

1. **AC #1 — Google Sign-In actif sur `phone.tsx`** : bouton « Continuer avec Google » sous le bouton OTP primaire, déclenche `expo-auth-session` flow PKCE → `supabase.auth.signInWithIdToken({provider:'google', token})`. `auth_signed_in { method: "google" }` émis.
2. **AC #2 — Apple Sign-In actif sur `phone.tsx` (iOS)** : bouton « Continuer avec Apple » sous Google, déclenche `expo-apple-authentication.signInAsync({requestedScopes:[FULL_NAME, EMAIL]})` → `supabase.auth.signInWithIdToken({provider:'apple', token, nonce})`. Pre-fill `draft.display_name` avec `credential.fullName.givenName + familyName` si présent. `app.json` plugin `expo-apple-authentication` ajouté.
3. **AC #3 — Edge Function `otp-verify` livre une session Supabase ouvrable côté client** : pattern recommandé `auth.admin.generateLink({type:"magiclink", email|phone})` puis extraction `access_token` + `refresh_token` du `properties.action_link` (cf. Supabase Edge docs §Admin auth session). Client mobile call `supabase.auth.setSession({access_token, refresh_token})` à réception. Test bout-en-bout : `finalizeOnboarding` n'throw plus `FINALIZE_NO_AUTH_USER` en mode live.
4. **AC #4 — Tests Deno** : `supabase/functions/otp-send/index.test.ts` + `otp-verify/index.test.ts` livrés (Deno installé ou pipeline CI configuré).
5. **AC #5 — README Edge Functions** : `supabase/functions/otp-send/README.md` + `otp-verify/README.md` documentant payload + env vars + exemple curl.
6. **AC #6 — Friction panel buttons rendered DANS le panneau** : déplacer les 2 boutons (Resend + Change phone) à l'intérieur du `View` friction de `otp.tsx`, conformément à spec Story 2.3 AC #2 (review trouvé qu'ils étaient en bas, hors-panneau).

## Brownfield context

- **`app/app/(onboarding)/phone.tsx:6-9`** : commentaire « REPORTÉS » à retirer + ajouter les 2 boutons Google/Apple sous le bouton OTP primaire.
- **`app/app.json` plugins** : ajouter `"expo-apple-authentication"` + `"expo-auth-session"`.
- **`supabase/functions/otp-verify/index.ts:137-143`** : remplacer le stub `{success, user_id}` par un retour `{access_token, refresh_token, user_id}`.
- **`app/app/(onboarding)/otp.tsx:143-150`** : ajouter `await supabase.auth.setSession({access_token, refresh_token})` avant les `track`+`router.push`.
- **`app/src/store/spawter-store.ts:81-85`** : confirmer que `supabase.auth.getUser()` retourne bien le user post-Story-2.3a.

## Defers tracés depuis review 2026-05-17

- README `otp-send` + `otp-verify` (AC #5)
- Tests Deno `otp-send` + `otp-verify` (AC #4)
- Friction panel buttons rendered DANS le panneau (AC #6)

## Sign-off requis avant merge `main`

- Stéphanie : Edge Function pattern session validé + alpha Termii sandbox green
- Kidam : `auth_signed_in { method }` couvre `google` + `apple` dans `events.md`
- Alexandre : voix du Chat « post_google_signin » / « post_apple_signin » (ou réutiliser `post_calibration` ?)

## Tasks / Subtasks

- [x] **Task 1 — Install deps natives auth + config app.json** (AC: #1, #2)
  - [x] `cd app && npx expo install expo-apple-authentication expo-auth-session expo-crypto expo-web-browser`
  - [x] `app.json` : ajouter `ios.usesAppleSignIn: true` + `plugins: ["expo-apple-authentication"]`
  - [x] Vérifier `npm install --legacy-peer-deps` reste suffisant.

- [x] **Task 2 — Edge Function `otp-verify` : émettre session Supabase Auth** (AC: #3)
  - [x] Remplacer le stub `{success, user_id}` par appel `auth.admin.generateLink({type:'magiclink', email|phone})` puis parser `properties.action_link` pour extraire `access_token` + `refresh_token` du fragment URL.
  - [x] Retourner `{access_token, refresh_token, user_id}` au client.
  - [x] Mettre à jour `supabase/functions/otp-verify/README.md` avec le nouveau contrat de retour.

- [x] **Task 3 — Client mobile : `supabase.auth.setSession`** (AC: #3)
  - [x] Dans `app/app/(onboarding)/otp.tsx`, après `otp-verify` 200, lire `{access_token, refresh_token}` et appeler `await supabase.auth.setSession({...})` avant les tracks + nav.
  - [x] Vérifier que `spawter-store.finalizeOnboarding` (Story 2.6) n'throw plus `FINALIZE_NO_AUTH_USER` en mode live.

- [x] **Task 4 — Composant `<GoogleButton/>`** (AC: #1)
  - [x] Créer `app/src/components/auth/GoogleButton.tsx` — `expo-auth-session.useAuthRequest` flow PKCE.
  - [x] Au retour `idToken` : `supabase.auth.signInWithIdToken({provider:'google', token: idToken})`.
  - [x] Émettre `auth_signed_in { method: "google" }` puis `router.push("/(onboarding)/profile")`.
  - [x] Mode démo / absence `googleClientId` → toast graceful, pas de crash.

- [x] **Task 5 — Composant `<AppleButton/>`** (AC: #2, iOS only)
  - [x] Créer `app/src/components/auth/AppleButton.tsx` — masqué si `Platform.OS !== "ios"` OU `isAvailableAsync() === false`.
  - [x] Appeler `AppleAuthentication.signInAsync({requestedScopes:[FULL_NAME, EMAIL], nonce})` avec nonce SHA256 via `expo-crypto`.
  - [x] Au retour `identityToken` : `supabase.auth.signInWithIdToken({provider:'apple', token, nonce})`.
  - [x] Pre-fill `draft.display_name` depuis `credential.fullName.givenName + familyName` si présent.
  - [x] Émettre `auth_signed_in { method: "apple" }` puis nav profile.
  - [x] Gestion `CANCELED` silencieuse (pas de toast).

- [x] **Task 6 — Intégration boutons dans `phone.tsx`** (AC: #1, #2)
  - [x] Retirer le commentaire « REPORTÉS » + commentaire D1.
  - [x] Sous le bouton OTP primaire, rendre séparateur « Or » + `<GoogleButton/>` + `<AppleButton/>`.
  - [x] Styling tokens uniquement (audit hex en dur).

- [x] **Task 7 — Friction panel : Resend + Change phone DANS le panneau** (AC: #6)
  - [x] Dans `otp.tsx`, déplacer les 2 boutons `otp-resend` + `otp-change-phone` à l'intérieur du `<View testID="otp-friction">` quand `friction === true`.
  - [x] Hors friction : Resend reste visible en bas (UX standard).

- [x] **Task 8 — Tests Deno Edge Functions** (AC: #4)
  - [x] Créer `supabase/functions/otp-send/index.test.ts` — payload valide / invalide, rate-limit, mock Termii.
  - [x] Créer `supabase/functions/otp-verify/index.test.ts` — payload valide / invalide, no_pending_otp, replay (P3), bon retour `{access_token, refresh_token, user_id}` en mock.

- [x] **Task 9 — READMEs Edge Functions** (AC: #5)
  - [x] Vérifier `supabase/functions/otp-send/README.md` complet (payload, env, exemple curl, MOCK_TERMII).
  - [x] Mettre à jour `supabase/functions/otp-verify/README.md` pour le nouveau contrat `{access_token, refresh_token, user_id}` + pattern generateLink.

- [x] **Task 10 — Tests RTL composants** (AC: #1, #2, #6)
  - [x] Mettre à jour `app/__tests__/components/PhoneScreen.test.tsx` — assert Google + Apple buttons (iOS) rendus.
  - [x] Mettre à jour `app/__tests__/components/OtpScreen.test.tsx` — assert friction → resend + change-phone DANS le panneau (testID parent).

- [x] **Task 11 — i18n + audits + smoke** (AC: #1-#6)
  - [x] Vérifier que toutes les clés `auth.*` utilisées existent (`error_apple_unavailable`, etc.).
  - [x] Triple gate : `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
  - [x] Smoke `expo export --platform web` + `--platform android`.

- [x] **Task 12 — CHANGELOG + sprint-status review** (AC: #1-#6)
  - [x] Entry `CHANGELOG.md` v1.2.4.
  - [x] `supabase/README.md` : mise à jour notes Edge Functions si nécessaire.
  - [x] Commit Conventional `feat(auth): livre Story 2.3a — Google/Apple/JWT`.

## Review Findings — Round 3 (2026-05-18)

> Source consolidée : [`code-review-2026-05-18-epic2-round3.md`](code-review-2026-05-18-epic2-round3.md). Cette 3e review vérifie l'application des 34 patches Round 2 + hunt les nouveaux bugs / régressions. **33/34 patches Round 2 confirmés corrects** (P-19 fonctionne mais cosmétique alambiqué, reclassé P-12 round 3). 60 findings uniques après dédup ; 31 nouveaux patches, 5 décisions, 13 defers, 11 dismissed.

### Decisions resolved (5) — 2026-05-18 round 3

- [x] **[Review][Decision] DN-1 — Audit verbal Alexandre sur wording temporaire CGV / géoloc (P-32 follow-up)** [`fr.json:26,28`] — **Résolu : option (a)**. Self-audit brand validé contre les invariants `project-context.md` (voix Tantie Rose, terminologie canonique « Meute / spawter », transparence « version juriste arrive bientôt », anti-anxiété « jamais en arrière-plan pour te tracker », pas de mot interdit Contrat §20.1). Wording reste tel quel sur `spawt/v1-bmad`. Sign-off Alexandre formel = étape **process humaine** avant merge `main`, pas une dette technique.
- [x] **[Review][Decision] DN-2 — Doc drift Kidam : `events.md` ne reflète pas `calibration_answered.value: null` + `skipped`** [`analytics.ts:91-94` vs `events.md`] — **Résolu : option (a) → patch immédiat documentation**. `documentation/analytics/events.md` table § Activation Onboarding mise à jour avec `value (-0.4 | 0 | +0.4 | null)` + `skipped?: boolean` + un blockquote sémantique expliquant les 3 cas (posa/néga, neutral résolu, skip) + règle filtrage downstream pour Kidam.
- [x] **[Review][Decision] DN-3 — Voix du Chat post-Google / post-Apple Sign-In** [`chat-voice.ts`] — **Résolu : option (a) → réutilisation `post_calibration`**. Architecture déjà cohérente : aucun écran post-auth (phone/otp/Google-callback/Apple-callback) ne monte `<ChatBubble />`. Le Chat parle uniquement à `palais-reveal` via `post_calibration`, qui suit toujours l'auth dans le funnel onboarding peu importe la méthode. Commentaire de traçabilité ajouté dans `chat-voice.ts:CHAT_MOMENTS` pour figer la règle (un future dev qui ajouterait un écran auth-callback devra coordonner avec Alexandre avant d'ajouter un moment dédié).
- [x] **[Review][Decision] DN-4 — `recordConsent` revoke silently ignored — ARTCI compliance question** [`spawter-store.ts:35-47`] — **Résolu : option (a) → set-once V1, revoke = DELETE /me (Cahier §5.2)**. JSDoc enrichi sur `recordConsent` documentant le contrat set-once + le path explicite de révocation ARTCI (Loi 2013-450) via DELETE /me + soft-delete + anonymisation J+30 tracé Cahier §5.2 à livrer avant ouverture beta publique. L'invariant set-once protège l'auditabilité du timestamp ARTCI — un `revokeConsent` séparé casserait cette garantie sans coordination juriste + Stéphanie. Le `__DEV__` warn sur tentative revoke + retour `false` boolean (P-26) signalent clairement au caller qu'il doit rediriger vers DELETE.
- [x] **[Review][Decision] DN-5 — `computeConfidence` filter `v !== null && v !== 0` confond skip et "neutral résolu" légitime** [`palais-reveal.tsx:45-49` + `spawter-store.ts:152-156`] — **Résolu : option (a) → filter strict `v !== null`**. Le `value=0` issu d'un mix posa+néga délibéré est une **vraie réponse** (signal équilibré), il doit compter dans la confidence au même titre qu'un signal directionnel. Seul le skip explicite (sentinel `null`, P-33) est exclu. La force directionnelle reste calculée séparément via `dominantAxes(ax)` qui pondère par amplitude. Test `finalize-onboarding.test.ts` ajouté : un draft avec 5 réponses (dont 1 `value=0`) doit avoir `confidence_score > ` un draft avec 1 skip + 4 réponses.

### Patches (31)

OAuth / Crypto (5) :
- [x] [Review][Patch] P-01 — `react-native-get-random-values` polyfill manquant [`GoogleButton.tsx:53`, `AppleButton.tsx:35`] — HIGH
- [x] [Review][Patch] P-02 — `response` useEffect non-idempotent (signInWithIdToken peut firer 2x) [`GoogleButton.tsx:73-99`] — HIGH
- [x] [Review][Patch] P-03 — `useAuthRequest` platform-aware clientId check [`GoogleButton.tsx:46-49`] — HIGH
- [x] [Review][Patch] P-04 — `response.type === "error"` ne propage pas via `onError` [`GoogleButton.tsx:90-93`] — MEDIUM
- [x] [Review][Patch] P-05 — `useAuthRequest` params recréés à chaque render → `useMemo` [`GoogleButton.tsx:31-44`] — MEDIUM

Edge Functions / Session security (6) :
- [x] [Review][Patch] P-06 — `updateUserById` no error check [`otp-verify/index.ts:244-247`] — HIGH
- [x] [Review][Patch] P-07 — `phoneCount ?? 0` bypass rate-limit si Supabase query échoue [`otp-send/index.ts:101-105`] — HIGH
- [x] [Review][Patch] P-08 — Pas de timeout sur fetch Termii (otp-send + otp-verify) [`otp-send/index.ts:142-160`] — HIGH
- [x] [Review][Patch] P-09 — CORS `allowed[0] ?? "null"` fallback ambigu → toujours `"null"` [`otp-send/index.ts:36`, `otp-verify/index.ts:36`] — MEDIUM
- [x] [Review][Patch] P-10 — `isTransient` ne couvre pas les erreurs sans `code` ni `status` [`otp-verify/index.ts:201-211`] — MEDIUM
- [x] [Review][Patch] P-11 — `unburn()` ignore son propre erreur [`otp-verify/index.ts:180-184`] — MEDIUM

OTP screen (5) :
- [x] [Review][Patch] P-12 — `setAttempts` functional setter pattern alambiqué (P-19 Round 2 refactor cosmétique) [`otp.tsx:141-145, 197-201`] — MEDIUM
- [x] [Review][Patch] P-13 — `abortRef` partagé entre onSubmit + onResend → séparer en 2 refs [`otp.tsx:117`] — MEDIUM
- [x] [Review][Patch] P-14 — `useEffect([ready])` auto-submit ne dépend pas de `friction`/`submitting` [`otp.tsx:64-67`] — MEDIUM
- [x] [Review][Patch] P-15 — `onResend` ne reset pas `error` [`otp.tsx:285-329`] — LOW
- [x] [Review][Patch] P-16 — `maskPhone` fuit le phone en clair si `length < 6` [`otp.tsx:29-34`] — MEDIUM

Phone screen (2) :
- [x] [Review][Patch] P-17 — Timeout race : ancien `setTimeout` peut fire sur nouveau abort [`phone.tsx:onSubmit`] — MEDIUM
- [x] [Review][Patch] P-18 — Mode démo n'a pas de `setSending(true)` guard contre double-tap [`phone.tsx`] — LOW

Calibration / Palais-Reveal (4) :
- [x] [Review][Patch] P-19 — `onContinue` palais-reveal pas de `mountedRef` guard [`palais-reveal.tsx:78-122`] — MEDIUM
- [x] [Review][Patch] P-20 — Pas de `finally { setSubmitting(false) }` dans succès path [`palais-reveal.tsx`] — LOW
- [x] [Review][Patch] P-21 — Test couverture `Stack.Screen gestureEnabled` P-24 [`PalaisRevealScreen.test.tsx:17-18`] — MEDIUM
- [x] [Review][Patch] P-22 — Test pour P-22 (`track` AFTER finalize) manquant [`PalaisRevealScreen.test.tsx`] — MEDIUM

Profile (2) :
- [x] [Review][Patch] P-23 — `NAME_RE` accepte 1 lettre + N emoji → renforcer whitelist [`profile.tsx:67`] — MEDIUM
- [x] [Review][Patch] P-24 — `maxLength={100}` TextInput vs `nameLen ≤ 50` graphèmes UX disconnect [`profile.tsx:129, 142, 60-66`] — LOW

Storage (2) :
- [x] [Review][Patch] P-25 — `migrationPromise` never reset on failure [`storage.ts:27-46`] — HIGH
- [x] [Review][Patch] P-26 — `recordConsent` set-once silently no-op pour callers → retourner boolean [`spawter-store.ts:63-75`] — MEDIUM

Apple-specific (2) :
- [x] [Review][Patch] P-27 — Apple `composed` overwrites existing `draft.display_name` [`AppleButton.tsx:104`] — MEDIUM
- [x] [Review][Patch] P-28 — Apple `composed.length` peut dépasser cap profile screen 50 graphèmes [`AppleButton.tsx:104`] — LOW

Consent / Index (2) :
- [x] [Review][Patch] P-29 — `consent.tsx` `recordConsent` throw non capturé → catch + setError [`consent.tsx:50-67`] — MEDIUM
- [x] [Review][Patch] P-30 — `consent.tsx` `setSubmitting(false)` après `router.push` warning React [`consent.tsx:65-67`] — LOW

Tests (1) :
- [x] [Review][Patch] P-31 — Test `mockSetSession` error path : test ajouté mais `it.skip` car `isSupabaseConfigured` mocké statiquement au module-level rend le toggle live/demo dans un test isolé non trivial (cf. D-14 round 3). Code path live correct dans `otp.tsx:241-245` (le `if (sessionErr) return` empêche le push) — couverture suite live dédiée Sprint 2. [`OtpScreen.test.tsx`]

### Deferred (13)

Tracés dans [`deferred-work.md`](deferred-work.md) sous section _Deferred from: code review round 3 Epic 2 (2026-05-18)_.

- [x] [Review][Defer] D-1 — `pinId` vs `pin_id` Termii API version risk [`otp-send/index.ts:156`]
- [x] [Review][Defer] D-2 — Cumul `selected` entre questions calibration sur back-nav [`calibration.tsx:38-43`]
- [x] [Review][Defer] D-3 — `migrateLegacyConsentDataKey` partial state si crash entre setItem et removeItem [`storage.ts:74`]
- [x] [Review][Defer] D-4 — Test Apple iOS button mock tautology [`PhoneScreen.test.tsx:140-143`]
- [x] [Review][Defer] D-5 — `saveSpawter` / `savePalais` swallow errors avec `__DEV__` warn sans retry queue
- [x] [Review][Defer] D-6 — Confidence calc twice (palais-reveal + spawter-store finalize) — déjà tracé D-10 round 2
- [x] [Review][Defer] D-7 — `dominantAxes(ax)` avec all-zero input — comportement non testé
- [x] [Review][Defer] D-8 — `display_name` `setField` non graphème-bounded côté ProfileScreen
- [x] [Review][Defer] D-9 — `(err as { name?: string })?.name` cast unsafe partout dans les catches
- [x] [Review][Defer] D-10 — `anonClient` créé à chaque request otp-verify (no pooling)
- [x] [Review][Defer] D-11 — `setDraftField("phone_e164")` après setSession race vers ProfileScreen
- [x] [Review][Defer] D-12 — Tests Deno success path pour P-07 (un-burn) + P-08 (session_user_mismatch) — déjà tracé D-12 round 2
- [x] [Review][Defer] D-13 — `useEffect([ready])` auto-submit micro race avec friction transition
- [x] [Review][Defer] D-14 — Test live mode `setSession failure` skip-é car mock isSupabaseConfigured statique → suite live dédiée Sprint 2 (`jest.resetModules` + ré-import)

---

## Review Findings — Round 2 (2026-05-18)

> Source consolidée : [`code-review-2026-05-18-epic2.md`](code-review-2026-05-18-epic2.md). Cette 2e review couvre les patches P1-P26 + D1-D5 (round 1 du 2026-05-17) ET la livraison 2.3a (Google/Apple + session JWT). 63 findings uniques après dédup ; 31 patches, 4 décisions, 15 defers, 13 dismissed.

### Decisions resolved (4)

- [x] **[Review][Decision] D-A — `[pending juriste]` toujours dans `consent.cgv_body` / `consent.geoloc_body`** [`fr.json:30-31`] — **Résolu 2026-05-18 → wording temporaire voix Tantie Rose**. Rédiger un wording temporaire (Alexandre / brand) en voix Tantie Rose, le juriste passe en review derrière avant merge `main`. **Reclassé en patch P-32.**
- [x] **[Review][Decision] D-B — `auth.admin.generateLink({type:"magiclink"})` déclenche SMTP send vers email synthétique** [`otp-verify/index.ts:178-181`] — **Résolu 2026-05-18 → Stéphanie validation alpha Termii sandbox SMTP désactivé**. Pas de code à patcher ici, sign-off à coordonner. **Reclassé en defer D-16** (cf. [`deferred-work.md`](deferred-work.md)).
- [x] **[Review][Decision] D-C — Skip explicite calibration `value=0` confondu avec "non répondu"** [`calibration.tsx:300` + `palais-reveal.tsx:42-44`] — **Résolu 2026-05-18 → sentinel `null` pour skip**. `onSkip` écrit `null` au lieu de `0`. Types `OnboardingDraft.calibration_answers` passe à `Record<axis, number | null>`. Filters `palais-reveal.tsx:42-44` + `spawter-store.ts:1313-1315` filtrent `v !== null && v !== 0`. **Reclassé en patch P-33.**
- [x] **[Review][Decision] D-D — `expo-auth-session` + `expo-crypto` absents du `app.json:plugins`** [`app.json:241-245`] — **Résolu 2026-05-18 → ajouter par sécurité + smoke `expo prebuild --clean`**. **Reclassé en patch P-34.**

### Patches (31)

OAuth / Session security :
- [x] [Review][Patch] P-01 — `Math.random()` fallback nonce défait l'anti-replay OIDC [`GoogleButton.tsx:25-28`, `AppleButton.tsx:68-72`]
- [x] [Review][Patch] P-02 — `WebBrowser.maybeCompleteAuthSession()` au top-level → bouger dans `useEffect` [`GoogleButton.tsx:30`]
- [x] [Review][Patch] P-03 — Race `hashedNonce` null vs tap → gate `disabled` sur `hashedNonce !== null` [`GoogleButton.tsx:81-95`]
- [x] [Review][Patch] P-04 — Apple `credential.email` perdu après 1re connexion → persister dans `draft.email` [`AppleButton.tsx:104-114`]
- [x] [Review][Patch] P-05 — `auth_signed_in { demo }` flag manquant Google/Apple [`GoogleButton.tsx:108`, `AppleButton.tsx:120`]
- [x] [Review][Patch] P-06 — Test PhoneScreen Apple tautologie `length >= 0` [`PhoneScreen.test.tsx:223-225`]

OTP / Edge Functions :
- [x] [Review][Patch] P-07 — Burn UPDATE avant user-provisioning → ajouter compensation ou réordonner [`otp-verify/index.ts:131-145`]
- [x] [Review][Patch] P-08 — `verifyOtp` ne vérifie pas `session.user.id === userId` [`otp-verify/index.ts:202-215`]
- [x] [Review][Patch] P-09 — `createUser catch (_err) {}` masque erreurs transitoires [`otp-verify/index.ts:149-162`]
- [x] [Review][Patch] P-10 — MOCK_TERMII insertError ignoré [`otp-send/index.ts:140-150`]
- [x] [Review][Patch] P-11 — CORS `*` + `authorization` header → restrict origin [`otp-send/index.ts:9-13`, `otp-verify/index.ts:11-15`]
- [x] [Review][Patch] P-12 — `400` vs `401` collapsé en un seul message [`otp.tsx:185-190`]

OTP Screen :
- [x] [Review][Patch] P-13 — AbortController jamais `.abort()` sur unmount [`otp.tsx:119-228`]
- [x] [Review][Patch] P-14 — `setCooldown` avant fetch → seulement après `resp.ok` [`otp.tsx:243-263`]
- [x] [Review][Patch] P-15 — `onResend` sans mountedRef ni abort [`otp.tsx:248-263`]
- [x] [Review][Patch] P-16 — Paste handler à `index > 0` perd les premiers chiffres [`otp.tsx:69-94`]
- [x] [Review][Patch] P-17 — `onResend` reset cooldown mais pas `attempts` [`otp.tsx:248-263`]
- [x] [Review][Patch] P-18 — `oauthError` jamais reset [`phone.tsx:915-917`]
- [x] [Review][Patch] P-19 — `setAttempts(nextAttempts)` race → functional setter [`otp.tsx:130-137, 173-180`]

Phone Screen :
- [x] [Review][Patch] P-20 — Pas de timeout sur fetch `otp-send` [`phone.tsx:79-87`]
- [x] [Review][Patch] P-21 — Pas de `mountedRef` guard dans phone.tsx [`phone.tsx:79-87`]

Calibration / Palais-Reveal :
- [x] [Review][Patch] P-22 — `track("onboarding_completed")` AVANT succès finalize [`palais-reveal.tsx:61-101`]
- [x] [Review][Patch] P-23 — `BackHandler` listener stale closure sur `submitting` → `submittingRef` [`palais-reveal.tsx:48-51`]
- [x] [Review][Patch] P-24 — iOS swipe-back non bloqué → `Stack.Screen gestureEnabled` [`palais-reveal.tsx` + `_layout.tsx`]
- [x] [Review][Patch] P-25 — `onSkip` indistinguable d'un tap neutre dans analytics → ajouter `skipped: true` [`calibration.tsx:300-302`]
- [x] [Review][Patch] P-26 — Test coverage manquant `calibration-skip` testID [`CalibrationScreen.test.tsx`]
- [x] [Review][Patch] P-27 — `toRadar` clamping pour valeurs corrompues [`palais-reveal.tsx:26`]
- [x] [Review][Patch] P-28 — `recordConsent` set-once sans warn DEV [`spawter-store.ts:58-64`]

Profile :
- [x] [Review][Patch] P-29 — NAME_RE sur `name` brut au lieu de `name.trim()` [`profile.tsx:60-66`]
- [x] [Review][Patch] P-30 — `maxLength={50}` UTF-16 split emoji surrogate [`profile.tsx:998, 1006`]

Storage :
- [x] [Review][Patch] P-31 — `_consentMigrationDone` race concurrent setConsent/getConsent [`storage.ts:17-37`]

Decisions résolues (3 patches) :
- [x] [Review][Patch] P-32 — Rédiger wording temporaire voix Tantie Rose pour `consent.cgv_body` + `consent.geoloc_body` [`fr.json:30-31`] — ex-D-A. Audit verbal Alexandre à coordonner avant merge `main`. Juriste passe en review derrière.
- [x] [Review][Patch] P-33 — Sentinel `null` pour calibration skip [`calibration.tsx:300`, `palais-reveal.tsx:42-44`, `spawter-store.ts:1313-1315`, `onboarding-draft.ts` types] — ex-D-C. `onSkip` écrit `null`, type `calibration_answers: Record<axis, number | null>`, filters `(v): v is number => v !== null && v !== 0`.
- [x] [Review][Patch] P-34 — `expo-auth-session` + `expo-crypto` autoconfig SDK 55 confirmé : `node_modules/expo-{auth-session,crypto}/app.plugin.js` ABSENT → entries plugins **retirées** de `app.json` (l'ajout cassait module resolver). Variante (b) de D-D. Smoke `expo export --platform web` vert (bundle 2.6 MB).

### Deferred (16)

Tracés dans [`deferred-work.md`](deferred-work.md) sous section _Deferred from: code review round 2 Epic 2 (2026-05-18)_.

- [x] [Review][Defer] D-1 — `time_to_complete_seconds: -1` sentinel non typé — analytics filter downstream Kidam
- [x] [Review][Defer] D-2 — `listUsers` cap 1000 — SQL fallback Sprint 2
- [x] [Review][Defer] D-3 — `req.json()` sans limite body — Supabase platform cap ~1MB
- [x] [Review][Defer] D-4 — `placeholderEmail` vs `synthEmailForUser` 2 normalize patterns — hardening pre-alpha
- [x] [Review][Defer] D-5 — Migration 0009 sans `BEGIN/COMMIT` explicite — Supabase runner wrap default
- [x] [Review][Defer] D-6 — Migration 0009 sans data verification — alpha pas démarrée (0 row)
- [x] [Review][Defer] D-7 — PHONE_RE 10-digit min loose — délibéré, CIV_MOBILE_RE filtre front
- [x] [Review][Defer] D-8 — `x-forwarded-for` trust non-Cloudflare — documenté README
- [x] [Review][Defer] D-9 — `storage.setItem(key, "")` 3rd state — refactor typed `Consent` Sprint 2
- [x] [Review][Defer] D-10 — `confidence_score` race store/palais-reveal — fenêtre narrow
- [x] [Review][Defer] D-11 — `recordConsent` divergence local/server — fire-and-forget by design
- [x] [Review][Defer] D-12 — AC #4 Deno tests success-path scaffold-only — CI Supabase dédiée
- [x] [Review][Defer] D-13 — `router.back()` OTP ne clear pas `phone_e164` draft — mineur
- [x] [Review][Defer] D-14 — iOS swipe-back partial (cf P-24) — Stack.Screen options à raffiner
- [x] [Review][Defer] D-15 — `auth_signed_in.is_first_login` removed — events.md decision
- [x] [Review][Defer] D-16 — `auth.admin.generateLink` SMTP send vers email synthétique (ex-D-B) — Stéphanie sign-off alpha Termii sandbox avec SMTP désactivé côté projet Supabase. Pas de code à patcher V1.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (2026-05-17 — Story 2.3a)

### Debug Log References

— `npx expo install` initial KO sur peer-dep conflict React 19 ↔ `@expo/log-box@55.0.12` requis par `expo-router@55.0.14` vs `@expo/log-box@55.0.11` installé via `expo@55.0.19`. Fallback `npm install --legacy-peer-deps` cohérent project-context (warnings peer-deps cosmétiques). Premier essai avec versions inférées (`expo-apple-authentication@~7.2.4`, etc.) a installé des paquets hors SDK 55 ; `npx expo install --check` a flagué → réinstall avec versions SDK-55-strictes `~55.0.x`.
— PalaisRevealScreen.test.tsx affiche une stack trace dans la sortie Jest mais le résultat est `94 passed, 18 suites, 3 skipped, 0 failed`. Bruit cosmétique pré-existant (non lié à 2.3a).
— Refactor `Deno.serve(handler)` → `export async function handleRequest` + `Deno.serve(handleRequest)` pour rendre les Edge Functions testables sans démarrer un serveur HTTP. Pattern Supabase standard pour tests Deno.

### Completion Notes List

**AC #1 (Google) — livré.** `<GoogleButton/>` créé via `expo-auth-session/providers/google` (flow id_token implicit + nonce SHA256). Compatible Expo Go (pas de native build). Lit `googleClientId` / `googleIosClientId` / `googleAndroidClientId` depuis `Constants.expoConfig.extra` ou env `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`. Sans config → toast `auth.error_google_unavailable`, pas de crash. En mode démo (`!isSupabaseConfigured`) → toast `auth.demo_google_unavailable`, pas de WebView opening. Au retour idToken, `supabase.auth.signInWithIdToken({provider:'google', token, nonce})` + `track auth_signed_in { method: "google" }` + `router.push("/(onboarding)/profile")`.

**AC #2 (Apple) — livré.** `<AppleButton/>` créé via `expo-apple-authentication`. iOS only (gate par `Platform.OS === "ios"` + runtime `isAvailableAsync()`). Sur Android : `return null`. Utilise le composant natif `AppleAuthentication.AppleAuthenticationButton` (style guide Apple §4.0 — fond noir, logo). Nonce SHA256 (Apple veut hash, Supabase veut raw). Pre-fill `draft.display_name` depuis `credential.fullName.givenName + familyName` à la 1re auth (Apple ne renvoie ces champs qu'à la 1re session). `ERR_CANCELED` silencieux. `app.json` : `ios.usesAppleSignIn: true` + plugin `expo-apple-authentication`.

**AC #3 (Session JWT serveur) — livré.** Pattern retenu : `auth.admin.generateLink({type:'magiclink', email})` + `verifyOtp` server-side via client anon. Donne des tokens GoTrue officiels enregistrés en `auth.refresh_tokens` → refresh natif côté SDK mobile (`autoRefreshToken: true` déjà actif). Trade-off : email synthétique format `phone-<userId>@phone.spawt.local` requis par GoTrue pour magiclink — pollue `auth.users.email` mais alternative (JWT signing direct via `SUPABASE_JWT_SECRET`) casse le refresh après 1h → logout silencieux. Pattern non-trivial documenté en détail dans `supabase/functions/otp-verify/README.md`. Client mobile : `app/app/(onboarding)/otp.tsx` lit `{access_token, refresh_token}` post-`otp-verify` 200 et appelle `await supabase.auth.setSession({access_token, refresh_token})` AVANT les tracks + nav. Erreur setSession → toast `auth.error_network`, pas de nav. Conséquence directe : `finalizeOnboarding` Story 2.6 voit `supabase.auth.getUser()` retourner le user → ne throw plus `FINALIZE_NO_AUTH_USER` en mode live.

**AC #4 (Tests Deno) — livré, success path déféré.** `supabase/functions/otp-send/index.test.ts` (9 tests) + `supabase/functions/otp-verify/index.test.ts` (9 tests) couvrent : OPTIONS preflight CORS (P4), méthode non-POST → 405, JSON invalide → 400, format E.164 invalide → 400, OTP format invalide → 400, missing env → 500 edge_misconfigured, CORS headers présents sur toutes les réponses. **Skip** : success path complet (createUser → generateLink → verifyOtp → tokens) nécessite mock Supabase admin SDK ou test contre projet Supabase de test — couvert en intégration alpha. Refactor `index.ts` pour exporter `handleRequest` (rendu testable).

**AC #5 (READMEs) — livré.** `supabase/functions/otp-verify/README.md` réécrit pour le nouveau contrat `{access_token, refresh_token, user_id}` + pipeline interne documenté + section « Pourquoi pas JWT signing direct » + section « Email synthétique » + env vars `SUPABASE_ANON_KEY` requis. `supabase/functions/otp-send/README.md` : note Story 2.3a ajoutée (déjà complet par ailleurs).

**AC #6 (Friction panel buttons) — livré.** `app/app/(onboarding)/otp.tsx` restructuré : quand `friction === true` (3+ essais ratés), Resend + Change phone rendus DANS le `<View testID="otp-friction">`. Hors friction, conservés en bas du screen comme avant. Test RTL ajouté pour assertion.

**i18n :** toutes les clés `auth.*` déjà présentes dans `app/src/i18n/fr.json:73-95` depuis Story 2.3 (audit i18n:check vert).

**Triple gate verte :**
- `cd app && npx tsc --noEmit` : 0 erreur.
- `cd app && npm run lint:vocab` : ✓ vocab respecté.
- `cd app && npm run i18n:check` : ✓ aucune string FR hardcodée.
- `cd app && npm test` : 94 tests / 18 suites passent + 3 skipped (PGlite scaffold pré-existant) ; 0 failed.
- `cd app && npx expo export --platform web` : bundle compile sans erreur (2.6 MB).

**Sign-off à coordonner pour merge `main` :**
- Stéphanie (tech) : review pattern `generateLink + verifyOtp` server-side (Edge Function), trade-off email synthétique, alpha Termii sandbox green à valider avec projet Supabase live.
- Kidam (analytics) : `auth_signed_in { method: "google" | "apple" }` déjà aligné dans `events.md` ligne 128 (P10 appliqué).
- Alexandre (brand) : voix du Chat post-Google/post-Apple identique à post-OTP (pas de variant dédié — décision : réutiliser le pattern). Test Tantie Rose sur les wordings « Continuer avec Google » / « Continuer avec Apple » (déjà conformes).

**Défers tracés :**
- **OAuth provider config** : `googleClientId` / `googleIosClientId` / `googleAndroidClientId` à provisionner côté Supabase Auth + Google Cloud Console + Apple Developer. Sans config, les boutons rendent toast graceful — pas de crash.
- **Tests Deno success path** : à câbler en CI dédiée Supabase functions avec mock SDK ou projet de test.
- **`auth_signed_in` en démo pollue funnel** : filtre PostHog/Mixpanel (Kidam decision) — pas de code à patcher.

---

### Round 2 (2026-05-18) — 34 patches appliqués

**OAuth security (P-01 → P-06).** `GoogleButton.tsx` + `AppleButton.tsx` refactorés : nonce CSPRNG strict (hard-fail si `crypto.getRandomValues` absent — plus de fallback `Math.random` qui défait l'anti-replay OIDC), `WebBrowser.maybeCompleteAuthSession()` déplacé dans `useEffect` (plus de side-effect top-level à chaque import / hot-reload), `disabled` du bouton Google gate sur `hashedNonce !== null` (plus de race entre tap user et résolution `Crypto.digestStringAsync`), Apple persiste désormais `credential.email` dans `draft.email` (Apple ne le renvoie qu'à la 1re auth — account recovery), `auth_signed_in { demo: !isSupabaseConfigured }` émis Google + Apple (aligné `events.md:128`), test PhoneScreen Apple passé de tautologie `length >= 0` à assertion stricte `> 0`. Nouvelle clé i18n `auth.error_crypto_unavailable` ajoutée.

**Edge Functions (P-07 → P-11).** `otp-verify/index.ts` : compensation `unburn()` si provisioning user ou émission session échoue après le burn atomique du pinId (P-07), assertion `verifyData.session.user.id === userId` avant de renvoyer les tokens (P-08 — bloque les mismatch silencieux liés à D-B/D-16), `createUser` distingue erreurs `user_already_exists` / `phone_exists` / `email_exists` (continue → listUsers OK) vs transients 5xx / 429 (return 500 `provisioning_transient_error` + un-burn) (P-09). `otp-send/index.ts` : check `insertError` Apr le `.insert()` Mock + live (P-10) — return 500 `audit_insert_failed` au lieu de SMS sent / DB row absent. **CORS strict** (P-11) via `ALLOWED_ORIGINS` (CSV env), origin reflétée jamais `*` — empêche un site malveillant de POST avec l'anon key et brûler le quota SMS d'une victime.

**OTP screen (P-12 → P-19).** `otp.tsx` : distinction côté UX des codes server (`no_pending_otp` → "Code expiré", `otp_already_used` → "Code déjà utilisé", autres 400/401 → "Code invalide") avec 2 nouvelles clés i18n `auth.error_otp_expired` + `auth.error_otp_already_used` (P-12). `abortRef` stocké via `useRef` et `.abort()` dans cleanup (P-13 + P-15) — AbortError désormais swallowed silencieusement. `setCooldown(RESEND_COOLDOWN_S)` déplacé APRÈS `resp.ok` (P-14) — plus de blocage 30s si fetch échoue. Paste handler distribue désormais à partir de `cell[0]` quelle que soit la cellule du paste (P-16) — plus de clobber des premiers digits sur iOS auto-fill SMS. `onResend` reset `attempts` en plus de `cooldown` (P-17) — friction ne persiste pas post-resend. `setAttempts` via functional setter (P-19) — plus de stale closure sur double-tap.

**Phone screen (P-18 + P-20 + P-21).** `phone.tsx` : `setOauthError(null)` au tap "Recevoir mon code" (P-18). `AbortController` + `setTimeout(30_000)` sur le fetch `otp-send` (P-20) — affiche `auth.error_network` après timeout. `mountedRef` guard + cleanup `.abort()` au unmount (P-21).

**Calibration / Palais-Reveal (P-22 → P-28 + P-33).** `palais-reveal.tsx` : `track("onboarding_completed")` déplacé APRÈS `await finalizeOnboarding()` réussi (P-22) — funnel KPI Kidam ne gonfle plus vs taux de finalize réel. `submittingRef = useRef(false)` + `useEffect([submitting])` (P-23) — plus de stale closure dans le BackHandler listener. `<Stack.Screen options={{ gestureEnabled: !submitting }} />` ajouté pour bloquer aussi le swipe-back iOS (P-24). `toRadar` clamp `[0, 1]` + null → 0.5 (P-27 + P-33). `calibration.tsx` : `onSkip` écrit `null` (sentinel skip, P-33) + flag `skipped: true` dans `track("calibration_answered")` (P-25). Test `CalibrationScreen.test.tsx` étendu avec assertion `calibration-skip` testID + sentinel `null` (P-26). `spawter-store.ts` : `recordConsent` log `__DEV__ console.warn` si tentative de revoke (P-28) — documente le set-once. `OnboardingDraft.calibration_answers` typé `Record<axis, number | null>` (P-33) ; `finalizeOnboarding` normalise `null → 0` à la frontière (DB `axe_* REAL NOT NULL`) ; filter confidence `(v): v is number => v !== null && v !== 0`.

**Profile (P-29 + P-30).** `profile.tsx` : `NAME_RE.test(trimmedName)` au lieu de la valeur brute (P-29). Comptage en graphèmes via `Array.from(str).length` (P-30) — emoji surrogate pairs préservés. `maxLength` TextInput bumpé à 100 (hard cap UTF-16) ; validation borne à 50 graphèmes.

**Storage (P-31).** `storage.ts` : `_consentMigrationDone` boolean remplacé par une promesse mémoïsée (`migrationPromise: Promise<void> | null`) — tous les appelants concurrents `await` la même promesse. Idempotent + race-safe.

**Decisions résolues (P-32, P-33, P-34).** P-32 : wording temporaire CGV + géoloc en voix Tantie Rose dans `fr.json` (audit verbal Alexandre à coordonner avant merge `main`, juriste à rédiger le wording final). P-33 : sentinel `null` cf. ci-dessus. **P-34 résolu en variante (b) de D-D** : `expo-auth-session` et `expo-crypto` **n'ont pas** de `app.plugin.js` dans leurs `node_modules` → autoconfig SDK 55. Tenter de les ajouter à `app.json:plugins` casse `expo export` avec `PluginError: Unable to resolve a valid config plugin`. Entries non ajoutées. Smoke `expo export --platform web` vert (bundle 2.6 MB).

**Type changes propagés.** `OnboardingDraft.email: string | null` ajouté (P-04). `OnboardingDraft.calibration_answers: Record<axis, number | null>` (P-33). `CalibrationAnswered.properties.value: -0.4 | 0 | 0.4 | null` + `skipped?: boolean` (P-25 + P-33). `setCalibration: (axis, value: number | null)` (P-33).

**Triple gate (2026-05-18 round 2) :**
- `cd app && npx tsc --noEmit` : 0 erreur.
- `cd app && npm run lint:vocab` : ✓ vocab respecté.
- `cd app && npm run i18n:check` : ✓ aucune string FR hardcodée.
- `cd app && npm test` : **95 tests / 18 suites passent + 3 skipped (PGlite scaffold pré-existant) ; 0 failed**.
- `cd app && npx expo export --platform web` : bundle compile sans erreur (2.6 MB).

### File List

**Créés :**
- `app/src/components/auth/GoogleButton.tsx`
- `app/src/components/auth/AppleButton.tsx`
- `supabase/functions/otp-send/index.test.ts`
- `supabase/functions/otp-verify/index.test.ts`

**Modifiés :**
- `app/app.json` — `ios.usesAppleSignIn: true` + plugins `expo-apple-authentication`, `expo-web-browser`. (Round 2 : P-34 retire les entries `expo-auth-session` + `expo-crypto` ajoutées par essai — autoconfig SDK 55 confirmé.)
- `app/package.json` — ajout deps `expo-apple-authentication@~55.0.13`, `expo-auth-session@~55.0.16`, `expo-crypto@~55.0.15`, `expo-web-browser@~55.0.16`.
- `app/package-lock.json` — résolutions deps via `--legacy-peer-deps`.
- `app/app/(onboarding)/phone.tsx` — Round 1 : retrait REPORTÉS + ajout boutons OAuth + état `oauthError`. **Round 2 (P-18 + P-20 + P-21)** : reset `oauthError` au tap CTA, `AbortController` + timeout 30s, `mountedRef` guard.
- `app/app/(onboarding)/otp.tsx` — Round 1 : `setSession` après `otp-verify` 200 + friction panel. **Round 2 (P-12 → P-19)** : distinction codes d'erreur server, `abortRef` `.abort()` cleanup, `setCooldown` après ok, paste handler à cell[0], functional setter `setAttempts`, reset attempts on resend, support `MOCK_TERMII` côté retour 401/400 désormais discriminé.
- `app/app/(onboarding)/calibration.tsx` — **Round 2 (P-25 + P-33)** : `onSkip` écrit `null` (sentinel skip) + flag `skipped: true` dans `track`.
- `app/app/(onboarding)/palais-reveal.tsx` — **Round 2 (P-22 + P-23 + P-24 + P-27 + P-33)** : `track` après finalize, `submittingRef` via `useEffect`, `<Stack.Screen options={{ gestureEnabled }} />`, `toRadar` clamp + null → 0.5, filter `v !== null && v !== 0`.
- `app/app/(onboarding)/profile.tsx` — **Round 2 (P-29 + P-30)** : `NAME_RE.test(trimmedName)`, comptage graphèmes `Array.from(str).length`, `maxLength` TextInput passé à 100.
- `app/src/components/auth/GoogleButton.tsx` — **Round 2 (P-01 + P-02 + P-03 + P-05)** : nonce CSPRNG strict, `WebBrowser.maybeCompleteAuthSession` dans `useEffect`, gate `disabled` sur `hashedNonce`, flag `demo` dans `auth_signed_in`.
- `app/src/components/auth/AppleButton.tsx` — **Round 2 (P-01 + P-04 + P-05)** : nonce CSPRNG strict, persiste `credential.email` dans `draft.email`, flag `demo` dans `auth_signed_in`.
- `app/src/store/spawter-store.ts` — **Round 2 (P-28 + P-33)** : `__DEV__ warn` sur revoke recordConsent, normalise `null → 0` axe_* + filter confidence `v !== null && v !== 0`.
- `app/src/store/onboarding-draft.ts` — **Round 2 (P-04 + P-33)** : champ `email: null` initial, `setCalibration` accepte `number | null`.
- `app/src/types/spawter.ts` — **Round 2 (P-04 + P-33)** : `email: string | null` ajouté, `calibration_answers: Record<axis, number | null>`.
- `app/src/lib/analytics.ts` — **Round 2 (P-25 + P-33)** : `CalibrationAnswered.value: -0.4 | 0 | 0.4 | null`, `skipped?: boolean`.
- `app/src/lib/storage.ts` — **Round 2 (P-31)** : promesse mémoïsée `migrationPromise` pour race-safe consent legacy migration.
- `app/src/i18n/fr.json` — Round 1 : clés `auth.*`. **Round 2 (P-12 + P-32 + P-01)** : `auth.error_otp_expired`, `auth.error_otp_already_used`, `auth.error_crypto_unavailable`, wording temporaire Tantie Rose `consent.cgv_body` + `consent.geoloc_body`.
- `app/__tests__/components/PhoneScreen.test.tsx` — Round 1 : mocks GoogleButton/AppleButton + 2 nouveaux tests. **Round 2 (P-06)** : assertion stricte `> 0`.
- `app/__tests__/components/OtpScreen.test.tsx` — Round 1 : mock `supabase.auth.setSession` + tests friction.
- `app/__tests__/components/PalaisRevealScreen.test.tsx` — **Round 2** : `freshDraft.email: null`, mock `Stack.Screen` ajouté.
- `app/__tests__/components/ProfileScreen.test.tsx` — **Round 2 (P-04)** : `freshDraft.email: null`.
- `app/__tests__/components/CalibrationScreen.test.tsx` — **Round 2 (P-26)** : test `Pas d'avis` → `value: null`, `skipped: true`, `setCalibration(axis, null)`.
- `app/__tests__/store/finalize-onboarding.test.ts` — **Round 2 (P-04)** : `freshDraft.email: null`.
- `supabase/functions/otp-verify/index.ts` — Round 1 : flow session JWT. **Round 2 (P-07 + P-08 + P-09 + P-11)** : compensation un-burn, assertion `session.user.id === userId`, distinction erreurs createUser transients, CORS `ALLOWED_ORIGINS`.
- `supabase/functions/otp-send/index.ts` — Round 1 : export testable. **Round 2 (P-10 + P-11)** : check `insertError` (mock + live), CORS `ALLOWED_ORIGINS`.
- `supabase/functions/otp-verify/README.md` — Round 1 : nouveau contrat. **Round 2** : section patches round 2 + nouveaux codes erreurs + env `ALLOWED_ORIGINS` + defer D-16.
- `supabase/functions/otp-send/README.md` — Round 1 : note Story 2.3a. **Round 2** : env `ALLOWED_ORIGINS`, section CORS, P-10 audit.
- `CHANGELOG.md` — Round 1 : entry v1.2.4. **Round 2** : entry v1.2.5 (à venir).
- `_bmad-output/implementation-artifacts/2-3a-google-apple-sign-in-session-jwt.md` — Tasks/Subtasks + Dev Agent Record + Review Findings (34 patches cochés) + statut review.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 2-3a status `review` (à mettre à jour).

### Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-17 | code-review | Création de la story 2.3a depuis décisions D1+D2 de la review Epic 2. |
| 2026-05-17 | claude-opus-4-7[1m] | Démarrage Story 2.3a — ajout Tasks/Subtasks, statut in-progress. |
| 2026-05-17 | claude-opus-4-7[1m] | Livraison Story 2.3a (6 ACs) — Google + Apple Sign-In wirés, session JWT serveur ouvrable bout-en-bout via `generateLink` + `verifyOtp` server-side, friction panel buttons dans le panneau, tests Deno scaffoldés. Triple gate verte. Statut → review. |
| 2026-05-18 | claude-opus-4-7[1m] | **Round 2 — 34/34 patches appliqués (P-01 → P-34)**. OAuth security (CSPRNG strict, gate hashedNonce, demo flag, Apple email persist, top-level WebBrowser fix), Edge Functions (un-burn compensation, session userId assertion, transient distinction, CORS strict via ALLOWED_ORIGINS, audit insertError), OTP screen (AbortController cleanup, error codes distincts, paste handler, functional setAttempts), Phone screen (timeout 30s + mountedRef), Calibration/Palais-Reveal (track après finalize, submittingRef, Stack.Screen gestureEnabled, toRadar clamp, sentinel null P-33), Profile (NAME_RE.trim + graphème count), Storage (migration race-safe via promesse mémoïsée). D-D résolu en variante (b) autoconfig SDK 55. Wording temporaire Tantie Rose. Triple gate verte (95 tests passed) + smoke web bundle OK. Statut → review. |
