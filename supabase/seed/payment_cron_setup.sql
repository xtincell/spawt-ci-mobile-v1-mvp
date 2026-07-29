-- ============================================================================
-- Seed OPTIONNEL (NON exécuté automatiquement) — planification payment-cron
-- ============================================================================
-- Fait tourner le cycle de vie des abonnements Gold (PRD §11.4) : rappels
-- J-3 / J, passage en grâce (+7 j), expiration. Appel quotidien 08:00 UTC
-- de l'Edge Function `payment-cron` via pg_cron + pg_net.
--
-- RUNBOOK D'INSTALLATION (à exécuter en SQL Editor sur le projet live,
-- ucymjsxmnzdxvvupgaof, ou le VPS Coolify) :
--   1. Activer les extensions (Dashboard → Database → Extensions, ou SQL) :
--        create extension if not exists pg_cron  with schema pg_catalog;
--        create extension if not exists pg_net   with schema extensions;
--   2. Poser le secret côté Edge Functions :
--        supabase secrets set CRON_SECRET=<valeur forte aléatoire>
--   3. Remplacer ci-dessous <PROJECT_REF> et <CRON_SECRET> par les vraies
--      valeurs (le secret DOIT être identique à l'env CRON_SECRET de l'Edge).
--   4. Exécuter ce fichier. Vérifier : select * from cron.job;
--   5. Test manuel immédiat :
--        curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/payment-cron \
--             -H "x-cron-key: <CRON_SECRET>"
--      → 200 {"success":true,...} attendu ; 409 = mauvaise clé.
--
-- Désinstallation : select cron.unschedule('spawt-payment-cron-daily');

select cron.schedule(
  'spawt-payment-cron-daily',
  '0 8 * * *',  -- tous les jours à 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/payment-cron',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-key',   '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
