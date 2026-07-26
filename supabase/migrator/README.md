# SPAWT — Migrateur SQL (Coolify / self-hosted)

Petit conteneur one-shot qui applique les migrations `supabase/migrations/NNNN_*.sql`
sur un Postgres (le backend self-hosted Coolify, ou n'importe quelle base
compatible). Idempotent, sérialisé, fail-fast.

## Fonctionnement

- Table de suivi `public.schema_migrations (version text pk, applied_at)` :
  une migration = une ligne, `version` = nom de fichier sans `.sql`
  (ex. `0032_create_subscriptions_invoices`).
- Chaque migration s'applique dans **une transaction unique** qui :
  1. prend `pg_advisory_xact_lock` (deux migrateurs concurrents se
     sérialisent — pas de course entre redéploiements qui se chevauchent) ;
  2. insère la version dans `schema_migrations` (la PK est la garde
     anti-double application, même sous concurrence) ;
  3. exécute le fichier SQL.
  Tout ou rien : une erreur annule aussi l'enregistrement de la version.
- Les `.down.sql` sont **ignorés** (rollback = opération manuelle réfléchie,
  cf. convention repo).
- Première erreur SQL → arrêt immédiat, code de sortie ≠ 0, log de l'erreur.

## Build

Le contexte de build est le dossier `supabase/` (pour embarquer `migrations/`) :

```bash
cd supabase
docker build -f migrator/Dockerfile -t spawt-migrator .
```

## Usage Coolify

Deux façons de brancher, au choix :

### Option A — service one-shot (recommandé)

Déclarer un service Docker à partir de cette image dans le même projet que le
backend, avec `restart: "no"` (il tourne et se termine) :

```yaml
# docker-compose Coolify (extrait)
services:
  migrator:
    build:
      context: ./supabase
      dockerfile: migrator/Dockerfile
    environment:
      DATABASE_URL: ${DATABASE_URL}   # postgres://user:pass@db:5432/spawt
    restart: "no"
```

Relancer le service après chaque livraison de migrations. Code sortie 0 =
schéma à jour ; ≠ 0 = regarder les logs, **ne pas** déployer l'app.

### Option B — commande de pré-déploiement

Dans Coolify, sur la ressource applicative : *Pre-deployment command* →

```bash
docker run --rm -e DATABASE_URL="$DATABASE_URL" spawt-migrator
```

Le déploiement de l'app est bloqué si le migrateur sort en erreur.

## Variables d'environnement

| Variable         | Requis | Description                                        |
|------------------|--------|----------------------------------------------------|
| `DATABASE_URL`   | oui    | `postgres://user:pass@host:5432/db` (droits DDL)   |
| `MIGRATIONS_DIR` | non    | Défaut `/migrations` (monté par l'image)           |

## Notes

- Sur le projet Supabase **managé**, on continue de passer par le MCP/dashboard
  (cf. skill spawt-dev) — ce migrateur vise le Postgres self-hosted.
- La base est **unifiée** avec le quiz La Meute : les migrations 0033+ sont
  écrites pour cohabiter (CREATE IF NOT EXISTS sur les tables du quiz).
- Rejouer une base neuve : le migrateur applique 0001 → dernière dans l'ordre.
