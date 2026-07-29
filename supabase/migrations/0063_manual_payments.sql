-- ============================================================================
-- Migration 0063 — paiement à validation manuelle (CinetPay devient secondaire)
-- ============================================================================
-- Décision produit : à Abidjan, l'essentiel des paiements passe par Wave,
-- Orange Money, MTN MoMo, Moov Money — souvent d'un compte à un autre, sans
-- passerelle. CinetPay reste utile (carte, agrégation), mais ce n'est plus la
-- condition d'ouverture de la monétisation. Il faut donc un chemin qui ne
-- dépende d'aucune clé d'API : le payeur DÉCLARE son versement, l'équipe le
-- VALIDE, le droit s'ouvre.
--
-- Ce que ça débloque : le paywall géographique (`paywall-geo`), le droit Gold,
-- les rôles B2B Pro/Gold. Tous attendaient qu'un moyen de payer existe — pas
-- qu'un fournisseur particulier soit branché.
--
-- ── Pourquoi la demande est une simple table, écrite par le client ──────────
-- Une demande n'accorde RIEN. C'est une déclaration : « j'ai envoyé 2 950 F
-- par Wave, référence TX123 ». La laisser passer par la RLS (insert own) évite
-- une Edge Function de plus, et le montant déclaré n'est jamais cru : le prix
-- facturé vient du catalogue `plans`, pas du formulaire.
--
-- ── Pourquoi la DÉCISION est une fonction SQL, pas une Edge Function ────────
-- Le webhook CinetPay enchaîne quatre écritures (activer, superséder la grâce,
-- synchroniser le rôle B2B, émettre la facture) avec rattrapage « best effort »
-- sur chacune — il n'a pas le choix, il vit hors de la base. Une validation
-- manuelle, elle, tient dans UNE transaction : soit le Spawter est Gold avec sa
-- facture et sa ligne d'audit, soit rien ne s'est passé. Aucun état
-- intermédiaire à rattraper à la main, aucune facture orpheline.
--
-- ── Idempotence ─────────────────────────────────────────────────────────────
-- `subscriptions.provider_tx_id` est UNIQUE (0032). On y écrit
-- `manuel:<id de la demande>` : un double-clic sur « Valider » ne peut pas
-- créer deux abonnements, la contrainte le refuse. Même garantie que pour un
-- webhook rejoué, sans code supplémentaire.
--
-- ── Un écart de catalogue, réconcilié au passage ────────────────────────────
-- `plans` (0001) portait 22 000 HT pour l'annuel là où le checkout facture
-- 25 000 (arbitrage fondateur, cf. `_shared/payment/types.ts`). L'écart était
-- documenté et sans effet tant que `plans` ne servait à rien. Il devient
-- dangereux ici : la validation manuelle lit le catalogue SQL, elle
-- facturerait 3 000 F de moins que la carte bancaire pour le même abonnement.
-- On aligne `plans` sur le prix réellement pratiqué et on y ajoute les deux
-- plans B2B, absents jusqu'ici.
-- Date : 2026-07-29

-- ━━━ 1. Réconciliation du catalogue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATE public.plans SET price_ht = 25000 WHERE code = 'gold_annual' AND price_ht <> 25000;

INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
VALUES
  ('pro',      'Spawt Pro — lieu',  15000, 'XOF', 'CI', 'monthly', true),
  ('b2b_gold', 'Spawt Gold — lieu', 65000, 'XOF', 'CI', 'monthly', true)
ON CONFLICT (code) DO UPDATE
  SET price_ht = EXCLUDED.price_ht, label = EXCLUDED.label, is_active = true;

COMMENT ON TABLE public.plans IS
  'Offres commerciales — source de vérité SQL des prix. Doit rester alignée '
  'sur `supabase/functions/_shared/payment/types.ts` (PLAN_PRICING), qui sert '
  'le checkout CinetPay. Un écart entre les deux facture deux prix différents '
  'pour le même abonnement selon le canal.';

-- ━━━ 2. La demande de paiement ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Le payeur, au sens auth : un Spawter pour le B2C, le compte porteur du
  -- dossier B2B pour un lieu. Même convention que `customers.spawter_id`.
  requester_id     UUID NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  customer_type    TEXT NOT NULL CHECK (customer_type IN ('b2c','b2b')),
  plan             TEXT NOT NULL
                     CHECK (plan IN ('gold_monthly','gold_annual','pro','b2b_gold')),
  method           TEXT NOT NULL
                     CHECK (method IN ('wave','orange_money','mtn_momo','moov_money',
                                       'especes','virement','autre')),
  -- Ce que le payeur DIT avoir versé, en XOF TTC. Informatif : il sert à
  -- l'équipe pour rapprocher avec le relevé, jamais à calculer la facture.
  amount_declare   INTEGER NOT NULL CHECK (amount_declare > 0),
  -- Référence de la transaction chez l'opérateur, et numéro émetteur : les
  -- deux seules choses qui permettent de retrouver un versement.
  reference        TEXT,
  payer_phone      TEXT CHECK (payer_phone IS NULL OR payer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by       UUID REFERENCES public.spawt_staff(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,
  decision_reason  TEXT,
  subscription_id  UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Une décision sans décideur ni date serait intraçable ; un rejet sans motif
  -- est ingérable au support (« pourquoi on m'a refusé ? »).
  CONSTRAINT payment_requests_decision_complete CHECK (
    (status = 'pending'  AND decided_by IS NULL AND decided_at IS NULL)
    OR (status = 'cancelled')
    OR (status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CONSTRAINT payment_requests_reject_needs_reason CHECK (
    status <> 'rejected' OR nullif(btrim(coalesce(decision_reason, '')), '') IS NOT NULL
  )
);

COMMENT ON TABLE public.payment_requests IS
  'Déclarations de paiement hors passerelle (Wave, Orange Money, MoMo, Moov, '
  'espèces, virement). Une demande n''accorde AUCUN droit : seule '
  'approve_payment_request() ouvre l''abonnement, et elle est réservée aux '
  'admins. Le montant déclaré n''est jamais utilisé pour facturer.';
COMMENT ON COLUMN public.payment_requests.amount_declare IS
  'Montant TTC annoncé par le payeur, en XOF. Sert au rapprochement avec le '
  'relevé de l''opérateur. La facture, elle, est calculée depuis `plans`.';

CREATE INDEX IF NOT EXISTS payment_requests_pending_idx
  ON public.payment_requests (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS payment_requests_requester_idx
  ON public.payment_requests (requester_id, created_at DESC);

CREATE TRIGGER update_timestamp_payment_requests
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Quota : 3 demandes en attente par compte ────────────────────────────────
-- Sans plafond, un compte peut noyer la file de modération. Même motif que le
-- quota de 5 suggestions de lieu (0039). Trois, parce qu'un payeur légitime
-- peut se tromper de plan une fois et corriger — pas dix.
CREATE OR REPLACE FUNCTION public.payment_requests_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.payment_requests
       WHERE requester_id = NEW.requester_id AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'quota: 3 demandes de paiement en attente maximum'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_requests_quota_trg ON public.payment_requests;
CREATE TRIGGER payment_requests_quota_trg
  BEFORE INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.payment_requests_quota();

REVOKE ALL ON FUNCTION public.payment_requests_quota() FROM PUBLIC, anon, authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.payment_requests TO authenticated;

-- Le payeur déclare pour lui-même. `status` n'est pas dans le WITH CHECK par
-- hasard : la valeur par défaut est 'pending' et la policy UPDATE ci-dessous
-- interdit d'en sortir autrement que par annulation.
CREATE POLICY payment_requests_insert_own ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');

CREATE POLICY payment_requests_select_own ON public.payment_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

CREATE POLICY payment_requests_select_staff ON public.payment_requests
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- Un payeur peut ANNULER sa demande tant qu'elle est en attente (il s'est
-- trompé de plan, il a finalement payé par carte). Il ne peut jamais
-- l'approuver : le WITH CHECK n'autorise que 'cancelled' comme sortie.
CREATE POLICY payment_requests_cancel_own ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() AND status = 'pending')
  WITH CHECK (requester_id = auth.uid() AND status = 'cancelled');

-- Aucune policy UPDATE pour l'équipe : la décision passe EXCLUSIVEMENT par les
-- fonctions ci-dessous, qui sont les seules à savoir ouvrir un droit
-- proprement (abonnement + facture + rôle B2B + audit, en une transaction).

-- ━━━ 3. Journal d'audit : deux actions de plus ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'login',
    'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
    'place_adn_update',
    'review_keep', 'review_delete', 'review_warning',
    'spawter_warning', 'spawter_ban', 'spawter_unban',
    'seed_inventory_run',
    'spawter_internal_grant', 'spawter_internal_revoke',
    'payment_request_approve', 'payment_request_reject'
  ));

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_entity_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check
  CHECK (entity_type IN (
    'place','place_adn','spawt_checkin','spawter','session','seed_batch',
    'review_reports','push_campaign','place_event','place_promotion','challenge',
    'place_suggestion','b2b_account','feature_flag','explore_collection',
    'explore_item','payment_request'
  ));

-- ━━━ 4. L'approbation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
  SELECT p.price_ht::INTEGER,
         CASE p.period WHEN 'annual' THEN 12 WHEN 'monthly' THEN 1 ELSE 1 END
    INTO v_price_ht, v_months
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
  INSERT INTO public.subscriptions
    (customer_id, customer_type, plan, price_ht, tva_rate, currency, status,
     provider, provider_tx_id, started_at, expires_at, grace_until)
  VALUES
    (v_customer_id, v_req.customer_type, v_req.plan, v_price_ht, 18.00, 'XOF', 'active',
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
  -- Le trigger de 0032 pose le numéro (SPAWT-AAAA-NNNN), la TVA et le TTC.
  INSERT INTO public.invoices
    (subscription_id, customer_id, customer_type, price_ht, tva_rate, currency,
     status, provider_tx_id, issued_at, paid_at)
  VALUES
    (v_sub_id, v_customer_id, v_req.customer_type, v_price_ht, 18.00, 'XOF',
     'paid', 'manuel:' || p_request_id::TEXT, v_started, v_started);

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
                       'price_ht', v_price_ht, 'expires_at', v_expires),
    p_reason
  );

  RETURN jsonb_build_object(
    'subscription_id', v_sub_id, 'expires_at', v_expires, 'price_ht', v_price_ht);
END;
$$;

COMMENT ON FUNCTION public.approve_payment_request(UUID, TEXT) IS
  'Valide une déclaration de paiement : ouvre l''abonnement, clôt une grâce '
  'éventuelle, synchronise le rôle B2B, émet la facture et journalise — le '
  'tout en UNE transaction. Admins actifs uniquement. Idempotente (un second '
  'appel renvoie l''abonnement déjà créé).';

-- ━━━ 5. Le refus ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.reject_payment_request(
  p_request_id UUID,
  p_reason     TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff UUID := auth.uid();
  v_req   public.payment_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin_staff(v_staff) THEN
    RAISE EXCEPTION 'forbidden: admin staff required' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    -- Un refus sans motif est ingérable au support : le payeur rappelle, et
    -- personne ne sait quoi lui dire.
    RAISE EXCEPTION 'motif de refus obligatoire' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_req FROM public.payment_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status = 'rejected' THEN RETURN true; END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'demande déjà traitée (%)', v_req.status USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.payment_requests
     SET status = 'rejected', decided_by = v_staff, decided_at = now(),
         decision_reason = p_reason
   WHERE id = p_request_id;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
  VALUES (
    v_staff, 'payment_request_reject', 'payment_request', p_request_id,
    jsonb_build_object('status', 'pending', 'plan', v_req.plan,
                       'montant_declare', v_req.amount_declare, 'moyen', v_req.method),
    jsonb_build_object('status', 'rejected'),
    p_reason
  );
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.reject_payment_request(UUID, TEXT) IS
  'Refuse une déclaration de paiement. Motif obligatoire (le support en a '
  'besoin). Admins actifs uniquement, journalisée.';

REVOKE ALL ON FUNCTION public.approve_payment_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_payment_request(UUID, TEXT)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(UUID, TEXT)  TO authenticated;

-- ━━━ 6. Les instructions de versement, pilotables sans redéployer ━━━━━━━━━━
-- Les numéros Wave/Orange/MTN changent ; les figer dans le bundle du portail
-- imposerait un rebuild à chaque correction. On les met en base, lisibles par
-- tout le monde (ce sont des coordonnées publiques, elles n'ont d'intérêt que
-- si elles circulent), modifiables par un admin.
CREATE TABLE IF NOT EXISTS public.payment_instructions (
  method      TEXT PRIMARY KEY
                CHECK (method IN ('wave','orange_money','mtn_momo','moov_money',
                                  'especes','virement','autre')),
  label       TEXT NOT NULL,
  destinataire TEXT,
  instructions TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_instructions IS
  'Coordonnées de versement affichées au payeur (numéro Wave, compte MoMo…). '
  'En base et pas dans le bundle : un numéro qui change ne doit pas imposer un '
  'rebuild du portail. Lecture publique — ces coordonnées sont faites pour '
  'circuler ; écriture admin.';

ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_instructions TO anon, authenticated;

CREATE POLICY payment_instructions_select_all ON public.payment_instructions
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY payment_instructions_write_admin ON public.payment_instructions
  FOR ALL TO authenticated
  USING (public.is_admin_staff()) WITH CHECK (public.is_admin_staff());

CREATE TRIGGER update_timestamp_payment_instructions
  BEFORE UPDATE ON public.payment_instructions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Amorçage : désactivé par défaut, avec le texte à compléter. Un moyen de
-- paiement affiché sans numéro valide est pire que pas de moyen du tout — il
-- fait croire à un versement possible et génère du support.
INSERT INTO public.payment_instructions (method, label, destinataire, instructions, is_active, sort_order)
VALUES
  ('wave', 'Wave', NULL,
   'Envoie le montant au numéro Wave de SPAWT, puis note la référence de la transaction ci-dessous.',
   false, 10),
  ('orange_money', 'Orange Money', NULL,
   'Transfert Orange Money vers le numéro SPAWT, puis reporte l''ID de transaction.',
   false, 20),
  ('mtn_momo', 'MTN MoMo', NULL,
   'Transfert MTN MoMo vers le numéro SPAWT, puis reporte l''ID de transaction.',
   false, 30),
  ('moov_money', 'Moov Money', NULL,
   'Transfert Moov Money vers le numéro SPAWT, puis reporte l''ID de transaction.',
   false, 40),
  ('virement', 'Virement bancaire', NULL,
   'Virement sur le compte SPAWT, puis reporte la référence du virement.',
   false, 50),
  ('especes', 'Espèces', NULL,
   'Remise en main propre à un membre de l''équipe SPAWT.',
   false, 60)
ON CONFLICT (method) DO NOTHING;
