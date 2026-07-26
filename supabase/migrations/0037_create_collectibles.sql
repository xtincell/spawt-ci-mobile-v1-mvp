-- ============================================================================
-- Migration 0037 — Cartes collector (collectibles)
-- ============================================================================
-- Collection de cartes façon TCG : archétypes (héritage quiz La Meute),
-- plats, lieux, événements. Le seed pose les 13 cartes archétype avec les
-- codes ET les raretés EXACTS du quiz (spawt-meute-quiz/public/jeu.html,
-- const ARCHETYPES) — la carte reçue dans l'app est celle révélée au quiz.
-- Attribution automatique : quand claim_meute_heritage (0033) pose
-- spawters.quiz_archetype, le trigger dépose la carte correspondante.
-- Date : 2026-07-26

-- ━━━ Table : collectible_cards (catalogue) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.collectible_cards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  kind       text NOT NULL
               CHECK (kind IN ('archetype','plat','lieu','evenement')),
  rarity     text NOT NULL
               CHECK (rarity IN ('commun','rare','epique','legendaire')),
  title      text NOT NULL,
  -- Chemin relatif dans le bucket assets (ex: archetypes/omnivore.webp) —
  -- l'app préfixe par son CDN/bucket, la base ne fige pas de domaine.
  image_url  text,
  verso_text text,
  is_active  boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.collectible_cards IS
  'Catalogue des cartes collector. kind=archetype : codes/raretés = quiz La '
  'Meute (jeu.html ARCHETYPES). Écriture service_role only.';

-- ━━━ Table : spawter_cards (collection du spawter) ━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.spawter_cards (
  spawter_id  uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  card_id     uuid NOT NULL REFERENCES public.collectible_cards(id)
                ON DELETE CASCADE,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL
                CHECK (source IN ('spawt','badge','defi','heritage_quiz','admin')),
  PRIMARY KEY (spawter_id, card_id)
);

COMMENT ON TABLE public.spawter_cards IS
  'Cartes obtenues par spawter (mémoire d''identité — jamais retirées). '
  'source trace le chemin d''obtention.';

CREATE INDEX spawter_cards_card_idx ON public.spawter_cards (card_id);

-- ━━━ Attribution : carte archétype à l'héritage quiz ━━━━━━━━━━━━━━━━━━━━━━━━
-- Déclenchée quand quiz_archetype est posé (claim_meute_heritage 0033, ou
-- backfill admin). Idempotente via ON CONFLICT (PK).
CREATE OR REPLACE FUNCTION public.award_archetype_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.spawter_cards (spawter_id, card_id, source)
  SELECT NEW.id, c.id, 'heritage_quiz'
  FROM public.collectible_cards c
  WHERE c.kind = 'archetype'
    AND c.code = NEW.quiz_archetype
    AND c.is_active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_archetype_card_insert
  AFTER INSERT ON public.spawters
  FOR EACH ROW
  WHEN (NEW.quiz_archetype IS NOT NULL)
  EXECUTE FUNCTION public.award_archetype_card();

CREATE TRIGGER trg_award_archetype_card_update
  AFTER UPDATE OF quiz_archetype ON public.spawters
  FOR EACH ROW
  WHEN (NEW.quiz_archetype IS NOT NULL
        AND NEW.quiz_archetype IS DISTINCT FROM OLD.quiz_archetype)
  EXECUTE FUNCTION public.award_archetype_card();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.collectible_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spawter_cards     ENABLE ROW LEVEL SECURITY;

-- Catalogue : lisible par les authentifiés (affichage recto/verso + « cartes
-- à découvrir »).
CREATE POLICY collectible_cards_select_all ON public.collectible_cards
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY spawter_cards_select_own ON public.spawter_cards
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

CREATE POLICY spawter_cards_select_staff ON public.spawter_cards
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- Pas de policy INSERT/UPDATE/DELETE : attribution par triggers SECURITY
-- DEFINER + service_role uniquement.

-- ━━━ Seed : 13 cartes archétype (codes + raretés du quiz) ━━━━━━━━━━━━━━━━━━━
-- Source : spawt-meute-quiz/public/jeu.html — const ARCHETYPES.
-- verso_text = motto du quiz. image_url = assets du quiz (archetypes/<code>.webp).
INSERT INTO public.collectible_cards (code, kind, rarity, title, image_url, verso_text)
VALUES
  ('omnivore',  'archetype', 'legendaire', 'Omnivore',          'archetypes/omnivore.webp',  'Mange tout. Juge tout. N''appartient à aucune case.'),
  ('gardien',   'archetype', 'commun',     'Gardien du Maquis', 'archetypes/gardien.webp',   'Pourquoi chercher ailleurs quand tu as trouvé le bon ?'),
  ('ancre',     'archetype', 'commun',     'Ancre Fidèle',      'archetypes/ancre.webp',     'La fidélité est une forme d''expertise.'),
  ('bouchedor', 'archetype', 'rare',       'Bouche d''Or',      'archetypes/bouchedor.webp', 'Le palais n''a pas de frontières, mais il a des standards.'),
  ('braise',    'archetype', 'rare',       'Feu de Braise',     'archetypes/braise.webp',    'Manger seul c''est se nourrir. Ensemble, c''est vivre.'),
  ('memoire',   'archetype', 'rare',       'Mémoire Vive',      'archetypes/memoire.webp',   'Le vrai goût ne se réinvente pas. Il se transmet.'),
  ('pisteur',   'archetype', 'rare',       'Pisteur de Rue',    'archetypes/pisteur.webp',   'Le nez au vent, les pieds dans la poussière.'),
  ('vent',      'archetype', 'epique',     'Vent d''Ailleurs',  'archetypes/vent.webp',      'Chaque assiette est un billet d''avion.'),
  ('fantome',   'archetype', 'epique',     'Fantôme Furtif',    'archetypes/fantome.webp',   'Tu ne le trouves pas. C''est lui qui te trouve.'),
  ('murmure',   'archetype', 'legendaire', 'Murmure de Cour',   'archetypes/murmure.webp',   'Les meilleurs spots ne sont pas sur Google.'),
  ('oeil',      'archetype', 'epique',     'Œil de Chat',       'archetypes/oeil.webp',      'Si c''est moyen, ça n''existe pas.'),
  ('lame',      'archetype', 'legendaire', 'Fine Lame',         'archetypes/lame.webp',      'Le détail sépare le bon du mémorable.'),
  ('passeport', 'archetype', 'epique',     'Passeport Doré',    'archetypes/passeport.webp', 'La grande table n''a pas de nationalité.')
ON CONFLICT (code) DO NOTHING;
