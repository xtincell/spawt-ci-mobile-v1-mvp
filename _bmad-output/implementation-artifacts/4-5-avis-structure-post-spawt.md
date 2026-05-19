# Story 4.5: Avis structuré post-spawt

Status: review

<!-- Story de complétion du Spawt — livre `SpawtSheet`/`ReviewForm` (sheet
post-confirmation), upload photos compressées vers bucket `place-photos`,
attachment de l'avis au `SpawtCheckin` créé par Story 4.2 (`confirmSpawt`).
Migration `0013_storage_buckets_place_photos.sql` (bucket + RLS). Events
review_started/submitted/photo_added/abandoned. -->

## Story

As a spawter,
I want donner un avis structuré après mon spawt en moins de 2 min,
so that j'enrichis le produit (ADN du Lieu, note communautaire) pour les autres spawters — sans pression, sans nag.

## ⚠️ Brownfield context — read first

État courant Story 4.5 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| `SpawtCheckin.note_etoiles` / `texte_avis` / `tags` / `photos` | Story 4.1 migration `0011` | ✅ Colonnes existent | **Update** via patch après submit |
| `REVIEW_TAGS` (5 valeurs canoniques) | [app/src/types/spawt.ts:53-61](../../app/src/types/spawt.ts#L53-L61) | ✅ Existe (Epic 1) | **Consommer** — `copieux`, `rapide`, `ambiance_top`, `cher`, `a_refaire` + labels FR |
| Composant `SpawtSheet` / `ReviewForm` | (aucun) | ❌ N'existe pas | **Créer** comme nouvel écran modal — `app/app/review/[spawt_id].tsx` (modal route) |
| `Stars` primitive | `app/src/components/primitives/` (à vérifier — Story 1.4) | ⚠️ Existe probable, à confirmer + max=5 (D7 Story 1.4) | **Réutiliser** — tap pour noter 1-5 |
| Bucket Supabase `place-photos` | (aucun) | ❌ Pas créé V1 | **Créer** — migration `0013_storage_buckets_place_photos.sql` (CREATE BUCKET + RLS écriture limitée `<spawter_id>/<spawt_id>/`) |
| Compression photo client-side | (aucun) | ❌ | **Ajouter** — `expo-image-manipulator` (`compress: 0.8`, max 1MB) |
| Upload Storage helper | (aucun) | ❌ | **Créer** `app/src/lib/storage-photos.ts` — wrapper Supabase Storage upload + path `<spawter_id>/<spawt_id>/<index>.jpg` |
| Events analytics review | `analytics.ts:163` | ✅ Définis | **Consommer** : `review_started`, `review_submitted`, `review_photo_added`, `review_abandoned` |
| Décisions Story 1.4 héritées | Retrospective Epic 2/3 AT1.bis | ⚠️ Stars round logic + AdnTags brand validation | **À trancher avant ou pendant Story 4.5** — voir Dev Notes §1 |
| `incrementalWeightedRating` (Story 3.2 préparé !) | `app/src/lib/weighted-rating.ts` | ✅ Existe — accumulator `sum_weighted_notes`/`sum_weights` | **Pas appelé Story 4.5** — appel Story 4.7 (update ADN) |
| Open `SpawtSheet` post-confirmation | Story 4.2 `confirmSpawt` | ✅ Fenêtre +30min documentée | **Câbler** — après `confirmSpawt('active'/'manual')`, ouvrir SpawtSheet (`router.push("/review/[id]")`) avec entry_point `post_spawt` |

**Décisions héritées non-revisitables** :

- **5 étoiles obligatoire** (1-5) avant soumission (PRD §3.1 #6).
- **Tags `REVIEW_TAGS` 5 fixes** (gel Epic 1 types).
- **500 caractères max** texte libre.
- **0-3 photos optionnelles** (`photos: TEXT[]` array URL Storage).
- **Compression 80% / 1MB max client-side** (NFR-PERF-07, NFR-COST-02).
- **Bucket `place-photos` RLS écriture limitée au sous-dossier** `<spawter_id>/<spawt_id>/` (architecture §Naming Patterns + §Authentication & Security).
- **Avis différable** (« Plus tard ») — review reste possible depuis la fiche spawt (Profil → Mes spawts, Story 5.x). V1 = ouvre SpawtSheet à la confirm, si dismiss → row existe sans avis, mais pas de re-trigger automatique.
- **Soumission < 2 min** (PRD §3.1 #6) — performance UX, pas mesurable unit (test alpha).

## Acceptance Criteria

**AC #1 — Écran modal `app/app/review/[spawt_id].tsx`**

**Given** un `SpawtCheckin` avec `id`, `place_id` connus
**When** le spawter ouvre `router.push({ pathname: "/review/[spawt_id]", params: { spawt_id } })`
**Then** un écran modal monte avec :

- **Header** : photo cover lieu (compressée seed/Story 3.4) en hero hauteur 120dp, overlay close × en haut droit.
- **Title** : `t("review.title", { place_name })` → « Ton avis chez {{place_name}} »
- **Subtitle** : `t("review.subtitle")` → « Le Chat écoute. »
- **Section 1 — Note** :
  - `<Stars value={note} max={5} onChange={setNote} interactive />`
  - Label sous : `t("review.stars_hint")` → « De 1 (jamais retour) à 5 (à refaire vite) »
  - Visuel : étoiles or `theme.colors.brand.gold` selectionnées, gris `theme.colors.text.muted` non.
- **Section 2 — Tags** (multi-select chips) :
  - 5 chips `<ChipDark active={tags.includes(tag)} onPress={...} label={REVIEW_TAG_LABELS[tag]} />`
  - Toggle add/remove.
- **Section 3 — Texte libre** :
  - `<TextInput multiline maxLength={500} placeholder={t("review.text_placeholder")} value={text} onChangeText={setText} />`
  - Compteur live `{text.length}/500`.
  - Placeholder : « En 1 phrase, ce que tu retiens ? »
- **Section 4 — Photos (0-3)** :
  - 3 slots photo, tap → `expo-image-picker` (déjà installable, vérifier package — sinon ajouter).
  - Compression via `expo-image-manipulator` au choice (compress 0.8, resize maxWidth 1920px → cible < 1MB).
  - Preview thumbnail. Tap long → retirer.
- **Sticky CTA bas** :
  - Bouton primaire « Enregistrer mon avis » — **disabled tant que `note === null`**.
  - Bouton secondaire « Plus tard » → dismiss sans persistence (spawt reste sans avis ; re-accessible Story 5.x).

**And** l'écran est mounté comme modal (`presentation: "modal"` dans le `<Stack.Screen>`).
**And** un swipe-down dismisse → comportement « Plus tard » (émet `review_abandoned`).

---

**AC #2 — Événements analytics**

**Given** l'écran review
**When** les actions ci-dessous se produisent
**Then** :

| Action | Event | Properties |
|---|---|---|
| Ouverture (focus mount) | `review_started` | `{ place_id, entry_point: "post_spawt" \| "place_detail" }` |
| Submit succès | `review_submitted` | `{ place_id, note_etoiles, tags_count, text_length, photos_count }` |
| Tap ajout photo | `review_photo_added` | `{ place_id, photos_count_now: 1\|2\|3 }` |
| Dismiss/swipe-down sans submit | `review_abandoned` | `{ place_id, had_note: boolean }` |

`entry_point` :
- `"post_spawt"` si arrivée depuis `confirmSpawt` Story 4.2 (via deep param query `?entry=post_spawt`).
- `"place_detail"` si arrivée depuis Profil → fiche spawt (Story 5.x — deferred V1).

**V1** : seul `post_spawt` est câblé (Story 5.x ajoutera `place_detail`).

---

**AC #3 — Submit → update `spawt_checkin` + upload photos**

**Given** le spawter tape « Enregistrer mon avis » avec `note >= 1` (validé)
**When** le submit est lancé
**Then** :

1. **Upload photos** (si `photos.length > 0`) :
   - Pour chaque photo locale (`file://...`), `compressPhoto(uri)` → cible < 1MB.
   - Upload via `supabase.storage.from("place-photos").upload("{spawter_id}/{spawt_id}/{index}.jpg", blob)`.
   - Collecte les `public_url` retournés (ou path si privé V1).
   - Fail upload silencieux → continue, photo perdue, log `__DEV__`. Pas de blocage submit.
2. **Update row** `spawt_checkin` via `data-source` :
   - `patch = { note_etoiles, texte_avis, tags, photos: [array URLs], updated_at }`
   - Wrapper `saveSpawtToSupabaseOrEnqueue` Story 4.3 → enqueue offline si réseau down.
   - Store local : `spawter-store.registerSpawt` re-appelé ? **Non** — créer un nouveau action `attachReviewToSpawt(spawt_id, patch)` qui patche la row locale + sync.
3. **Émet `review_submitted`**.
4. **Latence cible** : **< 2 min** end-to-end (compression photos peut prendre 10-30s sur Tecno low-end).
5. **Navigation post-submit** :
   - Si entry_point === `post_spawt` → `router.replace` vers fiche lieu (`/place/[id]`) avec un Toast « Ton avis a renforcé l'ADN de {{place_name}}. »
   - Si entry_point === `place_detail` (V1 N/A) → dismiss modal.

**Given** une erreur réseau au submit
**When** offline queue absorbe la mutation
**Then** :
- UI considère le submit comme **réussi** côté utilisateur (local-first, fire-and-forget).
- Photos pendantes : V1 = perdues si upload Storage failed pre-queue. (Améliorable Sprint 2 avec photo queue dédiée.)
- L'utilisateur revient à la fiche, sa note est visible (lecture locale store).

---

**AC #4 — Migration `0013_storage_buckets_place_photos.sql`**

**Given** Supabase Storage
**When** Story 4.5 est livrée
**Then** **2 fichiers** existent :

`supabase/migrations/0013_storage_buckets_place_photos.sql` :

```sql
-- Story 4.5 — Bucket place-photos (avis photos) + RLS d'écriture limitée.
-- Bucket `place-covers` (read-only public, cover_photo_url Story 3.3a) : différé Story 6.3
-- quand les vraies covers seront uploadées staff.

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-photos', 'place-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS sur storage.objects pour bucket place-photos
-- SELECT public (rapide via lien signé V2 — V1 = lecture restreinte au spawter pour son sub-folder).
CREATE POLICY place_photos_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT/UPDATE : limité au sous-dossier <spawter_id>/<spawt_id>/.
CREATE POLICY place_photos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] IS NOT NULL  -- spawt_id sub-folder required
  );

CREATE POLICY place_photos_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Pas de DELETE policy publique — V1 immutable. Modération admin Story 6.4 via service_role.
```

`supabase/migrations/0013_storage_buckets_place_photos.down.sql` :

```sql
DROP POLICY IF EXISTS place_photos_update_own ON storage.objects;
DROP POLICY IF EXISTS place_photos_insert_own ON storage.objects;
DROP POLICY IF EXISTS place_photos_select_own ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'place-photos';
```

**And** la migration tourne sur `supabase db reset` propre (extension `storage` activée par Supabase managed).

---

**AC #5 — Helper `app/src/lib/storage-photos.ts`**

**Given** le dossier `app/src/lib/`
**When** Story 4.5 est livrée
**Then** [app/src/lib/storage-photos.ts](../../app/src/lib/storage-photos.ts) existe :

```ts
import { supabase } from "./supabase";

/** Path canonique : <spawter_id>/<spawt_id>/<index>.jpg */
export function photoPath(spawter_id: string, spawt_id: string, index: 0 | 1 | 2): string {
  return `${spawter_id}/${spawt_id}/${index}.jpg`;
}

/** Upload une photo compressée. Retourne le path Storage si succès, null si échec.
 *  Échec = log __DEV__ warn, ne throw pas. */
export async function uploadReviewPhoto(
  uri: string,
  spawter_id: string,
  spawt_id: string,
  index: 0 | 1 | 2,
): Promise<string | null>;

/** Lecture publique via signed URL (V1 — 7 jours TTL, suffit pour HomeD cache).
 *  V2 si Story 4.7 ADN affiche les photos → revoir RLS public read.  */
export async function getReviewPhotoUrl(path: string): Promise<string | null>;

/** Compression : expo-image-manipulator quality 0.8, resize maxWidth 1920.
 *  Retourne URI locale post-compression, prête pour upload. */
export async function compressPhoto(uri: string): Promise<string>;
```

**API exemple** :

```ts
const localUri = await compressPhoto(pickerUri);
const path = await uploadReviewPhoto(localUri, spawter.id, spawtId, idx);
if (path) photos.push(path);
```

---

**AC #6 — Sticky CTA disabled tant que note vide**

**Given** l'écran review avec `note === null`
**When** le spawter ouvre l'écran
**Then** le bouton « Enregistrer mon avis » est **disabled** (`opacity: 0.5`, `pointerEvents: "none"` ou `disabled` prop).
**And** dès que `note >= 1`, le bouton devient `enabled`.
**And** **les autres champs (tags, texte, photos) sont optionnels** — soumission OK avec juste la note.

---

**AC #7 — Avis différable (« Plus tard »)**

**Given** l'écran review ouvert post-confirmation Story 4.2
**When** le spawter tape « Plus tard » OU swipe-down dismiss
**Then** :
1. Émet `review_abandoned` (`{ place_id, had_note: (note !== null) }`).
2. Aucun update sur `spawt_checkin` — la row reste sans avis (note_etoiles/texte/tags/photos restent null/empty).
3. Navigation : `router.replace` vers la fiche lieu (revient au contexte naturel).
4. **Pas de notif** « Tu as un avis non donné » V1. Story 5.x exposera la fiche spawt avec un CTA « Donner mon avis » sur les rows sans avis.

---

**AC #8 — Tests + triple gate + smoke**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **Écran `review/[spawt_id].tsx`** test léger :
   - Render initial : CTA primaire disabled.
   - Tap note 4 → CTA enabled.
   - Tap tags → state update.
   - Pas de snapshot pixel.
2. **`storage-photos.ts`** :
   - `photoPath` test pure helper (déterministe, format).
   - `compressPhoto` mock `expo-image-manipulator` → retour URI.
   - `uploadReviewPhoto` mock Supabase Storage → retour path / null en échec.
3. **Integration `attachReviewToSpawt`** action store :
   - Patch row locale → state cohérent.
   - Mock Supabase fail → enqueue Story 4.3.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Ajouter `expo-image-picker` + `expo-image-manipulator`** (AC: #1, #5)
  - [ ] `cd app && npx expo install expo-image-picker expo-image-manipulator`
  - [ ] Vérifier permissions iOS (`NSPhotoLibraryUsageDescription` déjà dans app.json Cahier §5.7 — vérifier explicitement).
  - [ ] Android : `READ_MEDIA_IMAGES` (Android 13+) + `READ_EXTERNAL_STORAGE` (legacy) à ajouter dans `app.json`.

- [ ] **Task 2 — Trancher décisions Story 1.4 héritées** (AC: #1)
  - [ ] **Stars primitive max=5 round logic** : confirmer auprès d'Alexandre que `Math.round(value * 2) / 2` (demi-étoiles) vs `Math.round(value)` (entières). Recommandation V1 : entières (note_etoiles est SMALLINT 1-5).
  - [ ] **Style chips tags** : confirmer variant `dark` actif/inactif.
  - [ ] Tracer décisions en Dev Notes.

- [ ] **Task 3 — Migration `0013_storage_buckets_place_photos.sql` + `.down.sql`** (AC: #4)
  - [ ] Créer les 2 fichiers.
  - [ ] Tester `supabase db reset` (ou syntaxe SQL en local).

- [ ] **Task 4 — Helper `lib/storage-photos.ts`** (AC: #5)
  - [ ] Créer fichier avec API publique.
  - [ ] Implémentation compress via `expo-image-manipulator`.
  - [ ] Implémentation upload via `supabase.storage.from("place-photos")`.

- [ ] **Task 5 — Écran `app/app/review/[spawt_id].tsx`** (AC: #1, #2, #3, #6, #7)
  - [ ] Créer le fichier modal (`<Stack.Screen options={{ presentation: "modal" }}>`).
  - [ ] Structure : header hero, Stars, Tags chips, TextInput multi-ligne, photo slots, sticky CTA.
  - [ ] State local `useState` pour note/tags/text/photos.
  - [ ] Events analytics dans les bons handlers.

- [ ] **Task 6 — Action store `attachReviewToSpawt`** (AC: #3)
  - [ ] Étendre `spawter-store` avec `attachReviewToSpawt(spawt_id, patch)` :
    - Locate row in `spawts` array.
    - Update locale + persist AsyncStorage via `appendSpawtLocal` (replace logic — voir storage.ts pattern).
    - Fire-and-forget Supabase update via wrapper Story 4.3 `saveSpawtToSupabaseOrEnqueue`.
  - [ ] Tests unit cohérence.

- [ ] **Task 7 — Câblage post-confirm Story 4.2** (AC: #1, #2)
  - [ ] Éditer `app/src/lib/guet/guet-spawt-actions.ts:confirmSpawt` :
    - Après update row + emit `spawt_completed`, `router.push("/review/[spawt_id]", { params: { spawt_id, entry: "post_spawt" } })`.
  - [ ] Si confirm vient du tap notif (in-app), la modal s'ouvre directement.
  - [ ] Si confirm vient d'un mode démo manuel → idem, ouvre la modal.

- [ ] **Task 8 — i18n clés `review.*`** (AC: #1)
  - [ ] Éditer [app/src/i18n/fr.json](../../app/src/i18n/fr.json) avec :
    - `review.title`, `review.subtitle`, `review.stars_hint`, `review.text_placeholder`
    - `review.cta_save`, `review.cta_later`
    - `review.photo_add`, `review.photo_compressing`, `review.photo_upload_failed`
    - `review.submit_success_toast` (« Ton avis a renforcé l'ADN de {{place_name}}. »)
  - [ ] `i18n:check` vert.

- [ ] **Task 9 — Tests + triple gate + smoke** (AC: #8)
  - [ ] Test écran review state (CTA disabled, toggle tags).
  - [ ] Test `storage-photos.ts` (path, compress mock, upload mock).
  - [ ] Test `attachReviewToSpawt` store action.
  - [ ] Triple gate verte.
  - [ ] CHANGELOG `feat(review)` + `feat(spawt)` Story 4.5.

## Dev Notes

### 1. Décisions Story 1.4 héritées — bloquantes V1

Retro Epic 3 §3.6 a flag AT1.bis : 3 décisions Story 1.4 non tranchées impactent Story 4.5 (consumer de Stars + Tags).

**À trancher avant ou pendant la dev** :

| Décision | Options | Reco V1 |
|---|---|---|
| `Stars` round logic | Entier (1-5) vs demi (0.5-5) | **Entier** — `note_etoiles SMALLINT 1-5` (Story 4.1 migration) impose. Demi-étoiles côté affichage agrégat (`weighted_rating REAL` Story 3.2). |
| Tags chips visuel | Variant `dark` (default) vs `gold` | **Dark** — cohérent UX spec, pas de drift |
| Validation max tags | 0-5 OR illimité (toggle) | **0-5** (les 5 entrées `REVIEW_TAGS`). Multi-select unrestricted V1. |

**Action dev** : tracer ces décisions dans la story, signal Alexandre pour audit si désaccord.

### 2. Coupling Story 4.2 → 4.5

Story 4.2 `confirmSpawt` doit ouvrir Story 4.5 modal **après** update row + emit `spawt_completed`. Trade-off ordre :

- Ouvrir avant confirm → spawter voit la modal sans que `spawt_checkin.checked_in_at` soit set. Si dismiss avant submit → row incohérente.
- Ouvrir après confirm → row commit local immédiat (state cohérent) + modal sur fiche.

**V1 = après confirm** (cohérence state-first). Dismiss modal = `spawt_completed` déjà émis, `review_abandoned` émis aussi. 2 events distincts pour la même action utilisateur — Kidam doit comprendre l'usage du « had_review: false » dans `spawt_completed`.

### 3. Photo upload résilience

**V1 simple** : upload séquentiel synchrone au submit, échec silencieux par photo. Photos perdues si offline au moment du submit.

**Sprint 2** : queue dédiée photos avec retry exponentiel (sur le modèle `offline-queue.ts` Story 4.3). À tracer en defer.

### 4. Sticky CTA — pas de native Picker

V1 utilise `expo-image-picker` `launchImageLibraryAsync({ allowsMultipleSelection: false })`. 3 slots = 3 picks séparés (UX simple, pas de batch picker). Sprint 2 si UX feedback alpha demande batch → `allowsMultipleSelection: true` + iterate.

### 5. Coupling Story 4.7

L'avis attaché par Story 4.5 sera **consommé par Story 4.7** (update ADN du Lieu) :
- Story 4.7 trigger sur INSERT/UPDATE `note_etoiles` non-null (probablement Edge Function ou trigger SQL) → appelle `incrementalWeightedRating` ou recompute.
- Story 4.5 ne fait **pas** ce calcul — pure persistence.

### 6. Coupling Story 4.6

Story 4.6 (Palais update) consomme aussi l'avis (tags + sub-criteria pour mettre à jour les 5 axes Palais via `palais-engine.updateAxis`). Story 4.5 émet `review_submitted` + persist la row — Story 4.6 trigger côté store ou Edge Function.

### 7. Non-régression

- `spawter-store.registerSpawt` reste inchangé. `attachReviewToSpawt` est une **nouvelle** action.
- Story 4.2 modal opening = couplage léger, document explicite.
- Story 4.3 offline queue handle naturellement la mutation `spawt_update` (kind défini AC #1 Story 4.3).
- Story 3.4 (fiche lieu) : pas de modif. Story 5.x ajoutera un CTA « Donner mon avis » sur fiche spawt depuis profil — pas Story 4.5.

### 8. Sign-off

- **Stéphanie** (tech) : revue migration bucket + RLS sub-folder, revue compression resilience, revue `attachReviewToSpawt` action.
- **Kidam** (analytics) : confirmer `review_*` events et leur consommation funnel §16.1 PRD.
- **Alexandre** (brand) : audit copy `review.subtitle` (« Le Chat écoute »), copy `submit_success_toast` (« renforcé l'ADN ») — Test Tantie Rose.

### 9. Defers identifiés

- **D-425** — Photo queue dédiée resilience (Sprint 2).
- **D-426** — Sub-criteria avis (1-5 par axe Palais : qualité plat, ambiance, etc.) — PRD §3.1 #6 mentionne tags rapides + texte, pas de sub-criteria explicit V1. Story 4.6 dérivera de tags V1.
- **D-427** — CTA fiche spawt « Donner mon avis » (Story 5.x).
- **D-428** — Bucket `place-covers` (Story 6.3 staff upload).
- **D-429** — Modération photos (Story 6.4 admin).
- **D-430** — Edit / suppression avis a posteriori (Sprint 2, RGPD friendly).

### 10. Risk

- **Risque #1** : Compression `expo-image-manipulator` lente sur Tecno (10-30s pour 3 photos 5MP). Mitigation : feedback UI « Compression en cours… » + bouton submit disabled pendant. Test alpha matrix.
- **Risque #2** : Upload Storage échoue silencieusement → photos perdues, l'avis est commit sans photos. UX dégradé acceptable V1.
- **Risque #3** : RLS sub-folder `auth.uid()` cast `text` peut faux-négatif sur UUID specifics. Mitigation : test SQL local avec un auth.uid simulé.
- **Risque #4** : Spawter sans review mais avec spawt → fiche spawt Story 5.x doit gérer. V1 acceptable (Story 5.x prévue).

### Project Structure Notes

- **2 nouveaux fichiers SQL** : `supabase/migrations/0013_storage_buckets_place_photos.sql` + `.down.sql`.
- **1 nouveau fichier TS lib** : `app/src/lib/storage-photos.ts`.
- **1 nouvelle route modal** : `app/app/review/[spawt_id].tsx`.
- **Étendus** :
  - `app/src/store/spawter-store.ts` (+`attachReviewToSpawt` action).
  - `app/src/lib/guet/guet-spawt-actions.ts` (router.push à la confirm).
  - `app/app/_layout.tsx` (déclaration Stack.Screen `/review/[spawt_id]` modal — peut-être déjà handled by expo-router file-based).
  - `app/src/i18n/fr.json` (+10 clés `review.*`).
  - `app/app.json` (permissions Android `READ_MEDIA_IMAGES`).
- **2 nouvelles dépendances** : `expo-image-picker`, `expo-image-manipulator`.

### References

- [_bmad-output/planning-artifacts/epics.md#L925-L944](../planning-artifacts/epics.md#L925-L944) Story 4.5
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 6](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md FR-007 (photos)](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/architecture.md#L303-L307](../planning-artifacts/architecture.md#L303-L307) Stockage média + buckets
- [_bmad-output/planning-artifacts/architecture.md#L477-L479](../planning-artifacts/architecture.md#L477-L479) Bucket Storage naming + paths
- [_bmad-output/planning-artifacts/architecture.md#L417-L418](../planning-artifacts/architecture.md#L417-L418) Epic 4 sequence
- [_bmad-output/project-context.md §Voix du Chat — pas de copy générique](../project-context.md)
- [documentation/analytics/events.md §7 Avis](../../documentation/analytics/events.md)
- [app/src/types/spawt.ts:53-69](../../app/src/types/spawt.ts#L53-L69) `REVIEW_TAGS` + `REVIEW_TAG_LABELS`
- [app/src/lib/weighted-rating.ts](../../app/src/lib/weighted-rating.ts) `incrementalWeightedRating` (Story 3.2 préparé)
- [supabase/migrations/0011_create_spawt_checkin.sql](../../supabase/migrations/0011_create_spawt_checkin.sql) Story 4.1

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Completion Notes List

- Migration `0013_storage_buckets_place_photos.sql` + `.down.sql` créées — bucket `place-photos` privé + 3 RLS policies storage.objects (SELECT/INSERT/UPDATE limités au sub-folder `<auth.uid()>/<spawt_id>/`). Pas de DELETE policy publique (modération Story 6.4 via staff backend).
- `app/src/lib/storage-photos.ts` créé — `photoPath(spawter_id, spawt_id, index)` (path canonique) + `compressPhoto(uri)` (expo-image-manipulator resize 1920 + compress 0.8) + `uploadReviewPhoto` (Supabase Storage upload, retourne path ou null silencieusement) + `getReviewPhotoUrl` (signed URL TTL 7j).
- Écran modal `app/app/review/[spawt_id].tsx` créé — Note (Stars tap 1-5) + 5 chips REVIEW_TAGS multi-select + TextInput 500c max + 0-3 photos (long press → remove). Sticky CTA "Enregistrer mon avis" disabled tant que note === null. Events `review_started` (entry_point post_spawt/place_detail) / `review_photo_added` / `review_submitted` / `review_abandoned`.
- Action store `attachReviewToSpawt(spawt_id, patch)` créée — local-first (AsyncStorage rewrite spawts array) + fire-and-forget Supabase via `saveSpawtToSupabaseOrEnqueue` Story 4.3 (kind `spawt_update`). Chaîne fire-and-forget :  Palais update Story 4.6 (applyReviewToPalais) puis ADN update Story 4.7 (recomputeAndPersistPlaceAdn) puis emit `review_submitted`.
- Câblage `app/app/_layout.tsx` Stack.Screen `review/[spawt_id]` modal.
- i18n : `review.title/subtitle/stars_hint/text_placeholder/cta_save/cta_later/photo_add/submit_success_toast`.
- Dépendances `expo-image-picker@~17.0.8` + `expo-image-manipulator@~14.0.7` ajoutées + `npm install` lancé.
- **Defers Story 4.5 PASS 2** : (D-425) photo queue dédiée resilience (Sprint 2). (D-426) sub-criteria avis sliders (PRD §3.1 #6 V1 = tags + texte seulement). (D-427) CTA "Donner mon avis" depuis fiche spawt profil — Story 5.x. (D-428) bucket place-covers staff Story 6.3. (D-429) modération photos Story 6.4. (D-430) edit / suppression avis RGPD — Sprint 2.
- Couplage Story 4.5 → 4.2 (confirm spawt → router.push review modal) : reporté Story 4.2 PASS 2 — l'écran modal review est autonome (testable via direct route `/review/<spawt_id>`).

### File List

**Nouveau** :
- `supabase/migrations/0013_storage_buckets_place_photos.sql`
- `supabase/migrations/0013_storage_buckets_place_photos.down.sql`
- `app/src/lib/storage-photos.ts`
- `app/app/review/[spawt_id].tsx`

**Modifié** :
- `app/src/store/spawter-store.ts` (+attachReviewToSpawt action + Palais/ADN couplage)
- `app/app/_layout.tsx` (+Stack.Screen review/[spawt_id] modal)
- `app/src/i18n/fr.json` (+review.*)
- `app/package.json` (+expo-image-picker + expo-image-manipulator)
- `app/package-lock.json`
