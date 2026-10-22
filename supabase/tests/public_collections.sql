\set ON_ERROR_STOP on
BEGIN;
INSERT INTO places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
VALUES('eeee0000-0000-4000-8000-0000000084a1','Lieu recette carnet',null,null,null,'','','Abidjan','{}',true);
INSERT INTO explore_collections(id,slug,title_key,is_published) VALUES
('eeee0000-0000-4000-8000-0000000084c1','recette-public-84','Carnet public',true),
('eeee0000-0000-4000-8000-0000000084c2','recette-draft-84','Carnet privé',false);
INSERT INTO explore_items(id,collection_id,place_id) VALUES
('eeee0000-0000-4000-8000-0000000084d1','eeee0000-0000-4000-8000-0000000084c1','eeee0000-0000-4000-8000-0000000084a1'),
('eeee0000-0000-4000-8000-0000000084d2','eeee0000-0000-4000-8000-0000000084c2','eeee0000-0000-4000-8000-0000000084a1');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM explore_collections WHERE id='eeee0000-0000-4000-8000-0000000084c1')
  OR NOT EXISTS(SELECT 1 FROM explore_items WHERE id='eeee0000-0000-4000-8000-0000000084d1') THEN
  RAISE EXCEPTION 'ASSERT: published collection not public';
 END IF;
 IF EXISTS(SELECT 1 FROM explore_collections WHERE id='eeee0000-0000-4000-8000-0000000084c2')
  OR EXISTS(SELECT 1 FROM explore_items WHERE id='eeee0000-0000-4000-8000-0000000084d2') THEN
  RAISE EXCEPTION 'ASSERT: draft editorial content leaked';
 END IF;
 UPDATE explore_collections SET title_key='Unauthorized change' WHERE id='eeee0000-0000-4000-8000-0000000084c1';
 IF FOUND THEN RAISE EXCEPTION 'ASSERT: anonymous collection mutation accepted'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
