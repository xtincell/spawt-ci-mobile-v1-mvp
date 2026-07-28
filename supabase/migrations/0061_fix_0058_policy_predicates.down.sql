-- Migration 0061 — DOWN.
-- ⚠️ Rejouer ce down remet la base dans l'état cassé de 0058 : 41 policies sur
-- 18 tables deviennent inévaluables pour tout compte connecté. À n'exécuter
-- que dans le cadre d'un rollback complet de la série 0058→0061.

REVOKE EXECUTE ON FUNCTION public.is_active_staff(uuid)          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_staff(uuid)           FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_b2b_of(uuid)                FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_b2b_gold_of(uuid)           FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.crew_session_is_joinable(uuid) FROM authenticated;

-- Le garde de 0060 repasse à l'EXISTS inline (état d'origine de 0060).
CREATE OR REPLACE FUNCTION public.spawters_protect_internal_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_internal IS DISTINCT FROM OLD.is_internal THEN
    IF NOT (
      pg_has_role(current_user, 'service_role', 'MEMBER')
      OR EXISTS (
        SELECT 1 FROM public.spawt_staff s
         WHERE s.id = auth.uid() AND s.role = 'admin' AND s.is_active
      )
    ) THEN
      NEW.is_internal := OLD.is_internal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
