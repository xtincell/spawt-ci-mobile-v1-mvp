-- Rollback 0022 — Drop helpers, ne touche pas au backfill (irréversible safe)

-- 2. Drop RPC set_displayed_title
DROP FUNCTION IF EXISTS public.set_displayed_title(uuid, text);

-- 3. Restore COMMENT par défaut sur current_title (cf. migration 0014)
COMMENT ON COLUMN public.spawter_progression.current_title IS
  'i18n key pour le titre actuel/affiché (cf. Story 5.2 — D4 amend).';

-- 1. Backfill : pas de rollback (les rows backfillées sont indistinguables
-- des rows créées par registerSpawt — un rollback détruirait des données
-- utilisateur. Le up est volontairement non-réversible côté data).
