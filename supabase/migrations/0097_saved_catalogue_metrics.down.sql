BEGIN;
DROP FUNCTION public.admin_saved_catalogue(text,text);
DROP FUNCTION public.my_menu_item_ratings();
DROP FUNCTION public.set_menu_item_rating(uuid,integer);
DROP TABLE public.menu_item_ratings;
ALTER TABLE public.menu_items DROP COLUMN dish_type;
NOTIFY pgrst, 'reload schema';
COMMIT;
