# `otp-verify` Edge Function

Story 2.3 + Story 2.3a (FR-001) — valide un OTP Termii et ouvre une vraie
session Supabase Auth (avec `access_token` + `refresh_token` issued par
GoTrue) consommable par `supabase.auth.setSession()` côté client mobile.

## Payload

```json
POST /functions/v1/otp-verify
{
  "phone_e164": "+22507XXXXXXXX",
  "otp_code": "123456"
}
```

## Réponses

- `200 {success: true, user_id, access_token, refresh_token}` — OTP validé,
  user provisionné, session GoTrue émise. Le client mobile appelle
  `supabase.auth.setSession({access_token, refresh_token})` immédiatement.
- `400 {error: "invalid_phone" | "invalid_otp" | "invalid_json" | "no_pending_otp" | "otp_already_used"}`
  — payload ou état invalide. `otp_already_used` = race condition / replay (P3).
- `401 {error: "invalid_otp"}` — Termii a refusé le code.
- `429` — rate-limited (côté Termii).
- `500 {error: "edge_misconfigured" | "provider_error" | "user_provisioning_failed" | "session_provisioning_failed" | "session_user_mismatch" | "provisioning_transient_error"}`
  — secret manquant, Termii KO, `auth.admin` a échoué, mismatch user → session
  (P-08), ou erreur transitoire createUser (P-09).

## Flow (Story 2.3a)

1. Lookup `otp_attempts` → `pin_id` Termii le plus récent **non encore vérifié**
   pour ce phone (anti-replay P3).
2. POST `https://api.ng.termii.com/api/sms/otp/verify` avec `pin_id` + code.
3. Si vérifié : `UPDATE otp_attempts SET verified_at = now() WHERE request_id = ? AND verified_at IS NULL` (atomic burn).
4. Provision user : `auth.admin.createUser({phone, email: <synth>, phone_confirm, email_confirm})`,
   ou lookup paginé `listUsers({perPage: 1000})` (P6) si déjà existant.
5. Si user n'avait pas d'email (legacy) : `auth.admin.updateUserById(userId, {email: synth, email_confirm: true})`.
6. `auth.admin.generateLink({type: "magiclink", email})` → récupère
   `properties.hashed_token`.
7. Avec un client anon (pas admin), `auth.verifyOtp({type: "magiclink", token_hash})`
   → retourne une session GoTrue officielle (`access_token` + `refresh_token`
   issued + enregistrés dans `auth.refresh_tokens` → refresh natif côté SDK
   mobile via `autoRefreshToken: true`).
8. Retourne `{success, user_id, access_token, refresh_token}` au client.

## Email synthétique

Format : `phone-<phoneE164SansFormat>@phone.spawt.local`. Requis par GoTrue
pour `magiclink`. Non exposé côté UI, jamais utilisé pour envoyer un email
réel (le magiclink est consommé immédiatement server-side dans la même
requête).

## Pourquoi pas un JWT signé manuellement (HS256 + `SUPABASE_JWT_SECRET`)

Un `refresh_token` fabriqué côté Edge ne serait pas connu de GoTrue → après
expiration `access_token` (1h), le SDK appellerait `/auth/v1/token?grant_type=refresh_token`
avec le faux refresh → 401 → logout silencieux. Le pattern `generateLink` +
`verifyOtp` donne des tokens enregistrés en DB, donc refresh natif.

## Env vars requis

| Variable | Source |
|---|---|
| `TERMII_API_KEY` | `supabase secrets set` |
| `MOCK_TERMII` | `"true"` pour bypass Termii en CI/tests Deno |
| `ALLOWED_ORIGINS` | `supabase secrets set` (P-11 — CSV des origins web autorisées ; vide → CORS `"null"`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | auto-injecté |

## Déploiement

```bash
supabase functions deploy otp-verify
```

## Pré-requis schéma

Migration `0007_create_otp_attempts.sql` doit être appliquée.

## Patches review round 2 (2026-05-18)

- **P-07** : si le provisioning (createUser / listUsers / generateLink /
  verifyOtp) échoue après le burn, on UN-burn (`verified_at = null`) pour
  permettre une nouvelle tentative. Trade-off : choix replay-risk vs
  user-locked-out → on prend replay-risk (la fenêtre est minuscule et le
  pinId Termii a un TTL de 5 min).
- **P-08** : assertion `verifyData.session.user.id === userId` avant de
  renvoyer les tokens. Sinon une collision sur l'email synthétique (D-B /
  defer D-16) pourrait retourner une session pour un autre user.
- **P-09** : distingue erreur transitoire (rate limit, 5xx) de "user existe
  déjà" (continue → listUsers OK). Transient → return 500
  `provisioning_transient_error` + un-burn.
- **P-11** : CORS strict via `ALLOWED_ORIGINS` (CSV), origin reflétée, jamais
  `*`. Empêche un site malveillant de POST avec l'anon key et brûler le quota
  SMS d'une victime.

## Limitations connues

- `listUsers({perPage: 1000})` — au-delà de 1000 utilisateurs, basculer sur
  query SQL directe `auth.users WHERE phone = $1` (defer Sprint 2 hardening).
- Le user créé garde un email synthétique en DB. Si un jour on ajoute un
  écran de récupération par email, prévoir un `updateUserById` pour basculer
  vers un email réel saisi par le spawter.
- `auth.admin.generateLink({type: "magiclink"})` envoie effectivement un email
  vers l'email synthétique si SMTP est configuré côté projet Supabase. Defer
  **D-16** : alpha Termii sandbox = SMTP désactivé côté projet (sign-off
  Stéphanie requis avant merge `main`).

## Tests

`supabase/functions/otp-verify/index.test.ts` (Deno) — exécution :

```bash
supabase functions serve  # ou
deno test --allow-env --allow-net supabase/functions/otp-verify/index.test.ts
```
