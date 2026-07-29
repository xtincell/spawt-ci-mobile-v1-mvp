# Story 4.12: Fiche lieu v2 — carte statique, horaires par jour, galerie & tous les avis

Status: review

<!-- NOUVELLE story — Sprint Change Proposal v2 (2026-06-02), §4.6 / Batches 6.2/6.4/6.5/6.6.
Suite de 4.9 (place page refonte + reviews fetch). Test live APK build-android-2026-06-01,
Supabase live, mode démo OFF. ZÉRO migration : hours JSONB + gallery_urls TEXT[] existent déjà.
Source ACs : _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-02.md §4.6. -->

## Story

As a spawter sur la fiche d'un lieu,
I want voir où il se situe (carte), ses horaires jour par jour, une vraie galerie photos, et accéder à tous les avis,
so that je puisse décider d'y aller sans deviner l'emplacement, l'ouverture du jour, ni me limiter à 5 avis.

## ⚠️ Brownfield context — read first

Cette story est **du rendu front-end pur** sur des données **déjà présentes** côté schéma. Vérifié contre le code (proposal §1.3) :

| Élément | Fichier / source | État | Action |
|---|---|---|---|
| Écran fiche `place/[id].tsx` | [app/app/place/[id].tsx](../../app/app/place/%5Bid%5D.tsx) (~800 L) | ✅ Refondu Stories 3.4 + 4.9 (hero, AdnTags, Stars lg, sticky CTA, `<PlaceReviews />`) | **Étendre** : carte statique, horaires 7 jours, galerie ≥3 |
| `place.hours` | [app/src/types/place.ts:98](../../app/src/types/place.ts#L98) — `Record<DayOfWeek, OpeningSlot[]>` (JSONB [0010_create_places_place_adn.sql:26](../../supabase/migrations/0010_create_places_place_adn.sql#L26)) | ✅ Existe, peuplé, edité par l'admin (Story 6.2) | **Rendre les 7 jours** (actuellement seul le jour courant) |
| `place.gallery_urls` | [app/src/types/place.ts:102](../../app/src/types/place.ts#L102) — `string[]` (TEXT[] [0010:30](../../supabase/migrations/0010_create_places_place_adn.sql#L30)) | ✅ Existe | **Rendre** une galerie ≥3 slots |
| `place.cover_photo_url` + `location` (lat/lng) | place.ts | ✅ Existe | **Consommer** pour hero (inchangé) + centre de la carte |
| `<PlaceReviews />` | [app/src/components/PlaceReviews.tsx](../../app/src/components/PlaceReviews.tsx) | ✅ Existe (Story 4.9) ; bouton « Voir tous les avis » `onPress={undefined}` (stub) | **Câbler** le bouton vers la nouvelle route |
| `listReviewsForPlace(placeId, limit=5)` | [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) + [data-source.supabase.ts](../../app/src/lib/data-source.supabase.ts) | ✅ Existe (tri note desc → created_at desc, fallback `[]`) | **Réutiliser** avec limite relâchée |
| Composant item d'avis `ReviewCard` + `Avatar` | dans `PlaceReviews.tsx` (sous-composants internes) | ✅ Existe (truncate 140, badge `✨ Avis fondateur` si `is_seed`, avatar fallback initiales) | **Extraire / réutiliser** dans la route, pas de doublon |
| Primitive `Ico` | [app/src/components/primitives/Ico.tsx](../../app/src/components/primitives/Ico.tsx) | ✅ Glyphes `map`, `pin`, `clock`, `camera`, `walk`, `arrow-left` **présents** dans `IconName` | **Consommer** — pas de nouveau glyphe requis |
| Bucket `place-photos` | [supabase/migrations/0013_storage_buckets_place_photos.sql](../../supabase/migrations/0013_storage_buckets_place_photos.sql) | ✅ Existe (RLS `<spawter_id>/<spawt_id>/`) | **Réutiliser** — pas de nouveau bucket |
| Route `place/[id]/reviews.tsx` | (aucune) | ❌ | **Créer** (cf. ⚠️ gotcha routing ci-dessous) |

### ⚠️ Gotcha routing Expo Router — bloquant, à traiter en premier

Aujourd'hui il existe **uniquement** le fichier `app/app/place/[id].tsx` (aucun dossier `[id]/`). Expo Router (file-based) **n'autorise pas** un fichier `[id].tsx` ET un dossier `[id]/` au même niveau de segment. Pour ajouter `place/[id]/reviews.tsx` il faut donc :

1. **Déplacer** `app/app/place/[id].tsx` → `app/app/place/[id]/index.tsx` (la fiche devient l'index du segment). `git mv` pour préserver l'historique.
2. **Créer** `app/app/place/[id]/reviews.tsx` (écran « Tous les avis »).
3. **Vérifier les imports relatifs** dans le fichier déplacé : la profondeur change (`../../../src/...` → `../../../../src/...`). **Préférer les alias `@/`** pour neutraliser le problème (cf. project-context : aliases `@/* → ./src/*`).
4. **Vérifier la navigation typée** : `router.push({ pathname: "/place/[id]", params: { id } })` reste valide (typedRoutes régénère). La nouvelle route sera `"/place/[id]/reviews"`.
5. Re-tester que toute navigation entrante vers la fiche fonctionne toujours (Home feed, search, saved, onglet spawter, share). **Ne pas régresser** le routing existant.

### Décisions héritées / figées (proposal §4.0 + §4.6 — non revisitables)

- **Carte = image statique** (Mapbox Static API **OU** Google Static Maps). `react-native-maps` interactif = **defer Sprint 2**. 1 GET image, **aucune dépendance native**.
- **Clé API carte via `EXPO_PUBLIC_*`** uniquement (pas de secret en clair ; rappel project-context : `EXPO_PUBLIC_*` est inliné dans le bundle — n'y mettre qu'une clé restreinte/à quota, jamais un secret serveur). Quota à surveiller.
- **Zéro migration** : `hours` et `gallery_urls` sont déjà en base, l'admin les édite déjà (Stories 6.2/6.3). Le travail est **rendu + 1 route + seeding admin**.
- **Avis seed `is_seed = true`** : déjà affichés dans la section (décision 4.9, filtre relâché `note_etoiles IS NOT NULL`). La route « tous les avis » applique **le même filtre** — badge `✨ Avis fondateur` préservé.
- **Vocab** : « spot » banni, toujours « spawt » (proposal §4.0.a, lint-vocab bloquant).

## Acceptance Criteria

**AC #1 — Carte de localisation (image statique)**

**Given** `place.location` (lat/lng) présent sur la fiche
**When** la fiche est rendue
**Then** une **carte statique (image)** centrée sur `place.location` s'affiche sous l'adresse texte :

- Source : Static map image (Mapbox Static API **ou** Google Static Maps) — **1 GET image, pas de dep native**.
- **Tappable** → deeplink natif `geo:<lat>,<lng>` (Android) / `maps:` ou `http://maps.apple.com/?ll=` (iOS) via `Linking.openURL`. Cohérent avec le CTA « Localisation » (Story 3.4/4.9 amendée).
- **Fallback** : si pas de coords **ou** pas de réseau **ou** image en échec → l'**adresse texte seule** (déjà présente) reste affichée, pas de crash ni de bloc vide.
- Clé API via `EXPO_PUBLIC_*` (lecture via le pattern `Constants.expoConfig?.extra` → `process.env.EXPO_PUBLIC_*`, cf. [supabase.ts:6-16](../../app/src/lib/supabase.ts#L6-L16)).
- `react-native-maps` interactif **hors périmètre** (defer Sprint 2 — noter dans le code en `// TODO(@spawter, Sprint 2)`).

**AC #2 — Horaires par jour (rendu du JSONB existant)**

**Given** `place.hours: Record<DayOfWeek, OpeningSlot[]>` déjà peuplé ([place.ts:98](../../app/src/types/place.ts#L98))
**When** la fiche est rendue
**Then** les **7 jours** (Lun → Dim) sont affichés avec leurs créneaux respectifs (`open`–`close` au format "HH:mm"), **pas une ligne plate « jour courant » seule** :

- Le **jour courant** est mis en évidence (le code lit déjà `new Date().getDay()` + `DAY_KEYS` autour de [place/[id].tsx:242-245](../../app/app/place/%5Bid%5D.tsx#L242-L245) — **réutiliser** ce mapping `0=sun…6=sat`, ne pas le réinventer).
- Jour **fermé** (slot `[]`) → libellé `t("place.info_hours_closed")` = « Fermé » (clé existante [fr.json](../../app/src/i18n/fr.json), ne pas dupliquer).
- Plusieurs créneaux le même jour (ex. midi + soir) → afficher chaque slot.
- **Aucun** changement de data model ni de migration.

**AC #3 — Galerie photos (≥ 3 slots, rendu de `gallery_urls`)**

**Given** `place.gallery_urls: string[]` ([place.ts:102](../../app/src/types/place.ts#L102))
**When** la fiche est rendue
**Then** une section « Photos » affiche la galerie :

- **Minimum 3 slots** ; si `gallery_urls.length < 3` → compléter avec des **placeholders** (graceful, pas de crash — réutiliser le pattern fallback du hero qui dégrade vers l'icône `pin`). Les placeholders sont **seedables** côté admin (Story 6.2/6.3).
- La **cover** (`cover_photo_url`) reste le **hero** ; la galerie en est **distincte** (ne pas dupliquer la cover dans la galerie).
- Storage : réutiliser le bucket **`place-photos`** existant (migration 0013) — **PAS de nouveau bucket**.
- Affichage : `ScrollView` horizontal (cohérent avec le style existant), images contmain/cover, coins arrondis via `theme.radius.*`.
- **Aucune** migration.

**AC #4 — Voir tous les avis (nouvelle route)**

**Given** `<PlaceReviews />` limite l'affichage à 5 avis (Story 4.9), bouton « Voir tous les avis (N) » présent mais `onPress={undefined}`
**When** le nombre d'avis du lieu `> 5`
**Then** le bouton **navigue** vers la **nouvelle route** `app/app/place/[id]/reviews.tsx` (cf. ⚠️ gotcha routing) :

- `router.push({ pathname: "/place/[id]/reviews", params: { id } })`.
- Écran : liste défilable de **tous les avis** du lieu — appeler `listReviewsForPlace(id, <limite relâchée>)` (ex. `100`) **ou** ajouter un paramètre offset. Conserver le tri existant (note desc → created_at desc).
- **Réutiliser** le composant d'item d'avis (`ReviewCard` + `Avatar`) de `PlaceReviews.tsx` — **extraire** dans un fichier partagé si besoin, **pas de re-rendu dupliqué**.
- Header avec bouton retour (`Ico` `arrow-left`) + titre `t("place.reviews_all_title")`. Respecter `SafeAreaView` + thème.
- Badge `✨ Avis fondateur` (`is_seed`) **préservé** dans la liste complète.
- Bouton « Voir tous les avis » **visible uniquement** si `count > 5` (sinon les 5 affichés suffisent).

**AC #5 — i18n + Tests + vocab**

**Given** la triple gate locale
**When** Story 4.12 est livrée
**Then** :

- **i18n** (toute string via [fr.json](../../app/src/i18n/fr.json), aucune string FR hardcodée) :
  - Réutiliser : `place.info_hours`, `place.info_hours_closed`, `place.info_address`, `place.reviews_see_all` (template `{{count}}`).
  - Ajouter si absent : `place.gallery_title` (« Photos »), `place.reviews_all_title` (« Tous les avis »), libellés jours `place.day_mon`…`place.day_sun` (Lun…Dim), `place.map_open_aria` (« Ouvrir dans Maps »).
- **Tests** :
  - Horaires : un `hours` mocké (avec un jour fermé + un jour multi-créneaux) rend **7 jours** + « Fermé » sur le jour vide ; jour courant mis en évidence.
  - Galerie : `gallery_urls` à 0/1/3/5 → toujours **≥ 3 slots** (placeholders si < 3).
  - Carte : présence de l'image quand coords + clé API ; **fallback adresse seule** quand coords absentes.
  - Route reviews : le bouton « Voir tous les avis » apparaît **si count > 5** et route vers `reviews.tsx` ; l'écran rend la liste complète (mock `listReviewsForPlace`).
  - Non-régression `PlaceDetailScreen` après le déplacement `[id].tsx → [id]/index.tsx`.
- **Aucune occurrence « spot »**. `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` **verts**.

## Tasks / Subtasks

- [x] **Task 0 — Routing (gotcha, à faire en premier)** (AC: #4)
  - [x] `git mv app/app/place/[id].tsx app/app/place/[id]/index.tsx`
  - [x] Convertir les imports relatifs profonds en alias `@/` ; vérifier `tsc` vert
  - [x] Smoke-test : navigation entrante (Home, search, saved, onglet spawter, share) ouvre toujours la fiche
- [x] **Task 1 — Carte statique** (AC: #1)
  - [x] Helper `buildStaticMapUrl(location, apiKey)` (Mapbox **ou** Google Static — choisir, documenter le choix en `// WHY`)
  - [x] `<Pressable>` image + `Linking.openURL("geo:…")`, fallback adresse seule (coords/réseau/erreur image)
  - [x] Lire la clé via `Constants.expoConfig?.extra` → `EXPO_PUBLIC_*` (pattern supabase.ts)
- [x] **Task 2 — Horaires 7 jours** (AC: #2)
  - [x] Réutiliser `DAY_KEYS` + `new Date().getDay()` ([place/[id].tsx:242-245]) pour le jour courant
  - [x] Composant interne `OpeningHours` : 7 lignes, multi-slots, « Fermé » sur slot vide, highlight jour courant
- [x] **Task 3 — Galerie ≥3** (AC: #3)
  - [x] Section « Photos » `ScrollView` horizontal sur `gallery_urls`, placeholders si < 3
  - [x] Ne pas dupliquer la cover ; coins arrondis thème
- [x] **Task 4 — Route « Tous les avis »** (AC: #4)
  - [x] Extraire `ReviewCard`/`Avatar` réutilisables (depuis `PlaceReviews.tsx`)
  - [x] Créer `app/app/place/[id]/reviews.tsx` (fetch `listReviewsForPlace(id, 100)`, header retour + titre)
  - [x] Câbler le bouton `onPress` dans `PlaceReviews.tsx` (visible si count > 5)
- [x] **Task 5 — i18n + tests + triple gate** (AC: #5)
  - [x] Ajouter clés manquantes dans `fr.json`
  - [x] Tests horaires / galerie / carte fallback / route reviews / non-régression
  - [x] `tsc --noEmit` + `lint:vocab` + `i18n:check` + `jest` verts

## Dev Notes

### §1 — Carte statique : choix du provider

- **Mapbox Static Images API** : `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/<lng>,<lat>,<zoom>/<w>x<h>?access_token=<EXPO_PUBLIC_MAPBOX_TOKEN>`. Free tier généreux.
- **Google Static Maps** : `https://maps.googleapis.com/maps/api/staticmap?center=<lat>,<lng>&zoom=15&size=<w>x<h>&markers=<lat>,<lng>&key=<EXPO_PUBLIC_GOOGLE_MAPS_KEY>`.
- Choisir l'un, **documenter le `// WHY`** (quota, clé déjà dispo côté infra ?). La clé est inlinée dans le bundle (`EXPO_PUBLIC_*`) → la **restreindre par référent/API côté provider**, et noter dans le code que c'est une clé client à quota, pas un secret. Décision provider/clé : si bloquant, **ne pas trancher seul** — signaler à l'infra (project-context §« Décisions historisées ») et livrer le fallback adresse en attendant.
- `geo:` deeplink : `geo:<lat>,<lng>?q=<lat>,<lng>(<nom du lieu encodé>)`. Sur iOS `geo:` n'est pas toujours géré → fallback `http://maps.apple.com/?ll=<lat>,<lng>`. Tester `Linking.canOpenURL` avant.

### §2 — Horaires : ne pas réinventer le calcul du jour

Le code actuel ([place/[id].tsx:242-245](../../app/app/place/%5Bid%5D.tsx#L242-L245)) fait déjà `DAY_KEYS[new Date().getDay()]` (avec `DAY_KEYS = ["sun","mon",…,"sat"]`). **Réutiliser** ce mapping pour le highlight ; ne pas introduire un second mapping divergent. `OpeningSlot` = `{ open: string; close: string }` en "HH:mm" ([place.ts:112-115](../../app/src/types/place.ts#L112-L115)).

### §3 — Galerie : fallback gracieux

Réutiliser la stratégie de fallback du hero (état `coverFailed` + `onError` sur `<Image>`). Pour les slots manquants, un placeholder neutre (icône `camera` sur fond `theme.colors.surface.*`), **jamais** un placeholder « restaurant » générique (anti-pattern brand, cf. project-context). Pas d'asset > 200 KB bundlé (budget APK) — les vraies photos viennent du CDN Storage.

### §4 — Réutilisation des composants d'avis (DRY)

`PlaceReviews.tsx` contient `ReviewCard` (truncate 140, `<Stars size="sm">`, badge `is_seed`) et `Avatar` (32×32, fallback initiales sur `theme.colors.brand.primary`). **Extraire** ces deux sous-composants dans un module partagé (ou exporter depuis `PlaceReviews.tsx`) et les consommer dans `reviews.tsx`. Interdiction de redéfinir un second rendu d'avis (drift garanti sinon).

### §5 — `PlaceReview` shape (pour la route)

Réutiliser l'interface existante (data-source.ts) — ne pas la modifier :
`{ id, spawter_id, spawter_display_name, spawter_avatar_url, note_etoiles (1-5), texte_avis, created_at, is_seed, photos }`. La requête `listReviewsForPlaceFromSupabase` gère déjà le join défensif `spawters!inner` (Array.isArray) et le tri — **réutiliser tel quel** avec une limite plus élevée.

### §6 — Anti-patterns à éviter

- ❌ Carte interactive `react-native-maps` (defer Sprint 2 — dep native, OS-tue-app, hors périmètre).
- ❌ Secret serveur sous `EXPO_PUBLIC_*`.
- ❌ Re-rendu d'avis dupliqué entre `PlaceReviews` et `reviews.tsx`.
- ❌ Compteur de likes / leaderboard sur les avis (gamification interdite, project-context §Anti-patterns produit).
- ❌ Placeholder photo « restaurant » générique (fallback neutre seulement).
- ❌ Garder un fichier `[id].tsx` ET un dossier `[id]/` (le routing casse — convertir en `index.tsx`).

### §7 — Test Tantie Rose (Alexandre)

- *Comprend-elle ?* Carte = « c'est là » ; horaires jour par jour = « c'est ouvert quand j'y vais ? » ; galerie = « ça ressemble à quoi ». ✅
- *Brice partagerait ?* Galerie ≥3 + carte = fiche premium. ✅
- *Dominic appartient ?* Tous les avis accessibles = vraie communauté. ✅

### Project Structure Notes

- Canonical = `app/` (Expo SDK 55 / RN 0.83 / TS strict). Ne pas toucher la racine (prototype-web figé).
- Conventions : composants `PascalCase.tsx`, lib `kebab-case.ts`, **export nommé** sauf entry screens Expo Router (`export default function`). La nouvelle `reviews.tsx` et `index.tsx` déplacé = **`export default function`** (contrainte file-based routing).
- Tokens : couleurs via `useTheme()`, **aucun hex en dur** hors `tokens.ts`.
- Variance détectée : le déplacement `[id].tsx → [id]/index.tsx` change la profondeur des imports relatifs → migrer vers alias `@/` (pas un conflit, une amélioration alignée project-context).

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-02.md#46-story-412-nouvelle--fiche-lieu-v2]
- [Source: app/app/place/[id].tsx] (hero, DAY_KEYS, InfoLines, PlaceReviews mount)
- [Source: app/src/types/place.ts#L91-L115] (Place, hours, gallery_urls, DayOfWeek, OpeningSlot)
- [Source: app/src/components/PlaceReviews.tsx] (ReviewCard, Avatar, bouton see-all stub)
- [Source: app/src/lib/data-source.ts / data-source.supabase.ts] (listReviewsForPlace + tri/join)
- [Source: app/src/components/primitives/Ico.tsx#L9-L39] (glyphes map/pin/clock/camera/walk/arrow-left présents)
- [Source: supabase/migrations/0013_storage_buckets_place_photos.sql] (bucket place-photos)
- [Source: app/src/lib/supabase.ts#L6-L16] (pattern lecture EXPO_PUBLIC_*)
- [Source: _bmad-output/project-context.md] (invariants vocab/tokens/i18n/anti-patterns)
- Référence de forme : [documentation/ux/corrections/SPAWT Hi-fi (offline).html] (écran-cible fiche lieu)

## Files touched (estimation)

| Fichier | Type | Notes |
|---|---|---|
| `app/app/place/[id].tsx` → `app/app/place/[id]/index.tsx` | **move + modif** | `git mv` + carte + horaires 7j + galerie ; alias `@/` |
| `app/app/place/[id]/reviews.tsx` | **new** | écran « Tous les avis » |
| `app/src/components/PlaceReviews.tsx` | modif | câbler bouton see-all + exporter ReviewCard/Avatar |
| `app/src/components/ReviewCard.tsx` (ou export depuis PlaceReviews) | new/refactor | composant d'avis partagé |
| `app/src/lib/static-map.ts` (helper URL) | new | `buildStaticMapUrl` |
| `app/src/i18n/fr.json` | modif | `gallery_title`, `reviews_all_title`, `day_mon..day_sun`, `map_open_aria` |
| `app/src/**/__tests__/*` | new | horaires / galerie / carte fallback / route reviews / non-régression |

## Done definition

- Triple gate verte (`tsc --noEmit` + `lint:vocab` + `i18n:check` + `jest`).
- Manuel APK preview (Supabase live) sur une fiche seedée (ex. Cocody) :
  - Carte statique visible, tap → ouvre Maps natif ; fallback adresse si pas de coords.
  - Horaires : 7 jours affichés, jour courant mis en évidence, « Fermé » correct.
  - Galerie : ≥ 3 slots (placeholders si peu de photos), cover ≠ galerie.
  - « Voir tous les avis (N) » apparaît si > 5 avis → ouvre la liste complète sans régresser la fiche.
- Zéro migration. Aucune occurrence « spot ». Sweep adversarial **en fin de lot** (politique projet), pas par story.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — dev-story workflow.

### Debug Log References

- Triple gate (2026-06-02) : `tsc --noEmit` exit 0 · `lint:vocab` ✓ · `i18n:check` ✓ · `jest` **348 passed / 4 skipped / 0 failed** (exit 0, +22 tests vs base 326).
- Gotcha routing résolu : `[id].tsx` → `[id]/index.tsx` (move filesystem ; git mv refusait le pathspec `[id]`). Le segment `place/[id]` reste valide (index de dossier) + nouveau `place/[id]/reviews` enregistré au root Stack.
- Imports du fichier déplacé : profondeur relative bumpée `../../src/` → `../../../src/` (convention dominante du repo = relatifs ; `@/` n'est utilisé que dans 1 fichier → écarté pour neutraliser tout risque Metro). Écart assumé vs suggestion story §Project Structure.
- Correction post-gate : la navigation « Voir tous les avis » utilise `router.push(\`/place/${id}/reviews\` as never)` (pattern repo, cf. `profile.tsx` `router.push("/saved" as never)`) — `typedRoutes` ne régénère pas la route imbriquée hors dev-server, le `pathname` typé échouait `tsc`. Le `as never` résout au runtime. Gate finale conjointe 4.12+7.1 : tsc 0 · vocab ✓ · i18n ✓ · jest 353 passed.

### Completion Notes List

- **AC #1 (carte statique)** : `lib/static-map.ts` (`buildStaticMapUrl` Mapbox|Google + `geoUrl`/`appleMapsUrl`). Image tappable sous l'adresse (`onOpenMap` → `Linking.canOpenURL(geo:)` puis fallback Apple Maps). `null` si pas de clé/coords → adresse texte seule (fallback). Clé via `EXPO_PUBLIC_MAPBOX_TOKEN` / `EXPO_PUBLIC_GOOGLE_MAPS_KEY` (Constants.extra) — aucune nouvelle clé n'étant fournie côté infra, la fiche tombe proprement sur l'adresse seule jusqu'à provisioning (décision provider/clé laissée à l'infra, non tranchée seul).
- **AC #2 (horaires 7 jours)** : composant testable `OpeningHours.tsx` — 7 jours Lun→Dim, jour courant en gras/accent (réutilise le mapping `Date.getDay()`), « Fermé » sur slot vide, multi-créneaux joints. Remplace l'ancienne ligne « jour courant » unique.
- **AC #3 (galerie ≥3)** : `PlaceGallery.tsx` — ScrollView horizontal sur `gallery_urls`, complète en placeholders neutres (icône `camera`) si < 3, cover distincte du hero, fallback per-tile sur erreur image.
- **AC #4 (route tous les avis)** : `ReviewCard`/`Avatar` extraits de `PlaceReviews` vers `ReviewCard.tsx` (partagé, zéro doublon). Nouvel écran `place/[id]/reviews.tsx` (fetch `listReviewsForPlace(id, 200)`). `PlaceReviews` : ajout `onSeeAll` (navigation) + `counter` → bouton « Voir tous les avis (N) » avec le **vrai total** (via `countReviewsForPlace`, head/exact), visible seulement si `total > affichés`.
- **AC #5 (i18n + tests + vocab)** : 9 clés ajoutées (`gallery_title`, `reviews_all_title`, `map_open_aria`, `day_mon..day_sun`). 5 fichiers de tests (static-map, OpeningHours, PlaceGallery, count, +2 cas PlaceReviews). Triple gate verte. Aucune occurrence « spot ». **Zéro migration**.
- **Defer Sprint 2 (noté)** : `react-native-maps` interactif ; pagination offset de l'écran reviews si un lieu dépasse ~200 avis.
- **À faire au commit** (Moka phase 7) : stager explicitement le rename `app/app/place/[id].tsx` → `app/app/place/[id]/index.tsx` (move filesystem effectué ; git le verra comme delete+add — `git add` des deux chemins pour matérialiser le rename).
- **DoD externe restant** (hors dev) : sweep adversarial en fin de lot v2 + triple sign-off + matrice 4 devices (carte statique + deeplink Maps à tester sur device réel).

### File List

**New**
- `app/src/lib/static-map.ts`
- `app/src/components/OpeningHours.tsx`
- `app/src/components/PlaceGallery.tsx`
- `app/src/components/ReviewCard.tsx`
- `app/app/place/[id]/reviews.tsx`
- `app/src/lib/__tests__/static-map.test.ts`
- `app/src/lib/__tests__/data-source-reviews-count.test.ts`
- `app/src/components/__tests__/OpeningHours.test.tsx`
- `app/src/components/__tests__/PlaceGallery.test.tsx`

**Moved**
- `app/app/place/[id].tsx` → `app/app/place/[id]/index.tsx` (+ map/hours/gallery/onSeeAll intégrés, imports relatifs bumpés)

**Modified**
- `app/src/components/PlaceReviews.tsx` (import ReviewCard partagé ; `onSeeAll` + `counter` + gating sur vrai total)
- `app/src/lib/data-source.ts` (+ `countReviewsForPlace`)
- `app/src/lib/data-source.supabase.ts` (+ `countReviewsForPlaceFromSupabase`)
- `app/app/_layout.tsx` (+ `<Stack.Screen name="place/[id]/reviews">`)
- `app/src/i18n/fr.json` (+ 9 clés `place.*`)
- `app/src/components/__tests__/PlaceReviews.test.tsx` (counter/onSeeAll + comportement count-gated)

## Change Log

- 2026-06-02 — Story 4.12 implémentée (dev-story). Fiche lieu v2 : carte statique tappable, horaires 7 jours, galerie ≥3, route « Tous les avis » avec vrai total. Zéro migration. Triple gate verte (348 tests). Status → review.
