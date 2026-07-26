-- ============================================================================
-- Migration 0049 — Événements de lieux + outillage console admin
-- ============================================================================
-- Un lieu annonce un événement ponctuel (soirée braisé, live, dégustation…) ;
-- le staff le saisit dans la console admin (draft → publish, même modèle que
-- places.is_published 0010 et explore_collections 0045). Côté app, la Meute
-- ne voit QUE les événements publiés encore d'actualité (à venir ou en cours).
--
-- Cette migration porte aussi l'outillage nécessaire à la console admin
-- complète (chantier 07/2026), pour éviter trois micro-migrations :
--   2. Vue admin_waitlist_stats — agrégats de meute_waitlist (0033) pour la
--      page Métriques. La table est deny-all pour authenticated (PII phone/
--      email) : la vue « definer » n'expose AUCUNE ligne brute, uniquement
--      des comptages, gatés is_admin_staff() (pattern vues definer 0043).
--   3. Policies INSERT/UPDATE staff admin sur b2b_accounts (0043) — la page
--      Comptes B2B de la console lie/délie les comptes sans service_role
--      côté client (même principe que 0018 pour places).
--   4. Extension du CHECK admin_audit_log (remplace celui de 0047, strict
--      sur-ensemble) : réintègre les actions historiques de la console déjà
--      émises par spawt-admin mais jamais ouvertes en base (login_failed,
--      report_kept/report_removed/report_warned + entity review_reports —
--      leurs INSERT best-effort échouaient silencieusement), et ouvre le CRUD
--      complet de la curation Explore (explore_create/update/delete, entity
--      explore_item).
-- Date : 2026-07-26

-- ━━━ 1. Table : place_events ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.place_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (length(trim(title)) > 0),
  description  text,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,
  image_url    text,
  is_published boolean NOT NULL DEFAULT false,
  -- Auteur staff (traçabilité éditoriale) — pas de FK spawt_staff : un import
  -- service_role futur ne doit pas être bloqué, l'audit trail vit dans
  -- admin_audit_log (0017).
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE public.place_events IS
  'Événements ponctuels d''un lieu, saisis par le staff (console admin). '
  'Brouillon tant que is_published=false ; côté app, seuls les publiés '
  'encore d''actualité sont visibles (RLS).';

CREATE INDEX place_events_place_starts_idx
  ON public.place_events (place_id, starts_at);

CREATE TRIGGER update_timestamp_place_events
  BEFORE UPDATE ON public.place_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.place_events ENABLE ROW LEVEL SECURITY;

-- La Meute (authentifiés) : événements publiés À VENIR ou EN COURS uniquement
-- (un événement passé n'a plus rien à dire sur la fiche lieu).
CREATE POLICY place_events_select_published ON public.place_events
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND coalesce(ends_at, starts_at) >= now()
  );

-- Staff actif : lecture complète (brouillons + passés — historique console).
CREATE POLICY place_events_select_staff ON public.place_events
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- CRUD : staff admin (décision publique — même niveau que explore 0045).
CREATE POLICY place_events_insert_admin ON public.place_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY place_events_update_admin ON public.place_events
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

CREATE POLICY place_events_delete_admin ON public.place_events
  FOR DELETE TO authenticated
  USING (public.is_admin_staff());

-- ━━━ 2. Vue : admin_waitlist_stats (agrégats meute_waitlist, staff admin) ━━━━
-- meute_waitlist (0033) est deny-all pour authenticated (PII phone/email +
-- accès réservé à la connexion pg directe du quiz). La page Métriques n'a
-- besoin QUE de comptages : vue « definer » (security_invoker = false, pattern
-- 0043) qui agrège en bypass RLS mais ne matérialise sa ligne que pour un
-- staff admin — aucun agrégat pour tout autre caller, et jamais de ligne brute.
-- NB : le gate enveloppe l'agrégation (et non un WHERE dans le FROM) — un
-- agrégat sans GROUP BY renvoie toujours 1 ligne même sur 0 rows, un
-- non-admin recevrait une ligne de zéros. Ici : 0 ligne pour tout non-admin.
CREATE VIEW public.admin_waitlist_stats
  WITH (security_invoker = false)
AS
  SELECT agg.*
  FROM (
    SELECT
      count(*)                                                          AS total_leads,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')  AS leads_30d,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')   AS leads_7d,
      count(*) FILTER (WHERE referred_by IS NOT NULL)                   AS leads_parraines
    FROM public.meute_waitlist
  ) agg
  WHERE public.is_admin_staff();

COMMENT ON VIEW public.admin_waitlist_stats IS
  'Agrégats waitlist La Meute pour la page Métriques admin (KPI Acquisition). '
  'Vue definer gatée is_admin_staff() : agrégats uniquement, jamais de PII — '
  'la table meute_waitlist reste deny-all pour authenticated (0033).';

REVOKE ALL ON public.admin_waitlist_stats FROM anon;
GRANT SELECT ON public.admin_waitlist_stats TO authenticated;

-- ━━━ 3. b2b_accounts : gestion par le staff admin (console Comptes B2B) ━━━━━━
-- 0043 ne posait que les SELECT (gestion via service_role envisagée) ; la
-- console admin lie/délie et active/désactive elle-même — staff admin only,
-- chaque action auditée (b2b_link/b2b_unlink) côté console.
CREATE POLICY b2b_accounts_insert_admin ON public.b2b_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY b2b_accounts_update_admin ON public.b2b_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

-- Pas de DELETE : on désactive (is_active=false), l'historique contractuel reste.

-- ━━━ 4. admin_audit_log : CHECK actions/entités (sur-ensemble strict de 0047) ━
-- Un CHECK se remplace par drop + add (pas d'ALTER direct). Sur-ensemble
-- strict : les lignes existantes restent valides par construction.
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'login',
  -- Console admin — tentatives de login échouées (émis par authProvider
  -- depuis Story 6.1, jamais ouvert en base jusqu'ici).
  'login_failed',
  'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
  'place_adn_update',
  'review_keep', 'review_delete', 'review_warning',
  -- Console admin — résolution des signalements (page Signalements, 0026).
  'report_kept', 'report_removed', 'report_warned',
  'spawter_warning', 'spawter_ban', 'spawter_unban',
  'seed_inventory_run',
  -- Push serveur (Edge push-send)
  'push_campaign',
  -- Console admin — événements & promotions de lieux
  'event_create', 'event_update', 'event_delete',
  'promo_create', 'promo_update', 'promo_delete',
  -- Console admin — défis collectifs
  'challenge_create', 'challenge_update',
  -- Console admin — suggestions de lieux (UGC)
  'suggestion_approve', 'suggestion_reject',
  -- Console admin — comptes B2B (lien lieu ↔ compte Pro/Gold)
  'b2b_link', 'b2b_unlink',
  -- Console admin — feature flags
  'flag_update',
  -- Console admin — curation Mode Explore (CRUD complet + publication)
  'explore_create', 'explore_update', 'explore_delete',
  'explore_publish', 'explore_unpublish'
));

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_entity_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check CHECK (entity_type IN (
  'place', 'place_adn', 'spawt_checkin', 'spawter', 'session', 'seed_batch',
  'review_reports',
  'push_campaign', 'place_event', 'place_promotion', 'challenge',
  'place_suggestion', 'b2b_account', 'feature_flag',
  'explore_collection', 'explore_item'
));
