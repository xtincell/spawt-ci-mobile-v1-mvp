BEGIN;

ALTER TABLE public.menu_items ADD COLUMN dish_type text
  CHECK (dish_type ~ '^[a-z][a-z0-9_-]{0,39}$' AND dish_type <> 'non_classe');
COMMENT ON COLUMN public.menu_items.dish_type IS 'Type éditorial du plat. NULL signifie non classé.';

-- Only catalogue records whose names identify their type. Unclassified dishes remain visible.
UPDATE public.menu_items AS m SET dish_type = t.kind
FROM (VALUES
 ('3b2b451c-7fad-554f-846d-f14d11c2941e'::uuid, 'Burger de poulet', 'burger'),
 ('1cc79c1f-b718-587c-aa8b-b564d8b77dbc', 'Burger de veau', 'burger'),
 ('9911d127-8d45-50d2-8deb-0e2a20dc5481', 'Pancake chocolat banane', 'pancake'),
 ('551ba313-afd3-5a07-8de8-6448b554dcdf', 'Pancake egg & bacon', 'pancake'),
 ('47476edf-25d4-53be-9ef6-672880894939', 'Katsusando club sandwich', 'sandwich'),
 ('6dad3f00-d87f-4c70-87a7-b083af11c4d7', 'Eggs Benedict', 'oeufs'),
 ('36a0a708-7637-52d0-8435-a7f97d6dc001', 'Omelette, oeuf brouillé ou sur le plat', 'oeufs')
) AS t(id, name, kind) WHERE m.id = t.id AND m.name = t.name;

CREATE TABLE public.menu_item_ratings (
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (spawter_id, menu_item_id)
);
CREATE INDEX menu_item_ratings_dish ON public.menu_item_ratings(menu_item_id);
ALTER TABLE public.menu_item_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_item_ratings FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.set_menu_item_rating(p_menu_item_id uuid, p_rating integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE member uuid := auth.uid();
BEGIN
  IF member IS NULL OR NOT EXISTS (SELECT FROM public.spawters WHERE id = member AND NOT is_banned) THEN
    RAISE EXCEPTION 'account_required' USING ERRCODE = '42501';
  END IF;
  IF p_menu_item_id IS NULL OR (p_rating IS NOT NULL AND p_rating NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'invalid_dish_rating' USING ERRCODE = '22023';
  END IF;
  -- The same owner can erase an old rating even after the dish has left the public menu.
  IF p_rating IS NULL THEN
    DELETE FROM public.menu_item_ratings WHERE spawter_id = member AND menu_item_id = p_menu_item_id;
  ELSE
    IF NOT EXISTS (SELECT FROM public.public_menu_items WHERE id = p_menu_item_id) THEN
      RAISE EXCEPTION 'dish_unavailable' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.menu_item_ratings AS r (spawter_id, menu_item_id, rating)
    VALUES (member, p_menu_item_id, p_rating)
    ON CONFLICT (spawter_id, menu_item_id) DO UPDATE SET rating = excluded.rating, updated_at = now()
      WHERE r.rating <> excluded.rating;
  END IF;
  RETURN p_rating;
END $$;

CREATE FUNCTION public.my_menu_item_ratings() RETURNS TABLE(menu_item_id uuid, rating integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.menu_item_id, r.rating::integer FROM public.menu_item_ratings r
  JOIN public.spawters s ON s.id = r.spawter_id
  WHERE r.spawter_id = auth.uid() AND NOT s.is_banned ORDER BY r.menu_item_id
$$;

CREATE FUNCTION public.admin_saved_catalogue(p_city_code text DEFAULT NULL, p_dish_type text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE = '42501'; END IF;
  WITH
  members AS MATERIALIZED (
    SELECT s.id FROM public.spawters s
    WHERE NOT (s.is_internal OR s.is_demo OR s.is_seed OR s.is_banned)
      AND NOT EXISTS (SELECT FROM public.spawt_staff st WHERE st.id = s.id)
  ), locations AS (
    SELECT p.id AS place_id, p.name, p.city_code, COALESCE(c.name, p.city) AS city, p.neighborhood,
           p.is_published AS published
    FROM public.places p LEFT JOIN public.cities c ON c.code = p.city_code
    WHERE p_city_code IS NULL OR p.city_code = p_city_code
  ), catalogue AS (
    SELECT m.id AS menu_item_id, m.name, m.dish_type, l.place_id, l.name AS place_name, l.city_code, l.city,
           l.neighborhood, (l.published AND m.is_published) AS published
    FROM public.menu_items m JOIN locations l ON l.place_id = m.place_id
  ), selected_dishes AS (
    SELECT * FROM catalogue WHERE p_dish_type IS NULL OR COALESCE(dish_type, 'non_classe') = p_dish_type
  ), place_saves AS (
    SELECT s.place_id,s.spawter_id FROM public.saved_places s JOIN members u ON u.id = s.spawter_id
    JOIN locations l ON l.place_id = s.place_id
  ), dish_saves AS (
    SELECT s.menu_item_id,s.spawter_id FROM public.saved_menu_items s JOIN members u ON u.id = s.spawter_id
    JOIN selected_dishes d ON d.menu_item_id = s.menu_item_id
  ), ratings AS (
    SELECT r.menu_item_id,r.rating FROM public.menu_item_ratings r JOIN members u ON u.id = r.spawter_id
    JOIN selected_dishes d ON d.menu_item_id = r.menu_item_id
  ), place_rows AS (
    SELECT l.*,s.save_count FROM locations l JOIN (
      SELECT place_id, count(*) AS save_count FROM place_saves GROUP BY place_id
    ) s USING(place_id)
  ), dish_rows AS (
    SELECT d.*, COALESCE(s.save_count,0) AS save_count, COALESCE(r.rating_count,0) AS rating_count,
           r.average_rating
    FROM selected_dishes d LEFT JOIN (
      SELECT menu_item_id, count(*) AS save_count FROM dish_saves GROUP BY menu_item_id
    ) s USING(menu_item_id) LEFT JOIN (
      SELECT menu_item_id, count(*) AS rating_count, round(avg(rating),2) AS average_rating FROM ratings GROUP BY menu_item_id
    ) r USING(menu_item_id)
    WHERE d.published OR s.save_count IS NOT NULL OR r.rating_count IS NOT NULL
  )
  SELECT jsonb_build_object(
    'summary',jsonb_build_object(
      'place_saves',(SELECT count(*) FROM place_saves), 'unique_places',(SELECT count(DISTINCT place_id) FROM place_saves),
      'place_savers',(SELECT count(DISTINCT spawter_id) FROM place_saves), 'dish_saves',(SELECT count(*) FROM dish_saves),
      'unique_dishes',(SELECT count(DISTINCT menu_item_id) FROM dish_saves), 'dish_savers',(SELECT count(DISTINCT spawter_id) FROM dish_saves),
      'rating_count',(SELECT count(*) FROM ratings)),
    'places',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY save_count DESC,name,place_id) FROM place_rows p),'[]'::jsonb),
    'dishes',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY save_count DESC,name,menu_item_id) FROM dish_rows d),'[]'::jsonb),
    'cities',COALESCE((SELECT jsonb_agg(jsonb_build_object('code',c.code,'name',c.name) ORDER BY c.name,c.code)
      FROM public.cities c WHERE c.is_active OR EXISTS (SELECT FROM public.places p WHERE p.city_code=c.code)),'[]'::jsonb),
    'dish_types',COALESCE((SELECT jsonb_agg(kind ORDER BY kind) FROM
      (SELECT DISTINCT COALESCE(dish_type,'non_classe') AS kind FROM catalogue) t),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_menu_item_rating(uuid,integer), public.my_menu_item_ratings(),
  public.admin_saved_catalogue(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_menu_item_rating(uuid,integer), public.my_menu_item_ratings(),
  public.admin_saved_catalogue(text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
