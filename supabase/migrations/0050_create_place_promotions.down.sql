-- Rollback 0050 — Drop place_promotions
-- (policies + trigger + index tombent avec la table ; aucun autre objet :
-- le Contrat SPAWT garantit qu'aucun trigger/colonne n'existe côté
-- place_adn/notes — rien d'autre à défaire.)

DROP TABLE IF EXISTS public.place_promotions;
