-- ============================================================================
-- Migration 0064 — `payment_requests.requester_id` prend `auth.uid()` par défaut
-- ============================================================================
-- Détail d'ergonomie serveur, avec un effet réel sur la sécurité de lecture du
-- code client.
--
-- En 0063, le portail devait poser `requester_id` lui-même, donc lire l'id du
-- compte connecté et l'envoyer dans le corps de la requête. La policy
-- `payment_requests_insert_own` refusait déjà toute autre valeur — mais le
-- champ AVAIT L'AIR d'un paramètre, et un champ qui a l'air d'un paramètre
-- finit un jour par en devenir un.
--
-- Avec la valeur par défaut, le client n'envoie plus rien : le serveur sait
-- qui appelle, la policy vérifie que le défaut correspond bien. Une déclaration
-- « pour quelqu'un d'autre » n'est plus une requête refusée, c'est une requête
-- qu'on ne sait pas écrire.
--
-- Effet de bord bienvenu : le portail n'a plus besoin de lire la session pour
-- déclarer un versement — moins de code, et un chemin de moins où une session
-- expirée produit un message confus.
-- Date : 2026-07-29

ALTER TABLE public.payment_requests
  ALTER COLUMN requester_id SET DEFAULT auth.uid();

COMMENT ON COLUMN public.payment_requests.requester_id IS
  'Compte payeur. Valeur par défaut = auth.uid() : le client ne l''envoie pas, '
  'et la policy insert_own vérifie que le défaut correspond bien à l''appelant. '
  'Un versement déclaré pour le compte d''un tiers n''est pas une requête '
  'refusée — c''est une requête qu''on ne sait pas formuler.';
