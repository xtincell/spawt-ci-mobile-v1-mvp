# `otp-verify` Edge Function

Story 2.3 / FR-001 — valide un OTP Termii et provisionne le user Supabase Auth.

## Payload

```json
POST /functions/v1/otp-verify
{
  "phone_e164": "+22507XXXXXXXX",
  "otp_code": "123456"
}
```

## Réponses

- `200 {success: true, user_id: "..."}` — OTP validé, user provisioned.
- `400 {error: "invalid_phone" | "invalid_otp" | "invalid_json" | "no_pending_otp"}` — payload ou état invalide.
- `401 {error: "invalid_otp"}` — Termii a refusé le code.
- `500 {error: "edge_misconfigured" | "provider_error" | "user_provisioning_failed"}` — secret manquant, Termii KO, ou auth.admin a échoué.

## Flow

1. Lookup `otp_attempts` pour récupérer le `pin_id` Termii le plus récent.
2. POST `https://api.ng.termii.com/api/sms/otp/verify` avec `pin_id` + code saisi.
3. Si vérifié : `auth.admin.createUser({phone, phone_confirm: true})` (ou lookup si existe).
4. Marque `otp_attempts.verified_at` pour audit.

## Limitation V1 — émission de session

Supabase v2.45 n'expose pas `auth.admin.createSession()` directement. La V1 retourne
`{user_id}` ; le client mobile suit avec son propre flow (cf. `app/app/(onboarding)/otp.tsx`).
À durcir en alpha (Defer Story 2.3 §7).

## Env vars requis

| Variable | Source |
|---|---|
| `TERMII_API_KEY` | `supabase secrets set` |
| `MOCK_TERMII` | `"true"` pour bypass Termii en CI |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | auto-injecté |

## Déploiement

```bash
supabase functions deploy otp-verify
```

## Pré-requis schéma

Migration `0007_create_otp_attempts.sql` doit être appliquée.
