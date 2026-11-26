-- Public menu snapshot of IN’ Concept Store, read from public_menu_items for this recipe.
-- The public record has an observed price and no photograph.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'pilot_http' THEN RAISE EXCEPTION 'Loopback visual recipe database required'; END IF;
END $$;
INSERT INTO public.menu_items
  (id, place_id, name, aliases, price_xof, description, source_url, observed_on, is_published)
VALUES (
  '6dad3f00-d87f-4c70-87a7-b083af11c4d7', 'c5acfd12-01dd-5cd3-9beb-0531d89c3e99',
  'Eggs Benedict', ARRAY['Œufs Benedict','Oeufs Benedict'], 7000,
  'Pain toasté, oeuf, sauce hollandaise, charcuterie de boeuf ou porc',
  'https://www.inconceptstore.com/brunch-menu/', DATE '2026-10-22', true
);
COMMIT;
