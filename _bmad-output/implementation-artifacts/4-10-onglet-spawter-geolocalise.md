# Story 4.10: Onglet Spawter géolocalisé

Status: ready-for-dev

<!-- Epic 4 PASS 2 — bundle UX retour user 2026-05-20 point #14.
Remplace le stub Alert du FAB par un écran liste des lieux proches
(<2km) avec bouton "Spawter ici" direct. La fonction PRINCIPALE
du produit ne peut pas rester en stub. -->

## Story

As a spawter qui ouvre l'app pour faire un spawt rapide,
I want voir directement les 5 lieux les plus proches de moi et tapper "Spawter ici" en 1 geste,
so that je n'aie pas à scroller le feed, ouvrir une fiche, descendre au sticky CTA pour valider mon passage.

## ⚠️ Brownfield context — read first

État courant Story 4.10 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| FAB central tab bar | [app/app/(tabs)/_layout.tsx:64-72](../../app/app/(tabs)/_layout.tsx#L64-L72) | ✅ Bouton FAB déclenche `Alert.alert(t("fab.stub_title"), t("fab.stub_body"))` | **Remplacer** par navigation vers nouvel écran modal `(spawter)` |
| Tab.Screen `spawter` | (aucune) | ❌ | **Ajouter** route `(tabs)/spawter.tsx` ou modal stack root `/spawter` |
| Permission géoloc | [app/src/lib/guet/permissions.ts](../../app/src/lib/guet/guet-permissions.ts) Story 4.2 | ✅ Existe (`ensureGuetPermission()`) | **Réutiliser** pour demander foreground location |
| Lib `expo-location` | app/package.json | ✅ Installé `~55.1.8` | **Consommer** |
| Helper distance Haversine | [app/src/lib/matching.ts:haversineKm](../../app/src/lib/matching.ts) | ✅ Exporté | **Consommer** |
| List places | `listPlaces()` dans data-source | ✅ Retourne `PlaceWithAdn[]` | **Consommer** + filtrer par distance |
| `buildManualSpawt()` | [app/src/lib/guet/guet-spawt-actions.ts](../../app/src/lib/guet/guet-spawt-actions.ts) | ✅ Existe — crée un row spawt_checkin manuel | **Consommer** sur tap CTA |
| i18n `fab.nearby_*` | fr.json:26-29 | ✅ `nearby_title`, `nearby_empty`, `nearby_loading`, `nearby_perm_required`, `nearby_cta_spawt` | **Consommer** |
| Events analytics | events.md | ⚠️ Pas d'event `nearby_screen_opened` ou `nearby_spawt_tapped` | **Ajouter** 2 events (voir Dev Notes §3) |

**Décisions héritées non-revisitables** :

- **Rayon de recherche V1 = 2km** (cohérent avec `geofence 10m` de Le Guet + Cahier §5.8 alpha terrain).
- **Limite 5 lieux** (UX : pas de scroll infini, focalisé sur l'action).
- **Spawt depuis le tab Spawter est `is_verified = true`** UNIQUEMENT si geoloc retournée + distance < 100m du lieu choisi. Sinon `is_verified = false` (poids 0.5x) — cohérent avec `PASSIVE_CHECKIN_WEIGHT` PRD §7.2.
- **Pas de carte interactive** dans cet écran V1 (Carte = Sprint 2). Liste textuelle suffit.

## Acceptance Criteria

**AC #1 — Helper pure `listNearbyPlaces()`**

`app/src/lib/nearby-places.ts` à créer :

```ts
import type { PlaceWithAdn } from "./data-source";
import { haversineKm } from "./matching";

export interface NearbyPlace {
  place: PlaceWithAdn;
  distance_km: number;
  is_within_spawt_range: boolean; // distance < 0.1km
}

export const NEARBY_RADIUS_KM = 2;
export const SPAWT_RANGE_KM = 0.1;

export function listNearbyPlaces(
  places: readonly PlaceWithAdn[],
  userLat: number,
  userLng: number,
  limit = 5,
): NearbyPlace[] {
  return places
    .filter((p) => p.is_published)
    .map((place) => {
      const distance_km = haversineKm(
        { lat: userLat, lng: userLng },
        { lat: place.location.lat, lng: place.location.lng },
      );
      return {
        place,
        distance_km,
        is_within_spawt_range: distance_km < SPAWT_RANGE_KM,
      };
    })
    .filter((np) => np.distance_km <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}
```

Tests `app/src/lib/__tests__/nearby-places.test.ts` :
- Lieu à 50m → `is_within_spawt_range: true`.
- Lieu à 1.5km → in list, `is_within_spawt_range: false`.
- Lieu à 3km → filtré out.
- Limit 5 respecté quand 12 lieux dans le rayon.
- Tri ascendant par distance.

**AC #2 — Écran `(tabs)/spawter.tsx`**

`app/app/(tabs)/spawter.tsx` à créer (export default obligatoire — file-based routing) :

États gérés :
1. **Loading perm** → spinner + `t("fab.nearby_loading")`.
2. **Perm refusée** → message `t("fab.nearby_perm_required")` + bouton `Linking.openSettings()`.
3. **Loading position** → spinner + `t("fab.nearby_loading")`.
4. **Empty** (0 lieu dans rayon 2km) → `t("fab.nearby_empty")` + suggestion « Élargis » (no-op V1 ou navigate to feed).
5. **Loaded** → titre `t("fab.nearby_title")` + ScrollView avec cards :
   - Photo lieu thumb (50×50).
   - Nom lieu (theme.typography.h3).
   - Distance formatée (« 120m » si <1km, sinon « 1.4km »).
   - Chip cuisine + chip price_tier.
   - Bouton CTA `t("fab.nearby_cta_spawt")` (« Spawter ici ») :
     - Tap → `buildManualSpawt(spawter.id, place.id, userLat, userLng)`.
     - `is_verified = is_within_spawt_range`.
     - Toast success + navigate vers `/review/[spawt_id]` (Story 4.5 modal review).

**AC #3 — Wire FAB → navigation**

`app/app/(tabs)/_layout.tsx` modif :

```diff
- if (id === "fab") {
-   Alert.alert(
-     t("fab.stub_title", {...}),
-     t("fab.stub_body", {...}),
-   );
-   return;
- }
+ if (id === "fab") {
+   props.navigation.navigate("spawter");
+   return;
+ }
```

Ajout `<Tabs.Screen name="spawter" options={{ href: null /* masqué TabBar — accessible via FAB seul */ }} />`.

**AC #4 — Events analytics**

`documentation/analytics/events.md` + `app/src/lib/analytics.ts` :

```ts
// Event: nearby_screen_opened
// Propriétés: { count_in_radius: number, has_geoloc_perm: boolean }

// Event: nearby_spawt_tapped
// Propriétés: { place_id: string, distance_m: number, is_within_range: boolean }
```

**AC #5 — Permission geoloc — flow gracieux**

- Au mount → check perm via `expo-location` (`getForegroundPermissionsAsync`).
- Si `granted` → fetch position + listNearbyPlaces.
- Si `undetermined` → `requestForegroundPermissionsAsync()`.
- Si `denied` → écran perm_required avec bouton settings.
- Aucun crash si `expo-location` non-supporté (web fallback / native module manquant) — try/catch + fallback empty.

**AC #6 — Spawt depuis l'écran**

- Tap CTA « Spawter ici » sur un lieu →
  1. `buildManualSpawt(spawter_id, place_id, userLat, userLng)` retourne un row `SpawtCheckin`.
  2. `registerSpawt(spawter, spawt)` store action (recompute `unique_spots` + `stade`).
  3. Sync fire-and-forget Supabase (`void upsertSpawt(row)`).
  4. Navigate `/review/[spawt_id]` (modal review Story 4.5).

**AC #7 — Tests passants**

- `app/src/lib/__tests__/nearby-places.test.ts` (helper pur).
- `app/src/components/__tests__/SpawterTabScreen.test.tsx` couvrant les 5 états (mock `expo-location` + `data-source`).
- Pas de régression sur les tests `_layout.tsx` existants (`profile`, `index`, `meute`).

**AC #8 — Triple gate verte**

`cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` passe sans erreur.

## Dev Notes

### §1 — Format distance

```ts
function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
```

### §2 — Mock `expo-location` dans tests

Le projet n'a pas encore de jest setup pour expo-location. Créer `app/__tests__/setup-expo-location.ts` ou inliner via `jest.mock("expo-location", () => ({ getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }), getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 5.348, longitude: -3.998 } }) }))`.

### §3 — Events analytics — règles vocabulaire

Le nom d'event ne doit PAS contenir « user » ou « ranking » ou « level ». `nearby_screen_opened` + `nearby_spawt_tapped` OK.

### §4 — Anti-pattern

- ❌ **Pas de classement** « le plus proche est mieux » (uniquement tri par distance).
- ❌ **Pas de notification push** sur lieux proches V1 — c'est Le Guet (Story 4.1/4.2), pas cet écran.
- ❌ **Pas de pré-fetch automatique de la position au boot app** — uniquement quand l'écran est focus (cohérent privacy ARTCI).

### §5 — Tantie Rose

- *Comprend-elle ?* « Tu es près de… » + boutons « Spawter ici » → ✅ (un seul geste explicite)
- *Brice partagerait ?* Liste clean, photo + nom + distance → ✅
- *Dominic appartient ?* Le bouton principal du produit fonctionne — il ne se demande plus « bon, je fais quoi maintenant ? » → ✅

## Files touched (estimation)

| Fichier | Type | Lignes estimées |
|---|---|---|
| `app/src/lib/nearby-places.ts` | new | +50 |
| `app/src/lib/__tests__/nearby-places.test.ts` | new | +80 |
| `app/app/(tabs)/spawter.tsx` | new | +250 |
| `app/app/(tabs)/_layout.tsx` | modif | ±10 |
| `app/src/components/__tests__/SpawterTabScreen.test.tsx` | new | +180 |
| `app/src/lib/analytics.ts` | modif | +10 (2 events) |
| `documentation/analytics/events.md` | modif | +15 |

## Done definition

- Triple gate verte.
- Manuel APK preview :
  - Tap FAB centre TabBar → écran liste 5 lieux proches (dans la zone de seed Cocody/Plateau si DEMO_LAT/LNG seedé).
  - Tap « Spawter ici » sur lieu à <100m → spawt verified + redirection modal review.
  - Tap « Spawter ici » sur lieu à 500m → spawt passive (is_verified=false) + redirection review.
  - Refus permission → écran perm_required avec bouton settings fonctionnel.
- Events `nearby_screen_opened` + `nearby_spawt_tapped` visibles dans la queue analytics.
