#!/usr/bin/env bash
# Isolated QA stack for a Linux Android emulator. Only the loopback REST ports are published.
set -euo pipefail
repo="$(cd "${1:?Provide the Android repository checkout}" && pwd)"
here="$(cd "$(dirname "$0")" && pwd)"
runtime="$(mktemp -d "${RUNNER_TEMP:-/tmp}/spawt-pilot.XXXXXXXX")"
suffix="$(basename "$runtime" | tr '.:' '--')"
network="$suffix-net"
db="$suffix-db"
rest="$suffix-rest"
jwt="$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64url"))')"
gateway_pid=""
cleanup_on_failure(){
  if [[ -n "$gateway_pid" ]]; then kill "$gateway_pid" 2>/dev/null || true; fi
  docker rm -f "$rest" "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup_on_failure ERR
docker network create "$network" >/dev/null
docker run -d --name "$db" --network "$network" --network-alias db   -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=pilot_http   -v "$repo/supabase:/schema:ro" postgres:15-alpine >/dev/null
for ((n=0;n<90;n++)); do
  if docker exec "$db" pg_isready -h 127.0.0.1 -U postgres -d pilot_http >/dev/null 2>&1; then break; fi
  sleep 1
done
sql(){ docker exec -i "$db" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d pilot_http "$@"; }
sql -f /schema/tests/fixtures/full_schema_bootstrap.sql
for migration in "$repo"/supabase/migrations/*.sql; do
  name="$(basename "$migration")"
  if [[ "$name" == *.down.sql ]]; then continue; fi
  sql -f "/schema/migrations/$name" >> "$runtime/migrations.log" 2>&1 || { tail -30 "$runtime/migrations.log"; false; }
  if [[ "$name" == 0002_* ]]; then sql -f /schema/seed/0001_seed_currencies_plans.sql; fi
done
sql -c 'CREATE ROLE pilot_rest_smoke LOGIN NOINHERIT; GRANT anon,authenticated TO pilot_rest_smoke;'
node "$here/seed.mjs" | sql
docker run -d --name "$rest" --network "$network" -p 127.0.0.1:55487:3000   -e PGRST_DB_URI=postgresql://pilot_rest_smoke@db:5432/pilot_http   -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public -e "PGRST_JWT_SECRET=$jwt"   postgrest/postgrest:v16.6 >/dev/null
for ((n=0;n<90;n++)); do
  if curl -fsS http://127.0.0.1:55487/ >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:55487/ >/dev/null
PILOT_LOCAL_JWT="$jwt" nohup node "$here/gateway.mjs" >"$runtime/gateway.log" 2>&1 </dev/null &
gateway_pid=$!
for ((n=0;n<30;n++)); do
  if curl -fsS http://127.0.0.1:54321/health >/dev/null 2>&1; then break; fi
  sleep 1
done
node "$here/check-stack.mjs"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'PILOT_DB_CONTAINER=%s\nPILOT_REST_CONTAINER=%s\nPILOT_NETWORK=%s\nPILOT_GATEWAY_PID=%s\n' "$db" "$rest" "$network" "$gateway_pid" >> "$GITHUB_ENV"
fi
printf 'Local API on 127.0.0.1:54321. DB container %s. Logs %s.\n' "$db" "$runtime"

