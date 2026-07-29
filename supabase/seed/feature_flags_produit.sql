-- MAJ consolidée 07/2026 — Seed des flags PRODUIT togglables (décisions Q4 + R3).
-- Les deux fonctionnalités sont conservées (« on y tient ») et pilotables sans
-- redéploiement depuis le dashboard admin (page Fonctionnalités).
--
--   place-avg-price            → fiche lieu : prix moyen « ~N F CFA » (convention
--                                éditoriale type TheFork : repas/pers., hors
--                                boissons, saisi par l'équipe dans l'admin).
--                                OFF = retour à l'échelle ₣/₣₣/₣₣₣.
--   onboarding-origin-country  → inscription : question « Pays d'origine »
--                                (angle nostalgie « les goûts de chez toi »,
--                                skip toujours possible). OFF = champ masqué,
--                                colonne conservée en base (réversible).
--
-- ⚠️ ON CONFLICT DO NOTHING : ne modifie rien sur une base déjà seedée.
-- Pour basculer un flag ensuite : dashboard admin → Fonctionnalités.

INSERT INTO feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('place-avg-price', 'internal', true, NULL),
  ('place-avg-price', 'alpha', true, NULL),
  ('place-avg-price', 'beta', true, NULL),
  ('place-avg-price', 'prod', true, NULL),
  ('onboarding-origin-country', 'internal', true, NULL),
  ('onboarding-origin-country', 'alpha', true, NULL),
  ('onboarding-origin-country', 'beta', true, NULL),
  ('onboarding-origin-country', 'prod', true, NULL)
ON CONFLICT DO NOTHING;
