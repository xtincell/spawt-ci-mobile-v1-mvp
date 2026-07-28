-- ============================================================================
-- Migration 0053 — `brevo_queue` : la 5e table du quiz, oubliée par 0033
-- ============================================================================
-- La 0033 a capturé 4 des 5 tables du quiz La Meute (meute_waitlist,
-- table_versions, admin_config, app_config) mais pas `brevo_queue` — la file
-- persistée des inscriptions à pousser vers Brevo.
--
-- Pourquoi ça compte au moment de la bascule vers la base unifiée :
-- `initSchema()` du quiz (server.mjs) crée ses tables au démarrage, et son
-- échec est bien attrapé… mais il est attrapé DANS un `.then()` qui porte
-- aussi le démarrage du worker Brevo :
--
--     initSchema().then(() => { pumpBrevo(); setInterval(pumpBrevo, …); })
--                 .catch((e) => console.error("[quiz] initSchema échec:", …));
--
-- Autrement dit : si le DDL passe mal sur la base unifiée, le serveur HTTP
-- répond quand même — mais **plus aucune inscription ne part vers Brevo**, en
-- silence. Le symptôme serait invisible côté quiz et fatal côté acquisition.
-- On pose donc la table ici, au même titre que les 4 autres.
--
-- Le DDL est repris **à l'identique** de server.mjs (lignes 71-78) pour rester
-- bit-à-bit compatible avec le `CREATE TABLE IF NOT EXISTS` du quiz, qui
-- deviendra un no-op.
-- Date : 2026-07-28

CREATE TABLE IF NOT EXISTS public.brevo_queue (
  id         SERIAL PRIMARY KEY,
  payload    JSONB NOT NULL,
  attempts   INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  done_at    TIMESTAMPTZ
);

COMMENT ON TABLE public.brevo_queue IS
  'File persistée des inscriptions quiz à pousser vers Brevo (DDL = server.mjs '
  'du quiz). `payload` contient des PII (email, téléphone) : accès EXCLUSIF par '
  'la connexion pg directe du quiz + service_role. RLS sans policy.';

-- ━━━ Verrouillage PostgREST — même doctrine que 0033 ━━━━━━━━━━━━━━━━━━━━━━━
-- `payload` embarque l'email et le téléphone du lead : cette table ne doit
-- jamais être lisible par l'API publique. RLS activée SANS policy = deny-all
-- pour anon/authenticated ; le REVOKE est la ceinture et les bretelles (les
-- default privileges Supabase grantent sinon SELECT & co à ces rôles sur
-- toute nouvelle table du schéma public).
ALTER TABLE public.brevo_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brevo_queue FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.brevo_queue_id_seq FROM anon, authenticated;
