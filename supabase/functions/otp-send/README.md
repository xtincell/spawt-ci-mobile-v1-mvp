# `otp-send` Edge Function

Story 2.3 / FR-001 — bridge Termii pour envoyer un OTP SMS au format CIV.

## Payload

```json
POST /functions/v1/otp-send
{
  "phone_e164": "+22507XXXXXXXX"
}
```

## Réponses

- `200 {success: true, request_id: "..."}` — OK, OTP envoyé. `request_id` = `pinId` Termii.
- `400 {error: "invalid_phone" | "invalid_json"}` — payload invalide.
- `429 {error: "rate_limited", scope: "phone" | "ip", retry_after_seconds: 3600}` — quota dépassé.
- `500 {error: "edge_misconfigured" | "provider_error"}` — secret manquant ou Termii KO.

## Env vars requis (Supabase Edge)

| Variable | Source | Notes |
|---|---|---|
| `TERMII_API_KEY` | `supabase secrets set` | clé Termii — jamais committée. |
| `TERMII_SENDER_ID` | `supabase secrets set` | default `"SPAWT"` si absent. |
| `SUPABASE_URL` | auto-injecté | — |
| `SUPABASE_SERVICE_ROLE_KEY` | auto-injecté | bypass RLS sur `otp_attempts`. |
| `MOCK_TERMII` | `supabase secrets set` | `"true"` → renvoie un `request_id` factice sans appeler Termii. Utile CI/tests. |

## Déploiement

```bash
supabase secrets set TERMII_API_KEY=... TERMII_SENDER_ID=SPAWT
supabase functions deploy otp-send
```

## Exemple curl

```bash
curl -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"phone_e164":"+22507000000"}' \
  "$SUPABASE_URL/functions/v1/otp-send"
```

## Rate-limit

- 5 envois / `phone_e164` / heure
- 20 envois / IP / heure

Compté via `otp_attempts.sent_at >= now() - 1h`.

## Pré-requis schéma

Migration `0007_create_otp_attempts.sql` doit être appliquée (lookup + insert).
