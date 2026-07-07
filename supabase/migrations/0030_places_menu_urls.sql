-- Refonte fiche lieu (retours produit R17/R19) — onglet Menu.
-- Réversible : voir 0030_places_menu_urls.down.sql
--
-- `menu_urls` : URLs publiques des photos du menu (bucket place-photos,
-- migration 0013, ou CDN seedé côté admin) — même modèle que `gallery_urls`
-- (migration 0010). Tableau vide par défaut → l'onglet Menu de la fiche lieu
-- affiche l'état vide « Le menu arrive bientôt ».
--
-- Note : la numérotation 0024 étant prise (saved_places), cette migration
-- prend le premier numéro libre (0030).

ALTER TABLE places
  ADD COLUMN menu_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN places.menu_urls IS
  'Photos du menu (URLs publiques, modèle gallery_urls). Vide = onglet Menu en état « Le menu arrive bientôt ».';
