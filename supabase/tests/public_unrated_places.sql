\set ON_ERROR_STOP on
BEGIN;
INSERT INTO places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
VALUES('eeee0000-0000-4000-8000-0000000083a1','Lieu documentaire recette',null,null,null,'','','Abidjan','{}',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id='eeee0000-0000-4000-8000-0000000083a1' AND lat IS NULL AND price_tier IS NULL) THEN
    RAISE EXCEPTION 'ASSERT: public unrated record not readable';
  END IF;
  IF EXISTS(SELECT 1 FROM public_reviews WHERE place_id='eeee0000-0000-4000-8000-0000000083a1') THEN
    RAISE EXCEPTION 'ASSERT: publication created a review';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE places SET lat=5.3 WHERE id='eeee0000-0000-4000-8000-0000000083a1';
    RAISE EXCEPTION 'ASSERT: partial coordinates accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE places SET city='' WHERE id='eeee0000-0000-4000-8000-0000000083a1';
    RAISE EXCEPTION 'ASSERT: city missing on public record';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE places SET lat=5.3,lng=-4.0 WHERE id='eeee0000-0000-4000-8000-0000000083a1';
ROLLBACK;
