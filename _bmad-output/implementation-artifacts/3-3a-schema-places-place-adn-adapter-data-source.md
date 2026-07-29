# Story 3.3a: Schéma `places` / `place_adn` & adapter data-source

Status: review

<!-- Story de fondation Epic 3 — livre la migration SQL `0010_create_places_place_adn.sql` (table `places`, table 1:1 `place_adn`, RLS `is_published`-aware, index quartier/cuisine), durcit l'adapter `data-source.ts` avec Zod parse à la frontière `data-source.supabase.ts` (pattern architecture §Data Architecture), et seed les 12 lieux existants `SEED_PLACES` côté Supabase. Story autonome — pas de dépendance UI ; alimente 3.3b (moteur), 3.3c (HomeD), 3.4 (fiche lieu), 3.5 (recherche), 3.6 (favoris), Story 6.2 (Admin CRUD lieux). Indépendante de 3.3b (3.3b travaille sur les types existants). -->

## Story

As a développeur SPAWT,
I want les tables `places` / `place_adn` migrées avec RLS + index, l'adapter `data-source.ts` durci avec Zod parse à la frontière + fallback transparent vers `SEED_PLACES`, et un seed Supabase qui charge les 12 lieux existants,
so that les écrans Epic 3 (HomeD, fiche lieu, recherche, favoris) consomment les lieux via la règle d'or sans jamais toucher Supabase directement — en mode démo comme en mode live.

## ⚠️ Brownfield context — read first

Cette story **complète** un état partiel :
- L'adapter `data-source.ts` **existe déjà** ([app/src/lib/data-source.ts](../../app/src/lib/data-source.ts)) avec `listPlaces` / `getPlace` / `listSpawtsForSpawter` et le pattern fallback `SEED_PLACES`.
- L'implémentation Supabase `data-source.supabase.ts` **existe déjà** ([app/src/lib/data-source.supabase.ts](../../app/src/lib/data-source.supabase.ts)) avec `listPlacesFromSupabase` / `getPlaceFromSupabase` qui font le SELECT correct (`select("*, place_adn(*)").eq("is_published", true)`).
- Mais : **aucune migration SQL** `places` / `place_adn` n'existe encore ; les tables ne sont pas créées côté Supabase. La RLS n'est pas définie. Aucun Zod parse — l'adapter cast `as PlaceAdn` sans validation runtime. Et `SEED_PLACES` n'est pas seedé côté DB.

**État actuel** :

| Élément | Fichier / Table | État | Action Story 3.3a |
|---|---|---|---|
| Migration `places` | `supabase/migrations/0010_create_places_place_adn.sql` | ❌ N'existe pas | **Créer** + `.down.sql` appairé |
| Migration `place_adn` | `supabase/migrations/0010_create_places_place_adn.sql` | ❌ N'existe pas (1 fichier groupé pour les 2 tables 1:1) | **Créer** dans la même migration |
| RLS sur `places` / `place_adn` | (aucune) | ❌ N'existe pas | **Définir** dans la migration — SELECT public si `is_published = true`, INSERT/UPDATE staff-only (Story 6.2 affinera côté admin) |
| Schémas Zod | `app/src/types/place.schema.ts` | ❌ N'existent pas | **Créer** — `PlaceSchema`, `PlaceAdnSchema`, `PlaceWithAdnSchema`. Le type `Place` existant en `app/src/types/place.ts` reste, dérivé via `z.infer` (refactor doux — cohérent architecture §Data Architecture) |
| Adapter `listPlaces` | [app/src/lib/data-source.ts:43-49](../../app/src/lib/data-source.ts#L43-L49) | ✅ Existe (fallback OK) | **Garder** — pas de refactor signature |
| Adapter Supabase `listPlacesFromSupabase` | [app/src/lib/data-source.supabase.ts:12-29](../../app/src/lib/data-source.supabase.ts#L12-L29) | ⚠️ Cast `as Place` / `as PlaceAdn` sans Zod | **Durcir** : `PlaceWithAdnSchema.safeParse(row)` → si fail, drop la row + `__DEV__` log, fallback transparent |
| Seed Supabase | `supabase/seed/places.sql` | ❌ N'existe pas | **Créer** — script SQL qui INSERT les 12 lieux SEED_PLACES côté `places` + `place_adn` |
| Helper TS pour seed | (aucun) | — | **Optionnel** : script `app/scripts/generate-seed-places-sql.mjs` qui transforme `SEED_PLACES` → SQL INSERT. Sinon, écrire le SQL à la main. **V1** = à la main, suffit pour 12 lieux. |
| Type `PlaceWithAdn` | [app/src/lib/data-source.ts:37-41](../../app/src/lib/data-source.ts#L37-L41) | ✅ Existe | **Garder** — refactor optionnel pour dériver de `PlaceWithAdnSchema` |
| Index `idx_places_*` | (aucun) | ❌ N'existe pas | **Créer** dans la migration : `idx_places_neighborhood`, `idx_places_cuisine` (GIN), `idx_places_published_signals` (partial) |
| `RAW_DROP` config Zod | `data-source.supabase.ts` | — | **Implémenter** : `if (parseResult.success === false) skip row & __DEV__ log` — pattern architecture §Data Architecture « Échec de parse → fallback propre » |

**Décisions héritées non-revisitables** :

- **`select("*, place_adn(*)").eq("is_published", true)`** — pattern adapter existant (data-source.supabase.ts:14-16) conservé.
- **Filtre `is_published` côté client ET RLS serveur** — invariant project-context « ne pas se fier seul à la RLS ».
- **Dynamic import `await import("./data-source.supabase")`** — règle d'or, jamais cassée.
- **Adapter retourne `{ mode, data }`** — pas d'exception en bordure (architecture §API & Communication Patterns).
- **`PlaceAdn` 1:1 avec `Place`** — joint via `select("*, place_adn(*)")`, FK `place_adn.place_id REFERENCES places(id)`.
- **`is_seed = true`** sur les avis fondateurs (Claude amendment 5.4) — Story 3.3a ne touche pas `spawt_checkin` (Story 4.x), mais les seeds de **lieux** (pas d'avis) sont libres de `is_seed`.
- **Zod v4.4.3** (architecture §Data Architecture) — déjà mentionné, vérifier que `package.json` l'a (ou l'ajouter).
- **`down.sql` appairé** — règle Stéphanie (project-context §Migrations).

## Acceptance Criteria

**AC #1 — Migration SQL `0010_create_places_place_adn.sql` + `.down.sql`**

**Given** le dossier `supabase/migrations/`
**When** Story 3.3a est livrée
**Then** **2 fichiers** existent :

1. `supabase/migrations/0010_create_places_place_adn.sql` :
   ```sql
   -- Table places — fiche lieu publique (PRD §13.2)
   CREATE TABLE places (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     cuisine TEXT[] NOT NULL DEFAULT '{}',
     -- Location
     lat DOUBLE PRECISION NOT NULL,
     lng DOUBLE PRECISION NOT NULL,
     descriptive_address TEXT NOT NULL,
     neighborhood TEXT NOT NULL,
     city TEXT NOT NULL DEFAULT 'Abidjan',
     -- Price
     price_tier SMALLINT NOT NULL CHECK (price_tier BETWEEN 1 AND 3),
     avg_ticket_xof INTEGER, -- nullable
     -- Hours stockés en JSONB (Record<DayOfWeek, OpeningSlot[]>)
     hours JSONB NOT NULL DEFAULT '{}',
     phone TEXT,
     whatsapp TEXT,
     cover_photo_url TEXT,
     gallery_urls TEXT[] NOT NULL DEFAULT '{}',
     signals TEXT[] NOT NULL DEFAULT '{}', -- enum PlaceSignal côté TS
     is_published BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );

   -- Table place_adn 1:1 (PRD §6 + §13.2)
   CREATE TABLE place_adn (
     place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
     axe_local_international REAL NOT NULL DEFAULT 0 CHECK (axe_local_international BETWEEN -1 AND 1),
     axe_informel_etabli REAL NOT NULL DEFAULT 0 CHECK (axe_informel_etabli BETWEEN -1 AND 1),
     axe_budget_premium REAL NOT NULL DEFAULT 0 CHECK (axe_budget_premium BETWEEN -1 AND 1),
     axe_populaire_prive REAL NOT NULL DEFAULT 0 CHECK (axe_populaire_prive BETWEEN -1 AND 1),
     axe_decontracte_habille REAL NOT NULL DEFAULT 0 CHECK (axe_decontracte_habille BETWEEN -1 AND 1),
     confidence_score REAL NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
     total_reviews INTEGER NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),
     weighted_rating REAL NOT NULL DEFAULT 0 CHECK (weighted_rating BETWEEN 0 AND 5),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );

   -- Index
   CREATE INDEX idx_places_neighborhood ON places(neighborhood) WHERE is_published = true;
   CREATE INDEX idx_places_cuisine ON places USING GIN(cuisine) WHERE is_published = true;
   CREATE INDEX idx_places_signals ON places USING GIN(signals) WHERE is_published = true;
   CREATE INDEX idx_places_location ON places(lat, lng) WHERE is_published = true;

   -- Trigger updated_at
   CREATE OR REPLACE FUNCTION set_places_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = now(); RETURN NEW; END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_places_updated_at BEFORE UPDATE ON places
     FOR EACH ROW EXECUTE FUNCTION set_places_updated_at();
   CREATE TRIGGER trg_place_adn_updated_at BEFORE UPDATE ON place_adn
     FOR EACH ROW EXECUTE FUNCTION set_places_updated_at();

   -- RLS
   ALTER TABLE places ENABLE ROW LEVEL SECURITY;
   ALTER TABLE place_adn ENABLE ROW LEVEL SECURITY;

   -- SELECT public — uniquement les lieux publiés
   CREATE POLICY places_select_published ON places
     FOR SELECT TO anon, authenticated
     USING (is_published = true);

   CREATE POLICY place_adn_select_published ON place_adn
     FOR SELECT TO anon, authenticated
     USING (EXISTS (SELECT 1 FROM places WHERE places.id = place_adn.place_id AND places.is_published = true));

   -- INSERT/UPDATE/DELETE : aucune policy publique en V1 ; le staff opère via service_role (Story 6.2 affinera)
   -- Pas de policy ALL — les non-anon/non-auth peuvent pas écrire.
   ```

2. `supabase/migrations/0010_create_places_place_adn.down.sql` :
   ```sql
   DROP TRIGGER IF EXISTS trg_place_adn_updated_at ON place_adn;
   DROP TRIGGER IF EXISTS trg_places_updated_at ON places;
   DROP FUNCTION IF EXISTS set_places_updated_at();
   DROP POLICY IF EXISTS place_adn_select_published ON place_adn;
   DROP POLICY IF EXISTS places_select_published ON places;
   DROP INDEX IF EXISTS idx_places_location;
   DROP INDEX IF EXISTS idx_places_signals;
   DROP INDEX IF EXISTS idx_places_cuisine;
   DROP INDEX IF EXISTS idx_places_neighborhood;
   DROP TABLE IF EXISTS place_adn;
   DROP TABLE IF EXISTS places;
   ```

**And** la migration est testable en local : `supabase db reset` + `supabase db push` (mode supabase-cli) doivent passer sans erreur.
**And** la migration est testée **réversible** : `psql < 0010_*.down.sql` doit tomber proprement.

---

**AC #2 — Schémas Zod `PlaceSchema`, `PlaceAdnSchema`, `PlaceWithAdnSchema`**

**Given** le dossier `app/src/types/`
**When** Story 3.3a est livrée
**Then** un fichier [app/src/types/place.schema.ts](../../app/src/types/place.schema.ts) (nouveau) existe :

```ts
import { z } from "zod";

const ADN_AXIS = z.number().min(-1).max(1);

export const PlaceLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  descriptive_address: z.string(),
  neighborhood: z.string(),
  city: z.string(),
});

export const PriceRangeSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  avg_ticket_xof: z.number().int().nullable().optional(),
});

export const OpeningSlotSchema = z.object({
  open: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  close: z.string().regex(/^[0-2]\d:[0-5]\d$/),
});

export const HoursSchema = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.array(OpeningSlotSchema),
);

export const PlaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  cuisine: z.array(z.string()),
  location: PlaceLocationSchema,
  price: PriceRangeSchema,
  hours: HoursSchema,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  cover_photo_url: z.string().nullable(),
  gallery_urls: z.array(z.string()),
  signals: z.array(z.string()),
  is_published: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PlaceAdnSchema = z.object({
  place_id: z.string().uuid(),
  axe_local_international: ADN_AXIS,
  axe_informel_etabli: ADN_AXIS,
  axe_budget_premium: ADN_AXIS,
  axe_populaire_prive: ADN_AXIS,
  axe_decontracte_habille: ADN_AXIS,
  confidence_score: z.number().min(0).max(1),
  total_reviews: z.number().int().min(0),
  weighted_rating: z.number().min(0).max(5),
  updated_at: z.string(),
});

export const PlaceWithAdnSchema = PlaceSchema.extend({
  adn: PlaceAdnSchema,
  rating_display: z.number(),
  total_spawts: z.number().int().min(0),
});

export type PlaceParsed = z.infer<typeof PlaceSchema>;
export type PlaceAdnParsed = z.infer<typeof PlaceAdnSchema>;
export type PlaceWithAdnParsed = z.infer<typeof PlaceWithAdnSchema>;
```

**And** le fichier `app/src/types/place.ts` existant n'est **PAS** supprimé en V1 — refactor doux Sprint 2 pour dériver les types depuis Zod (cohérent architecture §Data Architecture « au fur et à mesure »). Les 2 fichiers cohabitent : `place.ts` = types figés, `place.schema.ts` = source d'arrivée pour validation runtime.

**And** Zod v4.4.3 doit être présent dans `app/package.json`. S'il manque : `npm install zod@4.4.3 --save` côté `app/`. Note : décision tech lead — pin la version exacte (architecture §Data Architecture).

---

**AC #3 — Durcissement de `data-source.supabase.ts` avec Zod parse + fallback transparent**

**Given** [app/src/lib/data-source.supabase.ts:12-29](../../app/src/lib/data-source.supabase.ts#L12-L29)
**When** Story 3.3a est livrée
**Then** `listPlacesFromSupabase` est réécrit :

```ts
import { PlaceWithAdnSchema } from "../types/place.schema";

export async function listPlacesFromSupabase(): Promise<PlaceWithAdn[]> {
  const { data: rows, error } = await supabase
    .from("places")
    .select("*, place_adn(*)")
    .eq("is_published", true);

  if (error) {
    if (__DEV__) console.warn("[data-source] listPlaces failed", error);
    return [];
  }

  const out: PlaceWithAdn[] = [];
  for (const row of rows ?? []) {
    // Pivot : Supabase retourne { ..., place_adn: { ... } } — mappe vers
    // PlaceWithAdn structure attendue par les écrans.
    const candidate = {
      ...(row as Record<string, unknown>),
      adn: (row as { place_adn?: unknown }).place_adn,
      // rating_display = alias UI sur weighted_rating (compat existante PlaceCard)
      rating_display: ((row as { place_adn?: { weighted_rating?: number } }).place_adn?.weighted_rating) ?? 0,
      total_spawts: (row as { total_spawts?: number }).total_spawts ?? 0,
      // Pivot location flat → nested (DB = colonnes plates, TS = sub-object)
      location: {
        lat: (row as { lat: number }).lat,
        lng: (row as { lng: number }).lng,
        descriptive_address: (row as { descriptive_address: string }).descriptive_address,
        neighborhood: (row as { neighborhood: string }).neighborhood,
        city: (row as { city: string }).city,
      },
      price: {
        tier: (row as { price_tier: 1 | 2 | 3 }).price_tier,
        avg_ticket_xof: (row as { avg_ticket_xof: number | null }).avg_ticket_xof ?? undefined,
      },
    };
    const parsed = PlaceWithAdnSchema.safeParse(candidate);
    if (parsed.success) {
      out.push(parsed.data as unknown as PlaceWithAdn);
    } else if (__DEV__) {
      console.warn("[data-source] place row dropped — Zod parse failed", parsed.error.flatten());
    }
  }
  return out;
}
```

**And** `getPlaceFromSupabase(id)` applique la même logique (parse 1 row, retourne `null` si fail).
**And** **Pivot location flat → nested** est documenté en commentaire (les colonnes DB sont plates pour les index, le type TS garde la structure imbriquée existante).
**And** un Zod parse fail **ne crash pas l'app** — fallback propre, row droppée, `__DEV__` warn, le reste de la liste continue.

**Given** `listSpawtsFromSupabase` / `saveSpawterToSupabase` / `savePalaisToSupabase`
**When** Story 3.3a est livrée
**Then** elles **restent inchangées** — Story 3.3a se limite aux 2 fonctions place-related.

---

**AC #4 — Seed Supabase `supabase/seed/places.sql`**

**Given** le dossier `supabase/seed/` (à créer si absent)
**When** Story 3.3a est livrée
**Then** un fichier `supabase/seed/places.sql` existe avec 12 INSERT pour les 12 SEED_PLACES :

```sql
-- Seed 12 lieux SEED_PLACES (PRD §3.1 Feature 4 + cahier des charges §5.3)
-- ⚠️ Idempotent : utiliser ON CONFLICT DO NOTHING pour permettre supabase db reset multiples
-- ⚠️ Les UUID sont stables — DOIVENT matcher app/src/data/seed/places.ts pour cohérence client/serveur

INSERT INTO places (id, name, cuisine, lat, lng, descriptive_address, neighborhood, city, price_tier, avg_ticket_xof, hours, phone, whatsapp, cover_photo_url, gallery_urls, signals, is_published, created_at, updated_at)
VALUES
  -- Bô Zinc
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Bô Zinc', ARRAY['francaise','fusion'], 5.328, -4.009, 'Zone 4, en face du centre commercial', 'Zone 4', 'Abidjan', 3, 25000, '{"mon":[{"open":"12:00","close":"23:00"}], ...}'::jsonb, '+22527XXXXXXX', NULL, NULL, '{}', ARRAY['institution'], true, '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- ... 11 autres entries
ON CONFLICT (id) DO NOTHING;

INSERT INTO place_adn (place_id, axe_local_international, axe_informel_etabli, axe_budget_premium, axe_populaire_prive, axe_decontracte_habille, confidence_score, total_reviews, weighted_rating, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 0.6, 0.85, 0.7, -0.3, 0.6, 0.85, 87, 4.6, '2026-05-03T18:00:00Z'),
  -- ... 11 autres
ON CONFLICT (place_id) DO NOTHING;
```

**And** les UUID utilisés dans le seed **doivent matcher** ceux de [app/src/data/seed/places.ts](../../app/src/data/seed/places.ts) — Action obligatoire : **changer les `id` côté TS** de `"place_bo_zinc"` → un UUID stable, pour cohérence client/serveur. Cf. Task 4.

**And** la commande `supabase db reset` (ou équivalent) doit charger le seed sans erreur.

---

**AC #5 — Cohérence ID `place_*` → UUID dans `SEED_PLACES`**

**Given** [app/src/data/seed/places.ts:22](../../app/src/data/seed/places.ts#L22) — `id: "place_bo_zinc"` (string slug)
**When** Story 3.3a est livrée
**Then** les `id` sont **migrés en UUID** stables :
- `place_bo_zinc` → `00000000-0000-0000-0000-000000000001`
- `place_bushman` → `00000000-0000-0000-0000-000000000002`
- ... (mapping 1-12 séquentiel pour traçabilité)

**And** la régex UUID v4 validation côté `analytics.ts:243` (`UUID_RE`) sera maintenant satisfaite par les `place_id` provenant du fallback — élimine le bug actuel où `analytics.ts:295` set `place_id = null` car le slug n'est pas un UUID.
**And** **aucune autre référence côté code** à ces slugs (vérifier via `grep -rn "place_bo_zinc\|place_bushman" app/` — devrait être 0 ailleurs que le seed).

**Given** l'ID type côté TS
**When** Story 3.3a est livrée
**Then** le type `Place.id: string` reste — pas de typage UUID strict côté TS (Zod valide runtime, TypeScript reste laxe). La compat DB est garantie par le UUID literal.

---

**AC #6 — Adapter inchangé côté signature publique**

**Given** [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) signature publique
**When** Story 3.3a est livrée
**Then** `listPlaces`, `getPlace`, `PlaceWithAdn` exportés gardent **exactement la même signature** — aucun caller ne casse.
**And** le mode fallback (`isSupabaseConfigured === false`) continue de retourner `SEED_PLACES` mappés via `seedToPlaceWithAdn` (existant).
**And** `dataSourceMode` reste `"supabase" | "fallback"`.

---

**AC #7 — Tests + triple gate verte**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut :

1. **`PlaceWithAdnSchema`** (`app/src/types/__tests__/place.schema.test.ts`) :
   - Parse une row Supabase valide (fixture) → success
   - Parse une row avec `axe_*` hors [-1, 1] → fail
   - Parse une row sans `place_adn` → fail (adn required)
   - Parse une row avec `cuisine` au mauvais format → fail
   - Round-trip : `PlaceWithAdnSchema.parse(SEED_PLACES[0] mappé)` → success

2. **`data-source.supabase` Zod parse fail-safe** (`app/src/lib/__tests__/data-source.supabase.test.ts`) :
   - Mock `supabase.from(...).select(...)` retourne 2 rows valides + 1 corrompue → output = 2 rows, 1 dropped (warn `__DEV__`)
   - Mock retourne `error` → output = `[]` sans crash
   - Mock retourne `data: []` → output = `[]`

3. **Cohérence client/serveur** :
   - Vérifier que `SEED_PLACES.map(s => s.id)` matche exactement les UUID du seed SQL — assertion explicite dans `app/src/data/seed/__tests__/places-uuid.test.ts`.

**Given** la triple gate + smoke
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** `cd app && expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Vérifier / installer Zod v4.4.3** (AC: #2)
  - [ ] `cd app && npm list zod` — si absent, `npm install zod@4.4.3 --save --legacy-peer-deps`.
  - [ ] Vérifier `app/package.json` pin la version exacte.

- [ ] **Task 2 — Migration SQL `0010_create_places_place_adn.sql` + `.down.sql`** (AC: #1)
  - [ ] Créer `supabase/migrations/0010_create_places_place_adn.sql` avec le DDL de l'AC #1.
  - [ ] Créer `supabase/migrations/0010_create_places_place_adn.down.sql` réversible.
  - [ ] Tester localement : `supabase db reset` (si CLI installée), sinon valider syntactiquement via `pg_format` ou un linter SQL.
  - [ ] **Migration ordre** : numéro `0010` (après 0009_align_otp_phone_check.sql). Si une migration `0010_*` existe déjà, bump à `0011`.

- [ ] **Task 3 — Schémas Zod `app/src/types/place.schema.ts`** (AC: #2)
  - [ ] Créer le fichier selon l'AC #2.
  - [ ] **Ne PAS supprimer** `app/src/types/place.ts` (V1 — refactor doux Sprint 2).
  - [ ] Ajouter `PlaceWithAdnParsed` etc. à `app/src/types/index.ts` (barrel autorisé pour `types/`).

- [ ] **Task 4 — Migrer les IDs `SEED_PLACES` en UUID** (AC: #5)
  - [ ] Éditer [app/src/data/seed/places.ts](../../app/src/data/seed/places.ts) : remplacer `id: "place_bo_zinc"` → `id: "00000000-0000-0000-0000-000000000001"` (et 11 autres).
  - [ ] Vérifier qu'aucune autre référence : `grep -rn "place_bo_zinc\|place_bushman\|place_petit_paris\|place_tantie_rose" app/` → uniquement seed.
  - [ ] Vérifier que le `seedToPlaceWithAdn` continue de fonctionner (lit `seed.adn.place_id` qui doit aussi être UUID).
  - [ ] **Tests existants** : adapter `app/src/lib/__tests__/types/analytics.test-d.ts` si tests sur `place_id` slug.

- [ ] **Task 5 — Durcir `data-source.supabase.ts` avec Zod** (AC: #3)
  - [ ] Réécrire `listPlacesFromSupabase` selon l'AC #3 — pivot location flat→nested + Zod parse.
  - [ ] Réécrire `getPlaceFromSupabase` symétrique.
  - [ ] **Garder inchangé** : `listSpawtsFromSupabase`, `saveSpawterToSupabase`, `savePalaisToSupabase`, `listFeatureFlagsFromSupabase`, `insertUserSignals`.
  - [ ] Tester en mode démo : `listPlaces` continue de retourner `SEED_PLACES` mappés (l'adapter principal `data-source.ts` gère le mode).

- [ ] **Task 6 — Seed SQL `supabase/seed/places.sql`** (AC: #4)
  - [ ] Créer `supabase/seed/places.sql` avec 12 INSERT `places` + 12 INSERT `place_adn`, UUID matchant `SEED_PLACES` (post-Task 4).
  - [ ] Utiliser `ON CONFLICT (id) DO NOTHING` pour idempotence (multi-reset).
  - [ ] **Stratégie de génération** : à la main pour 12 lieux (faisable). Si scale Sprint 2 (50-100 lieux), écrire un script `app/scripts/seed-places-to-sql.mjs` qui sérialise `SEED_PLACES` en SQL — différé.

- [ ] **Task 7 — Tests** (AC: #7)
  - [ ] `app/src/types/__tests__/place.schema.test.ts` — 5 cas (cf. AC #7 #1).
  - [ ] `app/src/lib/__tests__/data-source.supabase.test.ts` — 3 cas (cf. AC #7 #2).
  - [ ] `app/src/data/seed/__tests__/places-uuid.test.ts` — cohérence client/serveur (smoke test).
  - [ ] Vérifier que les tests existants (`analytics.test-d.ts`, etc.) restent verts après le changement `place_id` slug→UUID.

- [ ] **Task 8 — Smoke + CHANGELOG + clôture** (AC: #7)
  - [ ] Triple gate verte.
  - [ ] `expo export --platform android` compile.
  - [ ] CHANGELOG `feat(infra)` + `feat(place)` scope `infra` + `place` — migration + adapter Zod-durci + seed.
  - [ ] Commit conventional (PRD ref §13.2 + §6.1).

## Dev Notes

### 1. Pourquoi 1 migration pour 2 tables ?

`places` et `place_adn` sont **strictement 1:1** (FK `place_adn.place_id REFERENCES places(id)`). Les séparer en 2 migrations introduirait un order-of-apply implicite (place_adn doit venir après places). Une seule migration `0010_` les crée ensemble = atomique.

**Référence architecture §Naming Patterns** : `NNNN_<verbe>_<objet>.sql` — le `_<objet>` peut être composé (`places_place_adn`).

### 2. Pourquoi pas RLS staff-only en V1 ?

L'écriture (INSERT/UPDATE/DELETE) sur `places` / `place_adn` est faite via **`service_role` côté Edge Function admin** (Story 6.2). En V1, **aucune policy INSERT/UPDATE** côté `anon`/`authenticated` — la RLS rejette silencieusement.

**Implication tests** : si un test mobile tente d'INSERT un place via le client anon, ça fail. C'est voulu — seul `spawt-admin` (Story 6.2) écrit, via `service_role` ou un compte `spawt_staff` authenticated.

### 3. Pourquoi pivot location flat→nested ?

Le DB stocke `lat`, `lng`, `descriptive_address`, etc. en colonnes **plates** pour permettre les index (`idx_places_location ON places(lat, lng)`). Le type TS `Place.location: PlaceLocation` est **imbriqué** par cohérence DDD (un lieu a UNE location avec plusieurs champs).

L'adapter `data-source.supabase.ts` fait le **pivot** au moment du parse. Cohérent avec le pattern `place_adn` (Supabase retourne `{...place, place_adn: {...}}`).

### 4. UUID stables pour le seed — pourquoi 1, 2, 3 et pas des UUID aléatoires ?

Pour la **traçabilité** : un développeur qui lit `00000000-0000-0000-0000-000000000007` peut deviner « c'est le 7e seed ». L'audit log devient lisible. Les UUID aléatoires (cohérent prod) seront utilisés dès Story 6.2 (Admin CRUD) quand un staff créé un vrai lieu (`gen_random_uuid()` côté DB default).

**V1** = UUID séquentiels lisibles pour les 12 seeds. Sprint 2 = `gen_random_uuid()` pour tout nouveau lieu.

### 5. Zod parse — pourquoi `safeParse` pas `parse` ?

`parse()` throw, `safeParse()` retourne `{ success, error | data }`. Le moteur doit **ne jamais throw** vers le caller (architecture §API & Communication Patterns). Une row malformée → drop + warn `__DEV__`, le reste continue.

**Risque évité** : 1 row corrompue côté DB ne casse pas tout le feed. Le spawter voit 11 lieux au lieu de 12, c'est dégradé mais fonctionnel. La row corrompue est loggée pour Stéphanie debug.

### 6. Non-régression vis-à-vis de Epic 2

- `data-source.ts` API inchangée → `(tabs)/index.tsx` Feed continue de marcher.
- `place.ts` types inchangés → `PlaceCard` + fiche lieu continuent de compiler.
- `analytics.ts` consomme un `place_id` UUID → après Task 4 (migration slug→UUID), `UUID_RE` matche enfin, `place_id` n'est plus stripé à `null` → events analytics enrichis (`feed_card_clicked.place_id` non null désormais).

**Bonus side-effect** : un bug latent est corrigé — Story 1.7 avait introduit `UUID_RE` mais les seeds passaient des slugs → tous les `place_id` étaient strip à `null` côté analytics. Story 3.3a résout ça par cohérence.

### 7. Coordination avec Story 6.2 (Admin CRUD lieux)

Story 6.2 (Epic 6) ouvrira l'écriture admin sur `places` / `place_adn`. Elle :
- Définira les policies INSERT/UPDATE/DELETE pour `spawt_staff` (RLS).
- Implémentera les écrans Refine CRUD côté `spawt-admin/`.
- Consommera **le même schéma** Story 3.3a — pas de divergence.

Story 6.3 (« Pré-chargement de l'inventaire initial ») chargera les seeds réels (50-100 lieux production) via le panel admin. V1 = les 12 seeds dev suffisent.

### 8. Cohérence avec Story 3.3b (matching)

`matching.ts` (Story 3.3b) consomme `Place` + `PlaceAdn` via `PlaceWithSignals`. Story 3.3a **ne touche pas** `matching.ts`. Les types existants `Place` / `PlaceAdn` restent stables — Story 3.3b travaille sur ces types.

### 9. Sign-off

- **Stéphanie** (tech) : revue migration SQL (réversibilité, RLS, index), revue Zod parse fail-safe.
- **Kidam** (analytics) : confirmation que `place_id` UUID propage en analytics events (`feed_card_clicked.place_id` non null).
- **Alexandre** (brand) : pas de Test Tantie Rose requis (infra).

### 10. Defers identifiés

- **Refactor `place.ts` → `z.infer<typeof PlaceSchema>`** — Sprint 2, doux, pas de breaking.
- **Migration des autres tables vers Zod** (`spawter.schema.ts`, etc.) — pattern à généraliser story par story (architecture §Data Architecture).
- **Edge Function admin** d'écriture `places` → Story 6.2.
- **Seed 50-100 lieux production** → Story 6.3.
- **Bucket Storage `place-photos`** + `cover_photo_url` réels → Story 4.5 (avis avec photos) + Story 6.3.
- **`PlaceWithAdn` dérivé de `PlaceWithAdnSchema`** → refactor doux Sprint 2.

### 11. Risk

- **Risque #1** : la migration 0010 conflicte avec une future numérotation Sprint 2. Mitigation : utiliser `0010_` comme prévu architecture §Project Structure, vérifier au moment de livrer qu'aucune autre migration `0010_*` n'a été pushée entre-temps.
- **Risque #2** : un seed à la main introduit des typos UUID. Mitigation : test cohérence client/serveur (AC #7 #3) ; si echec, vérifier mapping ligne par ligne.
- **Risque #3** : le format JSONB `hours` est lourd à écrire à la main pour 12 lieux. Mitigation : utiliser un helper one-shot (script Node) ou copier-coller depuis `SEED_PLACES` via `JSON.stringify(seed.hours)`.

### Project Structure Notes

- **2 nouveaux fichiers SQL** : `0010_create_places_place_adn.sql` + `.down.sql`.
- **1 nouveau fichier seed SQL** : `supabase/seed/places.sql`.
- **1 nouveau fichier TS** : `app/src/types/place.schema.ts`.
- **1 fichier TS modifié** : `app/src/lib/data-source.supabase.ts` (durcir 2 fonctions).
- **1 fichier TS modifié** : `app/src/data/seed/places.ts` (UUID).
- **1 nouvelle dépendance npm** : `zod@4.4.3` (si pas déjà présent).
- **Pas de modif store**, pas de modif UI, pas de modif i18n.

### References

- [_bmad-output/planning-artifacts/epics.md:698-713 Story 3.3a](../planning-artifacts/epics.md#L698-L713)
- [_bmad-output/planning-artifacts/PRD.md §13.2 Tables places + place_adn](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §6 ADN du Lieu](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/architecture.md:277-308 Data Architecture (Zod + migrations down)](../planning-artifacts/architecture.md#L277-L308)
- [_bmad-output/planning-artifacts/architecture.md:317-321 RLS — is_published](../planning-artifacts/architecture.md#L317-L321)
- [_bmad-output/planning-artifacts/architecture.md:686-704 Project Structure — supabase/migrations](../planning-artifacts/architecture.md#L686-L704)
- [_bmad-output/project-context.md §Data source adapter — règle d'or](../project-context.md)
- [_bmad-output/project-context.md §Supabase / PostgREST](../project-context.md)
- [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) — adapter existant
- [app/src/lib/data-source.supabase.ts](../../app/src/lib/data-source.supabase.ts) — Supabase impl à durcir
- [app/src/types/place.ts](../../app/src/types/place.ts) — types existants à conserver
- [app/src/data/seed/places.ts](../../app/src/data/seed/places.ts) — seeds à migrer UUID
- [supabase/migrations/](../../supabase/migrations/) — où vit la migration

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓).
- 12 tests Zod + cohérence UUIDs passants (`place.schema.test.ts` + `places-uuid.test.ts`).
- Zod 4.4.3 installé via `npm install zod@4.4.3 --save --legacy-peer-deps`.

### Completion Notes List

- Migration `0010_create_places_place_adn.sql` + `.down.sql` créées (RLS SELECT public `is_published=true`, index quartier/cuisine/signals/location partiels, triggers updated_at).
- Seed SQL `supabase/seed/places.sql` créé avec 12 INSERT places + 12 INSERT place_adn (UUIDs séquentiels 1-12, `ON CONFLICT DO NOTHING` idempotent).
- Schémas Zod `PlaceSchema` / `PlaceAdnSchema` / `PlaceWithAdnSchema` créés dans `app/src/types/place.schema.ts`.
- **Décision Zod UUID** : utilisé `z.string().regex()` permissif au lieu de `.uuid()` strict — Zod 4 valide RFC 4122 v4 nibbles (4 dans 3e bloc, 8/9/a/b dans 4e), incompatible avec nos UUIDs séquentiels dev `00000000-...-000000000001`. PostgreSQL `uuid` accepte tout UUID syntaxique 8-4-4-4-12.
- `data-source.supabase.ts` durci : `parseRows` helper pivot DB flat → TS nested + Zod `safeParse` fail-safe (row droppée + `__DEV__` warn, le reste continue).
- 12 IDs `SEED_PLACES` migrés de slug (`place_bo_zinc`) vers UUID séquentiel (`00000000-0000-0000-0000-000000000001`). Side-effect bonus : `analytics.ts` `UUID_RE` matche enfin, `place_id` n'est plus stripé à `null` dans les events.
- `types/index.ts` étend l'export pour `place.schema` (barrel autorisé pour `types/`).

### File List

**Nouveaux fichiers** :
- `supabase/migrations/0010_create_places_place_adn.sql`
- `supabase/migrations/0010_create_places_place_adn.down.sql`
- `supabase/seed/places.sql`
- `app/src/types/place.schema.ts`
- `app/src/types/__tests__/place.schema.test.ts`
- `app/src/data/seed/__tests__/places-uuid.test.ts`

**Fichiers modifiés** :
- `app/src/lib/data-source.supabase.ts` (`listPlacesFromSupabase` + `getPlaceFromSupabase` durcis Zod + pivot flat→nested)
- `app/src/data/seed/places.ts` (12 IDs slug → UUID séquentiel)
- `app/src/types/index.ts` (+ export `place.schema`)
- `app/package.json` (+ `zod@4.4.3`)
