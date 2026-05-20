# SPAWT — Panel admin

Greenfield codebase Refine v5 + Vite + React 18 + TS pour l'équipe interne.
**Aucune communication runtime avec `app/`** — seul lien = projet Supabase partagé.

## Stack

- Refine v5 (`@refinedev/core`, `@refinedev/supabase`, `@refinedev/react-router`)
- Vite + React 18 + TypeScript strict
- Zod (validation formulaires, port autonome depuis `app/`)
- Recharts (Story 6.5 dashboard)

## Workflow dev

```bash
cd spawt-admin
npm install
cp .env.example .env  # renseigner VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev           # → http://localhost:5173
```

## Triple gate

```bash
cd spawt-admin
npx tsc --noEmit
npm run lint
npm test
npm run build         # produit dist/
```

⚠️ La triple gate **mobile** (`cd app && tsc + lint:vocab + i18n:check`) reste séparée.
`spawt-admin/` ne touche jamais `app/`.

## Déploiement Cloudflare Pages

1. **Framework preset** : Vite.
2. **Build command** : `npm run build`.
3. **Build output** : `dist`.
4. **Root directory** : `spawt-admin`.
5. **Node version** : `20.x`.
6. **Env vars** (côté dashboard Cloudflare, jamais commit) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
7. **Preview deploys** activés sur chaque PR.
8. **Cloudflare Access** : allowlist d'emails `spawt_staff` (Email OTP free tier 50 users).
9. `public/_headers` pose les en-têtes de sécurité (X-Frame-Options DENY, etc.).
10. `public/_redirects` redirige `/* /index.html 200` (SPA fallback).

Provisioning Cloudflare live = handoff Stéphanie (defer D-601).

## Sécurité

- **Jamais `SUPABASE_SERVICE_ROLE_KEY` côté client.** Toute opération privilégiée passe par une Edge Function.
- Auth `spawt_staff` distincte des `spawters` mobile (PRD FR-027). Double vérification : RLS `spawt_staff_select_own` + applicative `authProvider`.
- Audit log append-only (`admin_audit_log`, migration 0017).
- Cloudflare Access + Supabase Auth + RLS `spawt_staff` = 3 barrières indépendantes.

## Liens

- Story 6.1 — bootstrap codebase.
- Story 6.2 — CRUD lieux.
- Story 6.3 — pré-chargement inventaire (Edge Function + CSV).
- Story 6.4 — modération avis + ban spawter.
- Story 6.5 — dashboard métriques.
