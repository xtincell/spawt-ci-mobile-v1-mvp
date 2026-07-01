---
name: spawt-dev
description: 'Workflow de développement SPAWT : triple gate, conventions de code, migrations SQL, i18n, vocabulaire, modes de données. Use when writing or modifying any code in app/, supabase/, or spawt-admin/.'
---

# SPAWT — Workflow de développement

## Avant tout commit : la triple gate (depuis `app/`)

```bash
npm run typecheck    # tsc --noEmit — 0 erreur exigé
npm run lint:vocab   # scripts/lint-vocab.mjs — vocabulaire interdit
npm run i18n:check   # scripts/i18n-check.mjs — strings hors i18n
npm test             # jest — 0 failed exigé (353+ tests)
```
Pour `spawt-admin/` : `npm test` (vitest, 21+ tests). Une gate rouge = on ne commit pas.

## Vocabulaire (lint-enforced, identité produit)

| Interdit | Utiliser |
|---|---|
| restaurant | lieu, spot, adresse, maquis, table |
| check-in | spawt, spawter (verbe) |
| user | spawter, mangeur |
| leaderboard, gamification | progression, collection, titres |
| VTC, Uber, Bolt | (reformuler — "Le Guet" pour la mécanique) |

Le ton du Chat : complice, direct, jamais corporate. Interdits marketing : "gastronomie", "solutions innovantes", "disruptif".

## Thème & UI

- Couleurs/typos/espacements : UNIQUEMENT via `app/src/theme/tokens.ts` (hook `useTheme`). Un hex hors tokens.ts = violation (auditée par grep en review).
- Polices : `KlinsmanTypefaceBold` (display/titres), `Gotham-Book`/`Gotham-Medium`/`Gotham-Bold` (corps/data). Les noms Klinsman sont les noms PostScript embarqués, différents des noms de fichiers .otf — ne pas "corriger".
- Presets typo : `theme.typography.preset.*` (display/h1/h2/h3/body/small/caption/data/overline).
- Data chiffrée : `preset.data` + `fontVariant: ['tabular-nums']` (pas de police mono).

## i18n

Toute string visible passe par `app/src/i18n/` (i18next). `i18n:check` casse la gate si une string UI est en dur. Français = langue par défaut.

## Migrations Supabase

- Nommage `NNNN_description.sql` + **`.down.sql` apparié obligatoire**. Prochain numéro libre : vérifier `ls supabase/migrations/` (trous 0015-0016 réservés, ne pas combler).
- RLS systématique : owner-only pour les données spawter, helpers `is_admin_staff()`/`is_active_staff()` pour le staff, `service_role` bypass pour les Edge Functions.
- Logique non triviale (triggers, RPC) → tests SQL dans `supabase/tests/` (modèle : `0012_antifraud` et `0019_moderation`).
- Colonnes updated_at : trigger `set_updated_at()` existant (migration 0001).
- Déploiement live : via Supabase MCP ou dashboard (projet `ucymjsxmnzdxvvupgaof`) — noter tout déploiement dans le header de `sprint-status.yaml`.

## Modes de données (adaptateur)

`app/src/lib/data-source.ts` bascule démo (fixtures locales `app/src/data/`) vs Supabase selon `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Toute nouvelle feature data doit fonctionner dans les deux modes (démo = fallback dégradé acceptable mais pas de crash). OTP mode démo : code `123456`.

## Env vars connues

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAPBOX_TOKEN`, `EXPO_PUBLIC_GOOGLE_MAPS_KEY`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (+`_IOS_`/`_ANDROID_` variantes), `EXPO_PUBLIC_DEV_AUTOLOGIN_*`, `EXPO_PUBLIC_BUILD_DATE`, `EXPO_PUBLIC_SENTRY_DSN` (ajouté au MVP). Côté Edge Functions : `TERMII_API_KEY`, `MOCK_TERMII`, `ALLOWED_ORIGINS`.

## Traçabilité BMAD

Chaque chantier significatif : mettre à jour le header de `_bmad-output/implementation-artifacts/sprint-status.yaml` (journal), et `CHANGELOG.md` à la racine. Les stories vivent dans `implementation-artifacts/N-N-titre.md`.
