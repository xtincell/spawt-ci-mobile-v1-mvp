-- Annulation de 0067 — on retire les DEFAULT posés sur les colonnes de jetons.
--
-- On ne remet AUCUNE valeur à NULL : les '' écrits par 0067 sont exactement ce
-- que GoTrue écrit lui-même, et y revenir recasserait la reconnexion de tous
-- les comptes. Une annulation ne doit pas restaurer une panne.

DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = col
    ) THEN
      EXECUTE format('ALTER TABLE auth.users ALTER COLUMN %I DROP DEFAULT', col);
    END IF;
  END LOOP;
END $$;
