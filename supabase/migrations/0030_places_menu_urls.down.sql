-- Rollback refonte fiche lieu (onglet Menu) — drop menu_urls.

ALTER TABLE places DROP COLUMN IF EXISTS menu_urls;
