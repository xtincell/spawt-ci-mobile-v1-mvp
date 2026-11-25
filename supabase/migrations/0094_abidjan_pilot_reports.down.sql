BEGIN;
DROP FUNCTION pilot_private.funnel(timestamptz,timestamptz);
DROP FUNCTION pilot_private.activations(timestamptz,timestamptz);
DROP VIEW pilot_private.usage,pilot_private.people;
DROP TABLE pilot_private.salt;
COMMIT;
