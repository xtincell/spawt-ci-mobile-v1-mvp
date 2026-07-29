-- Rollback 0042 — Drop reservation_requests
-- (la policy B2B posée par 0043 tombe avec la table)

DROP TABLE IF EXISTS public.reservation_requests;
