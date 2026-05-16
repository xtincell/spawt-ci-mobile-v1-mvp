-- ============================================================================
-- Migration 0002 — Entités commerciales : customers + plans + currencies
-- ============================================================================
-- Story 1.6. PRD ref : §13.3 (plans/currencies/customers) + amendement team
-- §4.2 (séparation B2C/commercial). NFR-PORT-01 (multi-pays).
-- Date : 2026-05-16

-- ━━━ Table : currencies (référentiel ISO 4217) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.currencies (
  code            text PRIMARY KEY
                    CHECK (length(code) = 3 AND code = upper(code)),
  label           text NOT NULL,
  base_rate       numeric(12, 6) NOT NULL CHECK (base_rate > 0),
  modifier        numeric(12, 6) NOT NULL DEFAULT 1 CHECK (modifier > 0),
  country_code    text NOT NULL
                    CHECK (country_code IN
                      ('CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH')),
  is_active       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.currencies IS
  'Référentiel devises ISO 4217. base_rate = taux vs USD (informatif V1, utilisé V2 cross-currency). modifier = ajustement local. is_active = visible côté app.';

CREATE INDEX currencies_country_code_idx ON public.currencies (country_code);

CREATE TRIGGER update_timestamp_currencies
  BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Table : plans ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE
                    CHECK (length(trim(code)) > 0),
  label           text NOT NULL,
  price_ht        numeric(12, 2) NOT NULL CHECK (price_ht >= 0),
  currency_code   text NOT NULL REFERENCES public.currencies(code)
                    ON DELETE RESTRICT,
  country_code    text NOT NULL
                    CHECK (country_code IN
                      ('CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH')),
  period          text NOT NULL
                    CHECK (period IN ('monthly','annual','lifetime')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Offres commerciales. code = slug stable (gold_monthly, gold_annual). is_active = visible côté app.';

CREATE INDEX plans_country_code_idx ON public.plans (country_code);
CREATE INDEX plans_active_idx       ON public.plans (is_active) WHERE is_active = true;

CREATE TRIGGER update_timestamp_plans
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Table : customers (entité commerciale séparée) ━━━━━━━━━━━━━━━━━━━━━━━━
-- Amendement 4.2 : un spawter peut avoir un customer pour le B2C
-- (individual), un autre pour B2B (business), un autre pour influencer.
-- UNIQUE (spawter_id, customer_type) garantit l'unicité par type.
CREATE TABLE public.customers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id              uuid NOT NULL REFERENCES public.spawters(id)
                            ON DELETE CASCADE,
  customer_type           text NOT NULL DEFAULT 'b2c_individual'
                            CHECK (customer_type IN
                              ('b2c_individual','b2b_business','influencer')),
  display_name            text NOT NULL,
  billing_country_code    text NOT NULL
                            CHECK (billing_country_code IN
                              ('CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH')),
  billing_currency_code   text NOT NULL REFERENCES public.currencies(code)
                            ON DELETE RESTRICT,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spawter_id, customer_type)
);

COMMENT ON TABLE public.customers IS
  'Entité commerciale séparée du compte spawter (amendement 4.2). Un spawter peut avoir 1 customer par type. ON DELETE CASCADE depuis spawters (cohérent NFR-SEC-04 anonymisation J+30).';

CREATE INDEX customers_spawter_id_idx ON public.customers (spawter_id);

CREATE TRIGGER update_timestamp_customers
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ FK différée : spawters.customer_id → customers(id) ━━━━━━━━━━━━━━━━━━━━
-- Cette contrainte n'a pas pu être déclarée dans 0001 (customers n'existait
-- pas). On l'ajoute ici. ON DELETE SET NULL : si le customer est supprimé,
-- le spawter reste mais perd sa référence commerciale.
ALTER TABLE public.spawters
  ADD CONSTRAINT spawters_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id)
    ON DELETE SET NULL;

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers  ENABLE ROW LEVEL SECURITY;

-- Référentiel currencies = lookup public lisible en intégralité (incluant
-- `is_active=false`) — un plan référençant une currency inactive doit pouvoir
-- afficher son symbole/label côté client. Le filtre `is_active` reste un
-- contrôle d'éligibilité applicatif, pas un masque RLS.
CREATE POLICY currencies_select_all ON public.currencies
  FOR SELECT USING (true);

CREATE POLICY plans_select_active ON public.plans
  FOR SELECT USING (is_active = true);

-- customers : PII forte, scoping par spawter_id.
CREATE POLICY customers_select_own ON public.customers
  FOR SELECT USING (spawter_id = auth.uid());

CREATE POLICY customers_insert_own ON public.customers
  FOR INSERT WITH CHECK (spawter_id = auth.uid());

CREATE POLICY customers_update_own ON public.customers
  FOR UPDATE USING (spawter_id = auth.uid())
              WITH CHECK (spawter_id = auth.uid());

-- Staff actif : lecture sur tous les customers (panel admin Story 6.4).
CREATE POLICY customers_select_staff ON public.customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- ━━━ Intégrité back-edge spawters.customer_id ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Garde-fou : `spawters.customer_id` doit pointer vers un customer dont le
-- `spawter_id` est ce même spawter. Sinon le spawter « préfère » un customer
-- d'un autre user.
CREATE OR REPLACE FUNCTION public.assert_spawter_customer_owned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  customer_owner uuid;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT spawter_id INTO customer_owner
    FROM public.customers
    WHERE id = NEW.customer_id;
  IF customer_owner IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION
      'spawters.customer_id (%) doit appartenir au même spawter (% != %)',
      NEW.customer_id, customer_owner, NEW.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER spawters_customer_id_owned
  AFTER INSERT OR UPDATE OF customer_id ON public.spawters
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_spawter_customer_owned();
