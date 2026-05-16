-- ============================================================================
-- Migration 0001 — Fondation : `spawters` (B2C public) + `spawt_staff` (équipe)
-- ============================================================================
-- Story 1.5 — Schéma Supabase entités spawter & staff + RLS
-- PRD ref : §13.1 (table spawters) + §13.2 (table spawt_staff) + amendement
-- team §4.1 (séparation B2C/staff) + §4.2 (entité commerciale séparée
-- — `customer_id` FK différée à Story 1.6) + §4.5 (démographique
-- country_code / origin_country_code / gender / age_range).
--
-- Date : 2026-05-16
--
-- ----------------------------------------------------------------------------
-- CONVENTION FK (architecture §17.2, project-context vocab) :
-- Toute table métier (spawt_checkin, user_palais, spawter_progression,
-- collection_titres, user_signals, mue_tracking, subscriptions, invoices)
-- qui référence un spawter DOIT le faire via :
--   spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE
-- Jamais vers une table `users` générique. Jamais via un nom de colonne autre
-- que `spawter_id` (cohérence vocabulaire SPAWT — PRD §19).
-- ----------------------------------------------------------------------------

-- ━━━ Fonction réutilisable : updated_at trigger ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Créée une fois ici, réutilisée par toutes les tables futures qui ont
-- updated_at (cf. Stories 1.6+ : customers, plans, user_palais, etc.).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ━━━ Table : spawters (B2C public) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Aligné exactement sur `app/src/types/spawter.ts` (contrat TS canonique).
CREATE TABLE public.spawters (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  phone_e164            text NOT NULL UNIQUE
                          CHECK (phone_e164 ~ '^\+[1-9]\d{1,14}$'),

  display_name          text NOT NULL
                          CHECK (length(trim(display_name)) > 0),

  avatar_url            text,
  neighborhood          text,

  country_code          text NOT NULL DEFAULT 'CI'
                          CHECK (country_code IN
                            ('CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH')),

  origin_country_code   text
                          CHECK (origin_country_code IS NULL OR origin_country_code IN
                            ('CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH')),

  gender                text NOT NULL DEFAULT 'non_renseigne'
                          CHECK (gender IN
                            ('homme','femme','autre','non_renseigne')),

  age_range             text
                          CHECK (age_range IS NULL OR age_range IN
                            ('18-24','25-34','35-44','45-54','55+')),

  stade                 text NOT NULL DEFAULT 'touriste'
                          CHECK (stade IN
                            ('touriste','explorateur','detective','djidji','guide')),

  total_spawts          integer NOT NULL DEFAULT 0 CHECK (total_spawts >= 0),
  unique_spots          integer NOT NULL DEFAULT 0 CHECK (unique_spots >= 0),

  -- FK vers `customers(id)` ajoutée par migration 0002 (Story 1.6) — voir
  -- DEV NOTES Story 1.5 « ordering FK ».
  customer_id           uuid,

  -- Consentements ARTCI (Loi 2013-450 + Claude amendment 5.2).
  geoloc_consent_at     timestamptz,
  data_consent_at       timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.spawters IS
  'Comptes spawters publics (B2C). Séparation stricte vs spawt_staff (amendement team §4.1). FK convention : <métier>.spawter_id → spawters(id) ON DELETE CASCADE.';
COMMENT ON COLUMN public.spawters.id IS
  'UUID lié à auth.users(id). Le compte spawter et le compte auth sont 1:1 ; suppression auth cascade au spawter (mais le chemin canonique de suppression reste soft-delete via anonymize-deleted-spawters Edge Function — NFR-SEC-04).';
COMMENT ON COLUMN public.spawters.phone_e164 IS
  'Téléphone E.164 (CI : +225XXXXXXXXXX). UNIQUE — un spawter par numéro.';
COMMENT ON COLUMN public.spawters.customer_id IS
  'FK différée à Story 1.6 (customers). NULL = pas d''entité commerciale liée (compte gratuit). Ajout contrainte FK : ALTER TABLE spawters ADD CONSTRAINT spawters_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL.';

-- ━━━ Index sur spawters ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- phone_e164 UNIQUE → index implicite, pas redondant ici.
CREATE INDEX spawters_country_code_idx ON public.spawters (country_code);
CREATE INDEX spawters_stade_idx        ON public.spawters (stade);

-- ━━━ Trigger updated_at sur spawters ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TRIGGER update_timestamp_spawters
  BEFORE UPDATE ON public.spawters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Table : spawt_staff (équipe interne) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Architecture §3 lignes 239-244 : auth distincte des spawters publics. Un
-- humain qui est à la fois spawter ET staff doit avoir 2 comptes auth.users
-- distincts (un par usage).
CREATE TABLE public.spawt_staff (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL
                  CHECK (role IN ('admin','moderator','operator')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.spawt_staff IS
  'Comptes équipe interne. Inaccessible aux comptes publics (RLS). Auth distincte de spawters (amendement 4.1). is_active = soft-disable pour audit trail.';
COMMENT ON COLUMN public.spawt_staff.role IS
  'admin : full ; moderator : modération avis + comptes ; operator : lecture seule métriques + lieux.';

CREATE INDEX spawt_staff_role_idx ON public.spawt_staff (role);

CREATE TRIGGER update_timestamp_spawt_staff
  BEFORE UPDATE ON public.spawt_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.spawters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spawt_staff ENABLE ROW LEVEL SECURITY;

-- ━━━ Policies : spawters ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Un spawter ne lit que sa propre ligne (NFR-SEC-01).
CREATE POLICY spawters_select_own ON public.spawters
  FOR SELECT
  USING (id = auth.uid());

-- Un spawter peut s'auto-créer (signup OTP → Auth attribue l'id, l'insert
-- côté app utilise cet id).
CREATE POLICY spawters_insert_own ON public.spawters
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Un spawter peut mettre à jour sa propre ligne. WITH CHECK empêche de
-- changer son id pour usurper une autre identité.
CREATE POLICY spawters_update_own ON public.spawters
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Pas de DELETE public : suppression de compte = soft-delete via Edge
-- Function `anonymize-deleted-spawters` (service_role bypass RLS).

-- Staff actif : lecture sur tous les spawters (moderation panel — Story 6.4).
CREATE POLICY spawters_select_staff ON public.spawters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid()
        AND s.is_active = true
    )
  );

-- ━━━ Policies : spawt_staff ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Un staff lit sa propre ligne (login panel admin).
CREATE POLICY spawt_staff_select_own ON public.spawt_staff
  FOR SELECT
  USING (id = auth.uid());

-- Un admin actif lit tous les staff (gestion équipe).
CREATE POLICY spawt_staff_select_admin ON public.spawt_staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid()
        AND s.role = 'admin'
        AND s.is_active = true
    )
  );

-- Pas de policies INSERT/UPDATE/DELETE : création/modification d'un staff
-- exclusivement via Supabase Admin UI ou Edge Function service_role
-- (les opérations admin sont auditées avec horodatage + auteur — architecture §3 l244).
