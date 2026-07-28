-- ============================================================================
-- Migration 0054 — Avis d'amorçage : traçables, et surtout SUPPRIMABLES
-- ============================================================================
-- Le cahier prévoit explicitement des avis fondateurs (FR-032 : 3 par lieu,
-- 150-300 au lancement) pour éviter que 100 % des fiches affichent « ADN en
-- construction » à J0. Le marqueur existe depuis 0011 (`spawt_checkin.is_seed`)
-- et huit consommateurs le respectent. Le principe n'est donc pas en cause.
--
-- Trois défauts le sont :
--
-- 1. LE COMPTEUR NE PEUT PAS REDESCENDRE. La fonction 0025 fait
--    `total_reviews + 1` — un incrément, jamais un recompte — et il n'existe
--    aucun trigger sur DELETE, sur `deleted_at` ni sur `is_cancelled`.
--    Supprimer un avis laisse donc le compteur intact. Autrement dit, le jour
--    où l'on voudra retirer les avis d'amorçage parce que de vrais abonnés
--    sont arrivés, les nombres resteraient affichés. C'est le défaut central :
--    l'amorçage était une porte sans sortie.
--
-- 2. AUCUN LOT IDENTIFIABLE. `is_seed` est un booléen : impossible de retirer
--    « la campagne de juillet » sans toucher au reste.
--
-- 3. `spawters.is_seed` N'EXISTE PAS, alors que `seed-inventory/index.ts:155`
--    la lit. PostgREST rejette la colonne inconnue → la fonction sort en
--    404 SEED_SPAWTER_NOT_FOUND avant toute insertion. C'est l'explication
--    mécanique du « zéro avis en base » constaté malgré des compteurs à 87.
--
-- ── Ce que pose cette migration ─────────────────────────────────────────────
--   * `spawters.is_seed`            → débloque seed-inventory
--   * `spawt_checkin.seed_batch_id` → un lot par campagne, avec invariant
--   * `recompute_place_adn_full()`  → recompte depuis les lignes réelles
--   * triggers DELETE / soft-delete / annulation → le compteur redescend
--   * `purge_seed_reviews(lot)`     → la sortie de l'amorçage, en une commande
--   * colonnes `base_axe_*`         → l'ADN éditorial de départ, pour que le
--     recompte sache d'où repartir quand on retire des avis
-- Date : 2026-07-28

-- ━━━ 1. Le compte de service qui porte les avis d'amorçage ━━━━━━━━━━━━━━━━━
-- Sans cette colonne, seed-inventory échoue avant d'insérer quoi que ce soit.
-- Elle permet aussi d'exiger, à terme, qu'un avis fondateur ne porte JAMAIS le
-- nom d'affichage d'un vrai abonné (aujourd'hui la jointure `spawters_public`
-- afficherait le pseudo du compte utilisé pour le seed).
ALTER TABLE public.spawters
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.spawters.is_seed IS
  'Compte de service portant les avis fondateurs (FR-032). Jamais un vrai '
  'Spawter : sert à distinguer l''amorçage de la communauté, et attendu par '
  'la Edge Function seed-inventory.';

CREATE INDEX IF NOT EXISTS idx_spawters_is_seed
  ON public.spawters (is_seed) WHERE is_seed = true;

-- ━━━ 2. Le lot d'amorçage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- L'invariant est la pièce maîtresse : un avis marqué seed SANS lot serait
-- impossible à retirer sélectivement — exactement le piège qu'on ferme ici.
ALTER TABLE public.spawt_checkin
  ADD COLUMN IF NOT EXISTS seed_batch_id UUID;

-- Les avis d'amorçage déjà en base (il n'y en a aucun à ce jour, mais la
-- migration doit être rejouable sur un parc peuplé) sont rattachés à un lot
-- « historique » unique, pour satisfaire l'invariant posé juste après.
UPDATE public.spawt_checkin
   SET seed_batch_id = '00000000-0000-0000-0000-0000000000aa'
 WHERE is_seed = true AND seed_batch_id IS NULL;

ALTER TABLE public.spawt_checkin
  DROP CONSTRAINT IF EXISTS spawt_checkin_seed_batch_coherent;
ALTER TABLE public.spawt_checkin
  ADD CONSTRAINT spawt_checkin_seed_batch_coherent
  CHECK (is_seed = (seed_batch_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_spawt_checkin_seed_batch
  ON public.spawt_checkin (seed_batch_id) WHERE seed_batch_id IS NOT NULL;

COMMENT ON COLUMN public.spawt_checkin.seed_batch_id IS
  'Lot de la campagne d''amorçage qui a produit cet avis. NULL ⟺ avis de la '
  'communauté (invariant CHECK). Permet purge_seed_reviews(lot).';

-- Le staff ne doit pas pouvoir maquiller un avis communautaire en avis
-- fondateur (ni l'inverse) : 0023 verrouille déjà `is_seed`, on étend au lot.
-- La fonction de garde est recréée à l'identique avec la colonne en plus.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'spawt_checkin_staff_guard') THEN
    EXECUTE $g$
      CREATE OR REPLACE FUNCTION public.spawt_checkin_staff_guard()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = public, pg_temp AS $body$
      BEGIN
        IF current_setting('request.jwt.claims', true) IS NULL
           OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' THEN
          RETURN NEW;
        END IF;
        IF NEW.seed_batch_id IS DISTINCT FROM OLD.seed_batch_id THEN
          RAISE EXCEPTION 'spawt_checkin: seed_batch_id est immuable côté staff';
        END IF;
        RETURN NEW;
      END;
      $body$;
    $g$;
  END IF;
END$$;

-- ━━━ 3. L'ADN éditorial de départ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Les axes de `place_adn` sont mutés en place à chaque avis. Sans mémoire du
-- point de départ, un recompte « depuis les lignes réelles » n'a pas d'origine
-- où repartir : retirer des avis laisserait les axes qu'ils ont poussés.
-- On fige donc l'ADN saisi par l'équipe (CSV d'inventaire, console admin).
ALTER TABLE public.place_adn
  ADD COLUMN IF NOT EXISTS base_axe_local_international REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_axe_informel_etabli     REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_axe_budget_premium      REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_axe_populaire_prive     REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_axe_decontracte_habille REAL NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.place_adn.base_axe_local_international IS
  'ADN éditorial de départ (saisi par l''équipe). Les axes publics = cette '
  'base + l''accumulation des signaux d''avis. Le recompte repart d''ici.';

-- Initialisation : à ce stade les axes publics n'ont reçu aucun signal d'avis
-- (spawt_checkin est vide), ils SONT donc la base éditoriale.
UPDATE public.place_adn
   SET base_axe_local_international = axe_local_international,
       base_axe_informel_etabli     = axe_informel_etabli,
       base_axe_budget_premium      = axe_budget_premium,
       base_axe_populaire_prive     = axe_populaire_prive,
       base_axe_decontracte_habille = axe_decontracte_habille
 WHERE NOT EXISTS (SELECT 1 FROM public.spawt_checkin sc
                   WHERE sc.place_id = place_adn.place_id AND sc.note_etoiles IS NOT NULL);

-- ━━━ 4. Le recompte intégral ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Rejoue TOUS les avis valides du lieu, dans l'ordre d'arrivée, à partir de la
-- base éditoriale — mêmes formules que 0025, donc résultat identique sur un
-- historique inchangé, mais cette fois le compteur peut redescendre.
--
-- Le fait qu'il soit rejouable est ce qui rend l'amorçage réversible : purger
-- un lot puis recompter rend un état exactement équivalent à « ces avis n'ont
-- jamais existé ».
CREATE OR REPLACE FUNCTION public.recompute_place_adn_full(p_place_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adn public.place_adn%ROWTYPE;
  r RECORD;
  v_weight REAL; v_factor REAL; v_tag TEXT;
  v_local REAL; v_informel REAL; v_budget REAL; v_populaire REAL; v_decontracte REAL;
  v_total INTEGER := 0;      -- avis communautaires — le compteur public
  v_conf_total INTEGER := 0;  -- + avis fondateurs — la confiance
  v_rating REAL := 0;
  v_note_dir REAL; v_note_weight REAL;
BEGIN
  SELECT * INTO v_adn FROM public.place_adn WHERE place_id = p_place_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.place_adn (place_id) VALUES (p_place_id)
      ON CONFLICT (place_id) DO NOTHING;
    SELECT * INTO v_adn FROM public.place_adn WHERE place_id = p_place_id FOR UPDATE;
  END IF;

  v_local       := v_adn.base_axe_local_international;
  v_informel    := v_adn.base_axe_informel_etabli;
  v_budget      := v_adn.base_axe_budget_premium;
  v_populaire   := v_adn.base_axe_populaire_prive;
  v_decontracte := v_adn.base_axe_decontracte_habille;

  FOR r IN
    SELECT sc.note_etoiles, sc.tags, sc.is_seed,
           COALESCE(sp.stade, 'touriste') AS stade
      FROM public.spawt_checkin sc
      LEFT JOIN public.spawters sp ON sp.id = sc.spawter_id
     WHERE sc.place_id = p_place_id
       AND sc.note_etoiles IS NOT NULL
       AND sc.is_cancelled = false
       AND sc.deleted_at IS NULL
     ORDER BY sc.arrived_at, sc.id
  LOOP
    v_weight := CASE r.stade
      WHEN 'explorateur' THEN 1.5 WHEN 'detective' THEN 2.0
      WHEN 'djidji' THEN 2.5 WHEN 'guide' THEN 3.0 ELSE 1.0 END;

    -- Note pondérée : calculée AVANT d'incrémenter, comme dans 0025 où
    -- v_adn.total_reviews est l'état d'avant l'avis courant.
    IF v_total = 0 THEN
      v_rating := r.note_etoiles;
    ELSE
      v_rating := ROUND(((v_rating * v_total + r.note_etoiles * v_weight)
                         / (v_total + v_weight))::numeric, 1);
    END IF;

    -- Parité 0025 : un avis fondateur ne gonfle pas le compteur public,
    -- mais il nourrit la confiance et les axes.
    v_total      := v_total + (CASE WHEN r.is_seed THEN 0 ELSE 1 END);
    v_conf_total := v_total + (CASE WHEN r.is_seed THEN 1 ELSE 0 END);
    v_factor     := GREATEST(0.05, 1.0 / (1.0 + v_total * 0.05));

    IF r.note_etoiles <> 3 THEN
      v_note_dir    := CASE WHEN r.note_etoiles >= 4 THEN 1 ELSE -1 END;
      v_note_weight := CASE WHEN r.note_etoiles IN (1, 5) THEN 0.03 ELSE 0.02 END;
      v_decontracte := v_decontracte + v_note_dir * v_note_weight * v_factor;
    END IF;

    IF r.tags IS NOT NULL THEN
      FOREACH v_tag IN ARRAY r.tags LOOP
        CASE v_tag
          WHEN 'copieux' THEN
            v_informel := v_informel - 0.03 * v_factor;
            v_budget   := v_budget   - 0.02 * v_factor;
          WHEN 'rapide' THEN
            v_informel    := v_informel    - 0.03 * v_factor;
            v_decontracte := v_decontracte - 0.02 * v_factor;
          WHEN 'ambiance_top' THEN
            v_populaire   := v_populaire   - 0.03 * v_factor;
            v_decontracte := v_decontracte + 0.02 * v_factor;
          WHEN 'cher' THEN
            v_budget   := v_budget   + 0.04 * v_factor;
            v_informel := v_informel + 0.02 * v_factor;
          WHEN 'a_refaire' THEN
            v_populaire := v_populaire - 0.02 * v_factor;
          ELSE NULL;
        END CASE;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.place_adn SET
    axe_local_international = GREATEST(-1, LEAST(1, v_local)),
    axe_informel_etabli     = GREATEST(-1, LEAST(1, v_informel)),
    axe_budget_premium      = GREATEST(-1, LEAST(1, v_budget)),
    axe_populaire_prive     = GREATEST(-1, LEAST(1, v_populaire)),
    axe_decontracte_habille = GREATEST(-1, LEAST(1, v_decontracte)),
    weighted_rating         = GREATEST(0, LEAST(5, v_rating)),
    total_reviews           = v_total,
    confidence_score        = GREATEST(0, LEAST(1, 1.0 - 1.0 / (1.0 + v_conf_total * 0.05))),
    updated_at              = now()
  WHERE place_id = p_place_id;
END;
$$;

COMMENT ON FUNCTION public.recompute_place_adn_full(UUID) IS
  'Recompte l''ADN d''un lieu depuis ses avis réels, à partir de la base '
  'éditoriale. Mêmes formules que recompute_place_adn_on_review (0025), mais '
  'from scratch — donc le compteur peut redescendre. Appelée sur suppression, '
  'annulation et purge d''un lot d''amorçage.';

-- ━━━ 5. Les triggers qui manquaient ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0025 ne couvrait que l'ajout. Un avis supprimé, soft-supprimé ou annulé
-- laissait le compteur inchangé — un chiffre public que plus rien ne
-- justifiait. On ferme les trois portes.
CREATE OR REPLACE FUNCTION public.recompute_place_adn_on_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_place_adn_full(OLD.place_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_place_adn_full(NEW.place_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_place_adn_delete ON public.spawt_checkin;
CREATE TRIGGER trg_recompute_place_adn_delete
  AFTER DELETE ON public.spawt_checkin
  FOR EACH ROW
  WHEN (OLD.note_etoiles IS NOT NULL)
  EXECUTE FUNCTION public.recompute_place_adn_on_removal();

-- Soft-delete (modération) et annulation (anti-fraude) : mêmes conséquences
-- qu'une suppression du point de vue du compteur public.
DROP TRIGGER IF EXISTS trg_recompute_place_adn_softdelete ON public.spawt_checkin;
CREATE TRIGGER trg_recompute_place_adn_softdelete
  AFTER UPDATE OF deleted_at, is_cancelled ON public.spawt_checkin
  FOR EACH ROW
  WHEN (OLD.note_etoiles IS NOT NULL
        AND (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
             OR OLD.is_cancelled IS DISTINCT FROM NEW.is_cancelled))
  EXECUTE FUNCTION public.recompute_place_adn_on_removal();

-- Une note ÉDITÉE ne re-déclenchait rien (0025, parité client V1) : la note
-- affichée pouvait diverger de la note réelle. Le recompte règle le cas.
DROP TRIGGER IF EXISTS trg_recompute_place_adn_note_edit ON public.spawt_checkin;
CREATE TRIGGER trg_recompute_place_adn_note_edit
  AFTER UPDATE OF note_etoiles, tags ON public.spawt_checkin
  FOR EACH ROW
  WHEN (OLD.note_etoiles IS NOT NULL AND NEW.note_etoiles IS NOT NULL
        AND (OLD.note_etoiles IS DISTINCT FROM NEW.note_etoiles
             OR OLD.tags IS DISTINCT FROM NEW.tags))
  EXECUTE FUNCTION public.recompute_place_adn_on_removal();

-- ━━━ 6. La sortie de l'amorçage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Le jour où de vrais abonnés arrivent : une commande, lot par lot ou en bloc.
-- Le DELETE physique est sûr — `review_reports` est la seule clé étrangère
-- entrante sur spawt_checkin et elle est ON DELETE CASCADE (0026).
CREATE OR REPLACE FUNCTION public.purge_seed_reviews(
  p_batch UUID DEFAULT NULL,
  p_place_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL   -- qui l'a ordonnée ; NULL = script d'exploitation
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb;
  v_is_service BOOLEAN;
  v_places UUID[];
  v_deleted INTEGER;
  v_pid UUID;
BEGIN
  -- Réservée au service_role (Edge/admin) et au staff actif : supprimer des
  -- avis est irréversible, ce n'est pas une action de client mobile.
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_is_service := v_claims IS NULL OR (v_claims ->> 'role') = 'service_role';
  IF NOT v_is_service AND NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'purge_seed_reviews: réservé au staff' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(DISTINCT place_id) INTO v_places
    FROM public.spawt_checkin
   WHERE is_seed = true
     AND (p_batch IS NULL OR seed_batch_id = p_batch)
     AND (p_place_id IS NULL OR place_id = p_place_id);

  IF v_places IS NULL THEN
    RETURN jsonb_build_object('deleted', 0, 'places_recomputed', 0);
  END IF;

  DELETE FROM public.spawt_checkin
   WHERE is_seed = true
     AND (p_batch IS NULL OR seed_batch_id = p_batch)
     AND (p_place_id IS NULL OR place_id = p_place_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Le trigger DELETE recompte déjà ligne à ligne ; on repasse explicitement
  -- pour que le résultat soit garanti même si un trigger était désactivé.
  FOREACH v_pid IN ARRAY v_places LOOP
    PERFORM public.recompute_place_adn_full(v_pid);
  END LOOP;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_after, reason)
  VALUES (
    p_staff_id, 'seed_reviews_purge', 'seed_batch',
    COALESCE(p_batch, '00000000-0000-0000-0000-000000000000'),
    jsonb_build_object('deleted', v_deleted, 'places', array_length(v_places, 1),
                       'batch', p_batch, 'place_id', p_place_id),
    'sortie de l''amorçage — retrait des avis fondateurs'
  );

  RETURN jsonb_build_object('deleted', v_deleted, 'places_recomputed', array_length(v_places, 1));
END;
$$;

COMMENT ON FUNCTION public.purge_seed_reviews(UUID, UUID, UUID) IS
  'Retire les avis d''amorçage (tout, un lot, ou un lieu) et recompte l''ADN. '
  'C''est la sortie de l''amorçage prévue par FR-032 : les compteurs '
  'redescendent réellement. Réservée service_role / staff actif, journalisée.';

-- L'action de purge doit exister dans le journal d'audit, sinon l'INSERT
-- ci-dessus viole la contrainte et la purge échoue au dernier moment.
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'login','login_failed','place_create','place_update','place_delete',
    'place_publish_toggle','place_adn_update','review_keep','review_delete',
    'review_warning','report_kept','report_removed','report_warned',
    'spawter_warning','spawter_ban','spawter_unban','seed_inventory_run',
    'seed_reviews_purge','push_campaign','event_create','event_update',
    'event_delete','promo_create','promo_update','promo_delete',
    'challenge_create','challenge_update','suggestion_approve',
    'suggestion_reject','b2b_link','b2b_unlink','flag_update','explore_create',
    'explore_update','explore_delete','explore_publish','explore_unpublish'
  ]));

-- `spawt_staff_id` NULL devient légitime : une purge peut venir d'un script
-- d'exploitation en service_role, sans session de staff. Écrire l'identité
-- d'un staff qui n'a rien demandé serait pire qu'un NULL assumé — un journal
-- d'audit ne doit jamais mentir sur l'auteur d'une action.
ALTER TABLE public.admin_audit_log ALTER COLUMN spawt_staff_id DROP NOT NULL;

-- ━━━ 7. Assainissement : les compteurs redeviennent vrais ━━━━━━━━━━━━━━━━━━
-- `supabase/seed/places.sql` écrivait 12 compteurs en dur (28 à 156) SANS
-- insérer une seule ligne d'avis. Les fiches annonçaient « 87 avis » au-dessus
-- d'une liste vide. Le recompte remet chaque compteur en face de la réalité.
DO $$
DECLARE v_pid UUID;
BEGIN
  FOR v_pid IN SELECT place_id FROM public.place_adn LOOP
    PERFORM public.recompute_place_adn_full(v_pid);
  END LOOP;
END$$;
