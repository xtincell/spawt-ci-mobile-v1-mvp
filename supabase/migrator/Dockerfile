# =============================================================================
# SPAWT — image migrateur SQL (service one-shot Coolify)
# =============================================================================
# Contexte de build = le dossier supabase/ (pour embarquer migrations/) :
#   docker build -f migrator/Dockerfile -t spawt-migrator .
# Usage : voir migrator/README.md.

FROM postgres:16-alpine

# psql est fourni par l'image ; on ajoute bash pour migrate.sh.
RUN apk add --no-cache bash

COPY migrations/ /migrations/
COPY migrator/migrate.sh /usr/local/bin/migrate.sh
RUN chmod +x /usr/local/bin/migrate.sh

# Conteneur one-shot : applique les migrations manquantes puis se termine
# (code 0 = schéma à jour ; != 0 = échec, le déploiement doit s'arrêter).
ENTRYPOINT ["/usr/local/bin/migrate.sh"]
