-- ============================================================================
-- Migration 0060 — comptes internes : voir l'app comme un gratuit ET comme un Gold
-- ============================================================================
-- Besoin : Stéphanie (et l'équipe) doit pouvoir basculer, depuis SES réglages
-- dans l'app, entre l'expérience gratuite et l'expérience Spawter Gold — pour
-- vérifier de ses yeux ce que le paywall géographique (rayon gratuit 3 km,
-- PRD F14) change à l'écran, sans payer et sans deuxième téléphone.
--
-- ── Pourquoi ça ne pouvait pas passer par `spawt_staff` ─────────────────────
-- La migration 0001 pose une séparation dure (amendement 4.1) : « un humain
-- qui est à la fois spawter ET staff doit avoir 2 comptes auth.users
-- distincts ». Le compte de la console admin est un compte e-mail ; le compte
-- de l'app est un compte téléphone, avec un `auth.uid()` différent. Le statut
-- staff ne traverse donc pas, et c'est VOULU : on ne veut pas qu'une session
-- mobile perdue ouvre la modération.
--   → On introduit un statut distinct et beaucoup plus étroit, porté par le
--     compte APP : `spawters.is_internal`. Il n'ouvre aucune donnée d'autrui,
--     aucune écriture privilégiée. Il déverrouille uniquement un menu de
--     présentation dans les réglages de l'app.
--
-- ── Pourquoi une colonne ne suffit pas ─────────────────────────────────────
-- La policy `spawters_update_own` (0001) autorise un spawter à mettre à jour
-- sa propre ligne — toutes colonnes comprises. Posée naïvement, `is_internal`
-- serait donc auto-attribuable par n'importe qui avec la clé anon et un
-- PATCH. Pire : l'app fait des `upsert(spawter)` de la ligne ENTIÈRE à chaque
-- sauvegarde, donc une copie locale périmée écraserait un octroi légitime.
--   → Deux triggers ferment les deux trous :
--       * à l'INSERT, la valeur est imposée par le serveur depuis une liste
--         d'autorisation de numéros — le client ne la choisit jamais ;
--       * à l'UPDATE, un changement non privilégié est SILENCIEUSEMENT
--         ignoré (on restaure l'ancienne valeur) plutôt que rejeté : lever une
--         erreur casserait toutes les sauvegardes normales de l'app, qui
--         réécrivent la ligne complète en toute innocence.
--
-- ── Ce que ça n'est pas ─────────────────────────────────────────────────────
-- Ce n'est PAS un contournement d'abonnement. Le paywall géographique est un
-- nudge côté client par conception (PRD F14 : « pas un mur infranchissable » —
-- les lieux hors rayon sont envoyés au client, seul leur nom est masqué). Un
-- basculement local ne déverrouille donc rien qui ne soit déjà sur l'appareil.
-- Tout ce qui a une vraie valeur (droit Gold facturé) reste tranché par la vue
-- serveur `active_entitlements`, que ce statut ne touche pas.
-- Date : 2026-07-28

-- ━━━ 1. La liste d'autorisation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Amorçage : un compte interne doit pouvoir être désigné AVANT sa première
-- connexion (personne ne peut « attraper » le moment de l'inscription pour
-- basculer un interrupteur). On autorise donc des numéros, pas des comptes.
CREATE TABLE IF NOT EXISTS public.internal_phone_allowlist (
  phone_e164  TEXT PRIMARY KEY CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  note        TEXT,
  granted_by  UUID REFERENCES public.spawt_staff(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.internal_phone_allowlist IS
  'Numéros dont le compte app reçoit `spawters.is_internal = true` à la '
  'création. Contient de la PII (téléphones de l''équipe) : RLS sans aucune '
  'policy + REVOKE, donc invisible depuis l''API publique. Alimentée par '
  'scripts/grant-internal.mjs (service_role) ou par un admin en SQL.';

ALTER TABLE public.internal_phone_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internal_phone_allowlist FROM PUBLIC, anon, authenticated;

-- ━━━ 2. La colonne ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.spawters
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.spawters.is_internal IS
  'Compte interne équipe SPAWT. Déverrouille le menu « Mode interne » des '
  'réglages de l''app (bascule gratuit/Gold simulé, aperçu du paywall géo, '
  'choix du scope des flags). N''accorde AUCUN accès aux données d''autrui et '
  'ne modifie aucun droit facturé. Non exposée par la vue `spawters_public`.';

-- Recherche des comptes internes depuis la console admin (peu de lignes, mais
-- l'index partiel coûte trois fois rien et évite un seq scan sur la table la
-- plus lue).
CREATE INDEX IF NOT EXISTS spawters_internal_idx
  ON public.spawters (id) WHERE is_internal;

-- ━━━ 3. À l'INSERT : la valeur vient du serveur, jamais du client ━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.spawters_set_internal_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER            -- doit lire la liste, fermée aux clients
SET search_path = public, pg_temp
AS $$
BEGIN
  -- On ignore délibérément ce que le client a envoyé : la seule source est la
  -- liste d'autorisation. Un compte qui s'inscrit en se déclarant interne
  -- retombe donc à `false` sans même le savoir.
  NEW.is_internal := EXISTS (
    SELECT 1 FROM public.internal_phone_allowlist a
     WHERE a.phone_e164 = NEW.phone_e164
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spawters_internal_on_insert ON public.spawters;
CREATE TRIGGER spawters_internal_on_insert
  BEFORE INSERT ON public.spawters
  FOR EACH ROW EXECUTE FUNCTION public.spawters_set_internal_on_insert();

-- ━━━ 4. À l'UPDATE : seul un privilégié peut changer la valeur ━━━━━━━━━━━━━
-- SECURITY INVOKER volontairement : on a besoin de savoir QUI appelle.
--   * `pg_has_role(..., 'service_role', 'MEMBER')` couvre le service_role de
--     PostgREST, le rôle `postgres` (superuser, donc membre de tout) et donc
--     aussi les appels faits DEPUIS une fonction SECURITY DEFINER comme
--     `set_spawter_internal` ci-dessous ;
--   * la lecture de `spawt_staff` passe par la policy `spawt_staff_select_own`
--     (0001) : un admin lit sa propre ligne, ce qui suffit à s'identifier.
CREATE OR REPLACE FUNCTION public.spawters_protect_internal_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_internal IS DISTINCT FROM OLD.is_internal THEN
    IF NOT (
      pg_has_role(current_user, 'service_role', 'MEMBER')
      OR EXISTS (
        SELECT 1 FROM public.spawt_staff s
         WHERE s.id = auth.uid() AND s.role = 'admin' AND s.is_active
      )
    ) THEN
      -- Restauration silencieuse, pas d'exception : l'app réécrit la ligne
      -- entière à chaque `saveSpawter`, une erreur ici casserait toutes les
      -- sauvegardes légitimes pour un champ que le client n'a jamais voulu
      -- toucher.
      NEW.is_internal := OLD.is_internal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spawters_internal_on_update ON public.spawters;
CREATE TRIGGER spawters_internal_on_update
  BEFORE UPDATE ON public.spawters
  FOR EACH ROW EXECUTE FUNCTION public.spawters_protect_internal_on_update();

-- ━━━ 5. L'octroi depuis la console admin ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Nouvelles actions auditées (le CHECK de 0017 est une liste fermée).
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'login',
    'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
    'place_adn_update',
    'review_keep', 'review_delete', 'review_warning',
    'spawter_warning', 'spawter_ban', 'spawter_unban',
    'seed_inventory_run',
    'spawter_internal_grant', 'spawter_internal_revoke'
  ));

CREATE OR REPLACE FUNCTION public.set_spawter_internal(
  p_spawter_id UUID,
  p_enabled    BOOLEAN,
  p_reason     TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff UUID := auth.uid();
  v_before BOOLEAN;
BEGIN
  IF NOT public.is_admin_staff(v_staff) THEN
    RAISE EXCEPTION 'forbidden: admin staff required' USING ERRCODE = '42501';
  END IF;

  SELECT is_internal INTO v_before FROM public.spawters WHERE id = p_spawter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'spawter introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_before IS NOT DISTINCT FROM p_enabled THEN
    RETURN p_enabled;   -- idempotent : rien à écrire, rien à auditer
  END IF;

  UPDATE public.spawters SET is_internal = p_enabled WHERE id = p_spawter_id;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
  VALUES (
    v_staff,
    CASE WHEN p_enabled THEN 'spawter_internal_grant' ELSE 'spawter_internal_revoke' END,
    'spawter', p_spawter_id,
    jsonb_build_object('is_internal', v_before),
    jsonb_build_object('is_internal', p_enabled),
    p_reason
  );

  RETURN p_enabled;
END;
$$;

COMMENT ON FUNCTION public.set_spawter_internal(UUID, BOOLEAN, TEXT) IS
  'Octroie/retire le statut de compte interne. Réservée aux admins actifs '
  '(garde interne + REVOKE anon), idempotente, journalisée dans '
  'admin_audit_log. Appelée par la page Comptes de la console admin.';

REVOKE ALL ON FUNCTION public.set_spawter_internal(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_spawter_internal(UUID, BOOLEAN, TEXT) TO authenticated;

-- Les fonctions de trigger n'ont rien à faire dans la surface d'API (0058).
REVOKE ALL ON FUNCTION public.spawters_set_internal_on_insert()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spawters_protect_internal_on_update()
  FROM PUBLIC, anon, authenticated;

-- ━━━ 6. Rattrapage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Un numéro peut être autorisé après coup : on aligne les comptes existants.
UPDATE public.spawters s
   SET is_internal = true
  FROM public.internal_phone_allowlist a
 WHERE a.phone_e164 = s.phone_e164
   AND NOT s.is_internal;
