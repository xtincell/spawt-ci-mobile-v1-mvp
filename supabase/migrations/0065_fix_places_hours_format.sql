-- ============================================================================
-- Migration 0065 — `places.hours` : remettre les horaires au format du contrat
-- ============================================================================
-- Trouvé en pilotant l'app au navigateur contre la base réelle, pas par les
-- tests. Symptôme à l'écran : « Aucun spot connu dans les 2 km autour de toi »
-- alors qu'un lieu publié se trouvait à 250 mètres.
--
-- Cause : le seed de la Mission 1 a écrit les horaires dans un format que
-- l'app n'accepte pas, sur deux points à la fois.
--
--   écrit par le seed          attendu par le contrat
--   ─────────────────────      ──────────────────────────────────
--   {"lun": [["11:00",         {"mon": [{"open": "11:00",
--             "15:00"]]}                  "close": "15:00"}]}
--
--   * clés de jours en français (lun, mar, mer, jeu, ven, sam, dim) là où le
--     schéma attend mon/tue/wed/thu/fri/sat/sun ;
--   * créneaux en couples de chaînes là où le schéma attend des objets
--     {open, close}.
--
-- Conséquence : la validation côté app rejetait CHAQUE lieu — pas le champ
-- `hours`, le lieu entier. `listPlaces()` renvoyait donc une liste vide, et
-- tout ce qui en découle (feed, bouton central, recherche, carte) était vide.
-- Silencieusement : le rejet n'est journalisé que sous `__DEV__`, donc jamais
-- dans un binaire distribué.
--
-- ── Pourquoi corriger la DONNÉE et pas le schéma ────────────────────────────
-- Le format mon/tue/… + {open, close} est celui qu'écrit la console admin
-- (`spawt-admin/src/types/place.schema.ts`) et celui que lit l'app. C'est le
-- contrat ; le seed était seul à en sortir. Élargir le schéma pour accepter les
-- deux formes reviendrait à accepter durablement deux vérités pour la même
-- donnée — et à devoir les gérer partout où on lit un horaire.
--
-- La conversion ne touche QUE les lignes encore dans l'ancien format : elle est
-- rejouable sans effet.
-- Date : 2026-07-29

CREATE OR REPLACE FUNCTION public.hours_to_canonical(p_hours JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_jour   TEXT;
  v_cle    TEXT;
  v_slots  JSONB;
  v_out    JSONB := '{}'::JSONB;
  v_slot   JSONB;
  v_liste  JSONB;
BEGIN
  IF p_hours IS NULL OR jsonb_typeof(p_hours) <> 'object' THEN
    RETURN p_hours;
  END IF;

  FOR v_jour, v_slots IN SELECT * FROM jsonb_each(p_hours) LOOP
    v_cle := CASE lower(v_jour)
      WHEN 'lun' THEN 'mon' WHEN 'mar' THEN 'tue' WHEN 'mer' THEN 'wed'
      WHEN 'jeu' THEN 'thu' WHEN 'ven' THEN 'fri' WHEN 'sam' THEN 'sat'
      WHEN 'dim' THEN 'sun'
      ELSE lower(v_jour)   -- déjà canonique (mon…sun) : on ne touche pas
    END;

    v_liste := '[]'::JSONB;
    IF jsonb_typeof(v_slots) = 'array' THEN
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) LOOP
        IF jsonb_typeof(v_slot) = 'array' AND jsonb_array_length(v_slot) >= 2 THEN
          -- ["11:00","15:00"] → {"open":"11:00","close":"15:00"}
          v_liste := v_liste || jsonb_build_array(jsonb_build_object(
            'open',  v_slot->>0,
            'close', v_slot->>1
          ));
        ELSE
          -- déjà un objet {open, close}, ou forme inconnue : on la laisse
          -- telle quelle plutôt que de fabriquer une donnée fausse.
          v_liste := v_liste || jsonb_build_array(v_slot);
        END IF;
      END LOOP;
    END IF;

    v_out := v_out || jsonb_build_object(v_cle, v_liste);
  END LOOP;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.hours_to_canonical(JSONB) IS
  'Normalise `places.hours` vers le contrat lu par l''app et écrit par la '
  'console : clés mon…sun et créneaux {open, close}. Idempotente — une valeur '
  'déjà canonique en ressort inchangée.';

REVOKE ALL ON FUNCTION public.hours_to_canonical(JSONB) FROM PUBLIC, anon, authenticated;

-- ━━━ Conversion des lignes encore dans l'ancien format ━━━━━━━━━━━━━━━━━━━━━
UPDATE public.places
   SET hours = public.hours_to_canonical(hours)
 WHERE hours IS NOT NULL
   AND (
     -- au moins une clé française…
     hours ?| ARRAY['lun','mar','mer','jeu','ven','sam','dim']
     -- …ou au moins un créneau encore en tableau
     OR EXISTS (
       SELECT 1
         FROM jsonb_each(hours) AS j(jour, slots)
        WHERE jsonb_typeof(slots) = 'array'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(slots) AS s(slot)
             WHERE jsonb_typeof(s.slot) = 'array'
          )
     )
   );

-- ━━━ Garde-fou : empêcher le format non canonique de revenir ━━━━━━━━━━━━━━━
-- Une contrainte plutôt qu'un commentaire : c'est un import ou un seed qui a
-- introduit l'écart, et un import recommence.
ALTER TABLE public.places DROP CONSTRAINT IF EXISTS places_hours_canonical;
ALTER TABLE public.places ADD CONSTRAINT places_hours_canonical CHECK (
  hours IS NULL
  OR NOT (hours ?| ARRAY['lun','mar','mer','jeu','ven','sam','dim'])
);

COMMENT ON COLUMN public.places.hours IS
  'Horaires JSONB. Contrat : clés mon|tue|wed|thu|fri|sat|sun, valeurs '
  '[{"open":"HH:MM","close":"HH:MM"}]. Un jour absent = fermé. ⚠️ Une clé de '
  'jour en français fait rejeter le LIEU ENTIER par la validation de l''app '
  '(pas seulement le champ) — d''où la contrainte places_hours_canonical.';
