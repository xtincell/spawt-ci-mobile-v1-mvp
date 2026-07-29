-- Migration 0064 — DOWN : le client redevient responsable de poser
-- `requester_id`. La policy `payment_requests_insert_own` continue de refuser
-- toute valeur autre que celle de l'appelant, donc rien ne s'ouvre — mais le
-- portail doit alors renvoyer le champ explicitement.
ALTER TABLE public.payment_requests
  ALTER COLUMN requester_id DROP DEFAULT;
