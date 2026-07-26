-- Sprint 2 — Seed des flags V2 (nouvelles features 0032→0046).
-- TOUS À FALSE PARTOUT : les features arrivent en base et dans le binaire,
-- l'activation se fait progressivement en OTA depuis le dashboard admin
-- (page Fonctionnalités), scope par scope (internal → alpha → beta → prod).
--
--   mode-rapide        → swipe de suggestions (signaux swipe_like/swipe_pass, 0046)
--   mode-crew          → sessions de décision de groupe (0038)
--   mode-explore       → collections éditoriales (0045)
--   badges-v2          → catalogue 32 badges + attribution auto (0036)
--   collectibles       → cartes collector (0037)
--   paws               → ledger + solde paws (0035)
--   wrapped            → rétrospective annuelle du spawter
--   reservation-1tap   → réservation WhatsApp/appel (0042)
--   defis-collectifs   → défis de la Meute + streaks privés (0040)
--   suggestions-lieux  → la Meute propose des spots (0039)
--   b2b-dashboards     → stats agrégées côté lieux (0043)
--
-- ⚠️ ON CONFLICT DO NOTHING : ne modifie rien sur une base déjà seedée.
-- NE PAS toucher aux seeds existants (paywall, produit, guet).

INSERT INTO feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('mode-rapide', 'internal', false, NULL),
  ('mode-rapide', 'alpha', false, NULL),
  ('mode-rapide', 'beta', false, NULL),
  ('mode-rapide', 'prod', false, NULL),
  ('mode-crew', 'internal', false, NULL),
  ('mode-crew', 'alpha', false, NULL),
  ('mode-crew', 'beta', false, NULL),
  ('mode-crew', 'prod', false, NULL),
  ('mode-explore', 'internal', false, NULL),
  ('mode-explore', 'alpha', false, NULL),
  ('mode-explore', 'beta', false, NULL),
  ('mode-explore', 'prod', false, NULL),
  ('badges-v2', 'internal', false, NULL),
  ('badges-v2', 'alpha', false, NULL),
  ('badges-v2', 'beta', false, NULL),
  ('badges-v2', 'prod', false, NULL),
  ('collectibles', 'internal', false, NULL),
  ('collectibles', 'alpha', false, NULL),
  ('collectibles', 'beta', false, NULL),
  ('collectibles', 'prod', false, NULL),
  ('paws', 'internal', false, NULL),
  ('paws', 'alpha', false, NULL),
  ('paws', 'beta', false, NULL),
  ('paws', 'prod', false, NULL),
  ('wrapped', 'internal', false, NULL),
  ('wrapped', 'alpha', false, NULL),
  ('wrapped', 'beta', false, NULL),
  ('wrapped', 'prod', false, NULL),
  ('reservation-1tap', 'internal', false, NULL),
  ('reservation-1tap', 'alpha', false, NULL),
  ('reservation-1tap', 'beta', false, NULL),
  ('reservation-1tap', 'prod', false, NULL),
  ('defis-collectifs', 'internal', false, NULL),
  ('defis-collectifs', 'alpha', false, NULL),
  ('defis-collectifs', 'beta', false, NULL),
  ('defis-collectifs', 'prod', false, NULL),
  ('suggestions-lieux', 'internal', false, NULL),
  ('suggestions-lieux', 'alpha', false, NULL),
  ('suggestions-lieux', 'beta', false, NULL),
  ('suggestions-lieux', 'prod', false, NULL),
  ('b2b-dashboards', 'internal', false, NULL),
  ('b2b-dashboards', 'alpha', false, NULL),
  ('b2b-dashboards', 'beta', false, NULL),
  ('b2b-dashboards', 'prod', false, NULL)
ON CONFLICT DO NOTHING;
