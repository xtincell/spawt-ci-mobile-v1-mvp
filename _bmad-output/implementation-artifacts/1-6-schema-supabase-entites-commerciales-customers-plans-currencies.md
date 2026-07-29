# Story 1.6: Schéma Supabase — entités commerciales (customers, plans, currencies)

Status: done

## Story

As a équipe SPAWT,
I want les tables `customers`, `plans` et `currencies` créées et seedées, plus la FK différée `spawters.customer_id → customers(id)` ajoutée,
so that la fondation multi-pays / multi-devises est prête sans activer le paiement, et la séparation B2C/commercial (amendement 4.2) est figée DB.

## ⚠️ Brownfield context — read first

Story 1.5 a livré `spawters.customer_id uuid NULL` **sans contrainte FK** (ordering : `customers` n'existait pas encore). Cette story crée `customers` et **ajoute la contrainte FK** sur `spawters.customer_id` via `ALTER TABLE`. Cohérence avec architecture §17.2.

**Aucun code mobile n'utilise ces tables en V1** — le paiement (CinetPay) est Sprint 2. Cette story est une **fondation infra** : les tables existent, les hooks de conversion devise sont présents mais inactifs.

**Pas de type TS `Customer`/`Plan`/`Currency`** dans `app/src/types/` actuellement. Cette story les crée comme contrat TS aligné sur le SQL.

## Acceptance Criteria

1. **Migration `0002_create_customers_plans_currencies.sql`** crée les 3 tables :

   **`currencies`** (référentiel devises) :
   - `code` text PRIMARY KEY (ISO 4217 : `XOF`, `USD`, `EUR`, `NGN`, etc.)
   - `label` text NOT NULL
   - `base_rate` numeric(12, 6) NOT NULL — taux de référence vers USD (informatif V1, utilisé en V2)
   - `modifier` numeric(12, 6) NOT NULL DEFAULT 1 — modificateur multi-pays (ajustement local)
   - `country_code` text NOT NULL — pays principal de la devise (CHECK IN liste pays SPAWT)
   - `is_active` boolean NOT NULL DEFAULT false
   - `created_at`, `updated_at` timestamptz

   **`plans`** (offres commerciales) :
   - `id` uuid PRIMARY KEY DEFAULT `gen_random_uuid()`
   - `code` text NOT NULL UNIQUE — slug stable (`gold_monthly`, `gold_annual`)
   - `label` text NOT NULL
   - `price_ht` numeric(12, 2) NOT NULL CHECK >= 0
   - `currency_code` text NOT NULL REFERENCES `currencies(code)` ON DELETE RESTRICT
   - `country_code` text NOT NULL CHECK IN liste pays SPAWT
   - `period` text NOT NULL CHECK IN (`'monthly'`, `'annual'`, `'lifetime'`)
   - `is_active` boolean NOT NULL DEFAULT true
   - `created_at`, `updated_at` timestamptz

   **`customers`** (entité commerciale — amendement 4.2 séparation B2C) :
   - `id` uuid PRIMARY KEY DEFAULT `gen_random_uuid()`
   - `spawter_id` uuid NOT NULL REFERENCES `spawters(id)` ON DELETE CASCADE
   - `customer_type` text NOT NULL CHECK IN (`'b2c_individual'`, `'b2b_business'`, `'influencer'`) DEFAULT `'b2c_individual'`
   - `display_name` text NOT NULL
   - `billing_country_code` text NOT NULL CHECK IN liste pays SPAWT
   - `billing_currency_code` text NOT NULL REFERENCES `currencies(code)` ON DELETE RESTRICT
   - `created_at`, `updated_at` timestamptz
   - UNIQUE constraint `(spawter_id, customer_type)` — un spawter peut avoir au max un customer par type.

2. **FK différée `spawters.customer_id`** ajoutée :
   ```sql
   ALTER TABLE public.spawters
     ADD CONSTRAINT spawters_customer_id_fkey
       FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
   ```

3. **Index** :
   - `customers_spawter_id_idx` BTREE (`spawter_id`) — lookup customer pour un spawter donné.
   - `plans_country_code_idx` BTREE — feed plans par pays.
   - `plans_is_active_idx` partial `WHERE is_active = true` — filtre actifs.
   - `currencies_country_code_idx` BTREE.

4. **Triggers** `update_timestamp_*` réutilisant `set_updated_at()` (créé Story 1.5) sur les 3 tables.

5. **RLS activée** sur les 3 tables :
   - **`customers`** : RLS PII forte
     - `customers_select_own` : `FOR SELECT USING (spawter_id = auth.uid())`
     - `customers_insert_own` : `FOR INSERT WITH CHECK (spawter_id = auth.uid())`
     - `customers_update_own` : `FOR UPDATE USING (spawter_id = auth.uid()) WITH CHECK (spawter_id = auth.uid())`
     - Pas de DELETE public — soft-delete via Edge Function (cohérent NFR-SEC-04).
     - `customers_select_staff` : staff actif lit tous.
   - **`plans`** : référentiel public en LECTURE
     - `plans_select_all` : `FOR SELECT USING (is_active = true)` — tous les plans actifs lisibles par tous (anon + authenticated). Pas de PII.
     - Pas d'INSERT/UPDATE/DELETE public — modification via Supabase Admin UI ou Edge Function service_role.
   - **`currencies`** : référentiel public en LECTURE
     - `currencies_select_all` : `FOR SELECT USING (is_active = true)` — idem `plans`.

6. **Seed Sprint 1** dans `supabase/seed/0001_seed_currencies_plans.sql` :
   - `currencies` : insert `XOF` (`is_active = true`, `base_rate = 0.00165` vers USD, `modifier = 1`, `country_code = 'CI'`). Autres devises (`USD`, `EUR`, `NGN`, …) insérées avec `is_active = false` (visibilité future).
   - `plans` : insert `gold_monthly` (`price_ht = 2500`, `currency_code = XOF`, `country_code = CI`, `period = monthly`) + `gold_annual` (`price_ht = 22000`, `currency_code = XOF`, `country_code = CI`, `period = annual`).

7. **Migration down `0002_..down.sql`** réversible + idempotente. Ordre de drop : `customers` (referencing FK), puis `plans` + `currencies`. **Important** : drop d'abord la contrainte FK `spawters_customer_id_fkey` avant `DROP TABLE customers` (sinon erreur dépendance).

8. **Types TS canoniques** créés dans `app/src/types/commerce.ts` :
   - `interface Customer { id, spawter_id, customer_type, display_name, billing_country_code, billing_currency_code, created_at, updated_at }`
   - `interface Plan { id, code, label, price_ht, currency_code, country_code, period: PlanPeriod, is_active, created_at, updated_at }`
   - `interface Currency { code, label, base_rate, modifier, country_code, is_active, created_at, updated_at }`
   - Type unions : `CustomerType`, `PlanPeriod`.

9. **Hooks conversion devise inactifs** : créer `app/src/lib/currency.ts` exposant `convertPrice(amount: number, from: Currency, to: Currency): number` qui retourne `amount` tel quel en V1 (pas de conversion réelle, modifier × base_rate ignoré). Documenter avec `// V2 : activer la conversion réelle quand subscriptions cross-currency seront wirées`.

10. **README mis à jour** : table d'état Sprint 1 dans `supabase/README.md` cocher 0002.

## Tasks

- [x] **Task 1** — `0002_create_customers_plans_currencies.sql`
- [x] **Task 2** — `0002_create_customers_plans_currencies.down.sql`
- [x] **Task 3** — `supabase/seed/0001_seed_currencies_plans.sql`
- [x] **Task 4** — `app/src/types/commerce.ts`
- [x] **Task 5** — `app/src/lib/currency.ts` (stub V1)
- [x] **Task 6** — sprint-status.yaml update + README cocher 0002
- [x] **Task 7** — Triple gate

## Dev Notes

### Pourquoi `currencies.code` PK (text) au lieu d'un `id` uuid ?

ISO 4217 garantit l'unicité globale (`XOF`, `USD`, `EUR`) et est le **slug naturel** dans le code mobile (`plan.currency_code === "XOF"` plus lisible qu'un uuid). Coût : les FK referenceront un text PK au lieu d'un uuid. C'est acceptable — la table fait ~10 lignes, perf négligeable.

### Pourquoi `plans.currency_code` text et pas `currency_id` uuid ?

Cohérence avec `currencies.code` PK text. Une string ISO 4217 est aussi explicite qu'un uuid et plus debuggable.

### Pourquoi pas de FK `customers.spawter_id → spawters(id)` ON DELETE CASCADE ?

Si on cascade, suppression spawter = suppression customer = perte historique facturation. Mais nous **n'avons pas encore** la table `subscriptions`/`invoices` (Sprint 2). Pour V1 c'est OK de cascade (pas d'historique à préserver). À reconsidérer Sprint 2 (le cascade `customers → subscriptions` est OK ; côté `spawter → customer`, on bascule peut-être en `ON DELETE RESTRICT` + soft-delete avec marquage `is_anonymized`).

**Décision V1** : `ON DELETE CASCADE` simple, cohérent avec NFR-SEC-04 (anonymisation J+30 efface tout par cascade quand le compte est purgé).

### Comment fonctionne `convertPrice` V1 ?

Stub no-op : `return amount`. Le hook existe pour câbler l'UI future (`<Text>{convertPrice(plan.price_ht, currency_XOF, user_currency)} {user_currency.code}</Text>`) mais en V1 tous les prix sont en XOF, tous les utilisateurs en CI, donc pas de conversion. Activer V2 quand un user NG ou SN s'abonne à un plan XOF.

### Project Context invariants respectés

- Convention vocab : `customers` table (entité commerciale séparée, amendement 4.2). Jamais `users` ni `accounts`.
- `country_code` partout (NFR-PORT-01).
- RLS activée systématique. PII → `spawter_id = auth.uid()`. Référentiel (`plans`, `currencies`) → SELECT public si `is_active`, jamais d'INSERT/UPDATE public.
- Pas de hex en dur, pas de string FR (cette story est SQL + TS — pas concerné par i18n directement).

### Files touched

- `supabase/migrations/0002_create_customers_plans_currencies.sql` (NEW)
- `supabase/migrations/0002_create_customers_plans_currencies.down.sql` (NEW)
- `supabase/seed/0001_seed_currencies_plans.sql` (NEW)
- `app/src/types/commerce.ts` (NEW)
- `app/src/lib/currency.ts` (NEW — stub V1)
- `supabase/README.md` (UPDATE — cocher 0002)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE — 1-6-... done)

## Dev Agent Record

### Agent Model Used
claude-opus-4-7[1m]

### Completion Notes
- Migration up + down + seed + 2 fichiers TS livrés. Triple gate vert.
- FK différée `spawters.customer_id_fkey` ajoutée dans 0002 up + dropped dans 0002 down (ordre correct).
- Hooks conversion devise = stub no-op documenté ; activation V2 quand cross-currency subscriptions seront wirées.

### File List
Voir « Files touched » ci-dessus.

### Review Findings (2026-05-16)

Couche source : Blind Hunter + Edge Case Hunter + Acceptance Auditor (mode `full`).

**Patch (3)**

- [ ] [Review][Patch] **`currencies_select_active` cache les currencies inactives → plans référençant une devise inactive renvoient `currency: null` côté client** [`supabase/migrations/0002_create_customers_plans_currencies.sql:1589-1593`] — RLS filtre côté SELECT, mais `plans.currency_code` peut référencer une currency `is_active=false` (4 currencies seedées comme telles). Le client résout `currency` → `null` et l'UI affiche `"undefined"` ou crash sur `currency.symbol`. Fix : (a) policy `currencies_select_all` `USING (true)` (devises = lookup public), OU (b) trigger CHECK qui empêche un plan de référencer une currency inactive.
- [ ] [Review][Patch] **`spawters.customer_id ↔ customers.spawter_id` back-edge sans CHECK d'intégrité** [`0001_..sql` + `0002_..sql:1568-1571`] — `spawters.customer_id` peut pointer vers un `customer` qui appartient à un autre spawter. Pas de garde-fou. Fix : constraint trigger qui vérifie `customer.spawter_id = spawter.id` lors de UPDATE/INSERT sur `spawters.customer_id`.
- [ ] [Review][Patch] **README `supabase/README.md` « État Sprint 1 » ligne 0002 reste `⏳`** [`supabase/README.md:1227`] — story `Status: done` mais le README contredit. Flipper `⏳ Story 1.6` → `✅ Story 1.6`. Patch combiné avec Stories 1.7 + 1.8 (un seul edit README).

**Defer (3)**

- [x] [Review][Defer] **`customers` UNIQUE `(spawter_id, customer_type)` — race d'insert concurrent depuis 2 devices** [`0002_..sql:1565`] — second device reçoit `23505` opaque. → Caller adapter doit faire `INSERT ... ON CONFLICT DO NOTHING`. À implémenter quand l'adapter customers atterrit (post-Epic 2 paywall).
- [x] [Review][Defer] **`plans.price_ht = 0 AND period = 'lifetime'` non bloqué** [`0002_..sql:25-29`] — création accidentelle d'un « Gold gratuit à vie » possible. → Ajouter CHECK ou seeded plan codes whitelist quand l'admin panel de plans landera.
- [x] [Review][Defer] **`currencies` FK `ON DELETE RESTRICT` → lock-in opérationnel** [`0002_..sql:57-58`] — une currency référencée ne peut jamais être supprimée. Probablement voulu mais pas documenté. → Tracer dans `supabase/README.md` ou architecture doc lors d'un cleanup pass.

**Dismissed (faux positifs)**

- ~~AC #3 index nommé `plans_active_idx` au lieu de `plans_is_active_idx`~~ — cosmétique, prédicat partial WHERE identique.
- ~~AC #5 policies `*_select_active` au lieu de `*_select_all`~~ — cosmétique, comportement identique.

#### Review Triage Summary (Story 1.6)

- 0 decision-needed
- 3 patch — **tous appliqués**
- 3 deferred
- 2 dismissed

#### Review Patches Applied (2026-05-16)

- ✅ P14 — `currencies_select_all USING (true)` (lookup public lisible en intégralité)
- ✅ P13 — constraint trigger `spawters_customer_id_owned` (back-edge intégrité)
- ✅ P20 README `0002 ⏳ → ✅`
- ✅ Triple gate vert post-patches
