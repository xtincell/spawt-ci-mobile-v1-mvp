-- ============================================================================
-- Migration 0036 — Badges : catalogue 32 badges + attribution automatique
-- ============================================================================
-- PRD §10.2 (les 5 badges canoniques) + extension « badges 30+ » (hors scope
-- V1, débloquée Sprint 2). Principes :
--   * badge_catalogue : data-driven — un badge = une condition typée + un
--     seuil. Ajouter un badge = 1 INSERT, pas une migration de code.
--   * Toutes les strings passent par i18n (title_key/description_key) —
--     cohérent 0014 collection_titres.
--   * check_and_award_badges() évalue les conditions CALCULABLES EN SQL
--     (spawt_checkin, places, place_adn, saved_places, coups_de_coeur,
--     meute_waitlist via héritage 0033). Les types 'custom' et
--     'defis_completes' ne sont PAS évalués ici : attribution par Edge
--     Function/service_role ('custom') ou par le moteur de défis 0040
--     (les tables challenges n'existent pas encore à cette migration).
--   * Jamais de classement : les badges sont une collection personnelle
--     (Contrat SPAWT — aucun palmarès comparatif, jamais).
-- Date : 2026-07-26

-- ━━━ Table : badge_catalogue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.badge_catalogue (
  code            text PRIMARY KEY,
  category        text NOT NULL
                    CHECK (category IN ('exploration','expertise','influence','core')),
  title_key       text NOT NULL,
  description_key text NOT NULL,
  condition_type  text NOT NULL
                    CHECK (condition_type IN (
                      'communes_distinctes','spawts_apres_21h','lieux_peu_avises',
                      'types_cuisine','avis_sauvegardes','spawts_total','avis_total',
                      'premier_spawt','coups_de_coeur_recus','spawts_weekend',
                      'lieux_nouveaux_30j','photos_publiees','parrainages',
                      'defis_completes','custom')),
  threshold       integer CHECK (threshold IS NULL OR threshold > 0),
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer
);

COMMENT ON TABLE public.badge_catalogue IS
  'Catalogue des badges (PRD §10.2 + extension Sprint 2). Un badge = condition '
  'typée + seuil. condition_type=custom : attribution service_role uniquement.';

-- ━━━ Table : spawter_badges ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.spawter_badges (
  spawter_id   uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  badge_code   text NOT NULL REFERENCES public.badge_catalogue(code)
                 ON DELETE CASCADE,
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  is_displayed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (spawter_id, badge_code)
);

COMMENT ON TABLE public.spawter_badges IS
  'Badges débloqués (mémoire d''identité, comme collection_titres 0014). '
  'Le spawter choisit jusqu''à 3 badges affichés (is_displayed, trigger).';

CREATE INDEX spawter_badges_spawter_idx ON public.spawter_badges (spawter_id);

-- ━━━ Contrainte : max 3 badges affichés par spawter ━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.assert_max_displayed_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_displayed
     AND (SELECT count(*) FROM public.spawter_badges b
          WHERE b.spawter_id = NEW.spawter_id
            AND b.is_displayed = true
            AND b.badge_code <> NEW.badge_code) >= 3 THEN
    RAISE EXCEPTION 'spawter_badges : maximum 3 badges affichés par spawter'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_max_displayed_badges
  BEFORE INSERT OR UPDATE OF is_displayed ON public.spawter_badges
  FOR EACH ROW
  WHEN (NEW.is_displayed)
  EXECUTE FUNCTION public.assert_max_displayed_badges();

-- ━━━ Column-level guard : le client ne touche QUE is_displayed ━━━━━━━━━━━━━━
-- Pattern 0023 : la RLS UPDATE own est trop large (elle autoriserait un
-- UPDATE de unlocked_at) → un BEFORE trigger rejette toute modification
-- d'autre colonne quand le caller n'est pas service_role.
CREATE OR REPLACE FUNCTION public.assert_spawter_badges_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  IF v_role = 'service_role' THEN RETURN NEW; END IF;

  IF NEW.spawter_id  IS DISTINCT FROM OLD.spawter_id
     OR NEW.badge_code  IS DISTINCT FROM OLD.badge_code
     OR NEW.unlocked_at IS DISTINCT FROM OLD.unlocked_at THEN
    RAISE EXCEPTION 'spawter_badges : seul is_displayed est modifiable côté client'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_spawter_badges_columns
  BEFORE UPDATE ON public.spawter_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_spawter_badges_update_columns();

-- ━━━ Moteur : check_and_award_badges ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Évalue toutes les métriques calculables en une passe, compare aux seuils du
-- catalogue, insère les badges gagnés (ON CONFLICT DO NOTHING — un badge n'est
-- jamais retiré ni re-gagné) et RETOURNE uniquement les NOUVEAUX codes (pour
-- l'écran « badge débloqué ! » côté app).
-- SECURITY DEFINER : le client n'a pas de droit INSERT sur spawter_badges.
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_spawter_id uuid)
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m jsonb;
  v_badge RECORD;
  v_value integer;
  v_inserted text;
BEGIN
  -- Garde-fou : un client authentifié ne déclenche l'évaluation QUE pour son
  -- propre compte (auth.uid() NULL = service_role/trigger interne → autorisé).
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM p_spawter_id
     AND NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'check_and_award_badges forbidden: spawter_id mismatch auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- Une seule passe de calcul des métriques. Base : spawts VÉRIFIÉS, hors
  -- seed / annulés / soft-deleted (mêmes exclusions que 0025).
  WITH spawts AS (
    SELECT sc.*, p.neighborhood, p.cuisine, p.created_at AS place_created_at
    FROM public.spawt_checkin sc
    JOIN public.places p ON p.id = sc.place_id
    WHERE sc.spawter_id = p_spawter_id
      AND sc.is_verified = true
      AND sc.is_seed = false
      AND sc.is_cancelled = false
      AND sc.deleted_at IS NULL
  ),
  avis AS (
    SELECT sc.* FROM public.spawt_checkin sc
    WHERE sc.spawter_id = p_spawter_id
      AND sc.note_etoiles IS NOT NULL
      AND sc.is_seed = false
      AND sc.is_cancelled = false
      AND sc.deleted_at IS NULL
  )
  SELECT jsonb_build_object(
    'spawts_total',        (SELECT count(*) FROM spawts),
    'premier_spawt',       (SELECT count(*) FROM spawts),
    'communes_distinctes', (SELECT count(DISTINCT neighborhood) FROM spawts),
    -- Abidjan vit en UTC (GMT+0) : l'heure locale = l'heure UTC.
    'spawts_apres_21h',    (SELECT count(*) FROM spawts
                            WHERE extract(hour FROM arrived_at AT TIME ZONE 'UTC') >= 21),
    'spawts_weekend',      (SELECT count(*) FROM spawts
                            WHERE extract(isodow FROM arrived_at AT TIME ZONE 'UTC') IN (6, 7)),
    -- « Pépite » = lieu encore peu avisé au moment de l'évaluation (<= 5 avis,
    -- seuil « ADN en construction » du PRD §6).
    'lieux_peu_avises',    (SELECT count(DISTINCT s.place_id) FROM spawts s
                            JOIN public.place_adn a ON a.place_id = s.place_id
                            WHERE a.total_reviews <= 5),
    'types_cuisine',       (SELECT count(DISTINCT c) FROM spawts s, unnest(s.cuisine) AS c),
    'avis_total',          (SELECT count(*) FROM avis),
    -- Lieu « nouveau » : spawté dans les 30 jours suivant sa création en base.
    'lieux_nouveaux_30j',  (SELECT count(DISTINCT place_id) FROM spawts
                            WHERE arrived_at < place_created_at + interval '30 days'),
    'photos_publiees',     (SELECT coalesce(sum(coalesce(array_length(photos, 1), 0)), 0) FROM avis),
    -- Influence : lieux que le spawter a avisés et que D'AUTRES ont sauvegardés.
    'avis_sauvegardes',    (SELECT count(*) FROM public.saved_places sv
                            WHERE sv.spawter_id <> p_spawter_id
                              AND sv.place_id IN (SELECT DISTINCT place_id FROM avis)),
    -- Influence : Coups de Cœur donnés par d'autres sur les lieux dont le
    -- spawter a publié le PREMIER avis (ses découvertes).
    'coups_de_coeur_recus', (SELECT count(*) FROM public.coups_de_coeur cdc
                             WHERE cdc.spawter_id <> p_spawter_id
                               AND cdc.place_id IN (
                                 SELECT sc.place_id FROM public.spawt_checkin sc
                                 WHERE sc.note_etoiles IS NOT NULL
                                   AND sc.is_seed = false AND sc.is_cancelled = false
                                   AND sc.deleted_at IS NULL
                                 GROUP BY sc.place_id
                                 HAVING (array_agg(sc.spawter_id ORDER BY sc.created_at))[1] = p_spawter_id)),
    -- Parrainage : referral_count maintenu par le quiz (héritage 0033).
    'parrainages',         coalesce((SELECT w.referral_count
                                     FROM public.spawters s
                                     JOIN public.meute_waitlist w ON w.referral_code = s.referral_code
                                     WHERE s.id = p_spawter_id), 0)
  ) INTO m;

  FOR v_badge IN
    SELECT code, condition_type, threshold
    FROM public.badge_catalogue
    WHERE is_active = true
      AND condition_type NOT IN ('custom', 'defis_completes')
  LOOP
    v_value := coalesce((m ->> v_badge.condition_type)::integer, 0);
    IF v_value >= coalesce(v_badge.threshold, 1) THEN
      INSERT INTO public.spawter_badges (spawter_id, badge_code)
      VALUES (p_spawter_id, v_badge.code)
      ON CONFLICT DO NOTHING
      RETURNING badge_code INTO v_inserted;
      IF v_inserted IS NOT NULL THEN
        RETURN NEXT v_inserted;
        v_inserted := NULL;
      END IF;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.check_and_award_badges(uuid) IS
  'Évalue les conditions de badges calculables en SQL et attribue les badges '
  'gagnés (ON CONFLICT DO NOTHING). Retourne les NOUVEAUX codes uniquement. '
  'custom/defis_completes : attribution externe (service_role / moteur 0040).';

GRANT EXECUTE ON FUNCTION public.check_and_award_badges(uuid) TO service_role;
-- L'app peut re-déclencher une évaluation pour SON compte (écran collection).
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges(uuid) FROM PUBLIC, anon;

-- ━━━ Trigger : évaluation au spawt vérifié ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.trg_check_badges_on_spawt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_seed OR NEW.is_cancelled OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.check_and_award_badges(NEW.spawter_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_badges_spawt_insert
  AFTER INSERT ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.is_verified)
  EXECUTE FUNCTION public.trg_check_badges_on_spawt();

CREATE TRIGGER trg_check_badges_spawt_verified
  AFTER UPDATE OF is_verified ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.is_verified AND NOT coalesce(OLD.is_verified, false))
  EXECUTE FUNCTION public.trg_check_badges_on_spawt();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.badge_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spawter_badges  ENABLE ROW LEVEL SECURITY;

-- Catalogue : lisible par tous les authentifiés (affichage collection,
-- y compris badges non encore gagnés « à débloquer »).
CREATE POLICY badge_catalogue_select_all ON public.badge_catalogue
  FOR SELECT TO authenticated
  USING (true);
-- Écriture catalogue : service_role only (seed + admin via Edge Function).

CREATE POLICY spawter_badges_select_own ON public.spawter_badges
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

-- UPDATE own : uniquement le toggle is_displayed (column-level trigger + max 3).
CREATE POLICY spawter_badges_update_own ON public.spawter_badges
  FOR UPDATE TO authenticated
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());

-- Staff actif : lecture (support).
CREATE POLICY spawter_badges_select_staff ON public.spawter_badges
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- Pas de policy INSERT/DELETE : attribution via check_and_award_badges
-- (SECURITY DEFINER) et service_role ; un badge ne se retire jamais.

-- ━━━ Seed : 32 badges ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Les 5 canoniques du PRD §10.2 (traversee, noctambule, chasseur_de_pepites,
-- palais_diversifie, eclaireur) + premier_spawt (0014 D4) + 26 badges
-- exploration/expertise/influence. i18n : badge.<code>.title / .description
-- (clés à créer dans app/src/i18n/fr.json quand l'écran collection arrive).
INSERT INTO public.badge_catalogue
  (code, category, title_key, description_key, condition_type, threshold, sort_order)
VALUES
  -- ── core ──────────────────────────────────────────────────────────────────
  ('premier_spawt',       'core',        'badge.premier_spawt.title',       'badge.premier_spawt.description',       'premier_spawt',        1,   1),
  -- ── exploration ──────────────────────────────────────────────────────────
  ('traversee',           'exploration', 'badge.traversee.title',           'badge.traversee.description',           'communes_distinctes',  5,  10),
  ('cartographe',         'exploration', 'badge.cartographe.title',         'badge.cartographe.description',         'communes_distinctes', 10,  11),
  ('maitre_des_communes', 'exploration', 'badge.maitre_des_communes.title', 'badge.maitre_des_communes.description', 'communes_distinctes', 13,  12),
  ('noctambule',          'exploration', 'badge.noctambule.title',          'badge.noctambule.description',          'spawts_apres_21h',    10,  13),
  ('chasseur_de_pepites', 'exploration', 'badge.chasseur_de_pepites.title', 'badge.chasseur_de_pepites.description', 'lieux_peu_avises',     5,  14),
  ('hors_des_sentiers',   'exploration', 'badge.hors_des_sentiers.title',   'badge.hors_des_sentiers.description',   'lieux_peu_avises',    15,  15),
  ('pionnier_commune',    'exploration', 'badge.pionnier_commune.title',    'badge.pionnier_commune.description',    'lieux_nouveaux_30j',   3,  16),
  ('marathon_maquis',     'exploration', 'badge.marathon_maquis.title',     'badge.marathon_maquis.description',     'spawts_total',        25,  17),
  ('semelles_de_feu',     'exploration', 'badge.semelles_de_feu.title',     'badge.semelles_de_feu.description',     'spawts_total',        75,  18),
  ('spawteur_du_weekend', 'exploration', 'badge.spawteur_du_weekend.title', 'badge.spawteur_du_weekend.description', 'spawts_weekend',      10,  19),
  ('leve_tot',            'exploration', 'badge.leve_tot.title',            'badge.leve_tot.description',            'custom',            NULL,  20),
  -- ── expertise ────────────────────────────────────────────────────────────
  ('palais_diversifie',   'expertise',   'badge.palais_diversifie.title',   'badge.palais_diversifie.description',   'types_cuisine',        5,  30),
  ('ambassadeur_cuisine', 'expertise',   'badge.ambassadeur_cuisine.title', 'badge.ambassadeur_cuisine.description', 'types_cuisine',       10,  31),
  ('calibre',             'expertise',   'badge.calibre.title',             'badge.calibre.description',             'avis_total',          10,  32),
  ('plume_du_palais',     'expertise',   'badge.plume_du_palais.title',     'badge.plume_du_palais.description',     'avis_total',          25,  33),
  ('voix_d_or',           'expertise',   'badge.voix_d_or.title',           'badge.voix_d_or.description',           'avis_total',          50,  34),
  ('oeil_de_braise',      'expertise',   'badge.oeil_de_braise.title',      'badge.oeil_de_braise.description',      'spawts_total',        50,  35),
  ('photographe_gourmand','expertise',   'badge.photographe_gourmand.title','badge.photographe_gourmand.description','photos_publiees',     10,  36),
  ('objectif_pepite',     'expertise',   'badge.objectif_pepite.title',     'badge.objectif_pepite.description',     'photos_publiees',     30,  37),
  ('gardien_du_garba',    'expertise',   'badge.gardien_du_garba.title',    'badge.gardien_du_garba.description',    'custom',            NULL,  38),
  ('fidele_au_poste',     'expertise',   'badge.fidele_au_poste.title',     'badge.fidele_au_poste.description',     'custom',            NULL,  39),
  -- ── influence ────────────────────────────────────────────────────────────
  ('eclaireur',           'influence',   'badge.eclaireur.title',           'badge.eclaireur.description',           'avis_sauvegardes',     5,  50),
  ('aimant',              'influence',   'badge.aimant.title',              'badge.aimant.description',              'coups_de_coeur_recus', 5,  51),
  ('coeur_de_la_meute',   'influence',   'badge.coeur_de_la_meute.title',   'badge.coeur_de_la_meute.description',   'coups_de_coeur_recus',15,  52),
  ('bouche_a_oreille',    'influence',   'badge.bouche_a_oreille.title',    'badge.bouche_a_oreille.description',    'parrainages',          3,  53),
  ('faiseur_de_pluie',    'influence',   'badge.faiseur_de_pluie.title',    'badge.faiseur_de_pluie.description',    'parrainages',         10,  54),
  ('voix_de_la_colonie',  'influence',   'badge.voix_de_la_colonie.title',  'badge.voix_de_la_colonie.description',  'parrainages',         25,  55),
  ('defi_releve',         'influence',   'badge.defi_releve.title',         'badge.defi_releve.description',         'defis_completes',      1,  56),
  ('pilier_de_colonie',   'influence',   'badge.pilier_de_colonie.title',   'badge.pilier_de_colonie.description',   'defis_completes',      5,  57),
  ('meneur_de_crew',      'influence',   'badge.meneur_de_crew.title',      'badge.meneur_de_crew.description',      'custom',            NULL,  58),
  ('murmure_urbain',      'influence',   'badge.murmure_urbain.title',      'badge.murmure_urbain.description',      'custom',            NULL,  59)
ON CONFLICT (code) DO NOTHING;
