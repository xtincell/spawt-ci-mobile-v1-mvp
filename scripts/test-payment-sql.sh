#!/usr/bin/env bash
# Disposable PostgreSQL only: never accepts a production connection string.
set -euo pipefail
cd "$(dirname "$0")/.."
container="spawt-payment-tests-${RANDOM}-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust -v "$PWD:/repo:ro" \
  postgres:15-alpine >/dev/null
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() { docker exec "$container" psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
sql -f /repo/supabase/tests/fixtures/full_schema_bootstrap.sql
for migration in supabase/migrations/*.sql; do
  [[ "$migration" == *.down.sql ]] && continue
  sql -f "/repo/$migration"
  # The commercial catalog must exist before the payment migrations.
  if [[ "$migration" == supabase/migrations/0002_* ]]; then
    sql -f /repo/supabase/seed/0001_seed_currencies_plans.sql
  fi
done
checks() {
  for test in gold_lieu_prix_final manual_payments admin_audit_actions provider_payment_atomic; do
    sql -f "/repo/supabase/tests/$test.sql"
  done
}
checks
# Exercise rollback in reverse dependency order, then upgrade again.
for version in 0081 0080 0079; do
  for migration in supabase/migrations/"$version"_*.down.sql; do sql -f "/repo/$migration"; done
done
sql -c "DO \$\$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='price_ttc')
    OR to_regprocedure('public.confirm_provider_payment(text,text,integer,text,timestamptz)') IS NOT NULL
    OR (SELECT price_ht FROM plans WHERE code='b2b_gold') IS DISTINCT FROM 65000 THEN
    RAISE EXCEPTION 'Payment rollback incomplete';
  END IF;
END \$\$;"
for version in 0079 0080 0081; do
  for migration in supabase/migrations/"$version"_*.sql; do
    [[ "$migration" == *.down.sql ]] && continue
    sql -f "/repo/$migration"
  done
done
checks
echo 'Payment SQL: fresh schema, permissions, invoices, rollback and upgrade passed.'
