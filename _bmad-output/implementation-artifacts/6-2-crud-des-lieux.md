# Story 6.2: CRUD des lieux

Status: ready-for-dev

<!-- 2e story Epic 6 — câble les resources Refine `places` + `place_adn`
sur les tables existantes (migration 0010 Story 3.3a). CRUD complet :
liste paginée + search + filtres, formulaires de création/édition avec
validation Zod (port `place.schema.ts` côté `spawt-admin/`), soft-delete
via `is_published = false`, upload photos via bucket `place-photos`
(existant migration 0013 — RLS étendue à `spawt_staff`). Toutes les
actions audit-loggées via la table `admin_audit_log` (Story 6.1). Dépend
de 6.1 (shell + audit log) et de 3.3a (places/place_adn). -->

## Story

As a membre `spawt_staff`,
I want créer, lire, modifier et dépublier des lieux et leurs métadonnées (y compris l'ADN) depuis le panel admin,
so that l'inventaire SPAWT est tenu à jour par l'équipe interne, chaque action est tracée dans `admin_audit_log` avec horodatage + auteur + payload before/after, et les lieux dépubliés disparaissent du feed mobile sans casser l'historique des avis liés.

## ⚠️ Brownfield context — read first

État courant Story 6.2 :

| Élément | Fichier / Table | État | Action |
|---|---|---|---|
| Tables `places` + `place_adn` | `supabase/migrations/0010_create_places_place_adn.sql` Story 3.3a | ✅ Existent — colonnes complètes + index + RLS SELECT public sur `is_published = true` | **Consommer** — pas de nouvelle migration sur le schéma |
| Policies INSERT/UPDATE/DELETE `places` | (aucune) | ❌ Pas de policy publique → bloque tout staff côté client | **Ajouter** policies `places_*_staff` côté migration `0018_create_places_admin_policies.sql` — autorise INSERT/UPDATE staff actif, pas de DELETE physique |
| Policies INSERT/UPDATE `place_adn` | (aucune) | ❌ Idem | **Ajouter** policies `place_adn_*_staff` même migration |
| Bucket Storage `place-photos` | `supabase/migrations/0013_storage_buckets_place_photos.sql` | ✅ Existe (Story 4.5) — RLS écriture limitée à `<spawter_id>/<spawt_id>/` | **Étendre** RLS staff via la migration 0015 : staff peut écrire/lire sous `places/<place_id>/` |
| Schémas Zod TS `app/src/types/place.schema.ts` | `app/src/types/place.schema.ts` Story 3.3a | ✅ Existe côté mobile | **Porter** côté `spawt-admin/src/types/place.schema.ts` (copie + adaptation — pas d'import croisé) |
| Table `admin_audit_log` | `supabase/migrations/0017_create_admin_audit_log.sql` Story 6.1 | ✅ Existe + helper `audit.ts` | **Consommer** — actions `place_create/update/delete/publish_toggle` + `place_adn_update` déjà dans le CHECK enum |
| Resource Refine `places` | `spawt-admin/src/App.tsx` Story 6.1 | ✅ Déclarée (placeholder) | **Compléter** — ajouter `create`, `edit`, `show` aux routes |
| Resource Refine `place_adn` | `spawt-admin/src/App.tsx` | ❌ Pas déclarée | **Ajouter** comme resource child de `places` (édition jointe) |
| Page `LieuxList` | `spawt-admin/src/pages/lieux/index.tsx` Story 6.1 | ⚠️ Placeholder vide | **Réécrire** — `useTable()` Refine + filtres + pagination + actions ligne |
| Photos upload côté `app/` | `app/src/lib/storage.ts` Story 4.5 | ✅ Existe (PutObject signed URL) | **Référence** — pas d'import croisé, mais même bucket cible |

**Décisions héritées non-revisitables** :

- **Schéma `places` figé** (Story 3.3a) — colonnes flat `lat`, `lng`, `neighborhood`, `cuisine TEXT[]`, `hours JSONB`, `signals TEXT[]`, `is_published BOOLEAN`. Pivot nested côté TS uniquement.
- **Schéma `place_adn` 1:1** — 5 axes `[-1, 1]`, `confidence_score [0,1]`, `total_reviews`, `weighted_rating [0,5]`. **Édité par Story 6.2** mais aussi recalculé par Story 4.7 (`applyReviewToAdn`) — politique : édition manuelle `spawt_staff` = override autorisé (cas Story 6.3 pour seeds initiaux + corrections manuelles).
- **Soft-delete via `is_published = false`** — pas de DELETE physique. Préserve l'historique `spawt_checkin` FK qui pointe sur `places(id) ON DELETE CASCADE` (un DELETE physique perdrait tous les avis).
- **Bucket `place-photos`** unique partagé mobile (`<spawter_id>/<spawt_id>/`) + admin (`places/<place_id>/`) — pas de 2e bucket. Décision Dev Notes §3.
- **Audit log obligatoire** — toute action CRUD insère 1 ligne `admin_audit_log` avec payload before/after JSON.
- **Vocab SPAWT** côté formulaire : « Lieu » (jamais « Restaurant »), « Quartier » (jamais « Address area »), « ADN » (jamais « Profile »).

## Acceptance Criteria

**AC #1 — Migration `0018_create_places_admin_policies.sql` — policies staff CRUD + extension bucket RLS**

**Given** l'absence de policies INSERT/UPDATE sur `places` / `place_adn` côté Story 3.3a
**When** Story 6.2 est livrée
**Then** `supabase/migrations/0018_create_places_admin_policies.sql` (+ `.down.sql`) existe :

```sql
-- Story 6.2 — Policies staff CRUD sur places + place_adn + extension bucket place-photos.
-- Permet aux spawt_staff actifs d'opérer le panel admin sans service_role côté client.
-- Préservation : SELECT public reste contraint à is_published = true (Story 3.3a).

-- ━━━ places : staff CRUD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Staff actif lit tous les lieux (publiés ou non — il faut voir les drafts en admin).
CREATE POLICY places_select_staff ON places
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Staff actif insère.
CREATE POLICY places_insert_staff ON places
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Staff actif update.
CREATE POLICY places_update_staff ON places
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Pas de policy DELETE : soft-delete via UPDATE is_published = false uniquement.

-- ━━━ place_adn : staff CRUD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE POLICY place_adn_select_staff ON place_adn
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY place_adn_insert_staff ON place_adn
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY place_adn_update_staff ON place_adn
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- ━━━ bucket place-photos : extension écriture/lecture staff sous places/<place_id>/ ━━━

-- Note : la policy mobile existante (Story 4.5, migration 0013) limite écriture
-- à <spawter_id>/<spawt_id>/<index>.jpg. La policy staff ajoute le chemin
-- alternatif places/<place_id>/<filename> pour les photos officielles.

CREATE POLICY storage_place_photos_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY storage_place_photos_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY storage_place_photos_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Lecture déjà publique sur le bucket (Story 4.5 — bucket public, photos servies via CDN).
```

**And** `0018_create_places_admin_policies.down.sql` réversible avec `DROP POLICY IF EXISTS` pour les 9 policies.

**And** un commentaire dans le header de la migration rappelle : « **Soft-delete only** sur `places` (`is_published = false`). Toute suppression physique passe par service_role + Edge Function explicite (jamais V1). Préserve l'historique `spawt_checkin.place_id`. »

---

**AC #2 — Port des schémas Zod côté `spawt-admin/src/types/place.schema.ts`**

**Given** `app/src/types/place.schema.ts` Story 3.3a
**When** Story 6.2 est livrée
**Then** un fichier équivalent existe côté admin : `spawt-admin/src/types/place.schema.ts` :

```ts
// Port autonome — pas d'import croisé app/ ↔ spawt-admin/.
// Synchronisé manuellement avec app/src/types/place.schema.ts (revue PR).
// Drift = warning au lint (TODO Sprint 2 : monorepo).

import { z } from "zod";

const ADN_AXIS = z.number().min(-1).max(1);

export const PlaceLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  descriptive_address: z.string().min(1, "Adresse descriptive requise"),
  neighborhood: z.string().min(1, "Quartier requis"),
  city: z.string().min(1).default("Abidjan"),
});

export const PriceRangeSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  avg_ticket_xof: z.number().int().nonnegative().nullable().optional(),
});

export const OpeningSlotSchema = z.object({
  open: z.string().regex(/^[0-2]\d:[0-5]\d$/, "Format HH:MM requis"),
  close: z.string().regex(/^[0-2]\d:[0-5]\d$/, "Format HH:MM requis"),
});

export const HoursSchema = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.array(OpeningSlotSchema),
);

export const PlaceFormSchema = z.object({
  name: z.string().min(1, "Nom du lieu requis").max(120),
  cuisine: z.array(z.string().min(1)).min(1, "Au moins une cuisine"),
  location: PlaceLocationSchema,
  price: PriceRangeSchema,
  hours: HoursSchema,
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  whatsapp: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  cover_photo_url: z.string().url().nullable().optional(),
  gallery_urls: z.array(z.string().url()).default([]),
  signals: z.array(z.enum([
    "institution", "coup_de_coeur", "pepite_verifiee",
    "hype", "nouveau", "sceptique",
  ])).default([]),
  is_published: z.boolean().default(false),
});

export const PlaceAdnFormSchema = z.object({
  axe_local_international: ADN_AXIS,
  axe_informel_etabli: ADN_AXIS,
  axe_budget_premium: ADN_AXIS,
  axe_populaire_prive: ADN_AXIS,
  axe_decontracte_habille: ADN_AXIS,
  // confidence_score, total_reviews, weighted_rating ne sont PAS editables
  // côté admin V1 — ils sont calculés par Story 4.7 (applyReviewToAdn).
  // Exception : Story 6.3 seed initial peut bypass via Edge Function service_role.
});

export type PlaceForm = z.infer<typeof PlaceFormSchema>;
export type PlaceAdnForm = z.infer<typeof PlaceAdnFormSchema>;
```

**And** un script `spawt-admin/scripts/check-schema-drift.mjs` (best-effort V1) compare le hash des 2 fichiers `place.schema.ts` mobile/admin et warn si divergence — pas bloquant CI V1, juste un signal au PR.

---

**AC #3 — Page `LieuxList` — liste paginée + search + filtres + actions ligne**

**Given** `spawt-admin/src/pages/lieux/index.tsx`
**When** Story 6.2 est livrée
**Then** la page expose :

1. **Liste paginée** via `useTable()` Refine :

```tsx
import { useTable, useNavigation, useDelete } from "@refinedev/core";
import { useState } from "react";

export const LieuxList = () => {
  const [filters, setFilters] = useState({ search: "", neighborhood: "", cuisine: "", published: "all" });
  const { tableQueryResult, current, setCurrent, pageSize, setPageSize, sorter, setSorter } = useTable({
    resource: "places",
    pagination: { pageSize: 25 },
    sorters: { initial: [{ field: "updated_at", order: "desc" }] },
    filters: {
      permanent: [
        { field: "name", operator: "contains", value: filters.search || undefined },
        { field: "neighborhood", operator: "eq", value: filters.neighborhood || undefined },
        ...(filters.published !== "all" ? [{ field: "is_published", operator: "eq", value: filters.published === "yes" }] : []),
      ].filter((f) => f.value !== undefined),
    },
    meta: { select: "*, place_adn(weighted_rating, total_reviews, confidence_score)" },
  });
  // ...
};
```

2. **Barre de filtres** :
   - Search texte (debounce 300ms) → cherche sur `name` (contains).
   - Dropdown quartier → distinct des `neighborhood` (fetch séparé via `useList` ou hard-coded V1 — 12 quartiers Abidjan dans une const).
   - Dropdown cuisine → idem (15 cuisines de référence).
   - Toggle published : Tous / Publiés / Brouillons.

3. **Tableau** colonnes : Nom · Quartier · Cuisine (chips) · Prix (tier) · Note pondérée · Avis total · Status (badge published/draft) · Actions (Edit · Dépublier/Republier).

4. **Tri** : cliquable sur `name`, `neighborhood`, `updated_at`, `place_adn.weighted_rating`.

5. **Pagination** : footer 25 / 50 / 100 par page + nombres.

6. **Bouton « + Nouveau lieu »** en haut → navigation vers `/lieux/create`.

7. **Action ligne « Dépublier »** (ou « Republier ») :
   - Confirmation native (`window.confirm("Dépublier ce lieu ?")` V1).
   - Appel `useUpdate({ resource: "places", id, values: { is_published: !current } })`.
   - **Audit log** : `await logAuditAction({ action: "place_publish_toggle", entity_type: "place", entity_id: id, payload_before: { is_published: current }, payload_after: { is_published: !current } })`.
   - Refetch automatique de la liste via Refine `useInvalidate()`.

**And** la liste rend en < 500ms sur un dataset de 100 lieux (acceptable V1 — pas d'optimisation virtual scroll).

---

**AC #4 — Page `PlaceCreate` / `PlaceEdit` — form avec validation Zod + jointure `place_adn` + upload photo**

**Given** `spawt-admin/src/pages/lieux/create.tsx` et `spawt-admin/src/pages/lieux/edit.tsx`
**When** Story 6.2 est livrée
**Then** les 2 pages exposent un formulaire unifié `<PlaceForm>` (composant partagé) :

```tsx
// spawt-admin/src/components/PlaceForm.tsx
import { useForm } from "@refinedev/core";
import { PlaceFormSchema, type PlaceForm as PlaceFormValues } from "../types/place.schema";
import { logAuditAction } from "../lib/audit";
import { uploadPlacePhoto } from "../lib/storage";

export const PlaceForm = ({ mode, id }: { mode: "create" | "edit"; id?: string }) => {
  const { formProps, queryResult, onFinish, mutationResult } = useForm({
    resource: "places",
    action: mode,
    id,
    meta: { select: "*, place_adn(*)" },
    onMutationSuccess: async (data, variables) => {
      const isCreate = mode === "create";
      await logAuditAction({
        action: isCreate ? "place_create" : "place_update",
        entity_type: "place",
        entity_id: (data.data as { id: string }).id,
        payload_before: isCreate ? null : queryResult?.data?.data,
        payload_after: variables,
      });
    },
  });

  // Sections du form :
  // 1. Identité : name, cuisine[] (multi-select), signals[] (multi-select)
  // 2. Localisation : lat, lng, descriptive_address, neighborhood (dropdown), city (default Abidjan)
  // 3. Tarification : price_tier (radio 1/2/3), avg_ticket_xof
  // 4. Horaires : éditeur 7 jours × n créneaux (composant HoursEditor)
  // 5. Contact : phone (E.164), whatsapp (E.164)
  // 6. Visuel : cover_photo_url + gallery (upload via <PhotoUploader />)
  // 7. ADN (édition manuelle — 5 sliders [-1, 1] step 0.05)
  // 8. Statut : is_published (toggle)

  // Validation onSubmit :
  // const parsed = PlaceFormSchema.safeParse(values);
  // if (!parsed.success) -> afficher erreurs Zod inline (formProps.errors)
  // sinon -> formProps.onFinish(parsed.data)

  // ...
};
```

**And** le composant `<PhotoUploader>` upload via Supabase Storage :

```ts
// spawt-admin/src/lib/storage.ts
import { supabaseClient } from "../utility/supabaseClient";

export async function uploadPlacePhoto(placeId: string, file: File): Promise<string | null> {
  // Compression côté client si > 1 MB (cohérent NFR-PERF-07 mobile).
  // V1 : skip compression (panel admin → laptop, bande passante OK).
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `places/${placeId}/${Date.now()}.${ext}`;
  const { error } = await supabaseClient.storage
    .from("place-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    console.warn("[storage] upload failed", error);
    return null;
  }
  const { data } = supabaseClient.storage.from("place-photos").getPublicUrl(path);
  return data.publicUrl;
}
```

**And** l'édition de l'ADN passe par un sous-formulaire séparé (5 sliders) ; au submit, la mise à jour `place_adn` est faite via un `useUpdate({ resource: "place_adn", id: placeId })` distinct du `places` update — 2 appels, 2 audit entries (`place_update` + `place_adn_update`).

**And** lors d'un `create`, une row `place_adn` est **aussi** insérée (1:1 obligatoire). Implémentation V1 : après le create de `places` réussi, déclencher un `useCreate({ resource: "place_adn", values: { place_id, ...PlaceAdnFormSchema.parse(adnDefaults) } })` avec valeurs par défaut (0 partout, confidence 0).

---

**AC #5 — Soft-delete via dépublication + préservation des avis liés**

**Given** un lieu `places` avec N avis `spawt_checkin` rattachés
**When** un staff dépublie le lieu (`is_published → false`)
**Then** :

1. Le lieu **disparaît du feed mobile** (RLS `places_select_published` Story 3.3a filtre).
2. Les avis `spawt_checkin.place_id = X` restent en base — pas de DELETE physique.
3. Aucune notification spawter — silent (les avis individuels restent dans Profil/Spawts du spawter).
4. Le staff peut **republier** plus tard → le lieu réapparaît tel quel.

**And** une action « Dépublier définitivement (purge) » est **explicitement absente** côté UI V1 — toute purge physique = handoff Stéphanie via Supabase Admin UI + service_role + audit manuel.

**Given** un lieu sans avis
**When** un staff dépublie
**Then** le comportement est identique (idempotent, no-op sur `spawt_checkin`).

---

**AC #6 — Audit log câblé sur les 5 actions CRUD**

**Given** chaque mutation côté admin
**When** elle réussit
**Then** une ligne `admin_audit_log` est insérée :

| Action UI | `action` | `entity_type` | `entity_id` | `payload_before` | `payload_after` |
|---|---|---|---|---|---|
| Création lieu | `place_create` | `place` | nouveau `places.id` | `null` | `PlaceForm` validé |
| Édition lieu | `place_update` | `place` | `places.id` | snapshot avant | snapshot après |
| Dépublication / Republication | `place_publish_toggle` | `place` | `places.id` | `{ is_published: <old> }` | `{ is_published: <new> }` |
| Édition ADN | `place_adn_update` | `place_adn` | `place_adn.place_id` | snapshot 5 axes avant | snapshot 5 axes après |
| Upload photo (success) | `place_update` | `place` | `places.id` | `{ cover_photo_url: <old> }` | `{ cover_photo_url: <new> }` |

**And** si l'INSERT `admin_audit_log` échoue (RLS / réseau), l'action principale n'est **pas** rollback — l'audit log fail est loggé en console mais ne bloque pas l'UX (cf. helper `logAuditAction` Story 6.1 §AC #8). Dev Notes §6 discute le trade-off.

**And** une page minimale `/audit` (route `spawt-admin/src/pages/audit/index.tsx`) liste les 100 dernières actions du staff connecté — utile pour debug / vérification. Pas dans la sidebar V1 (route directe, pas exposée dans le menu). Sprint 2 → exposition admin globale.

---

**AC #7 — Search + filtres + tri performants sur un dataset alpha**

**Given** un dataset alpha de 100 lieux (post-Story 6.3 seed)
**When** un staff recherche / filtre / trie
**Then** :

1. **Search par nom** (contains) : < 200ms réponse Supabase (index B-tree implicite sur `name` via `idx_places_neighborhood WHERE is_published` insuffisant — nécessaire ? Voir Dev Notes §7).
2. **Filtre quartier** : < 150ms (index `idx_places_neighborhood` existant Story 3.3a — mais partial WHERE `is_published = true` ; en admin on lit aussi les drafts).
3. **Filtre cuisine** : < 150ms (index GIN `idx_places_cuisine` existant — même remarque).
4. **Tri par `updated_at`** : pas d'index dédié V1 (acceptable < 1000 rows).

**And** Dev Notes §7 tranche : pour V1 alpha < 200 lieux, **pas de nouvel index**. Sprint 2 si > 1000 lieux → ajouter `idx_places_name_trgm` (pg_trgm) + `idx_places_updated_at`.

---

**AC #8 — Tests + triple gate `spawt-admin/`**

**Given** la suite de tests `spawt-admin/`
**When** `cd spawt-admin && npm test` est lancé
**Then** la couverture inclut :

1. **`place.schema.test.ts`** — `PlaceFormSchema` parse :
   - Valeurs valides → success.
   - `name = ""` → fail avec message FR.
   - `cuisine = []` → fail.
   - `lat = 100` → fail.
   - `phone = "0102030405"` (non-E.164) → fail.

2. **`PlaceForm.test.tsx`** :
   - Render mode `create` → form vide rendable.
   - Submit avec valeurs valides → `onFinish` appelé + `logAuditAction` mocké appelé avec `action: "place_create"`.
   - Submit avec `name = ""` → erreurs Zod affichées inline.

3. **`LieuxList.test.tsx`** :
   - Mock `useTable` retournant 3 rows → tableau rendu avec 3 lignes.
   - Click sur « Dépublier » → confirm OK → `useUpdate` appelé + `logAuditAction` appelé.

4. **`storage.test.ts`** :
   - Mock `supabaseClient.storage.from(...).upload` retourne `{ error: null }` → `uploadPlacePhoto` retourne l'URL publique.
   - Mock upload error → retourne `null` + warn console.

**Given** la triple gate spawt-admin
**When** lancée
**Then** `cd spawt-admin && npx tsc --noEmit && npm run lint && npm test` vert.
**And** `cd spawt-admin && npm run build` produit `dist/` sans erreur.

**And** la triple gate mobile (`cd app && tsc + lint:vocab + i18n:check`) reste verte — Story 6.2 ne touche **pas** `app/`.

## Tasks / Subtasks

- [ ] **Task 1 — Migration `0018_create_places_admin_policies.sql` + `.down.sql`** (AC: #1)
  - [ ] Créer le fichier UP avec 6 policies (`places_select_staff`, `places_insert_staff`, `places_update_staff`, `place_adn_select_staff`, `place_adn_insert_staff`, `place_adn_update_staff`) + 3 policies storage.
  - [ ] Créer le fichier DOWN réversible.
  - [ ] Tester via `supabase db reset` si CLI disponible, sinon syntaxe lint.

- [ ] **Task 2 — Port schémas Zod côté admin** (AC: #2)
  - [ ] Créer `spawt-admin/src/types/place.schema.ts` selon AC #2 (port de `app/src/types/place.schema.ts` + adaptations form).
  - [ ] Créer `spawt-admin/scripts/check-schema-drift.mjs` (best-effort hash compare).
  - [ ] Ajouter `zod` à `spawt-admin/package.json` (version `4.4.3` pin — aligné mobile).

- [ ] **Task 3 — Page `LieuxList` avec table + filtres + actions** (AC: #3)
  - [ ] Réécrire `spawt-admin/src/pages/lieux/index.tsx` selon AC #3.
  - [ ] Créer constantes `NEIGHBORHOODS` (12 quartiers Abidjan) + `CUISINES` (15 cuisines) dans `spawt-admin/src/constants/inventory.ts`.
  - [ ] Action « Dépublier » avec confirm + audit log.
  - [ ] CSS sobre dans `spawt-admin/src/styles/list.css`.

- [ ] **Task 4 — Composant `PlaceForm` partagé + pages create/edit** (AC: #4)
  - [ ] Créer `spawt-admin/src/components/PlaceForm.tsx`.
  - [ ] Créer `spawt-admin/src/components/HoursEditor.tsx` (7 jours × n créneaux).
  - [ ] Créer `spawt-admin/src/components/PhotoUploader.tsx` (input file + preview + upload Storage).
  - [ ] Créer `spawt-admin/src/components/AdnSliders.tsx` (5 sliders [-1, 1] step 0.05).
  - [ ] Créer `spawt-admin/src/pages/lieux/create.tsx` (mode="create").
  - [ ] Créer `spawt-admin/src/pages/lieux/edit.tsx` (mode="edit").
  - [ ] Ajouter les routes dans `spawt-admin/src/App.tsx`.

- [ ] **Task 5 — Upload Storage helper** (AC: #4)
  - [ ] Créer `spawt-admin/src/lib/storage.ts` (`uploadPlacePhoto`).
  - [ ] Pas de compression V1 (panel laptop, bande passante OK).
  - [ ] Documenter le chemin `places/<place_id>/<timestamp>.<ext>`.

- [ ] **Task 6 — Câblage audit log sur les 5 actions** (AC: #6)
  - [ ] Étendre `spawt-admin/src/lib/audit.ts` si besoin (helper déjà créé Story 6.1).
  - [ ] Câbler `logAuditAction` dans `PlaceForm.onMutationSuccess` (create + update).
  - [ ] Câbler dans `LieuxList` action dépublication.
  - [ ] Câbler dans `AdnSliders` submit séparé.
  - [ ] Câbler dans `PhotoUploader` post-upload réussi.

- [ ] **Task 7 — Page `/audit` minimale (debug)** (AC: #6)
  - [ ] Créer `spawt-admin/src/pages/audit/index.tsx` listant les 100 dernières lignes du staff connecté (via `useList({ resource: "admin_audit_log" })`).
  - [ ] Pas dans la sidebar (route directe).

- [ ] **Task 8 — Tests + triple gate** (AC: #8)
  - [ ] `spawt-admin/src/types/__tests__/place.schema.test.ts`.
  - [ ] `spawt-admin/src/components/__tests__/PlaceForm.test.tsx`.
  - [ ] `spawt-admin/src/pages/lieux/__tests__/LieuxList.test.tsx`.
  - [ ] `spawt-admin/src/lib/__tests__/storage.test.ts`.
  - [ ] Triple gate verte spawt-admin + mobile.
  - [ ] CHANGELOG : `feat(spawt-admin): CRUD lieux + audit log (Story 6.2)`.

## Dev Notes

### 1. Pourquoi pas `Edge Function` pour les opérations CRUD ?

L'auth `spawt_staff` + RLS étendue (migration 0015) permet aux staff de CRUD `places` / `place_adn` directement via le SDK Supabase JS, sans `service_role`. **C'est plus simple et tout aussi sécurisé** :

- L'anon key + JWT staff = scope limité à `spawt_staff_active`.
- La RLS bloque tout non-staff.
- L'audit log est inséré par le client lui-même (`spawter_id = auth.uid()` enforced).

**Edge Function nécessaire seulement si** :
- Opération qui doit cascader sur plusieurs tables atomiquement (Story 6.4 ban spawter — voir cette story).
- Opération qui requiert `service_role` (Story 6.3 seed initial avec `is_seed = true`).

V1 = CRUD direct via SDK. Trade-off OK.

### 2. Pourquoi un champ `reason` optionnel sur `admin_audit_log` côté Story 6.2 ?

Le CHECK dans la migration 0014 (Story 6.1) accepte `reason TEXT NULL`. **Côté Story 6.2** :
- Create/Update lieu : pas de motif obligatoire (action standard).
- Dépublication : motif optionnel (un staff peut justifier « duplicate », « fermé définitivement », etc. V1 = textarea libre).

**Côté Story 6.4** : motif obligatoire pour ban (vérifié côté application form, pas DB CHECK — flexibilité). Documenté Story 6.4.

### 3. Pourquoi un seul bucket `place-photos` (pas `place-photos-admin` séparé)

| Option | Verdict |
|---|---|
| **Bucket unique avec namespace par préfixe path** | ✅ **Retenu V1.** Mobile écrit `<spawter_id>/<spawt_id>/`, admin écrit `places/<place_id>/`. RLS distingue par préfixe (`storage.foldername(name)[1]`). |
| **2 buckets séparés (`place-photos` + `place-photos-admin`)** | ❌ Surcoût config sans bénéfice fonctionnel. Tests RLS plus complexes. |

L'option retenue est cohérente avec l'architecture l303-307 (un seul bucket public `place-photos`).

### 4. Édition manuelle de l'ADN — conflit potentiel avec Story 4.7 (recompute auto)

Story 4.7 (`applyReviewToAdn`) recalcule l'ADN à chaque avis posté côté mobile. Story 6.2 permet à un staff de **forcer** les 5 axes manuellement.

**Risque** : un staff édite l'ADN → un nouvel avis arrive → l'ADN est écrasé par le recompute.

**Mitigation V1** :
- Story 4.7 V1 = compute client local-first, persistance serveur reportée Sprint 2 (cf. Dev Notes 4.7 §2). Donc en pratique, l'édition admin V1 = **persistance canonique**.
- Sprint 2 : quand l'Edge Function `recompute-place-adn` arrive, ajouter un flag `manual_override BOOLEAN` sur `place_adn` qui bloque le recompute auto. Defer D-621.

**Cas Story 6.3 (seed initial)** : les avis seed posent un ADN cohérent. Pas de conflit immédiat.

### 5. HoursEditor — UX pragmatique

Le champ `hours JSONB` côté DB stocke `Record<DayOfWeek, OpeningSlot[]>`. **UX V1** :
- 7 lignes (lun-dim).
- Par défaut : 1 créneau `12:00 → 22:00` chacun (template `defaultHours` cohérent seeds).
- Bouton « + Créneau » par jour (pour les lieux qui ferment entre 14h-19h).
- Bouton « Fermé » → vide le tableau du jour.
- Bouton « Copier sur tous les jours » sur le 1er → DX.

Pas de validation cross-créneau (chevauchements) V1 — trade-off acceptable, le staff est de bonne foi.

### 6. Audit log fail-silent

Si l'INSERT `admin_audit_log` échoue (réseau, RLS, etc.), l'action principale n'est **pas** rollback. Pourquoi :

- **Cohérence UX** : un staff qui crée un lieu et voit une erreur audit serait perdu (« le lieu est créé ou non ? »).
- **Cohérence data** : la création/édition est commit avant l'audit insert (séquentiel, pas dans une transaction multi-statement).
- **Trace** : warn console + Cloudflare logs. Un drift d'audit = monitoring équipe (Sprint 2).

**Sprint 2 (D-622)** : Edge Function `audit-wrapper` qui wrappe l'action + audit dans une transaction Postgres atomique. Pour V1 alpha 3-5 staff, le risque est négligeable.

### 7. Indexation V1 vs Sprint 2

| Cas | Index existant | Suffisant V1 ? | Sprint 2 |
|---|---|---|---|
| Search `name CONTAINS` | aucun | < 200ms < 200 rows = OK | `pg_trgm` + `idx_places_name_trgm` |
| Filtre `neighborhood` | `idx_places_neighborhood WHERE is_published = true` | partial — admin lit aussi drafts (filtre côté requête sans index) — < 100ms OK | Index full (sans WHERE partial) |
| Filtre `cuisine` | `idx_places_cuisine GIN WHERE is_published` | idem | Idem |
| Tri `updated_at DESC` | aucun | scan 100 rows < 50ms | `idx_places_updated_at` si > 1000 lieux |

**Décision V1** : pas de nouvel index, scan suffit pour alpha < 200 lieux. Defer D-623.

### 8. Page `/audit` minimale — pourquoi pas dans la sidebar V1

L'audit log est conceptuellement une **section admin avancée** (debug, compliance). V1 = équipe 3-5 staff connue, on n'expose pas dans la sidebar pour ne pas alourdir l'UX. Route accessible direct via URL pour les besoins de debug. Sprint 2 : exposer dans sidebar avec filtres (par staff, par action, par date) + export CSV pour audit ARTCI.

### 9. Pas de live preview du feed mobile depuis le panel

Un staff qui dépublie un lieu ne voit pas en temps réel l'effet sur le feed mobile. Acceptable V1 — couplage faible volontaire (`spawt-admin/` ↔ `app/` boundary, architecture l740-742).

**Sprint 2** : iframe optionnel `/preview?place_id=X` qui rendrait une PlaceCard mobile-like — utile pour valider une édition avant publication.

### 10. Sign-off

- **Stéphanie** (tech) : revue migration `0018_create_places_admin_policies.sql` (RLS sound), audit log câblage, conflict ADN Story 4.7.
- **Kidam** (analytics) : pas concerné — l'audit log alimente Story 6.5 dashboard pas PostHog.
- **Alexandre** (brand) : revue libellés form (« Lieu », « Quartier », « ADN » — vocab respecté), sobriété UI confirmée.

### 11. Defers identifiés

- **D-621** — `manual_override BOOLEAN` sur `place_adn` pour bloquer recompute auto (Sprint 2 avec Edge Function `recompute-place-adn`).
- **D-622** — Edge Function `audit-wrapper` pour atomicité action + audit (Sprint 2).
- **D-623** — Index full `idx_places_neighborhood` (sans WHERE partial) + `pg_trgm` pour search nom (Sprint 2 si > 1000 lieux).
- **D-624** — Page `/audit` dans la sidebar avec filtres + export CSV (Sprint 2 compliance ARTCI).
- **D-625** — Preview iframe `/preview?place_id=X` (Sprint 2).
- **D-626** — Validation cross-créneau horaires (chevauchements détectés) (Sprint 2).
- **D-627** — Monorepo `@spawt/types` pour partager Zod schemas entre `app/` et `spawt-admin/` (Sprint 2+).

### 12. Risk

- **Risque #1** : Un staff édite l'ADN puis un avis recompute écrase. Mitigation V1 = Story 4.7 ne persiste pas serveur ; Sprint 2 = `manual_override`.
- **Risque #2** : Upload photo > 10 MB plante le navigateur. Mitigation V1 = pas de compression mais validation taille côté form (rejet si > 5 MB).
- **Risque #3** : 2 staff éditent le même lieu simultanément → last-write-wins, le 2e écrase le 1er. Acceptable V1 alpha 3-5 staff (race quasi impossible). Sprint 2 : optimistic locking via `updated_at` check.
- **Risque #4** : Drift Zod schema mobile/admin → form admin valide ce que mobile rejette (ou inverse). Mitigation = `check-schema-drift.mjs` + revue PR. Long-terme = monorepo.

### Project Structure Notes

- **1 nouvelle migration SQL** : `supabase/migrations/0018_create_places_admin_policies.sql` + `.down.sql` (6 + 3 policies).
- **Nouveaux fichiers `spawt-admin/src/`** :
  - `types/place.schema.ts` (port Zod).
  - `pages/lieux/index.tsx`, `create.tsx`, `edit.tsx`.
  - `pages/audit/index.tsx`.
  - `components/PlaceForm.tsx`, `HoursEditor.tsx`, `PhotoUploader.tsx`, `AdnSliders.tsx`.
  - `lib/storage.ts`.
  - `constants/inventory.ts` (`NEIGHBORHOODS`, `CUISINES`, `SIGNALS`).
  - `styles/list.css`, `styles/form.css`.
  - Tests (4 fichiers).
- **Nouveaux scripts** : `spawt-admin/scripts/check-schema-drift.mjs`.
- **Modifs `spawt-admin/src/App.tsx`** : ajout routes `/lieux/create`, `/lieux/edit/:id`, `/lieux/show/:id`, `/audit`.
- **Aucun fichier modifié dans `app/`** — boundary préservée.
- **CHANGELOG.md** : entry `feat(spawt-admin): CRUD lieux + place_adn + audit log (Story 6.2)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] lignes 1107-1125 — Story 6.2 user story + BDD AC.
- [Source: _bmad-output/planning-artifacts/architecture.md] lignes 277-307 (Data Architecture, buckets Storage), 392-394 (Cloudflare admin), 740-742 (boundary).
- [Source: _bmad-output/planning-artifacts/PRD.md] §3.1 Feature 19 (FR-023), §13.2 (schémas `places` + `place_adn`), §20.6 (poids stade weighted_rating).
- [Source: _bmad-output/project-context.md] §Vocabulaire SPAWT, §Security & privacy.
- [Source: supabase/migrations/0010_create_places_place_adn.sql] — schéma cible.
- [Source: supabase/migrations/0013_storage_buckets_place_photos.sql] — bucket place-photos existant.
- [Source: supabase/migrations/0017_create_admin_audit_log.sql] Story 6.1 — table audit cible.
- [Source: app/src/types/place.schema.ts] Story 3.3a — schéma Zod à porter.
- [Source: _bmad-output/implementation-artifacts/3-3a-schema-places-place-adn-adapter-data-source.md] — story sœur DB places.
- [Source: _bmad-output/implementation-artifacts/4-7-mise-a-jour-de-l-adn-du-lieu.md] — `applyReviewToAdn` (conflit ADN).
- [Source: _bmad-output/implementation-artifacts/6-1-authentification-shell-du-panel-admin.md] — shell + audit log table.
- [Refine docs] https://refine.dev/docs/data/hooks/use-table/ + `/data/hooks/use-form/`.

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev agent)_

### Debug Log References

_(à remplir par le dev agent)_

### Completion Notes List

_(à remplir par le dev agent)_

### File List

_(à remplir par le dev agent)_
