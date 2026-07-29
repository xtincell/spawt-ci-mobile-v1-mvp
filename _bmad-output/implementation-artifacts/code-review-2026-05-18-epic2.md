---
review_date: 2026-05-18
diff_baseline: 3af4d46 (uncommitted vs HEAD)
scope: Epic 2 — post-review patches (P1-P26 + D1-D5) + Story 2.3a (Google/Apple Sign-In + session JWT serveur)
reviewers: Blind Hunter (adversarial-general), Edge Case Hunter, Acceptance Auditor
raw_findings: ~186 (Blind 110 + Edge 70 + Auditor 6 + matrices)
unique_after_dedup: 63
---

# Code Review — Epic 2 round 2 (patches post-review 2026-05-17)

> Suite directe de [`code-review-2026-05-17-epic2.md`](code-review-2026-05-17-epic2.md). Ce diff (~930 lignes / 31 fichiers + 6 nouveaux) applique P1-P26 + D1-D5 et livre Story 2.3a (Google/Apple/JWT). L'objectif de cette 2e review : vérifier que les fixes ont été correctement appliqués, et hunter les régressions / nouveaux bugs introduits par la Story 2.3a.

## Triage summary

| Bucket | Count | Notes |
|---|---|---|
| **decision_needed** | 4 | Product/scope calls — Alexandre's input required |
| **patch** | 31 | Clear fix, ready to apply |
| **defer** | 15 | Real but out-of-scope or pre-existing hardening |
| **dismissed** | 13 | Noise, false positive, already handled |

**Etat des fixes round 1** (Auditor confirmation) :
- ✅ P1-P26 : **24/26 appliqués proprement**, 2 partiels (P2 manque test unitaire `toRadar`, P14 AbortController plumbé mais non abort-é)
- ✅ D1, D2, D4, D5 : résolus
- ⚠️ D3 : **non addressed** (`[pending juriste]` toujours dans `cgv_body`/`geoloc_body`) — reclassé en decision_needed round 2

---

## decision_needed (4)

### D-A — `[pending juriste]` toujours dans `consent.cgv_body` / `consent.geoloc_body`
- **Source** : Auditor (D3 héritage)
- **Severity** : major (ARTCI gate ship avec placeholder légal)
- **Evidence** : `app/src/i18n/fr.json` lignes ~30-31 — texte `cgv_body` + `geoloc_body` contient toujours `[pending juriste]`.
- **Decision needed** : (a) bloquer merge `main` tant que juriste n'a pas livré le wording ; (b) accepter sur `spawt/v1-bmad` car alpha pas démarrée, bloquer pour merge `main` ; (c) shipper wording temporaire en pleine voix Tantie Rose.

### D-B — `auth.admin.generateLink({type:"magiclink"})` déclenche un envoi SMTP vers email synthétique
- **Source** : Blind Hunter
- **Severity** : major (quota SMTP brûlé + bounce vers `@phone.spawt.local` indétectable)
- **Evidence** : `supabase/functions/otp-verify/index.ts:178-181` appelle `admin.generateLink` sans option `options: { shouldCreateUser: false }` ni flag pour supprimer l'envoi SMTP. Le README claim "jamais utilisé pour envoyer un email réel" mais Supabase v2.45 envoie effectivement un magic link email si SMTP configuré côté projet.
- **Decision needed** : (a) valider en alpha Termii sandbox avec SMTP désactivé côté projet Supabase — Stéphanie sign-off ; (b) basculer vers `auth.admin.createSession` pattern si exposé dans une version future de gotrue-js ; (c) injecter un domain blacklist côté Supabase pour ne PAS envoyer `*@phone.spawt.local`.

### D-C — Skip explicite calibration écrit value=0 → palais-reveal le compte comme "non répondu"
- **Source** : Blind + Edge
- **Severity** : minor UX (tension avec résolution D4)
- **Evidence** : `app/app/(onboarding)/calibration.tsx:300` `onSkip = () => advance("neutral", 0)`. Puis `palais-reveal.tsx:42-44` calcule `answeredCount = Object.values(ans).filter(v => v !== 0).length`. Un spawter qui clique 5×"Pas d'avis" termine avec `answeredCount=0` → `confidence=0` → radar `underConstruction`. Inverse du D4 ("le skip est délibéré").
- **Decision needed** : (a) traiter skip comme "répondu mais neutre" (filter `v !== null` au lieu de `v !== 0`, value=0 reste valide) ; (b) écrire un sentinel `NaN`/`null` pour skip et garder le filter `v !== 0` ; (c) accepter le comportement actuel (skip = pas d'apprentissage donc radar honnête en construction).

### D-D — `expo-auth-session` + `expo-crypto` installés mais absents du `app.json:plugins`
- **Source** : Blind Hunter #88
- **Severity** : major si EAS Build casse
- **Evidence** : `app/app.json:241-245` plugins array ajoute `expo-apple-authentication` + `expo-web-browser`. `expo-auth-session` et `expo-crypto` sont dans `package.json` mais pas dans `plugins`. Certaines versions Expo SDK 55 exigent les plugins enregistrés pour EAS Build native step.
- **Decision needed** : (a) ajouter les 2 plugins par sécurité, recompiler smoke `expo prebuild --clean` ; (b) confirmer via doc Expo SDK 55 que `expo-auth-session` et `expo-crypto` n'exigent PAS de plugin (autoconfig) ; (c) tester directement en EAS Build preview pour valider.

---

## patch (31)

### OAuth / Session security (6)

#### P-01 — `Math.random()` fallback nonce défait l'anti-replay OIDC
- **Source** : Blind #15, Edge ×2
- **Files** : `app/src/components/auth/GoogleButton.tsx:25-28`, `app/src/components/auth/AppleButton.tsx:68-72`
- **Fix** : Si `globalThis.crypto?.getRandomValues` indisponible, **hard-fail** (`onError("auth.error_crypto_unavailable")` + return) au lieu de fallback `Date.now() + Math.random()`. Un nonce prédictible permet le replay d'un identityToken Apple/Google volé.

#### P-02 — `WebBrowser.maybeCompleteAuthSession()` au top-level du module
- **Source** : Blind #14, Edge
- **File** : `app/src/components/auth/GoogleButton.tsx:30`
- **Fix** : Déplacer l'appel dans un `useEffect(() => { WebBrowser.maybeCompleteAuthSession(); }, [])` côté composant ou au mount de `phone.tsx`. Top-level → side-effect à chaque import (tests, hot-reload).

#### P-03 — Race `hashedNonce` null vs tap utilisateur
- **Source** : Blind #71, Edge
- **File** : `app/src/components/auth/GoogleButton.tsx:81-95`
- **Fix** : `disabled={!configured || !hashedNonce || busy}`. Si l'utilisateur tape avant que `Crypto.digestStringAsync` ait résolu, `useAuthRequest` part sans nonce → Supabase `signInWithIdToken` rejette en silence. Gate explicite sur `hashedNonce !== null`.

#### P-04 — Apple `credential.email` perdu après 1re connexion (Apple ne le renvoie qu'une fois)
- **Source** : Edge
- **File** : `app/src/components/auth/AppleButton.tsx:104-114`
- **Fix** : En plus du `display_name`, persister `credential.email` dans `draft.email` au pré-fill. Sans ça, account recovery / changement de device → email irrécupérable.

#### P-05 — `auth_signed_in { demo }` flag manquant pour Google/Apple
- **Source** : Blind #77, Auditor analytics drift
- **Files** : `app/src/components/auth/GoogleButton.tsx:108`, `AppleButton.tsx:120`
- **Fix** : `track({ name: "auth_signed_in", properties: { method: "google", demo: !isSupabaseConfigured } })`. `events.md` ligne 128 documente `demo?` mais le code OAuth ne l'émet pas.

#### P-06 — Test PhoneScreen Apple tautologie `.toBeGreaterThanOrEqual(0)`
- **Source** : Blind #61
- **File** : `app/__tests__/components/PhoneScreen.test.tsx:223-225`
- **Fix** : `expect(matches.length).toBeGreaterThan(0)` — sur iOS la default `Platform.OS === "ios"` du preset `jest-expo`, on doit trouver au moins 1. Test actuel = no-op (`length >= 0` toujours vrai).

### OTP / Edge Functions (6)

#### P-07 — Burn UPDATE atomique AVANT user-provisioning → si provisioning fail, code brûlé sans token
- **Source** : Edge
- **File** : `supabase/functions/otp-verify/index.ts:131-145` (burn) vs `:147-228` (provisioning)
- **Fix** : Soit déplacer le burn APRÈS la génération réussie de tokens (mais risque replay si provisioning prend du temps), soit ajouter une compensation : sur échec provisioning, `UPDATE otp_attempts SET verified_at = null WHERE request_id = ?` pour permettre une nouvelle tentative. Trade-off : choisir replay-risk vs user-locked-out. Recommandé : pattern compensation.

#### P-08 — `verifyOtp` ne vérifie pas que la session retournée matche le `userId` attendu
- **Source** : Blind #3
- **File** : `supabase/functions/otp-verify/index.ts:202-215`
- **Fix** : Après `anonClient.auth.verifyOtp({...})`, assert `verifyData.session.user.id === userId`. Sinon en cas de race (collision email synthétique, voir D-B), tokens retournés pour le mauvais user mais `user_id` retourné côté JSON pointe ailleurs → mismatch silencieux.

#### P-09 — `createUser` `catch (_err) {}` masque tous les erreurs, fallback listUsers peut retourner wrong user
- **Source** : Blind #5, Edge
- **File** : `supabase/functions/otp-verify/index.ts:149-162`
- **Fix** : Distinguer `error.code === "email_address_invalid"` / `"user_already_exists"` (continue → listUsers OK) vs erreurs transitoires (rate limit, 500). Sur transient → return 500 `provisioning_transient_error` au lieu de fall-through silencieux.

#### P-10 — MOCK_TERMII insert error ignoré → SMS sent / DB row absent
- **Source** : Edge
- **File** : `supabase/functions/otp-send/index.ts:140-150` (insert MOCK_TERMII path)
- **Fix** : Check `insertError` après le `.insert()`. Si error → return 500 `audit_insert_failed`. Sinon : SMS envoyé (vrai côté Termii live) mais row absent → `otp-verify` retourne `no_pending_otp`.

#### P-11 — CORS `*` + `authorization` header → abus cross-origin browser
- **Source** : Blind #7
- **Files** : `supabase/functions/otp-send/index.ts:9-13`, `otp-verify/index.ts:11-15`
- **Fix** : Restreindre `access-control-allow-origin` à l'origine de l'app web (ou plusieurs origins via switch) au lieu de `*`. Sinon, n'importe quelle page web malveillante peut POST vers les Edge Functions avec l'anon key et brûler le quota SMS d'une victime.

#### P-12 — `resp.status === 401 || resp.status === 400` collapsé en un seul message
- **Source** : Blind #107
- **File** : `app/app/(onboarding)/otp.tsx:185-190`
- **Fix** : Distinguer les codes (`401 invalid_otp` vs `400 no_pending_otp` vs `400 otp_already_used`). User mérite un message précis ("Code expiré" vs "Mauvais code").

### OTP Screen (otp.tsx) (7)

#### P-13 — AbortController plombé dans le `fetch` mais jamais `abort()`-é sur unmount
- **Source** : Auditor P14 partial, Blind #48-49, Edge
- **File** : `app/app/(onboarding)/otp.tsx:119-228`
- **Fix** : Stocker `abortRef = useRef<AbortController | null>(null)`. Au mount, dans le `useEffect` cleanup, appeler `abortRef.current?.abort()`. Sinon le fetch en cours continue après unmount, le `mountedRef` guard évite juste le `setState` mais le réseau / serveur consomme.

#### P-14 — `setCooldown(RESEND_COOLDOWN_S)` set AVANT le fetch otp-send → si fetch fail, user bloqué 30s
- **Source** : Blind #21, Edge
- **File** : `app/app/(onboarding)/otp.tsx:243-263` (`onResend`)
- **Fix** : Set cooldown SEULEMENT après `resp.ok`. En cas d'échec, ne pas bloquer.

#### P-15 — `onResend` n'a pas de `mountedRef` guard ni `AbortController`
- **Source** : Edge
- **File** : `app/app/(onboarding)/otp.tsx:248-263`
- **Fix** : Appliquer le même pattern que `onSubmit` : `if (!mountedRef.current) return;` après le fetch + abort.

#### P-16 — Paste handler à `index > 0` perd les premiers chiffres
- **Source** : Blind #51, Edge
- **File** : `app/app/(onboarding)/otp.tsx:69-94`
- **Fix** : Si `clean.length > 1`, **toujours** distribuer en commençant à `cell[0]` (pas à `index`) puis focus dernier cell rempli. Sinon, paste de 6 chiffres dans cell[4] = clobber des digits 1-3 silencieusement.

#### P-17 — `onResend` reset `cooldown` mais pas `attempts` → analytics & UX skew
- **Source** : Blind #20, Edge
- **File** : `app/app/(onboarding)/otp.tsx:248-263`
- **Fix** : Sur resend réussi, `setAttempts(0)`. Sinon la friction (3 essais) reste active après resend, et `auth_otp_validated` `attempts` count accumule sur 2 pin_id.

#### P-18 — `oauthError` jamais reset après une 2e tentative
- **Source** : Blind #52
- **File** : `app/app/(onboarding)/phone.tsx:915-917`
- **Fix** : Au tap "Recevoir mon code" ou au tap Google/Apple, `setOauthError(null)`. Sinon une erreur d'un tap Google périmé reste affichée même après OTP success.

#### P-19 — `setAttempts(nextAttempts)` race sous double-tap
- **Source** : Blind #1-2
- **File** : `app/app/(onboarding)/otp.tsx:130-137, 173-180`
- **Fix** : Utiliser `setAttempts(a => a + 1)` (functional setter), capturer `nextAttempts` via ref pour le track. Le `submitting` guard mitige mais ne résout pas la stale closure sur deux invocations dans le même tick.

### Phone Screen (2)

#### P-20 — Pas de timeout sur le fetch `otp-send` → user stuck CTA disabled
- **Source** : Edge
- **File** : `app/app/(onboarding)/phone.tsx:79-87`
- **Fix** : Wrap dans `AbortController` + `setTimeout(() => abort.abort(), 30000)`. Display `auth.error_network` après timeout.

#### P-21 — `phone.tsx` n'a pas de `mountedRef` guard autour de `setSending`/`setError`
- **Source** : Edge
- **File** : `app/app/(onboarding)/phone.tsx:79-87`
- **Fix** : Appliquer le même pattern que `otp.tsx`.

### Calibration / Palais-Reveal (7)

#### P-22 — `track("onboarding_completed")` AVANT le succès de `finalizeOnboarding`
- **Source** : Edge
- **File** : `app/app/(onboarding)/palais-reveal.tsx:61-101`
- **Fix** : Déplacer le `track` APRÈS le `await finalizeOnboarding()` réussi. Sinon le funnel KPI Kidam inflate l'event vs taux de finalize réel.

#### P-23 — `BackHandler` listener capture une stale closure sur `submitting`
- **Source** : Blind #8, Edge
- **File** : `app/app/(onboarding)/palais-reveal.tsx:48-51`
- **Fix** : Utiliser un `submittingRef = useRef(false)` mis à jour dans un `useEffect([submitting])`, et la closure lit `submittingRef.current`. Évite la course entre commit React et back press.

#### P-24 — `BackHandler` Android-only — iOS swipe-back n'est pas bloqué
- **Source** : Blind #23, Edge
- **File** : `app/app/(onboarding)/palais-reveal.tsx` + `app/(onboarding)/_layout.tsx`
- **Fix** : Ajouter `<Stack.Screen options={{ gestureEnabled: !submitting }} />` sur la route palais-reveal, ou désactiver via `navigation.setOptions({ gestureEnabled: false })` au mount + réactiver après finalize.

#### P-25 — `onSkip` indistinguable d'un tap "neutre" dans analytics
- **Source** : Blind #35, Edge
- **File** : `app/app/(onboarding)/calibration.tsx:300-302`
- **Fix** : `track({ name: "calibration_answered", properties: { axis, direction: "neutral", value: 0, skipped: true } })`. Étendre type `CalibrationAnswered` dans `analytics.ts` avec `skipped?: boolean`. Kidam pourra distinguer skip explicite vs cartes neutres choisies.

#### P-26 — Test de coverage manquant pour le bouton `calibration-skip` (D4 path b)
- **Source** : Auditor
- **File** : `app/__tests__/components/CalibrationScreen.test.tsx`
- **Fix** : Ajouter un test qui assert que `findByTestId("calibration-skip")` existe quand `selectedCards.length === 0`, et qu'un tap émet `calibration_answered { direction:"neutral", skipped:true }`.

#### P-27 — `toRadar` clamping pour valeurs hors `[-0.4, +0.4]` (corrupted draft)
- **Source** : Edge
- **File** : `app/app/(onboarding)/palais-reveal.tsx:26`
- **Fix** : `const toRadar = (v: number) => Math.max(0, Math.min(1, (v + 0.4) / 0.8));` Garde contre drift store (NaN, valeur hors plage).

#### P-28 — `recordConsent` set-once swallows revoke calls — pas de warn DEV
- **Source** : Blind #9, #25
- **File** : `app/src/store/spawter-store.ts:58-64`
- **Fix** : Si `current[fieldName]` déjà set ET `accepted === false`, log `__DEV__` warn : `recordConsent: revoke not supported (set-once invariant)`. Documente le contrat. Alternative : retirer le param `accepted: boolean` (signature lie).

### Profile (2)

#### P-29 — NAME_RE testé sur `name` brut au lieu de `name.trim()`
- **Source** : Blind #42
- **File** : `app/app/(onboarding)/profile.tsx:60-66`
- **Fix** : `if (!NAME_RE.test(name.trim())) return false`. Sinon `"  ab  "` passe NAME_RE (letter/digit présent) mais cohérence avec le `trim().length >= 2` est perdue.

#### P-30 — `maxLength={50}` mesuré en UTF-16 code units → split emoji surrogate
- **Source** : Edge
- **File** : `app/app/(onboarding)/profile.tsx:998, 1006` (TextInput)
- **Fix** : Avant submit : `if (Array.from(displayName).length > 50)` pour compter graphèmes. Garder `maxLength={100}` comme hard cap UTF-16 mais valider en graphèmes. 50 emojis = 100 code units, truncation actuelle casse les surrogate pairs.

### Storage (1)

#### P-31 — `_consentMigrationDone` module-level race sous appels concurrents `setConsent`/`getConsent`
- **Source** : Blind #46, Edge
- **File** : `app/src/lib/storage.ts:17-37`
- **Fix** : Au lieu d'un boolean module-level, utiliser `let migrationPromise: Promise<void> | null = null` qui cache la promesse en cours. Tous les appelants `await migrationPromise`. Idempotent + race-safe.

---

## defer (15)

1. **`time_to_complete_seconds: -1` sentinel non typé `number | -1`** [`analytics.ts:99`] — typing reste `number`. Filtrage downstream à configurer PostHog/Mixpanel (decision Kidam). [story 2.6]
2. **`listUsers` cap 1000** [`otp-verify/index.ts:163-167`] — au-delà → user pas trouvé → createUser duplicat. Migration vers SQL `select ... where phone = $1` Sprint 2 quand volume alpha > 1000. [story 2.3]
3. **`req.json()` sans limite de taille body** [`otp-send/index.ts`, `otp-verify/index.ts`] — DoS via megabytes. Supabase platform cap ~1MB, suffisant V1. [story 2.3]
4. **`placeholderEmail` (digits-stripped phone) vs `synthEmailForUser` (UUID-no-dashes) → schéma 2 sources de truth** [`otp-verify/index.ts:147,191`] — risque collision théorique narrow. Hardening pre-alpha. [story 2.3a]
5. **Migration 0009 sans `BEGIN/COMMIT` explicite** [`supabase/migrations/0009_align_otp_phone_check.sql`] — Supabase migration runner wrap par défaut. Documenter ce dependency dans `supabase/README.md` ? [story 2.3]
6. **Migration 0009 sans data verification step** — pas de `SELECT count(*) WHERE phone_e164 !~ '^\+[1-9]\d{8,14}$'` avant DROP CONSTRAINT. Alpha pas démarrée → 0 row → safe. À ajouter si une migration similaire arrive avec data prod. [story 2.3]
7. **PHONE_RE 10-digit min trop permissif vs E.164 réaliste** — délibérément loosened pour aligner client + Edge + migration 0009. CIV reste verrouillé par `CIV_MOBILE_RE` côté front. [story 2.3]
8. **`x-forwarded-for` trust en non-Cloudflare** — documenté dans `otp-send/README.md`. Sprint 2 si déploiement multi-CDN. [story 2.3]
9. **`storage.setItem(key, "")` empty string ≠ null** [`storage.ts:1277`] — 3rd state ambigu. API pré-existante, à refactorer en typed `Consent = null | { acceptedAt: ISO }` Sprint 2. [story 2.2]
10. **`confidence_score` race entre store et palais-reveal sur back-nav edit** — fenêtre narrow, UX dégradé acceptable V1. [story 2.6]
11. **`recordConsent` ne détecte pas la divergence local vs server** — fire-and-forget by design, P16 a câblé le `__DEV__` warn. Sprint 2 si ARTCI audit demande proof. [story 2.2]
12. **AC #4 (Deno success-path tests) scaffold-only** — runtime Deno absent local, success-path déféré à CI Supabase Functions dédiée. [story 2.3a]
13. **`router.back()` depuis OTP ne clear pas `phone_e164` dans draft** — analytics `auth_otp_sent` peut accumuler 2 masked phones. Mineur. [story 2.3]
14. **iOS swipe-back gesture pendant finalize** (cf P-24) — défer si P-24 ne couvre que Android. iOS native gesture nécessite Stack.Screen options. [story 2.6]
15. **`auth_signed_in.is_first_login` removed from contract** — décision documentée events.md, downstream KPI consumer Kidam à informer. [story 2.3]

---

## dismissed (13)

- **R-01** Clés i18n `auth.demo_*` / `error_*` claimed missing — **vérifiées présentes** dans `fr.json:78-95` par Auditor.
- **R-02** `consent.intro` / `palais_reveal.intro` removed but render still references — Auditor a vérifié : aucun caller, removal clean.
- **R-03** `FALLBACK_RE` accepterait `+0...` — regex actuelle `^\+[1-9]\d{9,14}$` rejette explicitement, false positive.
- **R-04** `OnbCard.altKey` removal en cours — propre, 3 tests mis à jour.
- **R-05** CHANGELOG "modifié hors diff" — IS in diff (lignes 1-36).
- **R-06** `friction` variable referenced from closure — pre-existing, hand-wave.
- **R-07** IIFE perf concern micro — pas un bug.
- **R-08** Apple version `~55.0.13` patch range — convention SDK, pinning exact pas requis.
- **R-09** `setSession` test mock `{error: null}` sans `data.session` — test pass aujourd'hui, hypothétique régression future.
- **R-10** `auth_signed_in.is_first_login` removal — décision documentée events.md, intentionnelle.
- **R-11** OAuth Google/Apple "bypass consent screen" — **false positive** : le funnel canonical est `Splash → Consent → Phone → (OTP|Google|Apple) → Profile`. Le consent est déjà recordé AVANT phone.tsx (donc avant les boutons OAuth).
- **R-12** `computeConfidence(answeredCount)` "semantic mismatch" with `uniqueSpots` — la fonction `1 - exp(-k * n)` fonctionne avec n'importe quel int positif. À n=5 → ~0.49, > seuil 0.3. Auditor a confirmé contrat aligné `palais-engine.ts`.
- **R-13** PalaisReveal sentinel test ne vérifie pas downstream — hors scope unit test, le sentinel est asserté dans le payload, l'effet downstream est testé en intégration.

---

## Cross-cutting observations

1. **Story 2.3a stabilise enfin Epic 2.** Les 4 blockers (D1+D2 round 1) sont résolus, le session JWT serveur ouvre bout-en-bout, `finalizeOnboarding` ne throw plus `FINALIZE_NO_AUTH_USER` en live. C'est la cascade qui débloque les Stories 2.6 + 2.2 pour passer en `done`.

2. **L'AbortController est décoratif partout.** P14 plumbé mais jamais `.abort()`. P-13 + P-15 + P-20 demandent la même fix : un `abortRef` stocké dans un ref + appel dans cleanup. Pattern à factoriser en `useAbortableFetch()` Sprint 2.

3. **OAuth nonce security fragile sur 2 axes.** P-01 (Math.random fallback) + P-03 (race hashedNonce null). Les 2 ensemble cassent l'anti-replay OIDC. **Patch les 2 ensemble**, pas isolé.

4. **L'edge function `otp-verify` est l'angle mort.** D-B (SMTP envoi inopiné), P-07 (burn order), P-08 (userId match), P-09 (createUser swallow), P-11 (CORS *). 5 findings sur ce fichier, score signal/bruit élevé. **Pré-alpha = revue dédiée Stéphanie + smoke contre projet Supabase live.**

5. **Calibration skip vs neutral mute analytics.** D-C (resolution D4 produit confidence=0) + P-25 (skipped flag analytics) sont liés. **Trancher D-C avant P-25** car D-C impacte la sémantique de `value=0`.

6. **D-D est le seul risque EAS Build.** Si EAS preview build échoue, on découvrira en alpha. **Smoke EAS preview Android avant merge** = pas coûteux + bloque tôt.

---

## Status recommendation per story

| Story | Recommended status | Rationale |
|---|---|---|
| 2.2 — Consent ARTCI | `in-progress` | D-A juriste pending, P-28 (warn revoke), sinon clean |
| 2.3 — Auth OTP | `review` → ou `done` après P-07 à P-12 + P-13-P-19 | Cascade débloquée par 2.3a, mais 6 patches OTP-side |
| 2.3a — Google/Apple/JWT | `in-progress` | D-B, D-D bloquent merge `main`; P-01 à P-06 OAuth security; P-13/P-15/P-20 abort |
| 2.4 — Profile PII | `review` → ou `done` après P-29, P-30 | 2 patches mineurs |
| 2.5 — Calibration | `in-progress` | D-C décision UX, P-25, P-26 test gap |
| 2.6 — Palais Reveal | `in-progress` | P-22 track order, P-23/P-24 back protection, P-27 clamp |

Aucune story ne peut passer `done` sans résolution des 4 decisions + au minimum les patches OAuth security (P-01, P-03) et OTP edge function (P-07, P-08, P-11).
