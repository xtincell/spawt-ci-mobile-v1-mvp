-- Down 0053 — retire `brevo_queue` de la base unifiée.
-- ⚠️ Destructif : la file d'envois Brevo non traités est perdue. Vérifier
-- `SELECT count(*) FROM brevo_queue WHERE done_at IS NULL` avant de jouer ce
-- rollback — chaque ligne en attente est une inscription qui n'arrivera jamais
-- dans Brevo.
DROP TABLE IF EXISTS public.brevo_queue;
