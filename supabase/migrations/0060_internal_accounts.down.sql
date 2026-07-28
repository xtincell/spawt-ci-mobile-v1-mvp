-- Migration 0060 — DOWN : retire le statut de compte interne.
-- Le CHECK de `admin_audit_log.action` est remis dans son état 0017 : les
-- lignes d'audit `spawter_internal_*` déjà écrites bloqueraient l'ajout de la
-- contrainte, on les purge d'abord (c'est la seule trace qui disparaît, et
-- elle ne décrit qu'un droit qui n'existe plus après ce down).

DROP TRIGGER IF EXISTS spawters_internal_on_update ON public.spawters;
DROP TRIGGER IF EXISTS spawters_internal_on_insert ON public.spawters;
DROP FUNCTION IF EXISTS public.spawters_protect_internal_on_update();
DROP FUNCTION IF EXISTS public.spawters_set_internal_on_insert();
DROP FUNCTION IF EXISTS public.set_spawter_internal(UUID, BOOLEAN, TEXT);

DELETE FROM public.admin_audit_log
 WHERE action IN ('spawter_internal_grant', 'spawter_internal_revoke');

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'login',
    'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
    'place_adn_update',
    'review_keep', 'review_delete', 'review_warning',
    'spawter_warning', 'spawter_ban', 'spawter_unban',
    'seed_inventory_run'
  ));

DROP INDEX IF EXISTS public.spawters_internal_idx;
ALTER TABLE public.spawters DROP COLUMN IF EXISTS is_internal;
DROP TABLE IF EXISTS public.internal_phone_allowlist;
