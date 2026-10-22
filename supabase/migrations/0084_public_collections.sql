-- Published editorial collections are public content, like their places.
-- Draft collections and their entries remain restricted to active staff.
ALTER POLICY explore_collections_select_published ON public.explore_collections TO anon,authenticated;
ALTER POLICY explore_items_select_published ON public.explore_items TO anon,authenticated;
