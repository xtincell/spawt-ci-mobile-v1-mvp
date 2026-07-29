-- Migration 0063 — DOWN : retire le paiement à validation manuelle.
--
-- ⚠️ Les abonnements ouverts par ce chemin (`provider = 'manuel'`) NE SONT PAS
-- supprimés : ce sont des droits payés, ils survivent au retrait de l'outil qui
-- les a créés. Seules disparaissent les demandes et les fonctions de décision.
-- Les lignes d'audit correspondantes sont purgées pour pouvoir remettre le
-- CHECK d'origine.

DROP FUNCTION IF EXISTS public.approve_payment_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_payment_request(UUID, TEXT);

DROP TRIGGER IF EXISTS payment_requests_quota_trg ON public.payment_requests;
DROP FUNCTION IF EXISTS public.payment_requests_quota();

DROP TABLE IF EXISTS public.payment_requests;
DROP TABLE IF EXISTS public.payment_instructions;

DELETE FROM public.admin_audit_log
 WHERE action IN ('payment_request_approve', 'payment_request_reject');

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'login',
    'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
    'place_adn_update',
    'review_keep', 'review_delete', 'review_warning',
    'spawter_warning', 'spawter_ban', 'spawter_unban',
    'seed_inventory_run',
    'spawter_internal_grant', 'spawter_internal_revoke'
  ));

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_entity_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check
  CHECK (entity_type IN (
    'place','place_adn','spawt_checkin','spawter','session','seed_batch',
    'review_reports','push_campaign','place_event','place_promotion','challenge',
    'place_suggestion','b2b_account','feature_flag','explore_collection','explore_item'
  ));

-- Le catalogue `plans` n'est PAS remis à 22 000 : 25 000 est le prix
-- réellement facturé par le checkout, le corriger était une réparation, pas un
-- effet de bord de cette migration.
