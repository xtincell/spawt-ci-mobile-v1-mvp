-- Migration 0066 — DOWN.
-- ⚠️ Restaure une policy qui expose la POSITION et l'horodatage de passage des
-- spawters à `anon`. À ne rejouer que dans un rollback complet, jamais seul.
DROP VIEW IF EXISTS public.public_reviews;
GRANT SELECT ON public.spawt_checkin TO anon;
CREATE POLICY spawt_checkin_select_published_reviews ON public.spawt_checkin
  FOR SELECT TO anon, authenticated
  USING (note_etoiles IS NOT NULL AND deleted_at IS NULL);
