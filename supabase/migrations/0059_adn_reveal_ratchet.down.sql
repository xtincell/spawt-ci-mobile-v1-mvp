-- Down 0059 — retire le cliquet et le seuil progressif.
-- ⚠️ Sans cliquet, un durcissement du seuil ferait de nouveau disparaître le
-- radar de lieux dont rien n'a changé. Ne jouer ce rollback que pour revenir
-- au seuil fixe de 0057, en connaissance de cause.
DROP FUNCTION IF EXISTS public.adn_reveal_threshold();
ALTER TABLE public.place_adn DROP COLUMN IF EXISTS adn_revealed_at;
