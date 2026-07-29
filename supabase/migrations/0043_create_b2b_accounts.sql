-- ============================================================================
-- Migration 0043 — Comptes B2B (lieux) + dashboards agrégés anti-réidentification
-- ============================================================================
-- Un lieu (maquis, table) obtient un compte B2B (rôle pro ou gold) lié à SON
-- lieu. Il voit des AGRÉGATS mensuels, JAMAIS de données individuelles :
--
--   RÈGLE ANTI-RÉIDENTIFICATION : tout agrégat porte sur >= 3 événements,
--   sinon NULL. Avec 1-2 spawts dans le mois, le patron pourrait recouper
--   (heure de passage, réservation, tête du client) et ré-identifier QUI a
--   noté quoi — inacceptable (NFR-SEC-01, Contrat SPAWT : les avis
--   appartiennent à la Meute, pas au lieu).
--
-- Choix technique : les vues sont des vues « definer » (security_invoker =
-- false, comme spawters_public 0021) avec un gate is_b2b_of() PAR LIGNE dans
-- le WHERE. Une vue security_invoker=true serait ici un faux ami : la RLS
-- owner-only de spawt_checkin rendrait les agrégats VIDES pour le compte B2B
-- (il ne peut pas lire les spawts individuels — c'est voulu). La vue definer
-- agrège en bypass RLS mais n'expose QUE des agrégats seuillés à n>=3 pour le
-- lieu du caller — l'intention « lisible par le B2B de SON lieu uniquement »
-- est tenue.
-- Date : 2026-07-26

CREATE TABLE public.b2b_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Compte auth dédié (jamais un compte spawter — même séparation stricte que
  -- spawt_staff, amendement 4.1).
  auth_user_id  uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id      uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  role          text NOT NULL
                  CHECK (role IN ('pro','gold')),
  contact_name  text,
  contact_phone text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.b2b_accounts IS
  'Comptes B2B des lieux. role=pro : stats mensuelles ; role=gold : + funnel '
  'signaux. Auth séparée des spawters. Création via service_role (commercial).';

CREATE INDEX b2b_accounts_place_idx ON public.b2b_accounts (place_id);

-- ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.is_b2b_of(p_place uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.b2b_accounts b
    WHERE b.auth_user_id = auth.uid()
      AND b.place_id = p_place
      AND b.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_b2b_gold_of(p_place uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.b2b_accounts b
    WHERE b.auth_user_id = auth.uid()
      AND b.place_id = p_place
      AND b.is_active = true
      AND b.role = 'gold'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_b2b_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_b2b_gold_of(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_b2b_of(uuid) IS
  'auth.uid() est-il un compte B2B ACTIF de ce lieu ? (SECURITY DEFINER — '
  'utilisé par les vues dashboards et les policies, pattern 0021).';

-- ━━━ Vue : b2b_place_stats_monthly ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Par lieu et par mois : spawts vérifiés, avis, note moyenne pondérée par
-- stade (port SQL de app/src/lib/weighted-rating.ts : Touriste 1x,
-- Explorateur 1.5x, Détective 2x, Djidji 2.5x, Guide 3x).
-- NB : le poids utilise le stade ACTUEL du spawter (comme le recompute 0025).
-- Chaque valeur est NULL sous 3 événements (anti-réidentification, cf. header).
CREATE VIEW public.b2b_place_stats_monthly AS
  SELECT
    sc.place_id,
    date_trunc('month', sc.arrived_at AT TIME ZONE 'UTC')::date AS month,
    CASE WHEN count(*) FILTER (WHERE sc.is_verified) >= 3
         THEN count(*) FILTER (WHERE sc.is_verified) END        AS spawts_verifies,
    CASE WHEN count(*) FILTER (WHERE sc.note_etoiles IS NOT NULL) >= 3
         THEN count(*) FILTER (WHERE sc.note_etoiles IS NOT NULL) END AS avis,
    CASE WHEN count(*) FILTER (WHERE sc.note_etoiles IS NOT NULL) >= 3
         THEN round((
           sum(sc.note_etoiles * CASE s.stade
                 WHEN 'explorateur' THEN 1.5
                 WHEN 'detective'   THEN 2.0
                 WHEN 'djidji'      THEN 2.5
                 WHEN 'guide'       THEN 3.0
                 ELSE 1.0 END) FILTER (WHERE sc.note_etoiles IS NOT NULL)
           / nullif(sum(CASE s.stade
                 WHEN 'explorateur' THEN 1.5
                 WHEN 'detective'   THEN 2.0
                 WHEN 'djidji'      THEN 2.5
                 WHEN 'guide'       THEN 3.0
                 ELSE 1.0 END) FILTER (WHERE sc.note_etoiles IS NOT NULL), 0)
         )::numeric, 1) END                                     AS note_moyenne_ponderee
  FROM public.spawt_checkin sc
  JOIN public.spawters s ON s.id = sc.spawter_id
  WHERE sc.is_seed = false
    AND sc.is_cancelled = false
    AND sc.deleted_at IS NULL
    -- Gate par ligne : seul le B2B actif de CE lieu (ou le staff) matérialise
    -- des lignes — pour tout autre caller la vue est vide.
    AND (public.is_b2b_of(sc.place_id) OR public.is_active_staff())
  GROUP BY sc.place_id, date_trunc('month', sc.arrived_at AT TIME ZONE 'UTC')::date;

COMMENT ON VIEW public.b2b_place_stats_monthly IS
  'Dashboard B2B (roles pro + gold) : agrégats mensuels du lieu du caller. '
  'Valeurs NULL sous 3 événements — anti-réidentification, jamais de détail '
  'individuel.';

-- ━━━ Vue : b2b_place_funnel (réservée role gold) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Funnel découverte → action depuis user_signals (0003) : vues de fiche,
-- sauvegardes, partages, spawts — par mois. Même seuil n>=3 → NULL.
CREATE VIEW public.b2b_place_funnel AS
  SELECT
    us.place_id,
    date_trunc('month', us.created_at AT TIME ZONE 'UTC')::date AS month,
    CASE WHEN count(*) FILTER (WHERE us.signal_type = 'view') >= 3
         THEN count(*) FILTER (WHERE us.signal_type = 'view') END  AS views,
    CASE WHEN count(*) FILTER (WHERE us.signal_type = 'save') >= 3
         THEN count(*) FILTER (WHERE us.signal_type = 'save') END  AS saves,
    CASE WHEN count(*) FILTER (WHERE us.signal_type = 'share') >= 3
         THEN count(*) FILTER (WHERE us.signal_type = 'share') END AS shares,
    CASE WHEN count(*) FILTER (WHERE us.signal_type = 'spawt') >= 3
         THEN count(*) FILTER (WHERE us.signal_type = 'spawt') END AS spawts
  FROM public.user_signals us
  WHERE us.place_id IS NOT NULL
    -- Funnel = donnée premium : réservé au role gold (et au staff).
    AND (public.is_b2b_gold_of(us.place_id) OR public.is_active_staff())
  GROUP BY us.place_id, date_trunc('month', us.created_at AT TIME ZONE 'UTC')::date;

COMMENT ON VIEW public.b2b_place_funnel IS
  'Funnel signaux du lieu (role GOLD only — is_b2b_gold_of). Agrégats '
  'mensuels seuillés à n>=3, NULL sinon (anti-réidentification).';

-- Vues sensibles : pas de lecture anon (les authenticated non-B2B obtiennent
-- de toute façon un résultat vide via le gate).
REVOKE ALL ON public.b2b_place_stats_monthly FROM anon;
REVOKE ALL ON public.b2b_place_funnel        FROM anon;
GRANT SELECT ON public.b2b_place_stats_monthly TO authenticated;
GRANT SELECT ON public.b2b_place_funnel        TO authenticated;

-- ━━━ Row-Level Security : b2b_accounts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.b2b_accounts ENABLE ROW LEVEL SECURITY;

-- Le compte B2B lit sa propre fiche (login panel pro).
CREATE POLICY b2b_accounts_select_own ON public.b2b_accounts
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Staff actif : lecture ; gestion via service_role (contrats = commercial).
CREATE POLICY b2b_accounts_select_staff ON public.b2b_accounts
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- ━━━ Policy différée de 0042 : le lieu lit SES demandes de réservation ━━━━━━━
CREATE POLICY reservation_requests_select_b2b ON public.reservation_requests
  FOR SELECT TO authenticated
  USING (public.is_b2b_of(place_id));
