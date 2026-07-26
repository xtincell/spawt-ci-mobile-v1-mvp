-- Version finale 07/2026 — extension des CHECK de admin_audit_log (0017).
--
-- Pourquoi : l'Edge Function push-send audite ses campagnes via
-- action='push_campaign' (limite anti-abus 3/jour) — valeur absente du CHECK
-- d'origine, l'INSERT échouait silencieusement et la limite était inopérante.
-- On en profite pour ouvrir les actions de la console admin complète
-- (événements, promotions, défis collectifs, suggestions de lieux, comptes
-- B2B, flags) afin que chaque chantier n'ait pas sa micro-migration.
--
-- Un CHECK se remplace par drop + add (pas d'ALTER direct) ; NOT VALID inutile
-- ici : le nouveau CHECK est un sur-ensemble strict de l'ancien, les lignes
-- existantes restent valides par construction.

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'login',
  'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
  'place_adn_update',
  'review_keep', 'review_delete', 'review_warning',
  'spawter_warning', 'spawter_ban', 'spawter_unban',
  'seed_inventory_run',
  -- Push serveur (Edge push-send)
  'push_campaign',
  -- Console admin — événements & promotions de lieux
  'event_create', 'event_update', 'event_delete',
  'promo_create', 'promo_update', 'promo_delete',
  -- Console admin — défis collectifs
  'challenge_create', 'challenge_update',
  -- Console admin — suggestions de lieux (UGC)
  'suggestion_approve', 'suggestion_reject',
  -- Console admin — comptes B2B (lien lieu ↔ compte Pro/Gold)
  'b2b_link', 'b2b_unlink',
  -- Console admin — feature flags
  'flag_update',
  -- Console admin — curation Mode Explore
  'explore_publish', 'explore_unpublish'
));

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_entity_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check CHECK (entity_type IN (
  'place', 'place_adn', 'spawt_checkin', 'spawter', 'session', 'seed_batch',
  'push_campaign', 'place_event', 'place_promotion', 'challenge',
  'place_suggestion', 'b2b_account', 'feature_flag', 'explore_collection'
));
