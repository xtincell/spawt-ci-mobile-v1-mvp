# `supabase/` — infra DB partagée SPAWT (mobile + admin)

Ce dossier porte le schéma Postgres, les Edge Functions et les seeds. Il est commun à `app/` (mobile RN) et `spawt-admin/` (panel web, à venir Epic 6) — la seule communication runtime entre les deux codebases est ce projet Supabase.

## Prérequis

- **Supabase CLI** ≥ 1.150 — `npm install -g supabase` (recommandé, cohérent avec l'écosystème Node ≥ 20 du repo). Alternative : `brew install supabase/tap/supabase` (macOS) ou MSI/scoop (Windows).
- **Docker Desktop** — requis uniquement pour la stack locale (`supabase start`). Sans Docker, les migrations restent versionnées et déployables sur un projet hosté.

## Workflow migrations

```bash
# Démarrer la stack locale (Postgres + Studio + Auth + Storage + Inbucket)
supabase start

# Appliquer toutes les migrations sur la DB locale
supabase db reset

# Créer une nouvelle migration vide (incrément automatique)
supabase migration new <verbe_objet>          # ex: create_user_signals_appendonly

# Lint / dump du schéma actuel
supabase db lint                              # si extension installée
psql "$(supabase db url)" -c "\d spawters"    # inspection manuelle

# Stop / cleanup
supabase stop
```

## Convention

- **Numérotation `NNNN_<verbe>_<objet>.sql`** appairée avec `NNNN_<verbe>_<objet>.down.sql` réversible et idempotent (`DROP IF EXISTS`).
- **`lower_snake_case`** pour tous les noms d'objets (tables, colonnes, index, policies, functions, triggers).
- **`timestamptz`** systématique (jamais `timestamp` sans timezone).
- **RLS activée** sur toutes les tables PII ; convention `spawter_id = auth.uid()`.
- **Convention FK** : toute table métier qui référence un spawter le fait via `spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE`. Jamais vers une table `users` générique.

## État Sprint 1

| Migration | Story | Tables livrées | Status |
|---|---|---|---|
| `0001_create_spawters_spawt_staff` | 1.5 | `spawters`, `spawt_staff` | ✅ Story 1.5 |
| `0002_create_customers_plans_currencies` | 1.6 | `customers`, `plans`, `currencies` | ✅ Story 1.6 |
| `0003_create_user_signals_appendonly` | 1.7 | `user_signals` (append-only) | ✅ Story 1.7 |
| `0004_create_feature_flags` | 1.8 | `feature_flags` | ✅ Story 1.8 |
| `0005_spawters_invariant_triggers` | 1.5 (review fixup) | triggers `stade` anti-régression + `consent_*_at` set-once | ✅ Code review 2026-05-16 |
| `0006_create_places_place_adn` | 3.3a | `places`, `place_adn` | ⏳ Epic 3 |
| `0007_create_user_palais` | 2.6 / 4.6 | `user_palais` | ⏳ Epic 2 / 4 |
| `0008_create_spawt_checkin` | 4.1 / 4.2 | `spawt_checkin` | ⏳ Story 4.1 / 4.2 |
| `0009_antifraud_triggers` | 4.4 | triggers PL/pgSQL anti-fraude | ⏳ Story 4.4 |
| `0010_create_progression_collection_titres` | 5.1 / 5.2 | `spawter_progression`, `collection_titres` | ⏳ Epic 5 |
| `0011_create_subscriptions_invoices` | (Sprint 2) | `subscriptions`, `invoices` | ⏳ Sprint 2 |
| `0012_storage_buckets_rls` | 4.5 | RLS storage `place-photos`, `avatars`, `place-covers` | ⏳ Story 4.5 |

## Edge Functions

À venir :

- `otp-send` — bridge Termii → session Supabase Auth (Story 2.3).
- `cinetpay-webhook` — confirme paiement → upsert subscriptions (Sprint 2).
- `anonymize-deleted-spawters` — soft-delete J+30 (NFR-SEC-04).

## Sources canoniques

- Schéma complet : `_bmad-output/planning-artifacts/architecture.md` § Data Architecture.
- Types TS canoniques : `app/src/types/spawter.ts`, `place.ts`, `palais.ts`, etc. — **le SQL doit aligner sur le TS**.
- Conventions : `_bmad-output/project-context.md` § Vocabulaire SPAWT + Supabase / PostgREST.
