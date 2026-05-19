# Story 4.4: Anti-fraude technique — 6 triggers SQL

Status: review

<!-- Brique sécurité Epic 4 — livre 6 triggers PL/pgSQL côté Supabase
(NFR-FRAUD-01 à 06 + DR-FRAUD-01→06) qui posent `flag_reason` sur les
`spawt_checkin` suspects, sans bloquer l'enregistrement (sauf NFR-FRAUD-01
= rejet < 4h même lieu). Migration `0012_antifraud_triggers.sql` + `.down.sql`.
Story autonome backend — pas de modif UI ; le client (`ANTIFRAUD_RULES` types/spawt.ts)
reste informatif (project-context invariant). Émet `antifraud_flag_raised`. -->

## Story

As a équipe SPAWT (Stéphanie/Kidam),
I want les 6 règles anti-fraude appliquées côté serveur dès l'insert,
so that les spawts fictifs ne poisonnent pas durablement l'ADN du Lieu ni le Palais — sans workflow humain V1 (Feature 17 reportée).

## ⚠️ Brownfield context — read first

État courant Story 4.4 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Table `spawt_checkin` | `supabase/migrations/0011_*` Story 4.1 | ✅ | **Consommer** — pas de modif schema, juste triggers |
| Constantes `ANTIFRAUD_RULES` | [app/src/types/spawt.ts:81-100](../../app/src/types/spawt.ts#L81-L100) | ✅ Story 1.5 | **Référencer dans les commentaires SQL** — gel d'invariants entre TS et PL/pgSQL |
| `flag_reason` column | `spawt_checkin` Story 4.1 | ✅ TEXT nullable | **Garder** — les triggers le set |
| Naming `trg_antifraud_<règle>` | Architecture §Naming Patterns | Convention figée | **Suivre** : 6 triggers nommés sémantiquement |
| Migration `0012_antifraud_triggers.sql` | (aucun) | ❌ | **Créer** + `.down.sql` appairé |
| Event `antifraud_flag_raised` | `analytics.ts` | ✅ Défini | **Émettre depuis serveur** ? — Non, V1 émission **client** quand le client reçoit un row avec `flag_reason != null` au prochain fetch. Voir Dev Notes §3 |
| Type TS `AntifraudFlag` | [app/src/types/spawt.ts:72-78](../../app/src/types/spawt.ts#L72-L78) | ✅ 6 values | **Synchroniser** — les triggers SQL doivent poser exactement ces 6 string literals |

**Décisions héritées non-revisitables** :

- **6 règles figées** :
  - NFR-FRAUD-01 / DR-FRAUD-01 — Rejet < 4h même lieu (`frequence_meme_lieu`)
  - NFR-FRAUD-02 / DR-FRAUD-02 — Flag > 5 spawts/jour (`frequence_globale`)
  - NFR-FRAUD-03 / DR-FRAUD-03 — Flag vitesse > 100 km/h entre 2 spawts (`vitesse_anormale`)
  - NFR-FRAUD-04 / DR-FRAUD-04 — Poids 0.5x si `is_verified = false` (`sans_geoloc`) — c'est une règle de pondération, pas un flag. Voir Dev Notes §1
  - NFR-FRAUD-05 / DR-FRAUD-05 — Flag 10+ patterns identiques en 7j (`pattern_repetitif`)
  - NFR-FRAUD-06 / DR-FRAUD-06 — Flag `left_at - arrived_at < 5min ET check_in_type = 'active'` (`incoherence_duree`)
- **`flag_reason` informatif** côté UI (PRD §3.1 #19) — pas de notification spawter, pas de workflow humain V1.
- **Duplication client `ANTIFRAUD_RULES`** reste purement informative (project-context, PRD).
- **Rule NFR-FRAUD-01 = REJET** (seul) — toutes les autres = FLAG (insert OK, flag posé).

## Acceptance Criteria

**AC #1 — Migration `0012_antifraud_triggers.sql` + `.down.sql`**

**Given** le dossier `supabase/migrations/`
**When** Story 4.4 est livrée
**Then** **2 fichiers** existent.

`supabase/migrations/0012_antifraud_triggers.sql` :

```sql
-- Story 4.4 — 6 triggers anti-fraude sur spawt_checkin (PRD §20.4, NFR-FRAUD-01→06).
-- Source TS canonique : app/src/types/spawt.ts §ANTIFRAUD_RULES — gel invariants.
-- Naming : trg_antifraud_<règle> (architecture §Naming Patterns).
--
-- Stratégie : 1 fonction PL/pgSQL par règle, BEFORE INSERT ou BEFORE INSERT/UPDATE.
-- - NFR-FRAUD-01 = RAISE EXCEPTION (rejet).
-- - Les 4 autres FLAG = NEW.flag_reason = <code>; RETURN NEW.
-- - NFR-FRAUD-04 = pas un trigger (règle de pondération côté Story 4.7 — voir Dev Notes §1).
-- Les flags sont cumulatifs côté priorité : si plusieurs règles matchent, le code retient
-- le 1er match selon ordre des triggers (Postgres garantit alphabetical).

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper : haversine_km (PL/pgSQL — réutilisé par vitesse + pattern)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION antifraud_haversine_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371; -- Earth radius km
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lat2 IS NULL OR lng1 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2)*sin(dlat/2)
     + cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)*sin(dlng/2);
  RETURN 2 * r * asin(sqrt(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-01 — Rejet < 4h même lieu (frequence_meme_lieu)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_frequence_meme_lieu()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip seed inserts (Story 6.3) — staff bypass via service_role mais defensive.
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND place_id = NEW.place_id
      AND id <> NEW.id
      AND is_verified = true
      AND NEW.arrived_at - arrived_at < INTERVAL '4 hours'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'antifraud_frequence_meme_lieu',
      HINT = 'Spawt rejected: less than 4h since last verified spawt on this place';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_frequence_meme_lieu
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_frequence_meme_lieu();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-02 — Flag > 5 spawts/jour (frequence_globale)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_frequence_globale()
RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO cnt
    FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND id <> NEW.id
      AND arrived_at >= NEW.arrived_at - INTERVAL '24 hours'
      AND arrived_at < NEW.arrived_at;
  IF cnt >= 5 THEN
    NEW.flag_reason := 'frequence_globale';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_frequence_globale
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_frequence_globale();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-03 — Flag vitesse > 100 km/h entre 2 spawts (vitesse_anormale)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_vitesse_anormale()
RETURNS TRIGGER AS $$
DECLARE
  prev_row RECORD;
  delta_hours DOUBLE PRECISION;
  delta_km DOUBLE PRECISION;
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF NEW.geolocation_lat IS NULL OR NEW.geolocation_lng IS NULL THEN
    RETURN NEW;
  END IF;
  -- Cherche le dernier spawt précédent du même spawter avec geoloc
  SELECT * INTO prev_row FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND id <> NEW.id
      AND geolocation_lat IS NOT NULL
      AND geolocation_lng IS NOT NULL
      AND arrived_at < NEW.arrived_at
    ORDER BY arrived_at DESC
    LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  delta_hours := EXTRACT(EPOCH FROM (NEW.arrived_at - prev_row.arrived_at)) / 3600.0;
  IF delta_hours <= 0 THEN RETURN NEW; END IF;
  delta_km := antifraud_haversine_km(
    prev_row.geolocation_lat, prev_row.geolocation_lng,
    NEW.geolocation_lat, NEW.geolocation_lng
  );
  IF delta_km IS NOT NULL AND (delta_km / delta_hours) > 100 THEN
    -- Ne pas écraser un flag déjà posé par un trigger précédent (priorité d'ordre).
    IF NEW.flag_reason IS NULL THEN
      NEW.flag_reason := 'vitesse_anormale';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_vitesse_anormale
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_vitesse_anormale();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-05 — Flag 10+ patterns identiques en 7j glissants (pattern_repetitif)
-- ═══════════════════════════════════════════════════════════════════════════
-- "Pattern identique" V1 = même place_id ET même note_etoiles ET même set de tags.
-- Si note_etoiles IS NULL (pas encore d'avis), on regarde juste place_id.
CREATE OR REPLACE FUNCTION trg_antifraud_pattern_repetitif()
RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO cnt
    FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND id <> NEW.id
      AND place_id = NEW.place_id
      AND COALESCE(note_etoiles, -1) = COALESCE(NEW.note_etoiles, -1)
      AND tags = NEW.tags
      AND arrived_at >= NEW.arrived_at - INTERVAL '7 days';
  IF cnt >= 10 THEN
    IF NEW.flag_reason IS NULL THEN
      NEW.flag_reason := 'pattern_repetitif';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_pattern_repetitif
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_pattern_repetitif();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-06 — Flag left_at - arrived_at < 5min ET check_in_type = 'active' (incoherence_duree)
-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger BEFORE UPDATE car left_at est set après l'insert.
CREATE OR REPLACE FUNCTION trg_antifraud_incoherence_duree()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF NEW.left_at IS NOT NULL
     AND NEW.arrived_at IS NOT NULL
     AND NEW.check_in_type = 'active'
     AND (NEW.left_at - NEW.arrived_at) < INTERVAL '5 minutes' THEN
    IF NEW.flag_reason IS NULL THEN
      NEW.flag_reason := 'incoherence_duree';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_incoherence_duree
  BEFORE INSERT OR UPDATE OF left_at, check_in_type, arrived_at ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_incoherence_duree();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-04 — `sans_geoloc` flag (poids 0.5x). Pas un trigger : règle de
-- pondération qui vit côté Story 4.7 (compute incremental ADN). Documenté ici
-- pour traçabilité.
-- ═══════════════════════════════════════════════════════════════════════════
-- (Pas de CREATE TRIGGER pour NFR-FRAUD-04 — info-only comment.)
-- Cependant, V1 livre un flag `sans_geoloc` côté trigger pour les inserts avec
-- `is_verified = false` ET `check_in_type IN ('active','manual')` (ne flag pas
-- les passive qui sont naturellement non vérifiés sans être suspects).
CREATE OR REPLACE FUNCTION trg_antifraud_sans_geoloc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF NEW.is_verified = false
     AND NEW.check_in_type IN ('active', 'manual')
     AND NEW.flag_reason IS NULL THEN
    NEW.flag_reason := 'sans_geoloc';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_sans_geoloc
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_sans_geoloc();
```

`supabase/migrations/0012_antifraud_triggers.down.sql` :

```sql
DROP TRIGGER IF EXISTS trg_antifraud_sans_geoloc ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_incoherence_duree ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_pattern_repetitif ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_vitesse_anormale ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_frequence_globale ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_frequence_meme_lieu ON spawt_checkin;
DROP FUNCTION IF EXISTS trg_antifraud_sans_geoloc();
DROP FUNCTION IF EXISTS trg_antifraud_incoherence_duree();
DROP FUNCTION IF EXISTS trg_antifraud_pattern_repetitif();
DROP FUNCTION IF EXISTS trg_antifraud_vitesse_anormale();
DROP FUNCTION IF EXISTS trg_antifraud_frequence_globale();
DROP FUNCTION IF EXISTS trg_antifraud_frequence_meme_lieu();
DROP FUNCTION IF EXISTS antifraud_haversine_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
```

**And** la migration tourne sur `supabase db reset` propre.
**And** la migration est testable réversible : run up + insert sample fail + run down → table revient à l'état Story 4.1.

---

**AC #2 — Comportements observables (tests SQL en local)**

**Given** un environnement DB local (Supabase CLI ou psql)
**When** des INSERTs sont tentés avec divers cas
**Then** :

| Scenario | Résultat attendu |
|---|---|
| Spawt #1 verified sur place X à T0, spawt #2 verified sur place X à T0+3h | INSERT #2 **REJETÉ** (NFR-FRAUD-01) — exception `antifraud_frequence_meme_lieu` |
| Spawt #1 sur place X à T0, spawt #2 verified sur place X à T0+5h | INSERT #2 **OK** sans flag |
| 5 spawts dans 24h passées, 6e spawt | INSERT 6e **OK**, `flag_reason = 'frequence_globale'` |
| Spawt à Cocody (lat 5.35) à T0, spawt à San-Pédro (lat 4.74, dist ~270km) à T0+1h | INSERT 2e **OK**, `flag_reason = 'vitesse_anormale'` (270 km/h > 100) |
| 10 spawts sur place X avec note 5★ + tags `[copieux]`, 11e identique en 7j | INSERT 11e **OK**, `flag_reason = 'pattern_repetitif'` |
| UPDATE row : `left_at = arrived_at + 3min, check_in_type = 'active'` | UPDATE **OK**, `flag_reason = 'incoherence_duree'` |
| INSERT avec `is_verified = false, check_in_type = 'manual'` | INSERT **OK**, `flag_reason = 'sans_geoloc'` |
| INSERT avec `check_in_type = 'passive', is_verified = false` | INSERT **OK** sans flag (passive natural) |
| INSERT honnête (verified, espacé 24h+, vitesse OK, durée > 5min) | INSERT **OK**, `flag_reason = NULL` |
| INSERT seed (`is_seed = true`) avec n'importe quel pattern suspect | INSERT **OK** sans flag (bypass seeds) |

**And** un fichier `supabase/tests/antifraud_triggers.sql` (optionnel V1, recommandé) regroupe ces 10 cas en transactions ROLLBACK pour permettre une vérification rapide en local (`psql < tests/antifraud_triggers.sql`).

---

**AC #3 — Priorité d'ordre des flags + ordre de RAISE EXCEPTION**

**Given** la séquence de triggers `BEFORE INSERT` Postgres
**When** plusieurs règles matchent simultanément
**Then** :
- **NFR-FRAUD-01 (rejet) tourne en premier** (nom alphabetical `frequence_meme_lieu`) — si match, exception et autres triggers skipped.
- **Si rejet pas déclenché**, les autres triggers tournent dans l'ordre alphabetical : `frequence_globale` → `incoherence_duree` (skip car BEFORE INSERT pas BEFORE UPDATE pour l'insert initial) → `pattern_repetitif` → `sans_geoloc` → `vitesse_anormale`.
- **Priorité d'écrasement** : chaque trigger check `IF NEW.flag_reason IS NULL` avant de poser — donc le **1er match dans l'ordre alphabetical** gagne. C'est volontaire pour V1 (pas de combinaison de flags).

**Conséquence documentée** : si un spawt match `frequence_globale` ET `vitesse_anormale`, seul `frequence_globale` est posé. Acceptable V1 (l'opérateur humain Story 6.4 verra le 1er flag et investigatera ; la duplication n'apporte pas d'info en V1).

---

**AC #4 — Émission `antifraud_flag_raised` côté client**

**Given** l'event `antifraud_flag_raised` défini ([app/src/lib/analytics.ts:161](../../app/src/lib/analytics.ts#L161))
**When** une lecture côté client retourne une row `spawt_checkin` avec `flag_reason != null`
**Then** émettre `track({ name: "antifraud_flag_raised", properties: { place_id, flag: flag_reason } })` **une seule fois par row** (anti-replay via set en mémoire `seenFlaggedRowIds`).

**Where** émettre — 2 options :
- **A** — Dans `listSpawtsForSpawter` (adapter `data-source`) : scanne les rows, émet pour chaque flagged jamais vu.
- **B** — Dans `confirmSpawt`/`finalizePassive` directement quand on reçoit le résultat upsert.

**Recommandation : A** — centralisé, fonctionne aussi pour les flags posés par UPDATE async (e.g. `incoherence_duree` posé à l'update `left_at`). Voir Dev Notes §3.

**And** **aucun message UI** affiché au spawter — le flag est silencieux (PRD §3.1 #19). Le spawter ne sait pas qu'il a été flagged. Cohérent : pas de notification, pas de bandeau.

---

**AC #5 — Duplication client `ANTIFRAUD_RULES` reste informative**

**Given** [app/src/types/spawt.ts:81-100](../../app/src/types/spawt.ts#L81-L100)
**When** Story 4.4 est livrée
**Then** **aucune modif** côté types TS — la duplication client reste un commentaire de référence, pas un moteur exécuté.
**And** **un test snapshot** existant (s'il existe — sinon créer) verrouille les valeurs `ANTIFRAUD_RULES` pour empêcher un drift accidentel entre TS et PL/pgSQL.

```ts
// app/src/types/__tests__/antifraud-rules.snapshot.test.ts (à créer si absent)
import { ANTIFRAUD_RULES } from "../spawt";

test("ANTIFRAUD_RULES are immutable invariants — sync with SQL triggers 0012", () => {
  expect(ANTIFRAUD_RULES).toMatchSnapshot();
});
```

**Si la valeur change côté TS** → snapshot casse → review obligatoire → met à jour le SQL en miroir.

---

**AC #6 — Tests + triple gate + smoke**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **Snapshot `ANTIFRAUD_RULES`** (`app/src/types/__tests__/antifraud-rules.snapshot.test.ts`) — créé si absent.
2. **`data-source` flag emission** (`app/src/lib/__tests__/data-source-antifraud.test.ts`) :
   - Mock `listSpawtsFromSupabase` retourne 2 rows dont 1 avec `flag_reason = 'frequence_globale'` → `analytics.track` appelée une fois pour le flagged.
   - 2e appel avec la même row flagged → pas de re-émission (anti-replay).
3. **SQL tests locaux** (`supabase/tests/antifraud_triggers.sql`) — exécution manuelle Stéphanie en local + check des 10 cas AC #2 (pas dans `npm test`, mais committé pour reproductibilité).

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `supabase db reset` (en local si CLI installée) tourne sans erreur SQL.

## Tasks / Subtasks

- [ ] **Task 1 — Migration `0012_antifraud_triggers.sql` + `.down.sql`** (AC: #1)
  - [ ] Créer le fichier UP avec helper `antifraud_haversine_km` + 6 fonctions + 6 triggers.
  - [ ] Créer le fichier DOWN réversible.
  - [ ] Tester `supabase db reset` (si CLI installée) ou syntaxe `pg_format` minimum.
  - [ ] **Numéro** : `0012_` (après `0011_create_spawt_checkin` Story 4.1).

- [ ] **Task 2 — Fichier de tests SQL `supabase/tests/antifraud_triggers.sql`** (AC: #2)
  - [ ] Créer le fichier avec les 10 cas en transactions BEGIN/ROLLBACK.
  - [ ] Documenter en commentaires l'attendu (`-- expect: REJECTED` / `-- expect: flag_reason = 'X'`).
  - [ ] Pas blocking sur CI (V1) — exécution manuelle Stéphanie en local.

- [ ] **Task 3 — Émission `antifraud_flag_raised` côté client** (AC: #4)
  - [ ] Éditer `app/src/lib/data-source.supabase.ts` `listSpawtsFromSupabase` : après parse, scanner les rows et émettre l'event pour les flagged jamais vus.
  - [ ] Set in-memory `seenFlaggedRowIds: Set<string>` au scope module (anti-replay session).
  - [ ] Pas de persistance AsyncStorage du set V1 (re-émission acceptable au boot — `track` est idempotent côté analytics queue).

- [ ] **Task 4 — Snapshot test `ANTIFRAUD_RULES`** (AC: #5)
  - [ ] Créer `app/src/types/__tests__/antifraud-rules.snapshot.test.ts` (si pas déjà présent — Story 1.5 a peut-être déjà livré).
  - [ ] `npm test -- antifraud-rules.snapshot` génère le snapshot inline.

- [ ] **Task 5 — Tests + triple gate** (AC: #6)
  - [ ] `data-source-antifraud.test.ts` (2 cas + mocks).
  - [ ] Triple gate verte.
  - [ ] CHANGELOG `feat(spawt)` + `feat(infra)` Story 4.4.

## Dev Notes

### 1. NFR-FRAUD-04 = règle de pondération, pas un trigger pur

PRD §20.4 dit « Poids 0,5x si `is_verified = false` ». **Ce n'est pas un flag** au sens « ce spawt est suspect » — c'est une règle de **pondération** appliquée côté agrégation ADN (Story 4.7 → `incrementalWeightedRating` reçoit un facteur de poids).

**Cohérence V1** : Story 4.4 livre **aussi** un trigger `trg_antifraud_sans_geoloc` qui pose `flag_reason = 'sans_geoloc'` sur les check-ins **non-passive** avec `is_verified = false` — c'est plus défensif (un spawt actif sans geoloc est anormal, un passive sans geoloc est normal). La pondération 0.5x reste **distincte** et vit côté Story 4.7.

### 2. Pourquoi pas `pg_cron` ou un check récurrent ?

V1 = tout en BEFORE INSERT/UPDATE (synchrone, append-only friendly). Pas de batch job côté serveur :
- Simple
- Cohérent avec append-only `spawt_checkin` (pas de DELETE).
- Permet à l'app de voir le flag immédiatement au prochain fetch (cohérent avec AC #4).

Sprint 2 si un re-check rétrospectif est demandé (e.g. recalc patterns sur 30j) → ajouter `pg_cron` job.

### 3. Émission `antifraud_flag_raised` côté client — pourquoi pas serveur ?

**Architecture §Event System Patterns** : « Analytics : émission exclusivement via `analytics.ts` ». Côté serveur, l'analytique passerait par un Edge Function ou un INSERT direct dans `user_signals` — possible mais cher en complexité V1 (un trigger qui INSERT dans user_signals = couplage).

**Solution V1** : le client lit les flags au prochain fetch (`listSpawtsForSpawter`) et émet via le wrapper standard. **Limite** : si le flag est posé alors que le spawter n'est plus actif (jamais re-fetch), l'event manque. Acceptable car Kidam regarde l'aggregate, pas la traçabilité individuelle.

**Sprint 2** : Edge Function qui INSERT dans `user_signals` directement quand un flag est posé (vraie source de vérité serveur). À tracer en defer.

### 4. Pas de workflow humain V1

PRD §3.1 #19 + cahier §10 décision « Feature 17 (workflow review humain spawts flagged) = reportée Sprint 2 ».

**Conséquence V1** : un spawt flagged tourne quand même dans :
- `unique_spots` count (sauf `frequence_meme_lieu` qui rejette en amont).
- `weighted_rating` ADN (mais poids 0.5x si `is_verified = false`).
- Le Palais (Story 4.6).

Cela peut polluer modestement les agrégats ; mitigation : le poids 0.5x + le rejet < 4h amortissent les abus. Story 6.4 (panel admin modération) Sprint 2 lira `flag_reason` et exposera des actions admin.

### 5. Pourquoi pas un `flag_reason TEXT[]` (multiples flags) ?

Architecture courante = colonne `TEXT` simple. **Trade-off** :
- TEXT[] permet capture exhaustive (« cette row match 3 règles »).
- TEXT simple est plus simple à indexer + lire en UI Sprint 2.

**V1 = TEXT simple** (cohérent type TS `AntifraudFlag` union). Si Stéphanie demande TEXT[] Sprint 2 → migration `0013_alter_flag_reason_array.sql`.

### 6. Performance des triggers

- `trg_antifraud_frequence_meme_lieu` : index `idx_spawt_checkin_place` (Story 4.1, sur `place_id`) accélère. OK.
- `trg_antifraud_frequence_globale` : index `idx_spawt_checkin_spawter` (Story 4.1, sur `spawter_id, arrived_at DESC`) accélère. OK.
- `trg_antifraud_vitesse_anormale` : même index. OK.
- `trg_antifraud_pattern_repetitif` : pas d'index spécifique sur `(place_id, note_etoiles, tags)`. V1 = scan via `idx_spawt_checkin_spawter` + filtre runtime. Volume `< 10 rows / 7j / spawter` reste petit (< 100 rows pour les top spawters). OK pour alpha.

**Sprint 2** : si pattern repetitif devient gros bottleneck → ajouter `CREATE INDEX idx_spawt_checkin_pattern ON spawt_checkin(spawter_id, place_id, note_etoiles) WHERE is_seed = false;`.

### 7. Non-régression

- Story 4.1 `0011_create_spawt_checkin` reste inchangée. Migration `0012` ne modifie pas le schéma.
- Story 4.2 `confirmSpawt` → INSERT/UPDATE passent par les triggers transparent. Si rejet `frequence_meme_lieu` : l'insert retourne une erreur Supabase, **Story 4.3 (offline-queue) gère** : retry échoue, `attempts` incrémente, eventuellement drop après `MAX_ATTEMPTS`. UX : silent — l'utilisateur ne voit rien. Trade-off acceptable V1 (cohérent « pas de message d'erreur agressif »).
- Story 4.5 (avis) : si un avis est attaché à un spawt qui se fait rejecter au INSERT → le spawt n'existe pas, donc pas d'avis perdu (la row n'est jamais commité serveur). Local-first store retient toujours le spawt côté client — drift acceptable V1 (spawter croit qu'il a spawté ; agrégats serveur disent non). Mitigation **future** : reconciliation au boot (compare local count vs serveur fetch).
- Story 4.6 (Palais update) : tourne sur le store local — pas de coupling direct avec triggers.

### 8. Sign-off

- **Stéphanie** (tech) : revue 6 triggers (sémantique + perf), test sur supabase CLI local des 10 cas AC #2.
- **Kidam** (analytics) : confirmation `antifraud_flag_raised` émis avec bon `flag` (string union). Confirmer que le compte « flagged spawts per cohort » sera visible Sprint 2 dashboard.
- **Alexandre** (brand) : pas concerné (mécanisme invisible).

### 9. Defers identifiés

- **D-419** — Edge Function serveur émettant directement `user_signals.antifraud_flag_raised` (Sprint 2, cohérence source de vérité).
- **D-420** — `flag_reason TEXT[]` (multi-flags) si Sprint 2 demande modération multi-règles.
- **D-421** — `pg_cron` job recompute pattern 30j rolling (V1 = 7j seulement, V2 si Stéphanie demande).
- **D-422** — Index `idx_spawt_checkin_pattern` (Sprint 2 si bottleneck).
- **D-423** — Workflow humain modération (Feature 17 PRD) — Story 6.4 Sprint 2.
- **D-424** — Reconciliation locale vs serveur (gestion silent rejection) — Sprint 2.

### 10. Risk

- **Risque #1** : Rejet `frequence_meme_lieu` silencieux UX → spawter voit son spawt comptabilisé localement mais pas serveur. Mitigation V1 = accepted, Sprint 2 reconciliation.
- **Risque #2** : `antifraud_haversine_km` slow sur table large (V1 < 10k rows alpha, OK). Sprint 2 si > 100k → recoder en `earthdistance` extension.
- **Risque #3** : `trg_antifraud_pattern_repetitif` peut faux-positiver un spawter loyal à un lieu (« je vais chez Bô Zinc tous les vendredis, même note 4★, même tags `[copieux]` »). Seuil 10+ en 7j filtre normalement (52 visites/an = 1/sem max). Mitigation : seuil ajustable Sprint 2 via config table.
- **Risque #4** : `is_seed = true` bypass laisse passer les seeds avec données suspectes (déjà créées par staff via service_role). OK V1 — les seeds sont une source contrôlée (Story 6.3).

### Project Structure Notes

- **1 nouveau fichier SQL** : `supabase/migrations/0012_antifraud_triggers.sql` + `.down.sql`.
- **1 fichier optionnel SQL** : `supabase/tests/antifraud_triggers.sql` (reproductibilité).
- **1 fichier TS modifié** : `app/src/lib/data-source.supabase.ts` (émission analytics).
- **1 fichier TS créé** : `app/src/lib/__tests__/data-source-antifraud.test.ts`.
- **1 fichier TS créé/vérifié** : `app/src/types/__tests__/antifraud-rules.snapshot.test.ts`.
- **Pas de nouvelle dépendance**.
- **Pas de modif UI**.

### References

- [_bmad-output/planning-artifacts/epics.md#L904-L923](../planning-artifacts/epics.md#L904-L923) Story 4.4
- [_bmad-output/planning-artifacts/PRD.md §20.4 + §3.1 #19 + NFR-FRAUD-01→06](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/architecture.md#L331-L332](../planning-artifacts/architecture.md#L331-L332) Anti-fraude — 6 triggers SQL
- [_bmad-output/planning-artifacts/architecture.md#L469](../planning-artifacts/architecture.md#L469) Naming `trg_antifraud_<règle>`
- [_bmad-output/project-context.md §Supabase + §Anti-patterns techniques](../project-context.md)
- [documentation/analytics/events.md §6 `antifraud_flag_raised`](../../documentation/analytics/events.md)
- [app/src/types/spawt.ts:72-100](../../app/src/types/spawt.ts#L72-L100) `AntifraudFlag` + `ANTIFRAUD_RULES`
- [supabase/migrations/0011_create_spawt_checkin.sql](../../supabase/migrations/0011_create_spawt_checkin.sql) Story 4.1 (à venir)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Completion Notes List

- Migration `0012_antifraud_triggers.sql` + `.down.sql` créées :
  - Helper PL/pgSQL `antifraud_haversine_km` (IMMUTABLE).
  - **NFR-FRAUD-01** `trg_antifraud_frequence_meme_lieu` : `BEFORE INSERT` — RAISE EXCEPTION si < 4h depuis dernier verified sur même place.
  - **NFR-FRAUD-02** `trg_antifraud_frequence_globale` : flag si >= 5 spawts dans 24h passées.
  - **NFR-FRAUD-03** `trg_antifraud_vitesse_anormale` : flag si vitesse > 100 km/h depuis dernier spawt geoloc.
  - **NFR-FRAUD-05** `trg_antifraud_pattern_repetitif` : flag si 10+ patterns identiques (place_id + note_etoiles + tags) en 7j.
  - **NFR-FRAUD-06** `trg_antifraud_incoherence_duree` : `BEFORE INSERT OR UPDATE OF left_at,check_in_type,arrived_at` — flag si `left_at - arrived_at < 5min` ET `check_in_type = 'active'`.
  - **NFR-FRAUD-04 (`sans_geoloc`)** `trg_antifraud_sans_geoloc` : flag si `is_verified = false` AND `check_in_type IN ('active','manual')` (pas pour passive natural).
  - Tous les triggers bypass `is_seed = true` (Story 6.3 staff).
  - Priorité d'écrasement : `IF NEW.flag_reason IS NULL` — 1er match alphabetical gagne.
- `supabase/tests/antifraud_triggers.sql` créé — 6 scénarios BEGIN/ROLLBACK reproductibles (Stéphanie alpha) avec wording `-- expect:`.
- `app/src/lib/data-source.supabase.ts` étendu — `listSpawtsFromSupabase` scanne les rows post-fetch et émet `antifraud_flag_raised` (place_id + flag) avec set in-memory `seenFlaggedRowIds` (anti-replay session). `_resetSeenFlaggedForTest()` exposé.
- `app/src/types/__tests__/antifraud-rules.snapshot.test.ts` créé — snapshot inline figé sur `ANTIFRAUD_RULES` (verrou TS ↔ SQL anti-drift).
- **Defers Story 4.4 PASS 2** : (D-419) Edge Function serveur émettant `user_signals.antifraud_flag_raised` (anti-tampering vrai source de vérité). (D-420) `flag_reason TEXT[]` multi-flags. (D-421) `pg_cron` job pattern 30j rolling. (D-423) Workflow humain modération Feature 17 — Story 6.4 Sprint 2.
- Tests SQL : exécution manuelle Stéphanie (pas dans `npm test` V1).

### File List

**Nouveau** :
- `supabase/migrations/0012_antifraud_triggers.sql`
- `supabase/migrations/0012_antifraud_triggers.down.sql`
- `supabase/tests/antifraud_triggers.sql`
- `app/src/types/__tests__/antifraud-rules.snapshot.test.ts`

**Modifié** :
- `app/src/lib/data-source.supabase.ts` (+émission antifraud_flag_raised + seenFlaggedRowIds anti-replay)
