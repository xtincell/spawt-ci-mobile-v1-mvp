-- ============================================================================
-- Migration 0032 — subscriptions + invoices + active_entitlements (PRD §13.8)
-- ============================================================================
-- Sprint 2 monétisation. Ces tables étaient « absentes volontairement » du
-- Sprint 1 (cf. spawt-context §Backend) : le squelette commercial (customers/
-- plans/currencies, migration 0002) existait sans paiement. Cette migration
-- pose la couche abonnement CinetPay :
--   * subscriptions : cycle de vie d'un abonnement (pending → active → grace
--     → expired / cancelled). provider_tx_id = idempotence côté webhook.
--   * invoices : factures TVA 18 % (Côte d'Ivoire), numérotation légale
--     SPAWT-YYYY-NNNN avec compteur remis à zéro chaque année.
--   * active_entitlements : vue de lecture unique côté app — « ce spawter
--     a-t-il un droit Gold actif ? » (status active/grace + fenêtre de grâce).
--
-- Écritures : EXCLUSIVEMENT service_role (Edge Function webhook CinetPay).
-- Aucune policy INSERT/UPDATE/DELETE pour authenticated — un client ne peut
-- pas s'auto-attribuer un abonnement.
--
-- Lien spawter : customers.spawter_id existe depuis 0002 (UNIQUE
-- (spawter_id, customer_type)) — la vue joint subscriptions → customers →
-- spawters, aucune colonne à ajouter.
-- Date : 2026-07-26

-- ━━━ Table : subscriptions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES public.customers(id)
                    ON DELETE CASCADE,
  customer_type   text NOT NULL
                    CHECK (customer_type IN ('b2c','b2b')),
  plan            text NOT NULL
                    CHECK (plan IN ('gold_monthly','gold_annual','pro','b2b_gold')),
  -- Montants en XOF entiers (pas de centimes en francs CFA).
  price_ht        integer NOT NULL CHECK (price_ht >= 0),
  tva_rate        numeric(4,2) NOT NULL DEFAULT 18.00 CHECK (tva_rate >= 0),
  currency        text NOT NULL DEFAULT 'XOF',
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','grace','expired','cancelled')),
  provider        text NOT NULL DEFAULT 'cinetpay',
  -- Idempotence webhook : une transaction provider = au plus un abonnement.
  provider_tx_id  text,
  started_at      timestamptz,
  expires_at      timestamptz,
  grace_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_tx_id)
);

COMMENT ON TABLE public.subscriptions IS
  'Abonnements (PRD §13.8). Écriture service_role only (webhook CinetPay). '
  'Cycle : pending → active → grace → expired ; cancelled = résiliation. '
  'Le droit effectif se lit via la vue active_entitlements.';
COMMENT ON COLUMN public.subscriptions.provider_tx_id IS
  'ID transaction CinetPay — UNIQUE = idempotence du webhook (un retry ne crée pas 2 abonnements).';
COMMENT ON COLUMN public.subscriptions.grace_until IS
  'Fenêtre de grâce post-expiration (relance paiement). Le droit reste actif tant que grace_until > now().';

CREATE INDEX subscriptions_customer_status_idx
  ON public.subscriptions (customer_id, status);

CREATE TRIGGER update_timestamp_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Numérotation factures : SPAWT-YYYY-NNNN (reset annuel) ━━━━━━━━━━━━━━━━━
-- Une séquence Postgres classique ne sait pas se remettre à zéro chaque année
-- de façon atomique : on porte le compteur dans une table (1 ligne par année)
-- et l'upsert ON CONFLICT verrouille la ligne → concurrence-safe sans trou de
-- numérotation dans la même transaction.
CREATE TABLE public.invoice_counters (
  year     integer PRIMARY KEY,
  counter  integer NOT NULL DEFAULT 0 CHECK (counter >= 0)
);

COMMENT ON TABLE public.invoice_counters IS
  'Compteur de numérotation factures par année (SPAWT-YYYY-NNNN). '
  'Ligne verrouillée par l''upsert de next_invoice_number() — pas de doublon possible.';

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year    integer := extract(year FROM now())::integer;
  v_counter integer;
BEGIN
  INSERT INTO public.invoice_counters AS ic (year, counter)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET counter = ic.counter + 1
  RETURNING ic.counter INTO v_counter;
  RETURN format('SPAWT-%s-%s', v_year, lpad(v_counter::text, 4, '0'));
END;
$$;

COMMENT ON FUNCTION public.next_invoice_number() IS
  'Numéro de facture séquentiel SPAWT-YYYY-NNNN, compteur remis à zéro par '
  'année via invoice_counters. SECURITY DEFINER : appelée par le trigger '
  'invoices (insert service_role).';

-- Les clients ne numérotent pas eux-mêmes.
REVOKE EXECUTE ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- ━━━ Table : invoices ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text NOT NULL UNIQUE,
  subscription_id  uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  customer_id      uuid NOT NULL REFERENCES public.customers(id)
                     ON DELETE RESTRICT,  -- une facture émise survit au client (obligation comptable)
  customer_type    text NOT NULL
                     CHECK (customer_type IN ('b2c','b2b')),
  price_ht         integer NOT NULL CHECK (price_ht >= 0),
  tva_rate         numeric(4,2) NOT NULL DEFAULT 18.00 CHECK (tva_rate >= 0),
  tva_amount       integer NOT NULL CHECK (tva_amount >= 0),
  price_ttc        integer NOT NULL CHECK (price_ttc >= 0),
  currency         text NOT NULL DEFAULT 'XOF',
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','issued','paid','void')),
  provider_tx_id   text,
  issued_at        timestamptz,
  paid_at          timestamptz,
  pdf_url          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoices IS
  'Factures (PRD §13.8). Numérotation SPAWT-YYYY-NNNN posée par trigger si '
  'absente. TVA CI 18 % par défaut. Écriture service_role only.';

CREATE INDEX invoices_customer_id_idx    ON public.invoices (customer_id);
CREATE INDEX invoices_subscription_id_idx ON public.invoices (subscription_id)
  WHERE subscription_id IS NOT NULL;

-- Trigger BEFORE INSERT : pose invoice_number si NULL + complète le calcul TVA
-- si le caller ne l'a pas fourni (les BEFORE triggers passent AVANT le check
-- NOT NULL — le caller peut donc insérer uniquement price_ht/tva_rate).
-- Arrondi TVA : round half-up au franc (pas de centimes en XOF).
CREATE OR REPLACE FUNCTION public.invoices_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := public.next_invoice_number();
  END IF;
  IF NEW.tva_amount IS NULL THEN
    NEW.tva_amount := round(NEW.price_ht * NEW.tva_rate / 100.0)::integer;
  END IF;
  IF NEW.price_ttc IS NULL THEN
    NEW.price_ttc := NEW.price_ht + NEW.tva_amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoices_before_insert
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_before_insert();

-- ━━━ Vue : active_entitlements ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Lecture unique côté app : « quel droit pour quel spawter ? ».
-- security_invoker = true → la RLS de subscriptions/customers s'applique au
-- caller : un spawter ne voit QUE ses propres droits, le staff admin voit tout.
-- is_active = status actif/grâce ET (pas d'échéance, ou échéance future, ou
-- fenêtre de grâce encore ouverte).
CREATE VIEW public.active_entitlements
  WITH (security_invoker = true)
AS
  SELECT
    c.spawter_id,
    s.plan,
    s.status,
    (
      s.status IN ('active','grace')
      AND (
        s.expires_at IS NULL
        OR s.expires_at > now()
        OR s.grace_until > now()
      )
    ) AS is_active,
    s.expires_at,
    s.grace_until
  FROM public.subscriptions s
  JOIN public.customers c ON c.id = s.customer_id;

COMMENT ON VIEW public.active_entitlements IS
  'Droits d''abonnement par spawter (PRD §13.8). security_invoker=true : la '
  'RLS des tables sous-jacentes filtre — chaque spawter ne lit que ses lignes.';

GRANT SELECT ON public.active_entitlements TO authenticated;

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
-- invoice_counters : RLS activée SANS policy = invisible/intouchable pour tout
-- rôle non service_role. Le compteur est une mécanique interne.
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Un spawter lit SES abonnements/factures via la jointure customers (0002 :
-- customers.spawter_id = auth.uid()).
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = subscriptions.customer_id
        AND c.spawter_id = auth.uid()
    )
  );

CREATE POLICY invoices_select_own ON public.invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = invoices.customer_id
        AND c.spawter_id = auth.uid()
    )
  );

-- Staff admin : lecture complète (dashboard revenus). Helper 0021.
CREATE POLICY subscriptions_select_admin ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin_staff());

CREATE POLICY invoices_select_admin ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_admin_staff());

-- AUCUNE policy INSERT/UPDATE/DELETE pour authenticated : toute écriture passe
-- par service_role (Edge Function webhook CinetPay) qui bypasse la RLS.
