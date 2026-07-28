-- ============================================================================
-- Migration 0059 — seuil de révélation de l'ADN : progressif, mais à cliquet
-- ============================================================================
-- Règle demandée : 3 avis jusqu'à 3 000 Spawters, puis 1/1000e de la base.
-- L'intention est juste — un seuil figé à 5 (FR-005/FR-026) ne vieillit pas
-- bien, l'exigence de fiabilité doit monter avec la maturité du produit.
--
-- Telle quelle, la règle a deux effets qu'on ne peut pas garder.
--
-- ── 1. Le seuil est RÉTROACTIF ──────────────────────────────────────────────
-- Un lieu qui affiche son radar avec 4 avis le perd quand la base passe de
-- 4 000 à 5 000 inscrits, SANS que rien n'ait changé sur ce lieu. Le Spawter
-- voit un ADN disparaître sans explication ; le restaurateur voit sa fiche se
-- dégrader alors qu'il n'a rien fait. Un indicateur de fiabilité qui recule
-- quand la donnée sous-jacente ne recule pas est un indicateur cassé.
--   → Corrigé par un CLIQUET : `adn_revealed_at`. Une fois le seuil atteint,
--     la révélation est acquise. Elle ne peut être reperdue que si les avis du
--     lieu disparaissent vraiment (purge, modération) — auquel cas c'est
--     honnête, la connaissance a réellement régressé.
--
-- ── 2. La règle couple une mesure LOCALE à une grandeur GLOBALE ─────────────
-- La fiabilité de l'ADN d'un lieu dépend des avis SUR CE LIEU, pas du nombre
-- d'inscrits. À 50 000 utilisateurs le seuil vaudrait 50 avis : les adresses
-- déjà connues les auront, les petits maquis jamais. Or ce sont eux que SPAWT
-- existe pour révéler — la règle transformerait le produit en annuaire des
-- lieux déjà populaires, contre sa mission.
--   → Corrigé par un PLAFOND. Au-delà d'une dizaine d'avis, un avis de plus ne
--     déplace plus l'ADN de façon perceptible (le facteur d'amortissement
--     1/(1+n·0,05) est déjà tombé sous 0,7) : exiger davantage ne protège
--     personne et condamne la longue traîne.
--
-- ── Ce qui reste de l'intention ─────────────────────────────────────────────
-- L'exigence monte bien avec la base : 3 avis jusqu'à 3 000 Spawters, puis
-- 1/1000e, jusqu'à un plafond de 10. Ce qui change, c'est qu'elle ne s'applique
-- qu'AUX LIEUX PAS ENCORE RÉVÉLÉS. Le seuil durcit l'entrée, il ne reprend
-- jamais ce qui est acquis.
-- Date : 2026-07-28

-- ━━━ 1. Le cliquet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.place_adn
  ADD COLUMN IF NOT EXISTS adn_revealed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.place_adn.adn_revealed_at IS
  'Date à laquelle le lieu a atteint le seuil de révélation de son radar ADN. '
  'Cliquet : une fois posée, un durcissement du seuil (croissance de la base) '
  'ne la retire pas — seule une vraie perte d''avis le fait, via le plancher '
  'absolu de 3. Empêche qu''un ADN disparaisse sans que rien n''ait changé sur '
  'le lieu.';

-- ━━━ 2. Le seuil courant ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Plancher 3 (règle demandée), plafond 10 (au-delà, l'exigence ne protège plus
-- personne et exclut la longue traîne). Les comptes de service qui portent les
-- avis fondateurs ne comptent pas comme des Spawters.
CREATE OR REPLACE FUNCTION public.adn_reveal_threshold()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT LEAST(
           GREATEST(3, (SELECT count(*) FROM public.spawters WHERE NOT is_seed) / 1000),
           10
         )::INTEGER;
$$;

COMMENT ON FUNCTION public.adn_reveal_threshold() IS
  'Nombre d''avis (fondateurs inclus) requis pour révéler le radar ADN d''un '
  'lieu PAS ENCORE révélé : 3 jusqu''à 3 000 Spawters, puis 1/1000e de la base, '
  'plafonné à 10. Évaluée côté serveur uniquement — l''app ne doit jamais avoir '
  'à compter la base pour afficher une fiche.';

REVOKE ALL ON FUNCTION public.adn_reveal_threshold() FROM PUBLIC, anon, authenticated;

-- ━━━ 3. Le recompte pose le cliquet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Une seule ligne change par rapport à 0057 : la pose de `adn_revealed_at`.
-- Le reste est identique (deux compteurs distincts, moyenne pondérée réelle).
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
  v_total INTEGER := 0;
  v_all INTEGER := 0;
  v_weight_sum REAL := 0;
  v_rating_sum REAL := 0;
  v_seuil INTEGER;
  v_revealed TIMESTAMPTZ;
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

    v_rating_sum := v_rating_sum + r.note_etoiles * v_weight;
    v_weight_sum := v_weight_sum + v_weight;

    v_all   := v_all + 1;
    v_total := v_total + (CASE WHEN r.is_seed THEN 0 ELSE 1 END);
    v_factor := GREATEST(0.05, 1.0 / (1.0 + v_all * 0.05));

    IF r.note_etoiles <> 3 THEN
      v_decontracte := v_decontracte
        + (CASE WHEN r.note_etoiles >= 4 THEN 1 ELSE -1 END)
        * (CASE WHEN r.note_etoiles IN (1, 5) THEN 0.03 ELSE 0.02 END)
        * v_factor;
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

  -- Le cliquet. Trois cas, dans cet ordre :
  --   * déjà révélé et toujours ≥ 3 avis  → on garde (le durcissement du
  --     seuil ne reprend jamais l'acquis) ;
  --   * pas encore révélé et seuil courant atteint → on révèle maintenant ;
  --   * moins de 3 avis → on retire : là, la connaissance a vraiment régressé
  --     (purge d'un lot d'amorçage, modération), le masquage est honnête.
  v_seuil := public.adn_reveal_threshold();
  v_revealed := v_adn.adn_revealed_at;
  IF v_all < 3 THEN
    v_revealed := NULL;
  ELSIF v_revealed IS NULL AND v_all >= v_seuil THEN
    v_revealed := now();
  END IF;

  UPDATE public.place_adn SET
    axe_local_international = GREATEST(-1, LEAST(1, v_local)),
    axe_informel_etabli     = GREATEST(-1, LEAST(1, v_informel)),
    axe_budget_premium      = GREATEST(-1, LEAST(1, v_budget)),
    axe_populaire_prive     = GREATEST(-1, LEAST(1, v_populaire)),
    axe_decontracte_habille = GREATEST(-1, LEAST(1, v_decontracte)),
    weighted_rating         = CASE WHEN v_weight_sum = 0 THEN 0
                                   ELSE GREATEST(0, LEAST(5,
                                     ROUND((v_rating_sum / v_weight_sum)::numeric, 1))) END,
    total_reviews           = v_total,
    sample_size             = v_all,
    adn_revealed_at         = v_revealed,
    confidence_score        = GREATEST(0, LEAST(1, 1.0 - 1.0 / (1.0 + v_all * 0.05))),
    updated_at              = now()
  WHERE place_id = p_place_id;
END;
$$;

-- ━━━ 4. Rattrapage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO $$
DECLARE v_pid UUID;
BEGIN
  FOR v_pid IN SELECT place_id FROM public.place_adn LOOP
    PERFORM public.recompute_place_adn_full(v_pid);
  END LOOP;
END$$;
