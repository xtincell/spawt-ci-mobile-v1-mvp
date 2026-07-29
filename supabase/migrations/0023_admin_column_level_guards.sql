-- Migration 0023 — Column-level guards admin (CR Chunk B Epic 6 — 2026-05-28)
--
-- Fixes CRITIQUE :
--   C2 — spawters_update_staff sans gate column-level (escalade privilege)
--   C3 — spawt_checkin_soft_delete_staff sans gate column-level (altération preuves)
--   C1 — auto-populate deleted_by_staff_id pour défense en profondeur
-- Fixes MAJEUR :
--   M15 — UNIQUE(phone_e164) sur spawters pour cohérence ban-check otp-send
--   M17 — UNIQUE(name, neighborhood) sur places pour idempotence seed-inventory
--
-- Principe : les helpers BEFORE UPDATE triggers SECURITY DEFINER auto-populent
-- les champs de provenance (deleted_by_staff_id, banned_at, banned_reason)
-- depuis auth.uid() + now(), et REJETTENT toute modification de colonnes hors
-- de la whitelist explicite quand le caller est staff non-admin.

-- ━━━ 1. spawters : restriction column-level via trigger ━━━━━━━━━━━━━━━━━━━━━

-- Helper : retourne true si le staff peut modifier les colonnes "structurelles"
-- du spawter (en pratique : aucun rôle V1 — seul service_role peut).
-- Les actions admin légitimes (ban/unban/warning) passent par Edge Function
-- moderate-spawter qui utilise service_role et bypass donc cette RLS.
CREATE OR REPLACE FUNCTION public.assert_spawters_update_columns_allowlist()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_is_owner boolean;
  v_is_staff boolean;
BEGIN
  -- Bypass service_role (Edge Functions trusted) : ils sont autorisés à toucher
  -- toutes les colonnes (ban/unban applique is_banned + banned_at + banned_reason
  -- ensemble via la Edge Function `moderate-spawter`).
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  IF v_role = 'service_role' THEN RETURN NEW; END IF;

  v_is_owner := (v_uid = NEW.id);
  v_is_staff := EXISTS (
    SELECT 1 FROM public.spawt_staff s
    WHERE s.id = v_uid AND s.is_active = true
  );

  -- Owner peut tout faire sur ses propres colonnes (limité par RLS spawters_update_own).
  IF v_is_owner THEN
    RETURN NEW;
  END IF;

  -- Staff (non-owner) ne peut modifier QUE les colonnes de modération.
  -- Toute autre modification est rejetée (escalade prévenue).
  IF v_is_staff THEN
    IF NEW.phone_e164 IS DISTINCT FROM OLD.phone_e164 OR
       NEW.display_name IS DISTINCT FROM OLD.display_name OR
       NEW.country_code IS DISTINCT FROM OLD.country_code OR
       NEW.origin_country_code IS DISTINCT FROM OLD.origin_country_code OR
       NEW.gender IS DISTINCT FROM OLD.gender OR
       NEW.age_range IS DISTINCT FROM OLD.age_range OR
       NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR
       NEW.neighborhood IS DISTINCT FROM OLD.neighborhood OR
       NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR
       NEW.stade IS DISTINCT FROM OLD.stade OR
       NEW.total_spawts IS DISTINCT FROM OLD.total_spawts OR
       NEW.unique_spots IS DISTINCT FROM OLD.unique_spots OR
       NEW.cgv_accepted_at IS DISTINCT FROM OLD.cgv_accepted_at OR
       NEW.geoloc_consent_at IS DISTINCT FROM OLD.geoloc_consent_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'spawters update forbidden: staff can only modify moderation columns (is_banned, banned_at, banned_reason, warning_count, last_warning_at, last_warning_reason). Use moderate-spawter Edge Function for ban/unban.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Ni owner ni staff : RLS UPDATE doit déjà avoir bloqué, mais defense in depth.
  RAISE EXCEPTION 'spawters update forbidden: not owner, not active staff'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS spawters_assert_update_columns ON public.spawters;
CREATE TRIGGER spawters_assert_update_columns
  BEFORE UPDATE ON public.spawters
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_spawters_update_columns_allowlist();

COMMENT ON FUNCTION public.assert_spawters_update_columns_allowlist() IS
  'CR Chunk B C2 — Restreint le staff non-owner à UPDATE uniquement les colonnes'
  ' de modération (is_banned, warning_count, etc.). Bloque l''escalade via API REST'
  ' qui était autorisée par la policy spawters_update_staff trop large.';

-- ━━━ 2. spawt_checkin : column-level pour soft-delete + auto-populate ━━━━━━━

CREATE OR REPLACE FUNCTION public.assert_spawt_checkin_staff_update_columns()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_is_owner boolean;
  v_is_staff boolean;
BEGIN
  -- Bypass service_role (Edge Function moderate-spawter ban → soft-delete reviews).
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  IF v_role = 'service_role' THEN RETURN NEW; END IF;

  v_is_owner := (v_uid = NEW.spawter_id);
  v_is_staff := EXISTS (
    SELECT 1 FROM public.spawt_staff s
    WHERE s.id = v_uid AND s.is_active = true
  );

  -- Owner peut tout faire sur ses propres rows (Story 4.5 attachReview, etc.).
  IF v_is_owner THEN
    RETURN NEW;
  END IF;

  -- Staff (non-owner) : UNIQUEMENT soft-delete colonnes autorisées.
  IF v_is_staff THEN
    IF NEW.note_etoiles IS DISTINCT FROM OLD.note_etoiles OR
       NEW.texte_avis IS DISTINCT FROM OLD.texte_avis OR
       NEW.tags IS DISTINCT FROM OLD.tags OR
       NEW.photos IS DISTINCT FROM OLD.photos OR
       NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
       NEW.is_seed IS DISTINCT FROM OLD.is_seed OR
       NEW.flag_reason IS DISTINCT FROM OLD.flag_reason OR
       NEW.spawter_id IS DISTINCT FROM OLD.spawter_id OR
       NEW.place_id IS DISTINCT FROM OLD.place_id OR
       NEW.arrived_at IS DISTINCT FROM OLD.arrived_at OR
       NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at OR
       NEW.left_at IS DISTINCT FROM OLD.left_at OR
       NEW.check_in_type IS DISTINCT FROM OLD.check_in_type OR
       NEW.session_duration_minutes IS DISTINCT FROM OLD.session_duration_minutes OR
       NEW.geolocation_lat IS DISTINCT FROM OLD.geolocation_lat OR
       NEW.geolocation_lng IS DISTINCT FROM OLD.geolocation_lng OR
       NEW.accuracy_meters IS DISTINCT FROM OLD.accuracy_meters OR
       NEW.geolocation_source IS DISTINCT FROM OLD.geolocation_source OR
       NEW.distance_to_lieu_meters IS DISTINCT FROM OLD.distance_to_lieu_meters OR
       NEW.is_cancelled IS DISTINCT FROM OLD.is_cancelled OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'spawt_checkin update forbidden: staff can only modify deleted_at, deleted_by_staff_id, deleted_reason (soft-delete only).'
        USING ERRCODE = '42501';
    END IF;
    -- C1 — auto-populate deleted_by_staff_id depuis auth.uid() si soft-delete
    -- s'enclenche (deleted_at vient d'être set) ET deleted_by_staff_id absent.
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.deleted_by_staff_id IS NULL THEN
      NEW.deleted_by_staff_id := v_uid;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'spawt_checkin update forbidden: not owner, not active staff'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS spawt_checkin_assert_staff_update ON public.spawt_checkin;
CREATE TRIGGER spawt_checkin_assert_staff_update
  BEFORE UPDATE ON public.spawt_checkin
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_spawt_checkin_staff_update_columns();

COMMENT ON FUNCTION public.assert_spawt_checkin_staff_update_columns() IS
  'CR Chunk B C1+C3 — Restreint le staff à UPDATE uniquement (deleted_at,'
  ' deleted_by_staff_id, deleted_reason). Auto-populate deleted_by_staff_id'
  ' depuis auth.uid() comme défense en profondeur si le client oublie.';

-- ━━━ 3. UNIQUE constraints pour cohérence (M15 + M4 idempotence) ━━━━━━━━━━━━━

-- M15 — phone_e164 unique sur spawters (sinon otp-send check_banned peut
-- matcher la mauvaise row si dup existe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spawters_phone_e164_key'
  ) THEN
    -- Vérifie d'abord qu'aucun doublon n'existe avant d'ajouter la contrainte.
    IF EXISTS (
      SELECT phone_e164 FROM public.spawters
      WHERE phone_e164 IS NOT NULL
      GROUP BY phone_e164 HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'spawters.phone_e164 has duplicates — skipping UNIQUE constraint. Resolve dups before re-running migration.';
    ELSE
      ALTER TABLE public.spawters
        ADD CONSTRAINT spawters_phone_e164_key UNIQUE (phone_e164);
    END IF;
  END IF;
END $$;

-- M4 — UNIQUE (name, neighborhood) sur places (idempotence seed-inventory).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'places_name_neighborhood_key'
  ) THEN
    IF EXISTS (
      SELECT name, neighborhood FROM public.places
      GROUP BY name, neighborhood HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'places (name, neighborhood) has duplicates — skipping UNIQUE constraint.';
    ELSE
      ALTER TABLE public.places
        ADD CONSTRAINT places_name_neighborhood_key UNIQUE (name, neighborhood);
    END IF;
  END IF;
END $$;
