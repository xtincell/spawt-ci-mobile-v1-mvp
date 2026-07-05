-- Migration 0028 — Coup de Cœur : monnaie sociale rare (PRD Feature 12 + §7.3)
-- Date: 2026-07-02
-- Contexte: Phase 2 version finale. Le badge éditorial statique existait mais
-- aucune mécanique. Quota MENSUEL indexé sur la maturité, pas le portefeuille
-- (arbitrage fondateur PRD §18.1 #4) : Touriste/Explorateur/Détective = 1,
-- Djidji = 2, Guide = 3. (Bonus premium +1 : branché avec l'abonnement Gold.)

CREATE TABLE public.coups_de_coeur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id UUID NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  -- Clé de quota mensuelle (Africa/Abidjan = UTC, pas d'ambiguïté).
  month_key TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un spawter ne donne qu'un Coup de Cœur par lieu et par mois.
  UNIQUE (spawter_id, place_id, month_key)
);

COMMENT ON TABLE public.coups_de_coeur IS
  'Coup de Cœur (PRD §7.3) — signal social rare, quota mensuel par stade. '
  'Toute écriture passe par le RPC give_coup_de_coeur (quota atomique).';

CREATE INDEX idx_cdc_place_month ON public.coups_de_coeur (place_id, month_key);
CREATE INDEX idx_cdc_spawter_month ON public.coups_de_coeur (spawter_id, month_key);

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.coups_de_coeur ENABLE ROW LEVEL SECURITY;

-- Signal social public : lecture libre (compteur fiche lieu, feed).
CREATE POLICY "cdc_select_all"
  ON public.coups_de_coeur
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Aucune policy INSERT/UPDATE/DELETE : l'écriture passe EXCLUSIVEMENT par le
-- RPC SECURITY DEFINER (quota) — un INSERT direct est rejeté par la RLS.

-- ━━━ RPC quota atomique ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.give_coup_de_coeur(p_place_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_spawter UUID := auth.uid();
  v_stade TEXT;
  v_quota INT;
  v_used INT;
  v_month TEXT := to_char(now(), 'YYYY-MM');
BEGIN
  IF v_spawter IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  SELECT stade INTO v_stade FROM public.spawters WHERE id = v_spawter;
  v_quota := CASE COALESCE(v_stade, 'touriste')
    WHEN 'djidji' THEN 2
    WHEN 'guide'  THEN 3
    ELSE 1
  END;

  -- Verrou advisory par spawter+mois : sérialise les taps concurrents.
  PERFORM pg_advisory_xact_lock(hashtext(v_spawter::text || v_month));

  SELECT count(*) INTO v_used FROM public.coups_de_coeur
  WHERE spawter_id = v_spawter AND month_key = v_month;

  IF v_used >= v_quota THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'quota_exhausted',
      'quota', v_quota, 'used', v_used
    );
  END IF;

  BEGIN
    INSERT INTO public.coups_de_coeur (spawter_id, place_id, month_key)
    VALUES (v_spawter, p_place_id, v_month);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'already_given',
      'quota', v_quota, 'used', v_used
    );
  END;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'given',
    'quota', v_quota, 'used', v_used + 1, 'remaining', v_quota - v_used - 1
  );
END;
$$;

COMMENT ON FUNCTION public.give_coup_de_coeur(UUID) IS
  'Phase 2 F12 — attribue un Coup de Cœur avec quota mensuel par stade '
  '(1/1/1/2/3). SECURITY DEFINER : seule voie d''écriture (RLS sans INSERT).';

-- Compteur du mois courant pour une fiche lieu (évite le SELECT count côté client).
CREATE OR REPLACE FUNCTION public.count_coups_de_coeur(p_place_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.coups_de_coeur
  WHERE place_id = p_place_id AND month_key = to_char(now(), 'YYYY-MM');
$$;
