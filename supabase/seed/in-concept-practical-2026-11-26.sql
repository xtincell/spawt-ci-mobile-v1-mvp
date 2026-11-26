-- Source URLs and the observation date are stored with the public facts. This
-- reconciliation only fills this published Abidjan catalogue ID; later editorial
-- changes and hours already entered by staff must be reviewed, never overwritten.
BEGIN;
DO $apply$
DECLARE target uuid:='c5acfd12-01dd-5cd3-9beb-0531d89c3e99';
 observed jsonb:=$doc${
  "website_url": "https://www.inconceptstore.com/",
  "contact_email": "contact@inconceptstore.com",
  "google_maps_url": "https://maps.app.goo.gl/LyXqzbJ9F6iHN6uZ7",
  "official_description": "IN’ associe une table de cuisine afro-européenne à un showroom de créateurs ivoiriens sur le boulevard des Martyrs.",
  "services": [
    "Brunch",
    "Bar à cocktails",
    "Showroom multimarques"
  ],
  "payment_methods": [],
  "social_links": [
    {
      "label": "Instagram",
      "url": "https://www.instagram.com/inconceptstore.ci/"
    }
  ],
  "sources": [
    {
      "label": "Contact et horaires du IN’",
      "url": "https://www.inconceptstore.com/contact/",
      "checked_on": "2026-11-26",
      "fields": [
        "address",
        "hours",
        "phone",
        "website_url",
        "contact_email",
        "google_maps_url",
        "social_links"
      ]
    },
    {
      "label": "Présentation du restaurant et du showroom",
      "url": "https://www.inconceptstore.com/qui-sommes-nous/",
      "checked_on": "2026-11-26",
      "fields": [
        "official_description",
        "services"
      ]
    },
    {
      "label": "Brunch du IN’",
      "url": "https://www.inconceptstore.com/brunch-menu/",
      "checked_on": "2026-11-26",
      "fields": [
        "services",
        "menu_urls",
        "price_range"
      ]
    },
    {
      "label": "Carte du restaurant",
      "url": "https://www.inconceptstore.com/eat-menu/",
      "checked_on": "2026-11-26",
      "fields": [
        "menu_urls",
        "price_range"
      ]
    },
    {
      "label": "Carte des boissons",
      "url": "https://www.inconceptstore.com/drink-menu/",
      "checked_on": "2026-11-26",
      "fields": [
        "services",
        "menu_urls"
      ]
    }
  ]
}$doc$;
 schedule jsonb:=$hours${"mon":[{"open":"07:00","close":"22:00"}],"tue":[{"open":"07:00","close":"22:00"}],"wed":[{"open":"07:00","close":"22:00"}],"thu":[{"open":"07:00","close":"22:00"}],"fri":[{"open":"07:00","close":"02:00"}],"sat":[{"open":"08:00","close":"02:00"}],"sun":[{"open":"09:00","close":"17:00"}]}$hours$;
 old_hours jsonb; old_profile public.place_practical_profiles;
BEGIN
 SELECT hours INTO STRICT old_hours FROM public.places
 WHERE id=target AND city_code='abidjan' AND is_published AND name='IN’ Concept Store'
 AND descriptive_address='Boulevard des Martyrs' AND phone='+2250757789832' FOR UPDATE;
 IF old_hours NOT IN ('{}'::jsonb,schedule) THEN RAISE EXCEPTION 'Existing weekly hours require editorial review'; END IF;
 SELECT * INTO old_profile FROM public.place_practical_profiles WHERE place_id=target;
 IF FOUND AND (old_profile.draft IS DISTINCT FROM observed OR old_profile.published_document IS DISTINCT FROM observed)
 THEN RAISE EXCEPTION 'Existing practical facts require editorial review'; END IF;
 PERFORM public.check_practical_document(observed,true);
 INSERT INTO public.place_practical_profiles(place_id,draft,published_document) VALUES(target,observed,observed)
 ON CONFLICT(place_id) DO NOTHING;
 IF old_hours='{}'::jsonb THEN UPDATE public.places SET hours=schedule WHERE id=target; END IF;
END $apply$;
COMMIT;
