---
review_date: 2026-05-18
diff_baseline: 3af4d46 (uncommitted vs HEAD, 37 modifiés + 6 untracked)
diff_size: 3502 lignes (+1425 / -307 + nouveaux fichiers)
scope: Epic 2 — round 2 patches (P-01 → P-34 Story 2.3a) + sister stories 2.2 / 2.3 / 2.4 / 2.5 / 2.6 + Edge Functions OTP + migration 0009
reviewers: Blind Hunter (adversarial-general), Edge Case Hunter, Acceptance Auditor
raw_findings: ~180 (Blind ~80 + Edge ~70 + Auditor ~30)
unique_after_dedup: 60
---

# Code Review — Epic 2 round 3 (vérification patches P-01 → P-34 + nouveau hunting)

> Suite directe de [`code-review-2026-05-18-epic2.md`](code-review-2026-05-18-epic2.md) (round 2, 34 patches appliqués). Ce diff couvre l'intégralité des modifications uncommitted sur la branche `spawt/v1-bmad` au 2026-05-18 — patches Round 2 de Story 2.3a + propagation aux sister stories Epic 2. L'objectif de cette 3e review : **(a)** vérifier que les 34 patches Round 2 ont été correctement appliqués sans régression, **(b)** hunter les nouveaux bugs introduits par les patches eux-mêmes ou par la livraison Story 2.3a (Google/Apple Sign-In + session JWT serveur).

## Triage summary

| Bucket | Count | Notes |
|---|---|---|
| **decision_needed** | 5 | Sign-off / scope / sémantique — Alexandre, Kidam, Stéphanie inputs requis |
| **patch** | 31 | Fix clair, prêt à appliquer |
| **defer** | 13 | Réel mais hors-scope ou pre-existing hardening |
| **dismissed** | 11 | Noise, false positive, déjà géré ailleurs |

**Etat des 34 patches Round 2** (Auditor confirmation cross-référencée au diff) :
- ✅ **33/34 patches visibles & corrects** — P-01 à P-18, P-20 à P-34 tous présents avec implémentation conforme à la description.
- ⚠️ **P-19 (functional setter `setAttempts`)** : appliqué mais avec un **pattern alambiqué** : `let nextAttempts = attempts + 1` (stale closure!) puis dans le setter `nextAttempts = a + 1`. Fonctionne par closure capture + mutation synchrone du setter, mais lisibilité dégradée → reclassé en patch P-11 round 3 (refactor cosmétique).

**Sister stories** (2.2 / 2.3 / 2.4 / 2.5 / 2.6) : Auditor confirme que les patches listés dans les ## Review Findings des stories filles sont tous appliqués. Decision D4 de Story 2.5 (`canContinue = selected.length > 0`) tranchée en faveur de "stricte ≥1 OU 'Pas d'avis'". Decision D3 (juriste CGV/géoloc) résolue par P-32 (wording temporaire Tantie Rose) — sign-off Alexandre encore pending.

---

## decision_needed (5)

### DN-1 — Audit verbal Alexandre sur wording temporaire CGV / géoloc (P-32 follow-up)
- **Source** : Auditor
- **Severity** : high (bloquant merge `main`)
- **Evidence** : `app/src/i18n/fr.json:26,28` — `consent.cgv_body` + `consent.geoloc_body` contiennent désormais un wording temporaire voix Tantie Rose (round 2 P-32). Le `[pending juriste]` a été retiré ; reste à valider par audit verbal Alexandre (PRD §9.3 voix du Chat) avant que le juriste ne rédige le wording final.
- **Decision needed** : (a) shipper le wording actuel sur `spawt/v1-bmad` + bloquer merge `main` tant qu'Alexandre n'a pas audité ; (b) audit Alexandre immédiat → potentiel ajustement de tonalité avant l'enchaînement juriste ; (c) attendre le wording juriste final avant l'audit pour économiser une passe Alexandre.

### DN-2 — Doc drift Kidam : `events.md` ne reflète pas les changements `calibration_answered.value: null` + `skipped`
- **Source** : Auditor
- **Severity** : high (sign-off Kidam bloquant)
- **Evidence** : `app/src/lib/analytics.ts:91-94` définit désormais `CalibrationAnswered.properties.value: -0.4 | 0 | 0.4 | null` + `skipped?: boolean` (Round 2 P-25 + P-33). `documentation/analytics/events.md` n'est PAS mis à jour dans ce diff pour refléter ces changements de contrat. Code/doc drift → Kidam consommateur downstream ignore que `value: null` est désormais un cas légitime.
- **Decision needed** : (a) ajouter une entrée `calibration_answered` dans `events.md` avec le nouveau payload + sémantique (`null` = skip, `0` = neutral résolu) — patch immédiat ; (b) reclasser en `patch` documentation et l'appliquer dans cette review ; (c) bloquer review Kidam tant que `events.md` n'est pas synchro.

### DN-3 — Voix du Chat post-Google / post-Apple Sign-In : réutiliser `post_calibration` ou ajouter un nouveau moment ?
- **Source** : Auditor (spec sign-off requirement)
- **Severity** : medium (cohérence brand)
- **Evidence** : `app/src/lib/chat-voice.ts` ne définit pas de moment `post_google_signin` / `post_apple_signin`. La spec Story 2.3a ligne 52 demande explicitement la décision. Dev Agent Record claim "réutiliser le pattern post-OTP (pas de variant dédié)" — décision implicite non confirmée par Alexandre.
- **Decision needed** : (a) accepter la décision implicite (réutiliser `post_calibration` ou logique de stade actuelle) — pas de nouvelle clé i18n ; (b) ajouter `post_google_signin` + `post_apple_signin` avec wording dédié voix du Chat ; (c) attendre l'audit Alexandre P-32 et trancher dans la même passe brand.

### DN-4 — `recordConsent` revoke silently ignored — ARTCI compliance question
- **Source** : Blind
- **Severity** : high (potentielle violation ARTCI)
- **Evidence** : `app/src/store/spawter-store.ts:65-75` (P-28 Round 2) : si caller tente `recordConsent("cgv", false)` après que `cgv_accepted` ait été set, le code log un `__DEV__` warn puis early-return. Pattern set-once intentionnel mais sans path de revoke explicite. La Loi 2013-450 (ARTCI) demande "droit à la révocation du consentement" — actuellement le store le refuse silencieusement.
- **Decision needed** : (a) accepter le set-once V1 (révocation = DELETE /me anonymise tout — déjà tracé Cahier §5.2) ; (b) ajouter un `revokeConsent` path explicite séparé de `recordConsent`, qui mute le state + persist + signal analytics ; (c) consulter juriste avant alpha publique.

### DN-5 — `computeConfidence` filter `v !== null && v !== 0` confond skip et "neutral résolu" légitime
- **Source** : Blind + Edge (D-C round 2 partiellement résolu)
- **Severity** : medium (sémantique apprentissage Palais)
- **Evidence** : `app/app/(onboarding)/palais-reveal.tsx:42-45` + `app/src/store/spawter-store.ts:141-143` filtrent `(v): v is number => v !== null && v !== 0`. Le sentinel `null` (P-33) distingue désormais "skip" de "répondu". Mais un spawter qui sélectionne 2 cartes négatives + 2 cartes positives obtient `resolveDirection = "neutral", value = 0` — c'est un signal LÉGITIME ("j'ai des goûts mais équilibrés") qui est filtré comme un skip. Confidence sous-estimée artificiellement.
- **Decision needed** : (a) filter strict `v !== null` (compter `value=0` neutral résolu comme une réponse valide) — alignement sémantique avec D4 résolution ; (b) garder le filter `v !== 0` mais retourner un sentinel différent pour neutral résolu (e.g. `0.001`) — patch sale ; (c) accepter comme un défaut V1 et tracer dans deferred-work.

---

## patch (31)

### OAuth / Crypto (5)

- **P-01 — `react-native-get-random-values` polyfill manquant** [`app/src/components/auth/GoogleButton.tsx:53`, `AppleButton.tsx:35`] — **HIGH**. `globalThis.crypto?.getRandomValues` n'est PAS disponible nativement sur React Native Hermes sans polyfill. Sur device réel, `generateSecureNonce()` retourne `null` silencieusement → bouton désactivé, toast `auth.error_crypto_unavailable` → le user croit que sa crypto OS est cassée. **Fix** : importer `import "react-native-get-random-values"` au top de chaque button (ou dans `_layout.tsx` Root) + ajouter la dep dans `package.json`. Alternative : refactorer pour utiliser `expo-crypto.getRandomBytesAsync(16)` qui fonctionne partout RN.

- **P-02 — `response` useEffect non-idempotent dans GoogleButton** [`app/src/components/auth/GoogleButton.tsx:73-99`] — **HIGH**. L'useEffect dépend de `[response, rawNonce, router, onError]`. Si `onError` parent n'est pas mémoïsé (no useCallback), chaque re-render parent recrée l'effet → `signInWithIdToken` peut être called 2x → 2x `auth_signed_in` track + 2x router.push. **Fix** : ajouter `const processedRef = useRef<string | null>(null)` et gate par `if (response.params?.id_token === processedRef.current) return`.

- **P-03 — `useAuthRequest` platform-aware clientId check** [`app/src/components/auth/GoogleButton.tsx:46-49`] — **HIGH**. `configured = Boolean(webClientId || iosClientId || androidClientId)` retourne true si seul `iosClientId` est set, même sur Android. `useAuthRequest({iosClientId: x})` sans `androidClientId` échoue silencieusement à la résolution sur Android. **Fix** : `const platformClientId = Platform.OS === "ios" ? iosClientId : Platform.OS === "android" ? androidClientId : webClientId; const configured = Boolean(platformClientId || webClientId);`.

- **P-04 — `response.type === "error"` ne propage pas via `onError`** [`app/src/components/auth/GoogleButton.tsx:90-93`] — **MEDIUM**. Si `response.type === "error"`, `setBusy(false)` puis return sans `onError?.()` → utilisateur ne voit aucun feedback toast. **Fix** : `if (response.type === "error") { setBusy(false); onError?.("auth.error_google_unavailable"); return; }`.

- **P-05 — `useAuthRequest` re-init à chaque render** [`app/src/components/auth/GoogleButton.tsx:31-44`] — **MEDIUM**. L'objet `{webClientId, iosClientId, androidClientId, scopes, responseType, extraParams}` est recréé à chaque render → `useAuthRequest` peut re-initialiser le request. **Fix** : envelopper dans `useMemo(() => ({...}), [webClientId, iosClientId, androidClientId, hashedNonce])`.

### Edge Functions / Session security (6)

- **P-06 — `updateUserById` no error check** [`supabase/functions/otp-verify/index.ts:244-247`] — **HIGH**. Si l'update fail (email déjà pris par un autre user, perm RLS, network transient), le code continue avec un user sans email valide → `generateLink` fail → un-burn → 500 générique au client. Pas de diagnostic structuré. **Fix** : `const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {...}); if (updateErr) { await unburn(); return jsonResponse({error: "session_provisioning_failed", detail: "user_email_update_failed"}, 500); }`.

- **P-07 — `phoneCount ?? 0` bypass rate-limit si Supabase query échoue** [`supabase/functions/otp-send/index.ts:101-105`] — **HIGH**. Si la query `select count` fail (table introuvable temporairement, RLS bug), `phoneCount` est `null` → `?? 0` accepte la request → rate-limit phone-only bypassé. **Fix** : `if (phoneError) return jsonResponse({error: "rate_limit_check_failed"}, 500); const count = phoneCount ?? 0;`.

- **P-08 — Pas de timeout sur fetch Termii (otp-send + otp-verify)** [`supabase/functions/otp-send/index.ts:142-160` + `otp-verify/index.ts:110-122` si présent] — **HIGH**. Si l'API Termii hang, l'Edge function attend jusqu'au Supabase Edge timeout (60s) → user voit network error tardif + quota Termii consommé. **Fix** : `const termiiResp = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(10_000) }); catch sur AbortError → return 504 "provider_timeout"`.

- **P-09 — CORS `allowed[0] ?? "null"` fallback ambigu** [`supabase/functions/otp-send/index.ts:36`, `otp-verify/index.ts:36`] — **MEDIUM**. Si origin est inconnue mais `allowed` non-vide, on reflète `allowed[0]` → browser bloque préflight mais le mobile native fetch passe avec un header incohérent. **Fix** : `const origin = req.headers.get("origin"); const reflected = origin && allowed.includes(origin) ? origin : "null"; return { "access-control-allow-origin": reflected, ... };` — toujours `"null"` pour origins non-whitelistées, jamais `allowed[0]`.

- **P-10 — `isTransient` ne couvre pas les erreurs sans `code` ni `status`** [`supabase/functions/otp-verify/index.ts:201-211`] — **MEDIUM**. Cast `(createErr as { code?: string; status?: number })` : si Supabase renvoie une erreur générique sans `code` ni `status`, `isTransient = false` → tombe dans `else` fallback (continue vers listUsers) en croyant que c'est un duplicate. Une CrashedRPC sera traitée comme "user existe". **Fix** : `const isTransient = !isDuplicate && (status !== undefined ? status >= 500 || status === 429 : (createErr?.message?.includes("timeout") || createErr?.message?.includes("network")));`.

- **P-11 — `unburn()` ignore son propre erreur** [`supabase/functions/otp-verify/index.ts:180-184`] — **MEDIUM**. `await admin.from("otp_attempts").update(...)` sans check du `.error` → si l'unburn fail, le pinId reste burned, le user est lock out sans rétroaction. **Fix** : `const { error: unburnErr } = await admin.from(...).update(...); if (unburnErr && __DEV__) console.warn("[otp-verify] unburn failed", unburnErr);` + en prod, logger structuré (Sentry).

### OTP screen (5)

- **P-12 — `setAttempts` functional setter pattern alambiqué (P-19 Round 2 refactor cosmétique)** [`app/app/(onboarding)/otp.tsx:141-145, 197-201`] — **MEDIUM**. `let nextAttempts = attempts + 1` + `setAttempts((a) => { nextAttempts = a + 1; return nextAttempts; })` fonctionne par closure capture + mutation synchrone, mais difficile à lire. **Fix** : `setAttempts((a) => a + 1); setAttemptsRef.current += 1; track({attempts: setAttemptsRef.current})` via `useRef` dédié.

- **P-13 — `abortRef` partagé entre onSubmit + onResend** [`app/app/(onboarding)/otp.tsx:117`] — **MEDIUM**. Tap rapide submit→resend → l'un abort l'autre. UX confus, surtout que les deux set des erreurs différentes. **Fix** : `const submitAbortRef = useRef<AbortController | null>(null); const resendAbortRef = useRef<AbortController | null>(null);` — refs séparées par flow.

- **P-14 — `useEffect([ready])` auto-submit ne dépend pas de `friction`** [`app/app/(onboarding)/otp.tsx:64-67`] — **MEDIUM**. `useEffect(() => { if (ready && !submitting && !friction) void onSubmit() }, [ready])` lit `friction` stale. Si attempts atteint 3 entre setDigits et l'effet, l'auto-submit fire malgré `friction = true`. **Fix** : ajouter `friction, submitting` aux deps OU déplacer le check au début de `onSubmit` synchronously.

- **P-15 — `onResend` ne reset pas `error`** [`app/app/(onboarding)/otp.tsx:285-329`] — **LOW**. Au tap Resend, une `error` précédente reste affichée → user confus. **Fix** : `setError(null)` au début de `onResend`, même path démo.

- **P-16 — `maskPhone` fuit le phone en clair si `length < 6`** [`app/app/(onboarding)/otp.tsx:29-34`] — **MEDIUM**. Early return `return p` retourne le phone EN CLAIR si trop court. Cas narrow mais analytics peut leak un phone tronqué identifiable. **Fix** : `if (p.length < 6) return "REDACTED";` + audit cross-usage.

### Phone screen (2)

- **P-17 — Timeout race : ancien `setTimeout` peut fire sur nouveau abort** [`app/app/(onboarding)/phone.tsx:onSubmit`] — **MEDIUM**. Si user tap rapide 2x avant la première réponse, `abortRef.current?.abort()` annule le 1er fetch mais le 1er `setTimeout` reste actif → peut firer plus tard sur le 2e abort, abort le 2e fetch arbitrairement. **Fix** : `clearTimeout(timeoutRef.current)` avant de créer le nouveau `setTimeout` + tracker `timeoutRef` dans un `useRef<NodeJS.Timeout | null>(null)`.

- **P-18 — `isSupabaseConfigured = false` mode démo n'a pas de `setSending(true)` guard** [`app/app/(onboarding)/phone.tsx`] — **LOW**. En démo, l'app navigue direct vers OTP avec `?demo=1` sans `setSending(true)` → double-tap navigue 2 fois. **Fix** : `setSending(true)` avant `router.push`, ou `if (sending) return;` guard.

### Calibration / Palais-Reveal (4)

- **P-19 — `onContinue` palais-reveal pas de `mountedRef` guard** [`app/app/(onboarding)/palais-reveal.tsx:78-122`] — **MEDIUM**. Si `finalizeOnboarding` succeeds et `router.replace` lance la nav, un re-render entre awaits peut firer `setError`/`setSubmitting(false)` après unmount → React warning. **Fix** : `if (!mountedRef.current) return;` après chaque `await`.

- **P-20 — Pas de `setSubmitting(false)` dans le succès path** [`app/app/(onboarding)/palais-reveal.tsx`] — **LOW**. Pas de `finally` — sur succès, `setSubmitting(false)` jamais appelé avant `router.replace`. Le composant unmount → OK techniquement. **Fix** : `finally { if (mountedRef.current) setSubmitting(false); }`.

- **P-21 — Test couverture `Stack.Screen gestureEnabled` P-24** [`app/__tests__/components/PalaisRevealScreen.test.tsx:17-18`] — **MEDIUM**. Le mock `Stack: { Screen: () => null }` n'assert pas que `gestureEnabled` est correctement passé. Régression P-24 non détectable. **Fix** : `jest.mock("expo-router", () => ({ Stack: { Screen: jest.fn(({options}) => null) } }))` puis `expect(Stack.Screen).toHaveBeenCalledWith(expect.objectContaining({options: expect.objectContaining({gestureEnabled: false})}))`.

- **P-22 — Test pour P-22 (`track` AFTER finalize success) manquant** [`app/__tests__/components/PalaisRevealScreen.test.tsx`] — **MEDIUM**. Le test "finalize throw → error visible + pas de navigation" ne vérifie pas que `track("onboarding_completed")` n'a PAS été appelé. **Fix** : ajouter `expect(mockTrack).not.toHaveBeenCalledWith(expect.objectContaining({name: "onboarding_completed"}))` dans le test throw.

### Profile (2)

- **P-23 — `NAME_RE` accepte 1 lettre + N emoji** [`app/app/(onboarding)/profile.tsx:67`] — **MEDIUM**. `NAME_RE = /[\p{L}\p{N}]/u` exige **au moins une** lettre/chiffre. `"a😀😀😀..."` (1 lettre + 49 emojis) passe la validation graphème ≤50 + NAME_RE → `display_name` pollué emoji-only. **Fix** : `NAME_RE = /^[\p{L}\p{N}\s\-']{2,}$/u` (whitelist stricte multi-graphèmes minimum).

- **P-24 — `maxLength={100}` TextInput vs `nameLen ≤ 50` graphèmes UX disconnect** [`app/app/(onboarding)/profile.tsx:129, 142, 60-66`] — **LOW**. User peut saisir 100 chars puis se voir refuser sans explication. **Fix** : afficher un counter live `${nameLen}/50` sous le TextInput, OU couper à 50 graphèmes via `setField("display_name", capGraphemes(v, 50))`.

### Storage (2)

- **P-25 — `migrationPromise` never reset on failure** [`app/src/lib/storage.ts:27-46`] — **HIGH**. Si `runMigration()` throw avec une erreur non-catchée (assertion, OOM, etc.), `migrationPromise` reste une promesse rejected. Tous les appelants futurs `await` une promesse rejected et propagent l'erreur ou n'avancent jamais. **Fix** : `try { await migrationPromise; } catch (err) { migrationPromise = null; throw err; }` dans le caller, OU `runMigration().catch(() => { migrationPromise = null; })` au top-level.

- **P-26 — `recordConsent` set-once silently no-op pour les callers** [`app/src/store/spawter-store.ts:63-75`] — **MEDIUM** — voir DN-4 pour la décision ARTCI. Patch immédiat : retourner un boolean pour signaler le no-op aux callers analytics. **Fix** : `recordConsent: (...) => boolean` qui retourne `false` si déjà set, `true` si nouveau set. Caller : `if (!recordConsent(...)) track("consent_already_set")`.

### Apple-specific (2)

- **P-27 — Apple `composed` overwrites existing `draft.display_name`** [`app/src/components/auth/AppleButton.tsx:104`] — **MEDIUM**. Si user a déjà rempli profile.tsx avant Apple Sign-In, `composed` (de Apple credential.fullName) écrase le nom déjà saisi. **Fix** : `const existing = useOnboardingDraft.getState().draft.display_name; if (!existing && composed.length > 0) setDraftField("display_name", composed);`.

- **P-28 — Apple `composed.length` peut dépasser le cap profile screen (50 graphèmes)** [`app/src/components/auth/AppleButton.tsx:104`] — **LOW**. Apple peut renvoyer un nom de 100+ chars (cultures), poussé tel quel dans le draft → user voit son nom trop long sur ProfileScreen sans capacité de l'éditer si l'écran est skip. **Fix** : `setDraftField("display_name", capGraphemes(composed, 50));`.

### Consent / Index screens (2)

- **P-29 — `consent.tsx` `recordConsent` throw non capturé** [`app/app/(onboarding)/consent.tsx:50-67`] — **MEDIUM**. `await useSpawterStore.getState().recordConsent("cgv", true)` est dans le `try` mais aucun `catch` → un throw côté store propage jusqu'au `finally` qui reset `submitting`, mais aucun message d'erreur affiché → user voit le CTA redevenir actif sans feedback. **Fix** : `try { ... } catch (err) { if (__DEV__) console.warn(err); setError(t("common.error_generic")); } finally { setSubmitting(false); }`.

- **P-30 — `consent.tsx` `setSubmitting(false)` après `router.push` warning React** [`app/app/(onboarding)/consent.tsx:65-67`] — **LOW**. `finally` exécute `setSubmitting(false)` après nav → setState sur composant unmount. **Fix** : `mountedRef` guard ou `setSubmitting(false)` avant push.

### Tests Deno (1)

- **P-31 — Test `mockSetSession` error path absent** [`app/__tests__/components/OtpScreen.test.tsx`] — **MEDIUM**. Tous les tests utilisent `mockSetSession.mockResolvedValue({error: null})` — aucun test "setSession fail → toast `auth.error_network` + pas de navigation". Cas live failure non couvert. **Fix** : ajouter un test `"setSession failure → error_network displayed + no router.push"`.

---

## defer (13)

Tracés dans [`deferred-work.md`](deferred-work.md) sous section _Deferred from: code review round 3 Epic 2 (2026-05-18)_.

- **D-1** — `pinId` vs `pin_id` Termii API version risk [`otp-send/index.ts:156`] — si Termii change la casse du champ, retour 500 sans détail. Defer : ajouter un parser fallback `pin_id ?? pinId` Sprint 2 si reproduit.
- **D-2** — Cumul `selected` entre questions calibration sur back-nav [`calibration.tsx:38-43`] — `selectedByStep` ne se reset pas si user revient via stack depuis palais-reveal. Bug visuel narrow. Defer : reset via `useEffect([params.step])` Sprint 2.
- **D-3** — `migrateLegacyConsentDataKey` partial state si crash entre setItem et removeItem [`storage.ts:74`] — état "double key" persistant possible. Race window narrow. Defer : pattern fully-transactional Sprint 2.
- **D-4** — Test Apple iOS button mock tautology [`PhoneScreen.test.tsx:140-143`] — le test repose sur le mock qui rend `<Pressable/>` SI `Platform.OS === "ios"` ; vérifie le mock plus que le composant. Refactor test bigger. Defer : remplacer par smoke E2E Sprint 2.
- **D-5** — `saveSpawter` / `savePalais` swallow errors avec __DEV__ warn — pas de retry queue [`spawter-store.ts:82-84, 156-160`] — fire-and-forget by design. Defer : queue retry + reconciliation Sprint 2.
- **D-6** — Confidence calc twice (palais-reveal + spawter-store finalize) [`palais-reveal.tsx:39-44`, `spawter-store.ts:141-143`] — fenêtre narrow back-nav. Déjà tracé D-10 round 2.
- **D-7** — `dominantAxes(ax)` avec all-zero input — comportement non testé [`palais-reveal.tsx:84-90`] — test `dominantAxes({all:0})` à ajouter. Defer : test lib pur Sprint 2.
- **D-8** — `display_name` `setField` non graphème-bounded côté ProfileScreen [`profile.tsx:124-128`] — `setField("display_name", v)` brut sans cap, schema DB peut rejeter à `finalizeOnboarding`. Defer : capGraphemes utility Sprint 2.
- **D-9** — `(err as { name?: string })?.name` cast unsafe partout dans les catches [`otp.tsx`, `phone.tsx`, button components] — pattern fragile mais fonctionnel. Defer : typed error narrowing utility Sprint 2.
- **D-10** — `anonClient` créé à chaque request otp-verify [`otp-verify/index.ts:218`] — pas de pooling, overhead. Acceptable mais sub-optimal. Defer : module-level singleton Sprint 2.
- **D-11** — `setDraftField("phone_e164")` après setSession race vers ProfileScreen [`otp.tsx`] — narrow race window. Defer : reorder writes Sprint 2.
- **D-12** — Tests Deno success path pour P-07 (un-burn) + P-08 (session_user_mismatch) absents — déjà tracé D-12 round 2.
- **D-13** — `useEffect([ready])` auto-submit micro race avec friction transition — voir P-14 patch ; partielle si patch P-14 appliqué, defer du polish complet.

---

## dismissed (11)

Noise, false positive, ou déjà géré ailleurs — non écrits à la story.

- Anon key dans bundle (Supabase pattern standard, expected).
- `apikey + authorization` même valeur (Supabase header convention).
- Apple email AsyncStorage sans encryption-at-rest (OS-level protection acceptable).
- `expoConfig.extra` baked dans bundle (OAuth client IDs sont publics par design).
- `AppleAuthenticationButton` height hardcoded 48 (Apple HIG button — pas de tokenisation possible).
- `composed.length` no cap dans AppleButton (couvert par ProfileScreen cap — bien que P-28 patch le rend explicite).
- `isAvailableAsync()` race null state initial AppleButton (acceptable transition).
- `toRadar` clamp masks bugs (intentional defensive, P-27 round 2).
- `Stack.Screen` re-render à chaque submitting change (cosmétique, OK).
- IIFE `(() => { ... })()` pattern dans otp.tsx friction render (works fine, lisibilité ok).
- `P-XX` annotations dans le code (review noise, normal pour cycle iteratif).

---

## Etat sign-off (résumé Auditor)

| Persona | Bloqueurs résiduels |
|---|---|
| **Stéphanie (tech)** | D-16 round 2 (SMTP send sign-off) toujours pending • P-07 un-burn replay-risk à valider explicitement • CORS `ALLOWED_ORIGINS` à provisionner avant alpha • D-12 (tests Deno success path) — CI dédiée à monter |
| **Kidam (analytics)** | **DN-2** code/doc drift `events.md` ↔ `analytics.ts` pour `calibration_answered` • D-1 round 2 (`time_to_complete_seconds: -1` typing) • D-15 round 2 (`auth_signed_in.is_first_login` retiré — annoncer formellement) • Recalibrage dashboard `onboarding_completed` (P-22 sémantique changée) |
| **Alexandre (brand)** | **DN-1** audit verbal wording temporaire CGV/géoloc (P-32) • **DN-3** voix du Chat post-Google/Apple (réutiliser vs ajouter) • Test Tantie Rose sur `auth.or_separator`, `error_otp_expired`, `error_otp_already_used`, `error_crypto_unavailable` |

---

## Conclusion

**33/34 patches Round 2 corrects** ; P-19 fonctionne mais cosmétique à refactorer (reclassé P-12 round 3). Story 2.3a livre l'intégralité des 6 ACs avec robustesse. Le diff couvre aussi proprement les patches sister stories 2.2 → 2.6.

**Risques résiduels critiques** :
1. **`react-native-get-random-values` manquant** (P-01) — peut casser Google/Apple Sign-In sur device réel.
2. **`updateUserById` sans error check** (P-06) — risque de session pour mauvais user en cas de collision email synthétique.
3. **`migrationPromise` jamais reset** (P-25) — peut bloquer toute écriture consent en cas de migration failed une fois.
4. **CORS `allowed[0]` fallback ambigu** (P-09) — comportement runtime confus.
5. **`phoneCount ?? 0` bypass rate-limit** (P-07) — DoS vector si Supabase query intermittent.

**5 decisions à trancher** avant merge `main` — 3 nécessitent input Alexandre (DN-1, DN-3), 1 Kidam (DN-2), 1 décision sémantique (DN-5), 1 compliance ARTCI (DN-4).

**Statut story 2.3a** : reste `review` (patches non encore appliqués) en attente de la décision utilisateur sur l'application des 31 patches + résolution des 5 decisions.
