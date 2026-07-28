-- Down 0057 — retire sample_size et rouvre les RPC.
-- ⚠️ Rouvrir `recompute_place_adn_full` à `anon` réexpose une écriture sur
-- place_adn contournant la RLS, et un scan complet des avis à chaque appel.
-- Ne jouer ce rollback que pour revenir à l'état 0056, en connaissance de cause.
GRANT EXECUTE ON FUNCTION public.recompute_place_adn_full(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_seed_reviews(UUID, UUID, UUID) TO anon, authenticated;
ALTER TABLE public.place_adn DROP COLUMN IF EXISTS sample_size;
