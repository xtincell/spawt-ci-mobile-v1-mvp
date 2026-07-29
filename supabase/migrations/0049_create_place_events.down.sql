-- Rollback 0049 — Drop place_events + outillage console admin

-- 4. Restaure le CHECK admin_audit_log de 0047 (état précédent exact).
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'login',
  'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
  'place_adn_update',
  'review_keep', 'review_delete', 'review_warning',
  'spawter_warning', 'spawter_ban', 'spawter_unban',
  'seed_inventory_run',
  'push_campaign',
  'event_create', 'event_update', 'event_delete',
  'promo_create', 'promo_update', 'promo_delete',
  'challenge_create', 'challenge_update',
  'suggestion_approve', 'suggestion_reject',
  'b2b_link', 'b2b_unlink',
  'flag_update',
  'explore_publish', 'explore_unpublish'
));

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_entity_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check CHECK (entity_type IN (
  'place', 'place_adn', 'spawt_checkin', 'spawter', 'session', 'seed_batch',
  'push_campaign', 'place_event', 'place_promotion', 'challenge',
  'place_suggestion', 'b2b_account', 'feature_flag', 'explore_collection'
));

-- 3. Policies staff admin sur b2b_accounts
DROP POLICY IF EXISTS b2b_accounts_update_admin ON public.b2b_accounts;
DROP POLICY IF EXISTS b2b_accounts_insert_admin ON public.b2b_accounts;

-- 2. Vue agrégats waitlist
DROP VIEW IF EXISTS public.admin_waitlist_stats;

-- 1. Table place_events (policies + trigger + index tombent avec la table)
DROP TABLE IF EXISTS public.place_events;
