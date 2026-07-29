---
review_date: 2026-05-17
commit: a85ef22
scope: Epic 2 — Onboarding funnel (Stories 2.2 → 2.6)
diff_stats: 66 files, +7164 / -504 lines
reviewers: Blind Hunter (adversarial-general), Edge Case Hunter, Acceptance Auditor
raw_findings: ~170 (Blind 80 + Edge 59 + Auditor 30)
unique_after_dedup: 54
---

# Code Review — Epic 2 (commit a85ef22)

## Triage summary

| Bucket | Count | Notes |
|---|---|---|
| **decision_needed** | 5 | Product/scope calls — Alexandre's input required before patching |
| **patch** | 26 | Clear fix, ready to apply |
| **defer** | 14 | Real issue but not Epic 2 scope or pre-existing hardening backlog |
| **dismissed** | 9 | Noise, false positive, already handled |

---

## decision_needed (5)

### D1 — Stories 2.3 AC #3 + AC #4 : Google Sign-In + Apple Sign-In livrés à 0%
- **Severity**: blocker per spec, but Story 2.3 Completion Notes explicitly defer ("Story 2.3a follow-up")
- **Evidence**: `app/app/(onboarding)/phone.tsx:6-9` comment "REPORTÉS — les deps natives… ne sont pas encore installées". `app.json` has no `expo-apple-authentication` plugin, no `expo-auth-session` wiring.
- **Decision needed**: (a) re-scope Story 2.3 → split into 2.3a (phone OTP only, marked done) + 2.3b (Google/Apple, ready-for-dev); (b) keep Story 2.3 as `review` until both OAuth surfaces ship; (c) reject as blocker — block Epic 2 merge.

### D2 — Story 2.3 AC #2/#5 : `otp-verify` ne livre PAS de session Supabase (live mode cassé bout-en-bout)
- **Severity**: blocker — cascade vers Story 2.6 `finalizeOnboarding` qui throw `FINALIZE_NO_AUTH_USER` en live
- **Evidence**: `supabase/functions/otp-verify/index.ts:139-143` retourne `{success, user_id}` sans tokens. `app/app/(onboarding)/otp.tsx:143-150` ne call jamais `supabase.auth.setSession`. `createUser({phone, phone_confirm:true})` sans password → `signInWithPassword` impossible (Blind #65).
- **Decision needed**: (a) descope live OTP — merger comme "demo-mode only" et créer Story 2.3c "ouvrir la session JWT serveur" comme blocker pré-alpha ; (b) implémenter maintenant via `auth.admin.generateLink({type:'magiclink'})` + extraction tokens ; (c) accepter le risque et tester en alpha Termii sandbox.

### D3 — `[pending juriste]` shippé dans `consent.cgv_body` / `consent.geoloc_body`
- **Severity**: major (ARTCI gate ships with placeholder legal copy)
- **Evidence**: `app/src/i18n/fr.json:7429` — `"Conditions d'utilisation et conditions générales de vente du service SPAWT. [pending juriste]"`, idem geoloc_body.
- **Decision needed**: (a) bloquer merge tant que juriste n'a pas livré le wording final ; (b) accepter sur `spawt/v1-bmad` car alpha pas démarrée (cohérent avec Story 2.2 dev notes "alpha pas démarrée"), bloquer pour merge `main` ; (c) shipper avec wording temporaire en pleine voix Tantie Rose.

### D4 — Story 2.5 AC #1 vs implémentation : `canContinue = true` (toujours) contredit spec "≥1 carte sélectionnée"
- **Severity**: minor (UX déviation)
- **Evidence**: `app/app/(onboarding)/calibration.tsx:38` `const canContinue = true; // multi-select autorise 0 → direction = "neutral"`.
- **Decision needed**: (a) imposer ≥1 sélection (aligné spec, contraint l'utilisateur) ; (b) accepter le comportement actuel (skip silencieux) ET ajouter un bouton "Pas d'avis" explicite (spec ligne calibration skip-via-explicit-button) ; (c) accepter le comportement actuel sans bouton.

### D5 — Mode démo `?demo=1` deep-link contourne la session Supabase en production
- **Severity**: major (sécurité)
- **Evidence**: `app/app/(onboarding)/otp.tsx:5972-5973` — `demoMode = params.demo === "1"` sans gate `!isSupabaseConfigured`. Un utilisateur sur APK prod tape `spawt://(onboarding)/otp?demo=1&phone=+225...` et passe avec code `123456`.
- **Decision needed**: (a) gate strict — `demoMode = params.demo === "1" && !isSupabaseConfigured` (patch trivial, mais on perd la possibilité de démo sur un build prod) ; (b) accepter (mode démo assumé sur tous les builds) et documenter ; (c) retirer le mode démo `?demo=1` complètement (sécurité par défaut).

---

## patch (26)

### P1 — `palais-reveal.tsx:6316-6318` : `computeConfidence(0)` hardcodé → underConstruction toujours true
- **Source**: blind+edge+auditor
- **Story**: 2.6
- **Fix**: `useMemo(() => computeConfidence(Object.values(ans).filter(v => v !== 0).length), [ans])`

### P2 — `palais-reveal.tsx:6302-6305` : `toRadar((v+1)/2)` incohérent avec range commenté `[-0.4, +0.4]`
- **Source**: blind+auditor
- **Story**: 2.6
- **Fix**: Choisir : (i) si range vraie `[-0.4, +0.4]` → `toRadar(v) = (v + 0.4) / 0.8` ; (ii) si tout futur usage utilise `[-1, +1]` → corriger le commentaire et confirmer le moteur Palais étend la plage. Ajouter un test unitaire `toRadar` (absence relevée Blind #80).

### P3 — `otp-verify` : aucune protection replay du `pin_id` après succès
- **Source**: blind+edge
- **Story**: 2.3
- **Fix**: Ajouter `.is("verified_at", null)` au SELECT du `pin_id` (`supabase/functions/otp-verify/index.ts:8424-8432`). Considérer aussi `UPDATE … WHERE verified_at IS NULL RETURNING request_id` pour bruler atomiquement.

### P4 — `otp-verify` + `otp-send` : aucun handler CORS / OPTIONS
- **Source**: blind+edge
- **Story**: 2.3
- **Fix**: Ajouter `CORS_HEADERS` + short-circuit `if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS })` dans les 2 functions. Pattern Supabase standard.

### P5 — `otp-send` : `x-forwarded-for` trust naïf → rate-limit IP contournable
- **Source**: blind+edge
- **Story**: 2.3
- **Fix**: `supabase/functions/otp-send/index.ts:8217` — utiliser `req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null` plutôt que le premier `x-forwarded-for`. Documenter limites Termii sandbox.

### P6 — `otp-verify` : `listUsers()` paginé à 50 par défaut → lookup fail silencieux passé 50 phones
- **Source**: blind+edge
- **Story**: 2.3
- **Fix**: Soit `admin.auth.admin.listUsers({ perPage: 1000 })` (court terme) soit query directe `auth.users` via SQL avec `WHERE phone = $1`. Court terme: bump perPage.

### P7 — `phone.tsx:6486` : `CIV_MOBILE_RE` ne matche AUCUN numéro CIV réel ; tous les fixtures passent via FALLBACK_RE
- **Source**: blind
- **Story**: 2.3
- **Fix**: Vérifier la spec CIV (numéros mobile sont `+225` + `0[157]` + 8 chiffres = 10 chars après `+225`, ou `+225 XX XX XX XX XX` = 10 chiffres). Aligner les fixtures de test (`+22507000000` → `+2250707000000` ?) ET le regex. Risque inverse : que le regex actuel rejette les vrais numéros entrants alpha — bloquant pour Le Guet.

### P8 — `otp-send` PHONE_RE vs migration 0007 CHECK : 10-15 digits vs 1-14 digits
- **Source**: blind
- **Story**: 2.3
- **Fix**: Aligner. Recommandé : `^\+[1-9]\d{8,14}$` (E.164 réaliste, 9-15 digits) dans les 2 fichiers.

### P9 — `lib/storage.ts` : rename `consent_data` → `consent_cgv` sans migration des clés AsyncStorage existantes
- **Source**: blind
- **Story**: 2.2
- **Fix**: Au boot, dans `storage.ts`, lire `AsyncStorage.getItem("spawt:consent:data")` ; si non-null, le copier vers `spawt:consent:cgv` puis supprimer l'ancienne clé. Pattern one-shot migration. (Story 2.2 dev notes prétendent "alpha pas démarrée" — défensif quand même.)

### P10 — `events.md` drift sur 3 events auth — single-source-of-truth Kidam violé
- **Source**: auditor
- **Story**: 2.3
- **Fix**: Mettre à jour `documentation/analytics/events.md:126-128` pour matcher les payloads shippés : `auth_otp_sent { phone_masked, country_code, provider, resend, demo }`, `auth_otp_validated { method, success, attempts, demo }`, `auth_signed_in { method, is_first_login, demo }`. Sign-off Kidam.

### P11 — `otp.tsx:6111` : resend `track` leak le `phone` brut au lieu de `maskPhone(phone)`
- **Source**: edge+auditor
- **Story**: 2.3
- **Fix**: `phone_masked: maskPhone(phone)` (pattern déjà appliqué dans `phone.tsx:56-93`).

### P12 — `otp.tsx:6105-6114` : `onResend` ne call PAS `otp-send` (no-op silencieux en live)
- **Source**: blind+edge
- **Story**: 2.3
- **Fix**: En live mode, dans `onResend`, faire `await fetch(${url}/functions/v1/otp-send, {...})`. En demo, no-op (comportement actuel correct).

### P13 — `otp.tsx:6037-6042` : `attempts: attempts + 1` lit la stale closure → analytics rapporte `attempts: 1, 1, 1`
- **Source**: blind
- **Story**: 2.3
- **Fix**: Capturer `const nextAttempts = attempts + 1; setAttempts(nextAttempts); track({…, attempts: nextAttempts})`.

### P14 — `otp.tsx:6029-6101` : pas d'`AbortController` ni `cancelled` flag sur les fetch — setState après unmount
- **Source**: edge
- **Story**: 2.3
- **Fix**: Pattern `useEffect(() => { let cancelled = false; … return () => { cancelled = true; }; }, [])` ou `AbortController` sur les fetch otp-send/verify.

### P15 — `palais-reveal.tsx` : `BackHandler` non bloqué pendant `finalizeOnboarding` (Android)
- **Source**: edge
- **Story**: 2.6
- **Fix**: `useFocusEffect(useCallback(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => submitting); return () => sub.remove(); }, [submitting]))`.

### P16 — `spawter-store.ts:7998-7999` : `void saveSpawter(spawter)` / `void savePalais(palais)` sans `.catch`
- **Source**: blind+edge
- **Story**: 2.6
- **Fix**: `void saveSpawter(spawter).catch(err => { if (__DEV__) console.warn("saveSpawter failed", err); /* TODO retry queue */ })` — pareil pour `savePalais`.

### P17 — `palais-reveal.tsx:6342-6344` : `started_at === null` fallback `seconds = 0` pollue KPI funnel
- **Source**: edge+blind
- **Story**: 2.6
- **Fix**: Émettre `time_to_complete_seconds: -1` (ou `null`) comme sentinelle dans l'event `onboarding_completed` quand `started_at == null`, plus warn `__DEV__`. Aligner type `OnboardingCompleted.time_to_complete_seconds: number | -1`.

### P18 — `index.tsx:7062-7066` : Splash CTA écrase `started_at` à chaque rentrée → KPI partiel
- **Source**: blind
- **Story**: 2.2
- **Fix**: `if (draft.started_at === null) { setField("started_at", Date.now()); }` — idempotent.

### P19 — `consent.tsx:5633-5640` : `recordConsent` re-déclenché → set-once trigger DB throw en re-entrée
- **Source**: blind+edge
- **Story**: 2.2
- **Fix**: Avant `recordConsent("cgv", true)`, check `spawter.cgv_accepted_at === null` ; idem geoloc. Le draft.consent reste idempotent côté local.

### P20 — `consent.tsx`+`phone.tsx`+`otp.tsx` : pas de garde "submitting" → double-tap → events dupliqués / double fetch
- **Source**: edge
- **Story**: 2.2+2.3
- **Fix**: Pattern uniforme `const [submitting, setSubmitting] = useState(false); if (submitting) return; setSubmitting(true); try {…} finally { setSubmitting(false); }`.

### P21 — `otp.tsx:6005-6013` : `slice(-1)` casse l'auto-fill iOS qui dump 6 digits dans cell[0]
- **Source**: edge
- **Story**: 2.3
- **Fix**: `if (value.length > 1) { const digits = value.replace(/\D/g, "").slice(0, 6); digits.split("").forEach((d, i) => /* fill cells */); return; }` avant le `slice(-1)`.

### P22 — `fr.json:26` `consent.intro` + `fr.json:257` `palais_reveal.intro` : strings dead
- **Source**: auditor
- **Story**: 2.2+2.6
- **Fix**: Soit consommer ces strings dans la UI (Story 2.2 a un Chat intro composite déjà rendu via ChatBubble — décider si `consent.intro` est redondant ou si la copy a un usage), soit retirer du `fr.json`.

### P23 — `calibration.tsx:5263` : `useMemo` importé non utilisé ; idem un `useMemo` no-op dans `palais-reveal.tsx`
- **Source**: blind
- **Story**: 2.5+2.6
- **Fix**: Retirer l'import non utilisé dans `calibration.tsx`. Dans `palais-reveal.tsx`, `useMemo` avec constant arg = no-op — soit le memo pose les vraies deps (cf. P1), soit on retire.

### P24 — `OnbCard.tsx:7319` : prop `altKey` required dans `Props` mais jamais utilisée dans le body
- **Source**: blind
- **Story**: 2.4
- **Fix**: Soit retirer `altKey` de l'interface (et de tous les callsites), soit l'utiliser (peut-être pour `accessibilityLabel` complémentaire ?).

### P25 — `profile.tsx:6717-6727` : validation includes `country_code !== null` mais le type garantit non-null → dead conditions
- **Source**: auditor
- **Story**: 2.4
- **Fix**: Retirer les checks `country_code !== null` et `gender !== null` (dead) ; valider only `display_name.trim().length >= 2 && neighborhood.trim().length >= 2 && age_range !== null`.

### P26 — `profile.tsx` : `display_name` aucune `maxLength` cap, pas de filtre emoji-only
- **Source**: edge
- **Story**: 2.4
- **Fix**: `<TextInput maxLength={50} … />` + sanitize côté finalize : `if (!/[\p{L}\p{N}]/u.test(displayName.trim())) reject`. Documenter limite dans `fr.json` placeholder.

---

## defer (14)

D1-defer to D14-defer — voir `_bmad-output/implementation-artifacts/deferred-work.md` section "code review of Epic 2 (2026-05-17)".

1. **`otp_attempts` no TTL / GDPR retention** — `0007_create_otp_attempts.sql` croît unbounded. Defer: hardening pré-alpha — ajouter cron `delete from otp_attempts where sent_at < now() - interval '7 days'`.
2. **`user_palais.axe_*` typés `real` (single-precision)** — risque drift EMA futur. Defer: schema review Epic 4 quand le moteur Palais EMA tape.
3. **`user_palais.dominant_axes text[]` CHECK ne valide pas le domaine** — accepte `['foo','bar']`. Defer: ajouter `CHECK (dominant_axes <@ ARRAY['axe_taniere_nomade',…])` en Epic 5 quand archetype/stade durcissent.
4. **`user_palais.archetype_id` free-form sans FK** — pas de table `archetypes` côté DB. Defer: créer table `archetypes` Epic 5 + FK.
5. **`user_palais.stade` CHECK dupliquait l'enum de `spawters`** — 2 sources de truth. Defer: extraire un TYPE Postgres `stade_enum` dans une migration future.
6. **`OnboardingDraft.gender` defaulted à `non_renseigne`** — biaise les KPI Kidam (100% "non_renseigne" si user skippe). Defer: décision Kidam + UI affordance (chip pre-selected vs. forcé null).
7. **Tests Deno `otp-send` / `otp-verify` non livrés** — runtime Deno absent en local. Defer: installer Deno + livrer tests dans Story 2.3a (suivi Google/Apple).
8. **PGlite tests scaffold-only** — `describe.skip` silencieux si dep absente. Defer: installer `@electric-sql/pglite` + livrer assertions concrètes user_palais en Story 2.5a.
9. **README Edge Functions `otp-send` / `otp-verify` absents** — AC #5 Story 2.3 demande README. Defer: rédiger pendant Story 2.3a.
10. **Friction panel buttons non-rendered DANS le panneau** — Resend/Change phone visibles en bas de l'écran, mais la spec demande à l'intérieur du panneau friction. Defer: polish UX Story 2.3a.
11. **ChatBubble re-render à chaque step calibration** — spec demande "rendu une seule fois au mount". Defer: micro-perf + isolation `<MemoizedBubble />`.
12. **OnboardingDraft non persisté AsyncStorage** — app killed mid-flow → PII perdues. Defer: décision produit (resume vs fresh-start) — passer en story de hardening avant alpha.
13. **`auth_signed_in` émis en mode démo pollue le funnel KPI** — `demo: true` flag présent mais filtrage requis côté analytics. Defer: configurer filtre PostHog/Mixpanel (decision Kidam) — pas de code à patcher ici.
14. **`gradient.night` typé `as const` casté à `LinearGradient`** — risque TS warning suppressed. Defer: type cleanup déjà tracé deferred-work Story 1.3 ("Casts type suspects").

---

## dismissed (9)

- **Blind #29** (stade CHECK dupliqué entre `spawters` trigger et `user_palais` check) — design choice acceptable, déjà tracé `defer` #5.
- **Blind #33, #34** (ChatBubble variant routing, CatBubble `void stage`) — design intentionnel (réservé Epic 5).
- **Blind #41** (Splash button color shift `accent` → `primary`) — couleur Or volontaire pour le Splash (cohérent avec `palais-reveal` CTA "Entrer dans la Meute").
- **Blind #50** (test SQL hardcoded userId) — paramétrisation non-applicable, fixture isolée.
- **Blind #54** (test path relatif `../../app/(onboarding)/otp`) — config jest stable, pas un risque.
- **Blind #58** (test names référencent legacy `data_consent_at`) — nit cosmétique, à nettoyer organiquement.
- **Blind #59** (`text.onBrand`, `text.inverseSecondary` non vus dans diff) — vérifié, tokens existent dans `app/src/theme/tokens.ts:56-57`.
- **Blind #63, #64, #66, #67, #68, #69, #71, #74, #75, #76, #79** — nits cosmétiques sans impact comportemental.
- **Edge findings non spécifiques** (refresh app mid-flow, hot reload, etc.) — pris en QA matrice alpha §5.7.

---

## Cross-cutting observations

1. **Story 2.3 est la source d'instabilité d'Epic 2.** D1+D2 cascadent vers Story 2.6 finalize (`FINALIZE_NO_AUTH_USER`). Tant que la session JWT n'est pas livrée bout-en-bout, le mode live est inutilisable. Le mode démo masque le défaut côté front mais le funnel KPI est fictif.
2. **Le mode démo est trop puissant.** Bypass `?demo=1` (D5), `auth_signed_in { demo: true }` pollue les funnels, `123456` accepté sans gate stricte. Une seule décision Alexandre : retirer ou gate strict.
3. **L'analytics `events.md` est désynchronisé du code shippé.** P10 doit être appliqué avant tout dashboard Kidam de Sprint 1 — sinon les contrats analytics divergent silencieusement.
4. **Le storage rename CGV (P9) est l'oubli technique le plus dangereux.** Toute alpha device existante perd son timestamp. Le commentaire "alpha pas démarrée" n'est pas une migration.
5. **Palais Reveal a 2 bugs visuels** (P1 confidence-zero, P2 toRadar range mismatch) qui rendent le moment-rituel littéralement "en construction" pour tout le monde. Test Tantie Rose impossible à passer.

---

## Status recommendation per story

| Story | Recommended status | Rationale |
|---|---|---|
| 2.2 — Consent ARTCI | `in-progress` | D3 (juriste), P9 (storage migration), P18-P19, P22 à appliquer |
| 2.3 — Auth OTP/Google/Apple | `in-progress` | D1+D2 blockers, ~10 patches OTP/security |
| 2.4 — Profile PII | `in-progress` | P24-P26 mineurs, sinon clean |
| 2.5 — Calibrage Palais | `in-progress` | D4 décision UX, P23 cleanup |
| 2.6 — Palais Reveal | `in-progress` | P1+P2 blocants visuels, P15-P17 résilience |

Aucune story ne peut passer à `done` sans au minimum les patches blocants (P1, P2, P3, P4, P9) et la résolution des 5 `decision_needed`.
