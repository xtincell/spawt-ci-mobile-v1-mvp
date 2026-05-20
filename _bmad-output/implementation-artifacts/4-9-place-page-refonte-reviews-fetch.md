# Story 4.9: Place page refonte + reviews fetch

Status: ready-for-dev

<!-- Epic 4 PASS 2 — bundle UX retour user 2026-05-20 point #10.
Agrandir rating + price tier, clarifier WhatsApp CTA, désambiguïser
heart vs Coup de Cœur, fetcher + afficher les avis spawter seed
déjà présents en DB mais non rendus. -->

## Story

As a spawter sur la fiche d'un lieu,
I want voir les avis des autres spawters et lire clairement la note + le budget,
so that je puisse décider d'aller au lieu sans ouvrir 3 onglets et comprendre la confiance communautaire.

## ⚠️ Brownfield context — read first

État courant Story 4.9 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Écran `place/[id].tsx` | [app/app/place/[id].tsx](../../app/app/place/%5Bid%5D.tsx) | ✅ Refondu Story 3.4 (photo hero, AdnTags, sticky CTA, Stars, MatchScore) | **Refondre** taille typo rating + price + clarifier CTAs |
| Composant `<Stars />` primitif | [app/src/components/primitives/Stars.tsx](../../app/src/components/primitives/Stars.tsx) | ✅ Existe | **Étendre** prop `size?: 'sm'|'md'|'lg'` ou créer variant `<StarsLarge />` |
| Bouton WhatsApp | place/[id].tsx zone CTAs | ✅ Existe, label `t("place.whatsapp")` | **Confirmer** label « Réserver via WhatsApp » (déjà figé) + icône book/calendar à côté pour expliciter |
| Toggle favori (heart) | place/[id].tsx Story 3.6 | ✅ Existe (heart top-right) | **Renommer** label aria « Sauvegarder pour plus tard » + ajouter sous-texte « aimé par N spawters » via fetch saved count |
| Signal `coup_de_coeur` | `signals: ['coup_de_coeur', ...]` champ place | ✅ Affiché via `SIGNAL_LABELS` | **Préserver** — c'est l'icône ❤️ Coup de Cœur, à ne pas confondre avec le heart toggle |
| Fetch reviews | (aucun) | ❌ | **Créer** `listReviewsForPlace(placeId)` dans `data-source.ts` + `data-source.supabase.ts` |
| Section reviews UI | (aucune) | ❌ | **Créer** `<PlaceReviews />` composant + intégrer dans `place/[id].tsx` |
| i18n `place.reviews_*` | fr.json:457-460 | ✅ Présent (`reviews_title`, `reviews_empty`, `reviews_loading`, `reviews_see_all`) | **Consommer** |
| Avatar spawter pour reviews | Table `spawters.avatar_url` | ✅ Présent + 11 spawters seedés via UPDATE Supabase | **Consommer** via join |

**Décisions héritées non-revisitables** :

- **Avis `is_seed = true` alimentent l'ADN mais sont exclus du compteur public `total_reviews`** — pour 4.9 on **affiche les seeds dans la section reviews** (UX, démo) car il n'y a quasi pas d'avis communauté V1 alpha. Filtre relâché : `WHERE place_id = X AND note_etoiles IS NOT NULL` (inclut seeds). Un disclaimer subtile « ✨ Avis fondateurs » pour les seeds.
- **Heart toggle vs Coup de Cœur** : ce sont **deux mécaniques distinctes**. Le heart = sauvegarde personnelle (favoris). Le Coup de Cœur = monnaie sociale rare (PRD §7.3). On ne peut pas les fusionner. Solution UX : label différenciant + tooltip/sous-texte.
- **Format prix** : `₣` / `₣₣` / `₣₣₣` figé (PRD §15). On change uniquement la taille typo.

## Acceptance Criteria

**AC #1 — `listReviewsForPlace()` dans data-source**

**Given** l'adapter `app/src/lib/data-source.ts`
**When** Story 4.9 est livrée
**Then** la fonction existe et délègue à Supabase/fallback :

```ts
// data-source.ts
export interface PlaceReview {
  id: string;                          // spawt_checkin.id
  spawter_id: string;
  spawter_display_name: string;
  spawter_avatar_url: string | null;
  note_etoiles: number;                // 1-5
  texte_avis: string | null;
  created_at: string;                  // ISO timestamp
  is_seed: boolean;
}

export async function listReviewsForPlace(placeId: string, limit = 5): Promise<PlaceReview[]>;
```

`data-source.supabase.ts` :

```ts
export async function listReviewsForPlaceFromSupabase(
  placeId: string,
  limit: number,
): Promise<PlaceReview[]> {
  const { data, error } = await supabase
    .from("spawt_checkin")
    .select("id, spawter_id, note_etoiles, texte_avis, created_at, is_seed, spawters!inner(display_name, avatar_url)")
    .eq("place_id", placeId)
    .not("note_etoiles", "is", null)
    .order("note_etoiles", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    spawter_id: String(r.spawter_id),
    spawter_display_name: (r.spawters as { display_name: string }).display_name,
    spawter_avatar_url: (r.spawters as { avatar_url: string | null }).avatar_url,
    note_etoiles: Number(r.note_etoiles),
    texte_avis: (r.texte_avis as string | null) ?? null,
    created_at: String(r.created_at),
    is_seed: Boolean(r.is_seed),
  }));
}
```

Fallback (seed) : retourne `[]` (pas de seed reviews côté mobile, on consomme Supabase quand mode supabase).

**AC #2 — Composant `<PlaceReviews />`**

`app/src/components/PlaceReviews.tsx` à créer :

- Fetch via `useEffect` + `listReviewsForPlace(placeId, 5)`.
- État loading → `t("place.reviews_loading")` + `<ActivityIndicator />`.
- État empty → `t("place.reviews_empty")`.
- État loaded → `FlatList` ou `ScrollView` horizontal de cards review :
  - Avatar (32×32 round, fallback initiales).
  - `display_name` + badge `✨ Avis fondateur` si `is_seed`.
  - `<Stars value={note_etoiles} size="sm" />`.
  - `texte_avis` tronqué à 140 chars + … si plus long.
- Bouton `t("place.reviews_see_all", { count })` non-fonctionnel V1 (defer Story Sprint 2 « écran reviews full »).

**AC #3 — Refonte taille rating + price tier dans `place/[id].tsx`**

**Given** le header zone de la fiche
**When** Story 4.9 est livrée
**Then** :

- `<Stars />` du rating principal passe à `size="lg"` (32px) — visible à 1m.
- Le label `weighted_rating` (« 4.3 ») passe à `theme.typography.preset.h2`.
- `priceLabel` (`₣₣`) passe à `theme.typography.preset.h2` à côté du rating.
- L'ensemble rating + price s'affiche sur la même ligne sous le nom du lieu.

**AC #4 — Désambiguïsation heart toggle vs Coup de Cœur**

- Icône heart toggle (top-right header) → tooltip/sous-texte au tap si non actif : `t("place.heart_hint")` (« Sauvegarde pour plus tard »).
- Si actif → label dynamique `t("place.heart_active")` (« Sauvegardé »).
- Sous le rating : si `signals.includes("coup_de_coeur")`, afficher chip ❤️ « Coup de Cœur » distincte du heart toggle.

**AC #5 — Bouton WhatsApp clarifié**

- Label : `t("place.whatsapp")` = « Réserver via WhatsApp » (déjà figé).
- Icône MessageCircle remplacée par icône Calendar+MessageCircle composite (ou simple « Calendar » seule) pour signaler la réservation. Si la primitive Ico n'a pas Calendar, fallback texte « 📅 Réserver via WhatsApp ».

**AC #6 — Intégration section reviews dans `place/[id].tsx`**

`<PlaceReviews placeId={id} />` monté entre `<AdnTags />` et le footer CTAs sticky.

**AC #7 — Tests passants**

- `app/src/components/__tests__/PlaceReviews.test.tsx` couvrant loading / empty / loaded / seed badge.
- `app/src/lib/__tests__/data-source-reviews.test.ts` (mock Supabase) couvrant le mapping flat→nested + tri + limit.
- Tests existants `PlaceDetailScreen` non régressés.

**AC #8 — Triple gate verte**

`cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` passe sans erreur.

## Dev Notes

### §1 — i18n strings additionnelles

Vérifier dans `app/src/i18n/fr.json` sous `place` la présence de :

```json
"heart_hint": "Sauvegarde pour plus tard",
"heart_active": "Sauvegardé",
"founder_review_badge": "Avis fondateur"
```

Si absentes, les ajouter (mode démo bundle UX).

### §2 — Performance fetch

- Single query avec join `spawters!inner` → 1 round-trip réseau.
- Limit 5 par défaut, on n'élargit pas V1.
- AbortController : annuler le fetch si le screen unmount avant retour.

### §3 — Avatar fallback

Pour les seeders dont `avatar_url` serait null (cas edge), afficher initiales sur cercle `theme.colors.brand.primary` (réutiliser pattern `SpawterCard` Story 5.3 ou inliner).

### §4 — Tantie Rose

- *Comprend-elle ?* « Ce qu'en dit la bande » + avis avec photo+nom+étoiles → ✅
- *Brice partagerait ?* Photos pravatar libres + texte fondateur subtil → ✅
- *Dominic appartient ?* Voir d'autres spawters qui se sont déjà exprimés → ✅

### §5 — Anti-pattern à éviter

- ❌ Pas de **counter de likes** sur un review (« 12 ❤️ ») → on slip dans gamification.
- ❌ Pas de **leaderboard** « top reviewers ».
- ❌ Pas de **avatar pixel pixelé / placeholder restaurant** → fallback initiales seulement.

## Files touched (estimation)

| Fichier | Type | Lignes estimées |
|---|---|---|
| `app/src/lib/data-source.ts` | modif | +30 (interface PlaceReview + signature) |
| `app/src/lib/data-source.supabase.ts` | modif | +35 (fn listReviewsForPlaceFromSupabase) |
| `app/src/components/PlaceReviews.tsx` | new | +180 |
| `app/src/components/__tests__/PlaceReviews.test.tsx` | new | +120 |
| `app/src/lib/__tests__/data-source-reviews.test.ts` | new | +80 |
| `app/app/place/[id].tsx` | modif | ±60 (taille typo + heart hint + mount PlaceReviews) |
| `app/src/components/primitives/Stars.tsx` | modif | +5 (prop size) |
| `app/src/i18n/fr.json` | modif (si nécessaire) | +3 keys |

## Done definition

- Triple gate verte.
- Manuel APK preview sur fiche Cocody Marriage (place id seedé) :
  - Rating + price tier 2x plus gros que pré-4.9.
  - 3 reviews seedés visibles avec avatar + nom + étoiles + texte.
  - Heart top-right ≠ chip Coup de Cœur sous le rating (UX clair).
  - Bouton « Réserver via WhatsApp » + icône calendar : on comprend qu'on réserve.
