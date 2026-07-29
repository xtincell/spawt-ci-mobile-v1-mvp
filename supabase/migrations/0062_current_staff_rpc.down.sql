-- Migration 0062 — DOWN.
-- ⚠️ Le rideau du portail (`VITE_PREVIEW_GATE`) appelle cette RPC : la retirer
-- referme la porte pour toute l'équipe. À ne faire qu'avec un portail qui ne
-- l'utilise plus.
DROP FUNCTION IF EXISTS public.current_staff();
