-- ============================================================================
-- Migration 0003 — user_signals (append-only strict)
-- ============================================================================
-- Story 1.7. FR-024 (collecte de signaux). NFR-DATA-01→03 (conservation).
-- Trigger bloque UPDATE/DELETE même en service_role — anti-fraude L1
-- (Claude amendment 5.3). Effacement uniquement via cascade depuis spawters
-- (anonymize-deleted-spawters Edge Function — NFR-SEC-04).

-- ━━━ Table : user_signals ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.user_signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- DEFAULT auth.uid() : le wrapper analytics côté client n'a pas à passer
  -- explicitement spawter_id. La RLS `insert_own` valide quand même côté
  -- WITH CHECK. Sans session auth (pre-OTP), l'insert échoue côté RLS.
  spawter_id    uuid NOT NULL DEFAULT auth.uid()
                  REFERENCES public.spawters(id) ON DELETE CASCADE,
  signal_type   text NOT NULL
                  CHECK (signal_type IN (
                    'spawt','review','view','save','share',
                    'search','filter','click','dismiss')),
  event_name    text NOT NULL
                  CHECK (length(trim(event_name)) > 0),
  place_id      uuid,  -- pas de FK ici : places n'existe pas encore (Story 3.3a)
                       -- FK ajoutée par migration ultérieure si nécessaire.
  -- Cap de taille jsonb (8 KB) pour éviter qu'un caller injecte un blob
  -- (base64 photo par erreur) dans metadata. Validation au CHECK-time, pas
  -- de panique runtime.
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
                  CHECK (pg_column_size(metadata) < 8192),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_signals IS
  'Signaux append-only. 9 signal_type agrégés (DB analytics SQL) + event_name granulaire (conforme documentation/analytics/events.md). Trigger bloque UPDATE/DELETE — append-only strict (anti-fraude L1).';
COMMENT ON COLUMN public.user_signals.signal_type IS
  '9 catégories agrégées : spawt | review | view | save | share | search | filter | click | dismiss. Mapping event → signal_type figé côté TS (analytics.ts).';
COMMENT ON COLUMN public.user_signals.event_name IS
  'Granulaire, conforme documentation/analytics/events.md. Validation typage côté wrapper analytics.ts (TS compile-time).';

-- ━━━ Index ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE INDEX user_signals_spawter_created_idx
  ON public.user_signals (spawter_id, created_at DESC);
CREATE INDEX user_signals_signal_type_idx
  ON public.user_signals (signal_type);
CREATE INDEX user_signals_event_name_idx
  ON public.user_signals (event_name);
CREATE INDEX user_signals_place_id_idx
  ON public.user_signals (place_id) WHERE place_id IS NOT NULL;

-- ━━━ Trigger append-only (UPDATE seulement) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Append-only au sens fort = pas de mutation des rows existantes
-- (anti-fraude L1 — Claude amendment 5.3). On bloque UPDATE.
--
-- DECISION D1 (code review 2026-05-16) : on ne bloque PAS DELETE.
-- Rationale :
--   * PostgreSQL 15 invoque les BEFORE DELETE row-level triggers même sur
--     les rows cascadées (corrigé du commentaire erroné précédent). Un
--     trigger BEFORE DELETE inconditionnel cassait l'anonymisation J+30
--     (NFR-SEC-04) car le cascade depuis spawters raise.
--   * La défense en profondeur DELETE est déjà côté RLS : pas de policy
--     DELETE = pas de DELETE pour les clients (spawter ou staff).
--     service_role bypass RLS mais c'est le rôle dédié à l'anonymisation.
--   * Quand un spawter est supprimé, le cascade naturel emporte ses
--     signaux — c'est le GDPR right-to-erasure légitime, pas un wipe
--     d'évidence (le compte spawter complet est anonymisé, plus rien à
--     analyser anti-fraude).
--   * Trace post-suppression : un event `account_deletion_requested`
--     (déjà dans la taxonomie analytics.ts) est émis AVANT l'appel à
--     l'Edge Function — l'agrégat reste exploitable par Kidam.
CREATE OR REPLACE FUNCTION public.block_modifications_user_signals()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'user_signals est append-only : UPDATE interdit (anti-fraude L1)'
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_update_user_signals
  BEFORE UPDATE ON public.user_signals
  FOR EACH ROW EXECUTE FUNCTION public.block_modifications_user_signals();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

-- Un spawter lit ses propres signaux (debug user-side).
CREATE POLICY user_signals_select_own ON public.user_signals
  FOR SELECT USING (spawter_id = auth.uid());

-- Un spawter n'insère que ses propres signaux.
CREATE POLICY user_signals_insert_own ON public.user_signals
  FOR INSERT WITH CHECK (spawter_id = auth.uid());

-- Staff actif : lecture tous signaux (dashboards Story 6.5).
CREATE POLICY user_signals_select_staff ON public.user_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Pas de policies UPDATE/DELETE — bloqué côté trigger ET côté RLS (défense en
-- profondeur). Aucun chemin d'effacement direct ; uniquement cascade depuis
-- spawters lors d'une anonymisation J+30.
