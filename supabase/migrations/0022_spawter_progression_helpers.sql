-- Migration 0022 — Helpers spawter_progression (CR Chunk A Epic 5 — 2026-05-27)
-- Date: 2026-05-27
-- Contexte: Code review adversarial sweep sur Epic 5 (commit f009569) — applique
-- les fixes de findings M4 + D1 + D4.
--
-- 3 changements:
--   1. Backfill défensif spawter_progression pour spawters existants sans row
--      (M4 — sans ça, premier UPDATE client échoue silencieusement faute de row).
--   2. RPC PL/pgSQL atomique `set_displayed_title(spawter_id, title_key)` qui fait
--      le 2-step (reset + set) dans une transaction (D1 — sans ça, partial fail
--      laisse "0 titre affiché" côté serveur).
--   3. Clarification COMMENT sur spawter_progression.current_title pour acter la
--      sémantique (D4 — code client est now la source de vérité du titre affiché).

-- ━━━ 1. Backfill défensif (M4) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Crée une row spawter_progression pour tout spawter existant qui n'en a pas
-- (idempotent via ON CONFLICT DO NOTHING). Pas de touche aux progressions
-- existantes, donc safe rejouable.
INSERT INTO public.spawter_progression (spawter_id, unique_spots, stade, current_title, updated_at)
SELECT s.id, 0, 'touriste', 'title.touriste', now()
FROM public.spawters s
WHERE NOT EXISTS (
  SELECT 1 FROM public.spawter_progression p WHERE p.spawter_id = s.id
)
ON CONFLICT (spawter_id) DO NOTHING;

-- ━━━ 2. RPC PL/pgSQL atomique set_displayed_title (D1) ━━━━━━━━━━━━━━━━━━━━━
-- Remplace le 2-step client (reset is_displayed=false puis set is_displayed=true)
-- par une transaction atomique server-side. Le partial-fail entre les 2 steps
-- laissait potentiellement le serveur dans l'état "0 titre affiché" et pouvait
-- violer l'index unique partial collection_titres_one_displayed.
--
-- SECURITY INVOKER : la fonction tourne avec les permissions du caller, donc la
-- RLS de collection_titres (spawter_id = auth.uid()) s'applique. Pas de bypass.
CREATE OR REPLACE FUNCTION public.set_displayed_title(
  p_spawter_id uuid,
  p_title_key text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- Sanity : le caller ne peut affecter que ses propres titres (cohérent RLS).
  IF p_spawter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'set_displayed_title forbidden: spawter_id mismatch auth.uid()'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Le titre cible doit exister dans la collection (sinon on tenterait de
  -- flag is_displayed=true sur 0 row → no-op silencieux, indésirable).
  IF NOT EXISTS (
    SELECT 1 FROM public.collection_titres
    WHERE spawter_id = p_spawter_id AND title_key = p_title_key
  ) THEN
    RAISE EXCEPTION 'set_displayed_title forbidden: title_key not in collection'
      USING ERRCODE = '23503';  -- foreign_key_violation
  END IF;

  -- Transaction atomique : reset les autres + set la cible dans une seule unité.
  -- L'index unique partial collection_titres_one_displayed garantit qu'un seul
  -- row est is_displayed=true à tout instant — le reset PRÉCÈDE le set dans
  -- la même transaction, donc pas de collision.
  UPDATE public.collection_titres
  SET is_displayed = false
  WHERE spawter_id = p_spawter_id
    AND is_displayed = true
    AND title_key <> p_title_key;

  UPDATE public.collection_titres
  SET is_displayed = true
  WHERE spawter_id = p_spawter_id
    AND title_key = p_title_key
    AND is_displayed = false;  -- no-op si déjà true, évite write inutile

  -- Sync miroir sur spawter_progression.current_title (D4 — single source of
  -- truth = collection_titres.is_displayed, current_title est le miroir cached).
  UPDATE public.spawter_progression
  SET current_title = p_title_key,
      updated_at = now()
  WHERE spawter_id = p_spawter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_displayed_title(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.set_displayed_title(uuid, text) IS
  'Story 5.2 RPC atomique pour set displayed title. Remplace le 2-step client'
  ' qui pouvait laisser le serveur en "0 titre affiché" sur partial fail.'
  ' Sync aussi spawter_progression.current_title comme miroir cached.';

-- ━━━ 3. Clarification sémantique COMMENT sur current_title (D4) ━━━━━━━━━━━━
COMMENT ON COLUMN public.spawter_progression.current_title IS
  'I18n key du titre actuellement affiché (miroir de collection_titres.is_displayed).'
  ' Source de vérité = collection_titres.is_displayed=true ; current_title est le'
  ' cache snapshot pour query rapide sans JOIN. Sync via RPC set_displayed_title()'
  ' et via client store (registerSpawt préserve le choix user au franchissement de stade).';
