#!/usr/bin/env bash
# =============================================================================
# SPAWT — migrateur SQL idempotent (Coolify / self-hosted)
# =============================================================================
# Applique les migrations supabase/migrations/NNNN_*.sql dans l'ordre, en
# sautant celles déjà enregistrées dans public.schema_migrations. Les fichiers
# *.down.sql sont ignorés (rollbacks manuels).
#
# Garanties :
#   * Idempotent : re-lancer le conteneur n'applique jamais deux fois la même
#     migration (table schema_migrations, version = préfixe NNNN_nom).
#   * Anti-course : chaque migration s'applique dans UNE transaction qui prend
#     d'abord pg_advisory_xact_lock — deux migrateurs lancés en même temps
#     (redéploiement qui se chevauche) se sérialisent ; le second voit le
#     duplicate key sur schema_migrations et saute proprement.
#   * Fail-fast : première erreur SQL = arrêt immédiat, code sortie != 0
#     (Coolify marque le déploiement en échec, l'app ne démarre pas sur un
#     schéma à moitié migré).
#
# Env :
#   DATABASE_URL   (requis)  postgres://user:pass@host:5432/db
#   MIGRATIONS_DIR (option)  défaut /migrations
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"
# Clé arbitraire mais stable du verrou advisory (« SPAWT migrator »).
LOCK_KEY=727270001

log() { printf '[migrate] %s\n' "$*"; }

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERREUR : DATABASE_URL non défini." >&2
  exit 1
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --no-psqlrc --quiet)

# ── 1. Table de suivi ────────────────────────────────────────────────────────
"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

# ── 2. Boucle sur les migrations, dans l'ordre lexical (NNNN_…) ──────────────
shopt -s nullglob
applied=0
skipped=0
for file in "$MIGRATIONS_DIR"/[0-9][0-9][0-9][0-9]_*.sql; do
  base="$(basename "$file")"
  case "$base" in *.down.sql) continue ;; esac
  version="${base%.sql}"

  # Déjà appliquée ? (lecture rapide hors verrou — la vérité finale est le
  # PRIMARY KEY de schema_migrations, vérifié sous verrou ci-dessous)
  exists="$("${PSQL[@]}" -tA -c \
    "SELECT 1 FROM public.schema_migrations WHERE version = '$version';")"
  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  log "→ applique $base"
  # UNE transaction : verrou advisory (sérialise les migrateurs concurrents),
  # enregistrement de la version (PK = garde anti-double application), puis le
  # fichier SQL lui-même. Tout ou rien.
  set +e
  output="$("${PSQL[@]}" --single-transaction \
    -c "SELECT pg_advisory_xact_lock($LOCK_KEY);" \
    -c "INSERT INTO public.schema_migrations (version) VALUES ('$version');" \
    -f "$file" 2>&1)"
  status=$?
  set -e

  if [ $status -ne 0 ]; then
    if printf '%s' "$output" | grep -q 'schema_migrations_pkey'; then
      # Un migrateur concurrent l'a appliquée pendant qu'on attendait le
      # verrou : c'est un succès du point de vue de l'idempotence.
      log "  déjà appliquée par un migrateur concurrent — sautée."
      skipped=$((skipped + 1))
      continue
    fi
    log "ERREUR sur $base — arrêt (rien de cette migration n'a été appliqué) :" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
  applied=$((applied + 1))
  log "  OK."
done

log "Terminé : $applied appliquée(s), $skipped déjà en place."
