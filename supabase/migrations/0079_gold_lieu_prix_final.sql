-- ============================================================================
-- Migration 0079 — Tarifs : le prix payé d'abord, une seule source (`plans`)
-- ============================================================================
-- Deux décisions du 18 octobre 2026.
--
-- 1. Gold lieu (`b2b_gold`) coûte 60 000 F CFA par mois, PRIX FINAL payé par
--    le lieu : SPAWT absorbe la TVA et les frais. Jusqu'ici : 65 000 F HT,
--    soit 76 700 F TTC.
-- 2. Les prix ne vivent plus dans le code. L'équipe les administre depuis la
--    console (page Tarifs) et `plans` devient leur seule source : le checkout
--    CinetPay, la validation manuelle et la console la lisent.
--
-- ── Le prix payé est la saisie, HT et TVA en sont dérivés ───────────────────
-- Le client raisonne en prix payé : l'équipe saisit donc le TTC, en F CFA
-- entiers, et la base en dérive HT = round(TTC / 1,18) et TVA = TTC − HT
-- (TVA fixe à 18 %). Le sens inverse ne tombe pas juste : aucun HT entier ne
-- donne 60 000 (50 847 + round(18 %) = 59 999 ; 50 848 → 60 001).
--
-- ── Remplissage : rien ne bouge pour le client, sauf Gold lieu ──────────────
-- `price_ttc` reprend le montant que le checkout envoie aujourd'hui au
-- provider (2 950, 29 500, 17 700) et pose 60 000 pour Gold lieu. Aucun plan
-- n'est activé ni désactivé ici : B2C et Pro se basculent depuis la console.
-- Toute ligne dont le HT change est signalée (NOTICE) et journalisée — seul
-- b2b_gold est attendu (65 000 → 50 847).
--
-- ── Montant facturé = montant encaissé ──────────────────────────────────────
-- Un tarif peut changer entre le checkout et la confirmation du paiement. Le
-- checkout fige donc HT et TTC sur l'abonnement (`subscriptions.price_ttc`)
-- et la facture reprend ces montants figés, jamais le prix courant.
--
-- ── Écriture : une RPC admin, auditée ───────────────────────────────────────
-- Aucune policy UPDATE sur `plans`. `admin_update_plan()` (admins actifs,
-- motif obligatoire) change le prix payé et/ou l'activation et journalise
-- l'avant/après dans `admin_audit_log`. Lecture : plans actifs pour tous
-- (policy 0002 inchangée), tous les plans pour le staff actif.
-- Date : 2026-10-18

-- ━━━ 1. Journal d'audit : une action et un type d'entité de plus ━━━━━━━━━━━
-- Extension du CHECK RÉEL (motif 0070/0074) : 0063 avait remplacé la liste et
-- fait disparaître des valeurs ajoutées avant elle. Garde de rejeu : on
-- n'ajoute que ce qui manque.
DO $$
DECLARE
  v_check TEXT;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check
    FROM pg_constraint
   WHERE conrelid = 'public.admin_audit_log'::regclass
     AND conname = 'admin_audit_log_action_check';
  IF position('''plan_update''' IN v_check) = 0 THEN
    ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_action_check;
    EXECUTE format(
      'ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK ((%s) OR action = %L)',
      v_check, 'plan_update'
    );
  END IF;

  SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check
    FROM pg_constraint
   WHERE conrelid = 'public.admin_audit_log'::regclass
     AND conname = 'admin_audit_log_entity_type_check';
  IF position('''plan''' IN v_check) = 0 THEN
    ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_entity_type_check;
    EXECUTE format(
      'ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check CHECK ((%s) OR entity_type = %L)',
      v_check, 'plan'
    );
  END IF;
END;
$$;

-- ━━━ 2. Les colonnes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_ttc  INTEGER,
  ADD COLUMN IF NOT EXISTS tva_amount INTEGER;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS price_ttc INTEGER;

-- ━━━ 3. Le remplissage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Les quatre plans vendus : le prix payé d'aujourd'hui, Gold lieu à 60 000.
-- Une ligne dont le HT change est signalée et journalisée, sans auteur (c'est
-- la migration) : la page Tarifs l'affiche comme dernier changement.
DO $$
DECLARE
  r     RECORD;
  v_ht  NUMERIC;
BEGIN
  FOR r IN
    SELECT p.id, p.code, p.price_ht, p.is_active, v.price_ttc
      FROM public.plans p
      JOIN (VALUES ('gold_monthly', 2950),
                   ('gold_annual',  29500),
                   ('pro',          17700),
                   ('b2b_gold',     60000)) AS v(code, price_ttc)
        ON v.code = p.code
  LOOP
    v_ht := round(r.price_ttc / 1.18);
    UPDATE public.plans
       SET price_ttc  = r.price_ttc,
           price_ht   = v_ht,
           tva_amount = r.price_ttc - v_ht::INTEGER
     WHERE id = r.id;

    IF r.price_ht <> v_ht THEN
      RAISE NOTICE '0079 : % — HT % → % (prix payé % F CFA)',
        r.code, r.price_ht, v_ht, r.price_ttc;
      INSERT INTO public.admin_audit_log
        (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
      VALUES (
        NULL, 'plan_update', 'plan', r.id,
        jsonb_build_object(
          'code', r.code, 'price_ht', r.price_ht,
          -- Ce que le checkout encaissait : HT + TVA arrondie.
          'price_ttc', round(r.price_ht)::INTEGER + round(round(r.price_ht) * 18 / 100.0)::INTEGER,
          'is_active', r.is_active),
        jsonb_build_object(
          'code', r.code, 'price_ht', v_ht, 'price_ttc', r.price_ttc,
          'tva_amount', r.price_ttc - v_ht::INTEGER, 'is_active', r.is_active),
        'Migration 0079 : prix payé d''abord (décision du 18/10/2026)'
      );
    END IF;
  END LOOP;
END;
$$;

-- Lignes hors des quatre plans vendus (aucune attendue) : prix payé
-- reconstitué comme le calculait l'ancien checkout, HT + TVA arrondie. Le HT
-- dérivé retombe alors sur le HT d'origine.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT code, price_ht FROM public.plans WHERE price_ttc IS NULL LOOP
    RAISE NOTICE '0079 : % hors catalogue vendu — prix payé reconstitué depuis % HT', r.code, r.price_ht;
  END LOOP;
END;
$$;

UPDATE public.plans p
   SET price_ttc  = l.ttc,
       price_ht   = round(l.ttc / 1.18),
       tva_amount = l.ttc - round(l.ttc / 1.18)::INTEGER
  FROM (
    SELECT id,
           round(price_ht)::INTEGER + round(round(price_ht) * 18 / 100.0)::INTEGER AS ttc
      FROM public.plans
     WHERE price_ttc IS NULL
  ) AS l
 WHERE p.id = l.id;

-- ━━━ 4. La dérivation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.plans
  ALTER COLUMN price_ttc  SET NOT NULL,
  ALTER COLUMN tva_amount SET NOT NULL;

-- Filet sous le trigger : même trigger désactivé (restauration, réplication),
-- une ligne incohérente est refusée.
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_price_ttc_derivation;
ALTER TABLE public.plans ADD CONSTRAINT plans_price_ttc_derivation CHECK (
  price_ttc >= 0
  AND price_ht = round(price_ttc / 1.18)
  AND tva_amount = price_ttc - price_ht
);

CREATE OR REPLACE FUNCTION public.plans_derive_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Écrivain historique qui ne connaît que le HT (seed 0001, UPDATE … SET
  -- price_ht) : le prix payé se reconstitue comme le calculait l'ancien
  -- checkout, HT + TVA arrondie. Sans cette branche, un HT modifié seul
  -- serait silencieusement recalculé depuis l'ancien prix payé.
  IF NEW.price_ttc IS NULL
     OR (TG_OP = 'UPDATE'
         AND NEW.price_ttc = OLD.price_ttc
         AND NEW.price_ht IS DISTINCT FROM OLD.price_ht) THEN
    IF NEW.price_ht IS NULL THEN
      RAISE EXCEPTION 'plans : prix payé (price_ttc) requis' USING ERRCODE = 'not_null_violation';
    END IF;
    NEW.price_ttc := round(NEW.price_ht)::INTEGER
                   + round(round(NEW.price_ht) * 18 / 100.0)::INTEGER;
  END IF;
  NEW.price_ht   := round(NEW.price_ttc / 1.18);
  NEW.tva_amount := NEW.price_ttc - NEW.price_ht::INTEGER;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.plans_derive_amounts() IS
  'Dérive HT = round(TTC / 1,18) et TVA = TTC − HT depuis le prix payé (0079). '
  'Un écrivain qui ne fournit que le HT obtient TTC = HT + TVA arrondie.';

DROP TRIGGER IF EXISTS plans_derive_amounts ON public.plans;
CREATE TRIGGER plans_derive_amounts
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.plans_derive_amounts();

REVOKE ALL ON FUNCTION public.plans_derive_amounts() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.plans IS
  'Offres commerciales — SEULE source des prix (0079). L''équipe saisit le prix '
  'payé (price_ttc) depuis la page Tarifs de la console (admin_update_plan) ; '
  'HT et TVA en sont dérivés. Le checkout CinetPay, la validation manuelle et '
  'la console lisent cette table : aucun montant en constante dans le code.';
COMMENT ON COLUMN public.plans.price_ttc IS
  'Prix payé par le client, TTC, F CFA entiers. C''est la saisie (0079).';
COMMENT ON COLUMN public.plans.price_ht IS
  'HT dérivé : round(price_ttc / 1,18). Ne se saisit pas (trigger plans_derive_amounts).';
COMMENT ON COLUMN public.plans.tva_amount IS
  'TVA dérivée : price_ttc − price_ht (TVA 18 %). Ne se saisit pas.';

-- ━━━ 5. L'abonnement fige ce que le client paie ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_price_ttc_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_price_ttc_check
  CHECK (price_ttc IS NULL OR price_ttc >= price_ht);

COMMENT ON COLUMN public.subscriptions.price_ttc IS
  'Prix payé TTC figé au checkout ou à la validation (0079) : la facture le '
  'reprend même si le tarif change ensuite — montant facturé = montant encaissé. '
  'NULL = abonnement antérieur à 0079 : TTC = HT + TVA arrondie, le calcul '
  'd''alors.';

-- ━━━ 6. Lecture : tout le staff voit tous les plans ━━━━━━━━━━━━━━━━━━━━━━━━
-- La policy 0002 `plans_select_active` (plans actifs, tout le monde) reste.
-- Celle-ci ajoute les plans désactivés pour le staff actif. Le prédicat garde
-- son EXECUTE pour `authenticated` (piège 0058 → 0061).
DROP POLICY IF EXISTS plans_select_staff ON public.plans;
CREATE POLICY plans_select_staff ON public.plans
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- Aucune policy INSERT/UPDATE/DELETE : l'écriture passe par la RPC ci-dessous.

-- ━━━ 7. L'écriture : admin_update_plan ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.admin_update_plan(
  p_code      TEXT,
  p_price_ttc INTEGER,
  p_is_active BOOLEAN,
  p_reason    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff  UUID := auth.uid();
  v_avant  public.plans%ROWTYPE;
  v_apres  public.plans%ROWTYPE;
BEGIN
  IF NOT public.is_admin_staff(v_staff) THEN
    RAISE EXCEPTION 'forbidden: admin staff required' USING ERRCODE = '42501';
  END IF;

  -- Un entier positif, plafonné à 1 000 000 F CFA. Le plafond n'arrête pas
  -- un zéro de trop sur 60 000 — la confirmation de la console montre l'avant
  -- et l'après pour ça — mais il arrête un montant absurde.
  IF p_price_ttc IS NULL OR p_price_ttc <= 0 OR p_price_ttc > 1000000 THEN
    RAISE EXCEPTION 'prix payé invalide : entier de 1 à 1 000 000 F CFA'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_is_active IS NULL THEN
    RAISE EXCEPTION 'statut actif ou inactif requis' USING ERRCODE = 'check_violation';
  END IF;
  -- Un changement de prix sans motif est ingérable : personne ne saura dire
  -- au client pourquoi son abonnement a changé de prix.
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'motif obligatoire' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_avant FROM public.plans WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan % introuvable', p_code USING ERRCODE = 'P0002';
  END IF;

  -- Rien ne change : rien n'est écrit ni journalisé.
  IF v_avant.price_ttc = p_price_ttc AND v_avant.is_active = p_is_active THEN
    RETURN jsonb_build_object(
      'changed', false, 'code', v_avant.code, 'price_ttc', v_avant.price_ttc,
      'price_ht', v_avant.price_ht, 'tva_amount', v_avant.tva_amount,
      'is_active', v_avant.is_active, 'updated_at', v_avant.updated_at);
  END IF;

  UPDATE public.plans
     SET price_ttc = p_price_ttc, is_active = p_is_active
   WHERE id = v_avant.id
  RETURNING * INTO v_apres;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
  VALUES (
    v_staff, 'plan_update', 'plan', v_avant.id,
    jsonb_build_object('code', v_avant.code, 'price_ttc', v_avant.price_ttc,
                       'price_ht', v_avant.price_ht, 'tva_amount', v_avant.tva_amount,
                       'is_active', v_avant.is_active),
    jsonb_build_object('code', v_apres.code, 'price_ttc', v_apres.price_ttc,
                       'price_ht', v_apres.price_ht, 'tva_amount', v_apres.tva_amount,
                       'is_active', v_apres.is_active),
    p_reason
  );

  RETURN jsonb_build_object(
    'changed', true, 'code', v_apres.code, 'price_ttc', v_apres.price_ttc,
    'price_ht', v_apres.price_ht, 'tva_amount', v_apres.tva_amount,
    'is_active', v_apres.is_active, 'updated_at', v_apres.updated_at);
END;
$$;

COMMENT ON FUNCTION public.admin_update_plan(TEXT, INTEGER, BOOLEAN, TEXT) IS
  'Change le prix payé (TTC, 1 à 1 000 000 F CFA) et/ou l''activation d''un '
  'plan ; HT et TVA suivent par trigger. Admins actifs uniquement (42501), motif '
  'obligatoire, avant/après journalisés dans admin_audit_log (plan_update). Vaut '
  'pour les nouveaux paiements : les abonnements et factures émis gardent leurs '
  'montants figés.';

REVOKE ALL ON FUNCTION public.admin_update_plan(TEXT, INTEGER, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_plan(TEXT, INTEGER, BOOLEAN, TEXT) TO authenticated;

-- ━━━ 8. La validation manuelle facture le prix payé, au franc près ━━━━━━━━━
-- Corps de 0063, à trois différences près : TTC et TVA lus dans `plans`,
-- TTC figé sur l'abonnement, TVA et TTC fournis à la facture (le trigger
-- 0032 n'en calcule plus aucun) ; le TTC rejoint l'audit et le retour.
-- Réservée aux ADMINS, pas aux modérateurs : la modération porte sur du
-- contenu, ceci ouvre un droit facturé.
CREATE OR REPLACE FUNCTION public.approve_payment_request(
  p_request_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff        UUID := auth.uid();
  v_req          public.payment_requests%ROWTYPE;
  v_customer_id  UUID;
  v_cust_type    TEXT;
  v_price_ht     INTEGER;
  v_price_ttc    INTEGER;
  v_tva_amount   INTEGER;
  v_months       INTEGER;
  v_sub_id       UUID;
  v_started      TIMESTAMPTZ := now();
  v_expires      TIMESTAMPTZ;
  v_name         TEXT;
BEGIN
  IF NOT public.is_admin_staff(v_staff) THEN
    RAISE EXCEPTION 'forbidden: admin staff required' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE : deux admins qui valident la même demande en même temps se
  -- sérialisent ; le second voit 'approved' et sort en no-op.
  SELECT * INTO v_req FROM public.payment_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN jsonb_build_object('idempotent', true, 'subscription_id', v_req.subscription_id);
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'demande déjà traitée (%)', v_req.status USING ERRCODE = 'check_violation';
  END IF;

  -- ── Prix : le catalogue, jamais le montant déclaré ────────────────────────
  -- Le prix payé est la saisie de l'équipe, HT et TVA en sont dérivés (0079) :
  -- les trois partent tels quels sur l'abonnement et la facture.
  SELECT p.price_ht::INTEGER, p.price_ttc, p.tva_amount,
         CASE p.period WHEN 'annual' THEN 12 WHEN 'monthly' THEN 1 ELSE 1 END
    INTO v_price_ht, v_price_ttc, v_tva_amount, v_months
    FROM public.plans p WHERE p.code = v_req.plan AND p.is_active;
  IF v_price_ht IS NULL THEN
    RAISE EXCEPTION 'plan % absent du catalogue actif', v_req.plan USING ERRCODE = 'P0002';
  END IF;
  v_expires := v_started + make_interval(months => v_months);

  -- ── Le client commercial (0002) ───────────────────────────────────────────
  v_cust_type := CASE WHEN v_req.customer_type = 'b2b' THEN 'b2b_business' ELSE 'b2c_individual' END;
  SELECT id INTO v_customer_id FROM public.customers
   WHERE spawter_id = v_req.requester_id AND customer_type = v_cust_type;
  IF v_customer_id IS NULL THEN
    SELECT COALESCE(display_name, 'Spawter') INTO v_name
      FROM public.spawters WHERE id = v_req.requester_id;
    INSERT INTO public.customers
      (spawter_id, customer_type, display_name, billing_country_code, billing_currency_code)
    VALUES (v_req.requester_id, v_cust_type, COALESCE(v_name, 'Spawter'), 'CI', 'XOF')
    RETURNING id INTO v_customer_id;
  END IF;

  -- ── L'abonnement ──────────────────────────────────────────────────────────
  -- `provider_tx_id` unique (0032) = idempotence : un double-clic sur
  -- « Valider » ne peut pas créer deux abonnements, la contrainte refuse.
  -- Le prix payé y est figé (0079), comme au checkout.
  INSERT INTO public.subscriptions
    (customer_id, customer_type, plan, price_ht, price_ttc, tva_rate, currency, status,
     provider, provider_tx_id, started_at, expires_at, grace_until)
  VALUES
    (v_customer_id, v_req.customer_type, v_req.plan, v_price_ht, v_price_ttc, 18.00, 'XOF', 'active',
     'manuel', 'manuel:' || p_request_id::TEXT, v_started, v_expires, NULL)
  RETURNING id INTO v_sub_id;

  -- Renouvellement pendant la grâce : l'ancien abonnement est clos, un seul
  -- droit actif à la fois (même règle que le webhook).
  UPDATE public.subscriptions
     SET status = 'expired'
   WHERE customer_id = v_customer_id AND status = 'grace' AND id <> v_sub_id;

  -- ── Rôle B2B — le paiement OUVRE le droit ─────────────────────────────────
  -- Sens unique, comme pour CinetPay : l'expiration ne rétrograde pas
  -- automatiquement, la coupure d'un compte lieu reste un acte humain.
  IF v_req.plan IN ('pro', 'b2b_gold') THEN
    UPDATE public.b2b_accounts
       SET role = CASE WHEN v_req.plan = 'b2b_gold' THEN 'gold' ELSE 'pro' END
     WHERE auth_user_id = v_req.requester_id;
  END IF;

  -- ── La facture ────────────────────────────────────────────────────────────
  -- Le trigger de 0032 pose le numéro (SPAWT-AAAA-NNNN). TVA et TTC viennent du
  -- catalogue (0079) : la facture dit le prix payé au franc près, là où
  -- round(HT × 18 %) donnerait 59 999 pour Gold lieu.
  INSERT INTO public.invoices
    (subscription_id, customer_id, customer_type, price_ht, tva_rate, tva_amount, price_ttc,
     currency, status, provider_tx_id, issued_at, paid_at)
  VALUES
    (v_sub_id, v_customer_id, v_req.customer_type, v_price_ht, 18.00, v_tva_amount, v_price_ttc,
     'XOF', 'paid', 'manuel:' || p_request_id::TEXT, v_started, v_started);

  -- ── La demande ────────────────────────────────────────────────────────────
  UPDATE public.payment_requests
     SET status = 'approved', decided_by = v_staff, decided_at = now(),
         decision_reason = p_reason, subscription_id = v_sub_id
   WHERE id = p_request_id;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
  VALUES (
    v_staff, 'payment_request_approve', 'payment_request', p_request_id,
    jsonb_build_object('status', 'pending', 'plan', v_req.plan,
                       'montant_declare', v_req.amount_declare,
                       'moyen', v_req.method, 'reference', v_req.reference),
    jsonb_build_object('status', 'approved', 'subscription_id', v_sub_id,
                       'price_ht', v_price_ht, 'price_ttc', v_price_ttc,
                       'expires_at', v_expires),
    p_reason
  );

  RETURN jsonb_build_object(
    'subscription_id', v_sub_id, 'expires_at', v_expires, 'price_ht', v_price_ht,
    'price_ttc', v_price_ttc);
END;
$$;

COMMENT ON FUNCTION public.approve_payment_request(UUID, TEXT) IS
  'Valide une déclaration de paiement : ouvre l''abonnement, clôt une grâce '
  'éventuelle, synchronise le rôle B2B, émet la facture et journalise — le '
  'tout en UNE transaction. Admins actifs uniquement. Idempotente (un second '
  'appel renvoie l''abonnement déjà créé).';

REVOKE ALL ON FUNCTION public.approve_payment_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID, TEXT) TO authenticated;

-- PostgREST doit voir tout de suite price_ttc et admin_update_plan : sans
-- rechargement, le checkout échouerait fermé et la page Tarifs resterait vide.
NOTIFY pgrst, 'reload schema';
