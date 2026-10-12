DROP FUNCTION IF EXISTS public.admin_delete_demo_spawter(uuid, text);
DROP TRIGGER IF EXISTS spawters_demo_marker_guard ON public.spawters;
DROP FUNCTION IF EXISTS public.spawters_protect_demo_marker();
ALTER TABLE public.spawters DROP COLUMN IF EXISTS is_demo;

-- Restaure le comportement de 0014. Les journaux de suppression restent
-- conservés : retirer une fonctionnalité ne retire pas sa trace d'audit.
-- Le CHECK d'audit reste donc un sur-ensemble acceptant cette action passée.
CREATE OR REPLACE FUNCTION public.assert_collection_titres_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'collection_titres is append-only (PRD section 5.4): DELETE rejected';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.title_key IS DISTINCT FROM NEW.title_key
       OR OLD.spawter_id IS DISTINCT FROM NEW.spawter_id
       OR OLD.source IS DISTINCT FROM NEW.source
       OR OLD.unlocked_at IS DISTINCT FROM NEW.unlocked_at THEN
      RAISE EXCEPTION 'collection_titres is append-only: only is_displayed can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';
