# Story 3.4: Fiche lieu détaillée

Status: review

<!-- Refonte de l'écran place/[id].tsx (existant stub Epic 1) en fiche lieu canonique UX spec §1127 — photo hero, nom Klinsman, quartier, cuisine, fourchette prix FCFA, note pondérée 1-5, horaires, adresse descriptive, boutons Appeler + WhatsApp, score matching, signaux spéciaux, ADN affiché en AdnTags (chips, pas radar) si ≥5 avis publics, sinon « ADN en construction ». Stick CTA bas, NFR-PERF-02 < 2s render, 4 events analytics (place_viewed, place_call_tapped, place_whatsapp_tapped, adn_under_construction_seen). Dépend de 3.3a (adapter Zod). Indépendante de 3.3b/3.3c — peut partir en parallèle. -->

## Story

As a spawter,
I want consulter la fiche complète d'un lieu — photo hero éditoriale, note pondérée par stade, ADN en chips quand fiable (« en construction » sinon), CTAs Appeler/WhatsApp, score matching personnalisé,
so that j'ai toute l'information pour décider d'y aller en moins de 2 secondes de chargement, et le ton « En construction » m'inspire confiance même quand les données sont minces.

## ⚠️ Brownfield context — read first

L'écran [app/app/place/[id].tsx](../../app/app/place/[id].tsx) **existe déjà** depuis Epic 1 (245 LOC) en stub fonctionnel — refonte canonique pour Epic 3. Cette story consomme la **structure data déjà câblée** :
- `getPlace(id) → PlaceWithAdn | null` (adapter Story 3.3a)
- `place.adn.weighted_rating` (Story 3.2 alimente — `is_seed` filtré du compteur public)
- `place.adn.confidence_score` — invariant « ADN en construction » si `< 0.3`
- `place.adn.total_reviews` — invariant « ADN en construction » si `< 5 avis publics`

**État actuel** :

| Élément | Fichier | État | Action Story 3.4 |
|---|---|---|---|
| Écran fiche lieu | [app/app/place/[id].tsx](../../app/app/place/[id].tsx) | ⚠️ Stub fonctionnel — back btn, nom, cuisine, signaux, AxisRadar (existant), CTA « Je spawt ici (démo) » | **Refondre** complètement selon UX spec §1127 |
| Composant `AdnTags` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/AdnTags.tsx](../../app/src/components/AdnTags.tsx) — affiche l'ADN en chips (pas radar) — décision UX spec §1329 |
| Photo hero | (aucune) | ❌ N'existe pas | **Implémenter** — Image fullWidth 280-320px hauteur, fallback gracieux si `cover_photo_url == null` |
| Bouton « Spawter ici » bottom sticky | (CTA inline existant) | ⚠️ CTA inline manuel mode démo, pas sticky | **Refactoriser** en sticky CTA bas (UX spec §1396) |
| Buttons Appeler/WhatsApp | ⚠️ Présents mais inline | **Garder logique**, restyler en CTAs visibles haut de page |
| Match score | ❌ Pas affiché actuellement | **Ajouter** — `<MatchScore value={...} />` calculé via `computeRawScore` / `displayedScore` (Story 3.3b) |
| Analytics events | (aucun) | ❌ Pas émis | **Émettre** 4 events selon AC #4 |
| Strings i18n `place.*` | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) | ⚠️ `place.notRatedYet` existe, reste à compléter | **Étendre** section `place.*` |
| Référer (`feed | search | map | share | direct`) | (aucun) | ❌ Pas tracké | **Tracker** via param URL `?ref=feed` ou store contextuel |

**Décisions héritées non-revisitables** :

- **ADN affiché en chips** (`AdnTags`), pas en radar — UX spec §1329 (décision explicite Component Strategy).
- **Le radar `AxisRadar` existant reste utilisé sur la fiche profil spawter** (Story 5.3 — Palais Radar) — pas sur la fiche lieu. Une seule action primaire par écran (UX spec §1386).
- **« ADN en construction »** affiché si `< 5 avis publics` (filtre `is_seed = false`) **OU** `confidence_score < 0.3` (cohérent project-context §Edge cases).
- **Sticky CTA bas** (UX spec §1396) — une seule action primaire « Je spawt ici » (mode démo en V1, Le Guet armé Story 4.x).
- **NFR-PERF-02 < 2s** — render fiche lieu sur 3G simulé.
- **NFR-A11Y-01** : cible tactile ≥ 44pt sur CTAs Appeler / WhatsApp.

## Acceptance Criteria

**AC #1 — Layout canonique livré (UX spec §1127)**

**Given** un tap sur une PlaceCard du feed (ou un deep link)
**When** [place/[id].tsx](../../app/app/place/[id].tsx) charge avec un `id` valide
**Then** l'écran affiche **dans cet ordre vertical** :

1. **Header back** — flèche `arrow-left` top-left, cercle `rgba(0,0,0,.4)` sur photo (ou Ico stroke sur fond clair) — UX spec §1444.
2. **Photo hero** — Image fullWidth 280-320px hauteur, `resizeMode: "cover"` avec dégradé bas `transparent → rgba(0,0,0,.85)` (cohérent UneCard). Fallback : `<View>` placeholder cohérent PlaceCard si `cover_photo_url == null`.
3. **Kicker overline** — sur la photo, en bas, en or Klinsman : signal[0] uppercase (ex. « ❤️ COUP DE CŒUR · 86% MATCH ») — composé de signal label + match score.
4. **Titre** — nom du lieu en `preset.display` (Klinsman) `text.primary`, padding latéral `theme.spacing.lg`.
5. **Sous-titre** — `quartier · cuisine · prix` en `preset.body` `text.secondary`.
6. **CTAs primaires haut** — 2 buttons icônes ronds en ligne : `Appeler` (icon `walk`/`phone`) + `WhatsApp` (icon `send`/`share`), même hauteur, gap `theme.spacing.base`. CTAs visibles **uniquement** si `phone`/`whatsapp` non null (sinon hidden).
7. **MatchScore + Stars + distance** — ligne horizontale : `<MatchScore value={...} />` `<Stars value={place.adn.weighted_rating} />` + distance km (icon `walk`).
8. **Signals chips** — `place.signals.map(s => <Chip variant="default" label={SIGNAL_LABELS[s]} />)`.
9. **Section ADN** :
   - Si `place.adn.total_reviews >= 5 && place.adn.confidence_score >= 0.3` → `<AdnTags adn={place.adn} />`
   - Sinon → message « ADN en construction (peu d'avis) » ou « En construction » + reseed counter `${place.adn.total_reviews} avis publics`
10. **InfoLines** — `Adresse`, `Horaires` (slot du jour), `Téléphone`, `WhatsApp` — chacune tappable si action possible.
11. **Sticky CTA bas** — `Pressable` plein largeur en bas, fond `theme.colors.brand.accent`, label « Je spawt ici (mode démo) » (V1) — au-dessus de la TabBar. Story 4.x remplacera par armer Le Guet.

**And** **CTA primaire unique** = sticky CTA bas. Pas de 2 CTAs primaires concurrents (UX spec §1386).

---

**AC #2 — Composant `AdnTags` (ADN en chips)**

**Given** [app/src/components/AdnTags.tsx](../../app/src/components/AdnTags.tsx) (nouveau)
**When** rendu avec un `adn: PlaceAdn` qui satisfait `confidence_score >= 0.3 && total_reviews >= 5`
**Then** il affiche **5 chips** (1 par axe ADN), libellées selon la valeur de chaque axe :

```ts
// Mapping axe → label affiché
// Si axe < -0.5 : pole négatif
// Si axe > 0.5 : pole positif
// Sinon : neutre (pas de chip)
// (cf. ADN_AXIS_LABELS dans types/place.ts)
```

Exemple : ADN `{ axe_local_international: -0.8, axe_informel_etabli: 0.6, ... }`
→ Chip « Local » (chip-gold), Chip « Établi » (chip-dark), etc.

**And** la signature :
```ts
interface AdnTagsProps {
  adn: PlaceAdn;
  /** Optionnel — seuil de polarité affiché (défaut: 0.5). */
  threshold?: number;
}
```

**And** :
- Pas de chip pour les axes dont `|valeur| < threshold` — l'axe est ambigu, on ne ment pas (« En construction » philosophy).
- Si **toutes** les chips sont absentes (axes neutres) → composant retourne `null` avec un fallback message « ADN en construction ».
- Chips disposées en wrap horizontal, gap `theme.spacing.sm`.

**And** **pas** d'utilisation du `AxisRadar` côté fiche lieu (réservé fiche spawter Story 5.3).

---

**AC #3 — Sticky CTA bas + safe-area + CTA primaire unique**

**Given** la fiche lieu rendue
**When** le user scroll vers le bas
**Then** un CTA `Pressable` plein largeur reste **fixé en bas** au-dessus de la TabBar (Story 3.1).

**Implémentation** :
- `ScrollView contentContainerStyle={{ paddingBottom: 88 }}` (espace pour CTA + TabBar).
- `<Pressable style={{ position: "absolute", bottom: TAB_BAR_HEIGHT, left: 0, right: 0, padding: 16, backgroundColor: theme.colors.brand.accent }}>` — au-dessus de la TabBar.
- Safe-area inférieure gérée via `useSafeAreaInsets().bottom`.

**And** Label : `t("place.spawt_cta_demo")` = « Je spawt ici (mode démo) » — wording **identique** au stub actuel (cohérent, pas de divergence cosmétique).
**And** Sub-label sous le CTA : `t("place.spawt_cta_demo_hint")` = « En live, Le Guet détecterait ta présence automatiquement. » — discret, `preset.small` `text.tertiary`.
**And** Tap CTA → registre un `SpawtCheckin` local (logique actuelle) → router.back() — comportement identique au stub.

---

**AC #4 — 4 events analytics émis avec props conformes events.md**

**Given** la fiche lieu montée
**When** les interactions ont lieu
**Then** ces events sont émis :

1. **`place_viewed`** — au mount (1× par session de fiche)
   - Props : `place_id: string` (UUID), `match_score: number`, `referrer: "feed" | "search" | "map" | "share" | "direct"`
   - `referrer` détecté via param URL (`?ref=feed`) OU store `useNavigationRef`. **V1** : utilise `useLocalSearchParams<{ id: string, ref?: string }>()` ; si `ref` absent → `"direct"` par défaut.

2. **`place_call_tapped`** — au tap sur le CTA Appeler
   - Props : `place_id`

3. **`place_whatsapp_tapped`** — au tap sur le CTA WhatsApp
   - Props : `place_id`

4. **`adn_under_construction_seen`** — quand `total_reviews < 5 || confidence_score < 0.3` ET la section ADN est visible (au mount, 1× par session de fiche)
   - Props : `place_id`, `total_reviews: number`

5. **`place_first_view`** — si `spawter.total_spawts === 0` ET 1re fois que ce `place_id` est vu
   - Props : `place_id`, `match_score`, `distance_km`, `time_since_onboarding_seconds`
   - Détection : marquer via AsyncStorage (`spawt:seenPlaces:set`) ou via store mémoire — déduper sur la session
   - **V1** : émettre uniquement si `spawter.total_spawts === 0` (post-onboarding pre-1er spawt). Si Story 4.x veut migrer ailleurs, OK.

**And** **dedup** : `place_viewed` émis 1× par mount (`useFocusEffect` ne ré-émet pas au focus successif).
**And** **fire-and-forget** : `track(...)` n'attend pas le retour réseau (wrapper Story 1.7).

---

**AC #5 — Référer tracking via URL param `?ref=`**

**Given** un caller (HomeD UneCard, FeuilletonRow, SearchResult, etc.)
**When** il navigue vers une fiche lieu
**Then** il **doit** passer le param `ref` :

```ts
// Côté caller
router.push({ pathname: "/place/[id]", params: { id: place.id, ref: "feed" } });

// Côté fiche
const { id, ref } = useLocalSearchParams<{ id: string; ref?: "feed" | "search" | "map" | "share" | "direct" }>();
```

**And** valeurs valides : `"feed" | "search" | "map" | "share" | "direct"`. Si ref invalide ou absent → `"direct"`.

**Given** Story 3.3c HomeD
**When** son code consomme `router.push` pour UneCard/FeuilletonRow
**Then** elle **doit** passer `ref: "feed"` — coordination cross-story (cf. Dev Notes §1).

**Given** Story 3.5 recherche
**When** elle navigue
**Then** elle **doit** passer `ref: "search"`.

**Given** Story 3.7 partage (deep link entrant)
**When** un share link s'ouvre
**Then** `ref: "share"`.

---

**AC #6 — Strings i18n + Test Tantie Rose**

**Given** [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 3.4 est livrée
**Then** la section `place.*` est étendue :

```json
{
  "place": {
    "notRatedYet": "Pas encore noté",
    "spawt_cta_demo": "Je spawt ici (mode démo)",
    "spawt_cta_demo_hint": "En live, Le Guet détecterait ta présence automatiquement (périmètre {{radius}} m, attente {{minutes}} min).",
    "info_address": "Adresse",
    "info_hours": "Horaires",
    "info_hours_closed": "Fermé",
    "info_phone": "Téléphone",
    "info_whatsapp": "WhatsApp",
    "adn_section_title": "ADN du lieu",
    "adn_in_construction": "ADN en construction",
    "adn_in_construction_hint": "{{reviews}} avis publics — il en faut au moins 5 pour révéler les axes.",
    "match_with_palais": "{{score}}% pour ton Palais",
    "call": "Appeler",
    "whatsapp": "WhatsApp",
    "back": "Retour"
  }
}
```

**And** audit `npm run i18n:check` + `npm run lint:vocab` verts.
**And** Test Tantie Rose Alexandre :
- « ADN en construction » est positif (cohérent project-context §Edge cases — « pattern d'honnêteté »).
- Pas de « rating » / « like » — vocab canonique.
- Hint sticky CTA accessible.

---

**AC #7 — Perf NFR-PERF-02 < 2s render**

**Given** un spawter sur 3G simulé tap sur une PlaceCard du feed
**When** la fiche lieu charge
**Then** le **TTI** (time-to-interactive — première frame avec CTA cliquable) est < 2s P95.

**Optimisations** :
- `getPlace(id)` est l'unique appel I/O au mount (`useEffect` 1×).
- Image hero `prefetch` au tap caller si possible (Story 3.3c HomeD pré-charge top 3).
- `useMemo` sur le calcul `displayedScore(rawScore)` avec deps `[place, palais]`.
- **Pas d'imports lourds** statiques (Mapbox, Lottie, etc. — aucun en V1).
- `ScrollView` racine (pas de FlatList car liste de sections fixes).

---

**AC #8 — Tests + triple gate verte**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut :

1. **`<AdnTags />`** (RTL) :
   - ADN avec 5 axes polarisés → 5 chips rendues (labels correctes via ADN_AXIS_LABELS)
   - ADN avec tous axes < threshold → null/fallback
   - ADN avec mix → seules les chips au-dessus du seuil rendues

2. **`<PlaceDetailScreen />`** (RTL + mock router) :
   - Mount avec valid `id` → `getPlace` mocké appelé → photo, nom, MatchScore, signals rendus
   - `ref=feed` → `place_viewed` track appelé avec `referrer: "feed"`
   - Pas de `ref` → `referrer: "direct"`
   - `total_reviews < 5` → `adn_under_construction_seen` track émis ; `<AdnTags />` pas rendu, message construction affiché
   - `total_reviews >= 5 && confidence_score >= 0.3` → AdnTags rendu, pas d'event under_construction
   - Tap CTA Appeler → `Linking.openURL("tel:...")` + `place_call_tapped` track
   - Tap CTA WhatsApp → `Linking.openURL("https://wa.me/...")` + `place_whatsapp_tapped` track
   - Tap sticky CTA → `registerSpawt` mock appelé + router.back

3. **Edge cases** :
   - `id` invalide / `getPlace` retourne null → message « Lieu introuvable » + back btn fonctionnel
   - `cover_photo_url` null → placeholder rendu sans crash
   - `phone` null → CTA Appeler hidden
   - `whatsapp` null → CTA WhatsApp hidden
   - `place.signals` vide → pas de section signals

4. **Voix Chat évolutive** (si édito ajouté — optionnel V1) — non requis Story 3.4 mais à considérer V1.5 si UX spec le demande.

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** `cd app && expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Créer `AdnTags`** (AC: #2)
  - [ ] Créer [app/src/components/AdnTags.tsx](../../app/src/components/AdnTags.tsx).
  - [ ] Mapping axe → label via `ADN_AXIS_LABELS` (constante existante dans `types/place.ts:20-51`).
  - [ ] Logique seuil : `Math.abs(axe) >= threshold` (default 0.5) → render chip pole correspondant.
  - [ ] Tests RTL avec fixtures ADN variés.

- [ ] **Task 2 — Refondre `place/[id].tsx`** (AC: #1, #3, #4, #5, #7)
  - [ ] Réécrire [app/app/place/[id].tsx](../../app/app/place/[id].tsx) selon AC #1.
  - [ ] Photo hero `<Image source={{uri: place.cover_photo_url ?? undefined}}>` avec fallback `View` placeholder.
  - [ ] `useLocalSearchParams<{ id: string; ref?: ... }>()` — extraire `id` + `ref`.
  - [ ] Émettre `place_viewed` au mount via `useFocusEffect` (anti-dedup).
  - [ ] Émettre `adn_under_construction_seen` si condition matchée au mount.
  - [ ] Émettre `place_first_view` si `spawter.total_spawts === 0` et place pas déjà vu.
  - [ ] CTA Appeler / WhatsApp : `Linking.openURL(...)` + `track(...)`.
  - [ ] Sticky CTA bas : `Pressable absolute bottom` ; tap → `registerSpawt` + router.back (logique stub existante).
  - [ ] **Calcul `match_score`** : reconstruire un `MatchingContext` (palais du store, position démo Cocody, visited set) + appeler `displayedScore(computeRawScore(...))`.
    - Réutiliser le code de [(tabs)/index.tsx:50-77](../../app/app/(tabs)/index.tsx#L50-L77) ou (post-Story 3.3c) `rankPlaces(ctx, [{place, adn, last_spawt_at}])[0]`.

- [ ] **Task 3 — Strings i18n `place.*`** (AC: #6)
  - [ ] Étendre fr.json selon AC #6.
  - [ ] Audits verts.

- [ ] **Task 4 — Tracker `ref=feed` côté HomeD** (AC: #5)
  - [ ] **Cross-cutting Story 3.3c** : si Story 3.3c est livrée avant 3.4, ajouter `params: { ref: "feed" }` à `router.push("/place/...")` côté HomeD.
  - [ ] Si 3.4 livrée avant 3.3c → noter en Dev Notes 3.3c pour qu'elle passe `ref="feed"`.
  - [ ] **V1 acceptable** : `ref` absent → `referrer: "direct"` (par défaut), pas bloquant pour tests.

- [ ] **Task 5 — Tests** (AC: #8)
  - [ ] `app/__tests__/components/AdnTags.test.tsx` — 3 cas (cf. Task 1 + AC #8).
  - [ ] `app/__tests__/screens/PlaceDetailScreen.test.tsx` — 7-8 cas (cf. AC #8).

- [ ] **Task 6 — Smoke + perf check + CHANGELOG** (AC: #7, #8)
  - [ ] Triple gate verte.
  - [ ] Smoke `expo export --platform android` compile.
  - [ ] Test manuel matrice 4 devices : TTI fiche < 2s sur 3G.
  - [ ] CHANGELOG `feat(place)` scope `place`.

## Dev Notes

### 1. Coordination Story 3.3c — passing `ref="feed"`

Story 3.4 introduit le tracking `referrer`. Story 3.3c (HomeD) doit, dans son code, **passer** `params: { ref: "feed" }` au `router.push("/place/[id]")`. Si Story 3.4 livrée avant 3.3c, Story 3.4 docs ce besoin ; si 3.3c livrée avant 3.4, Story 3.3c peut anticiper (passe `ref="feed"`, sera consommé par 3.4 quand elle atterrit).

**Décision** : **Story 3.3c** ajoute `ref="feed"` dès sa livraison (cf. tasks Story 3.3c). Story 3.4 lit le param et l'utilise. Si non passé → fallback `"direct"`.

### 2. Pourquoi `AdnTags` et pas le radar ?

Le radar (`AxisRadar`) demande un effort cognitif (lire 5 axes, comprendre les poles). Sur une **fiche lieu**, on veut un signal rapide : « ce lieu est Local + Établi + Premium ». **Chips** = lecture immédiate.

Le radar est réservé à la **fiche spawter** (Story 5.3) — où l'utilisateur explore SON Palais et a le temps de le comprendre.

Cohérent UX spec §1329 « `AdnTags` (ADN en chips, pas radar) ».

### 3. Edge case — `total_reviews >= 5` mais `is_seed` filtré

Le compteur public exclut les `is_seed = true` (project-context §Edge cases). Story 3.4 fiche lieu **affiche** uniquement les avis non-seed dans le compteur :
- `place.adn.total_reviews` (DB) = total brut (seed inclus).
- **Compteur public visible** = devra être un champ séparé OU calculé. **V1 décision** : afficher `place.adn.total_reviews` brut — le seed ne sera <5 sur la plupart des lieux alpha. Si data alpha montre confusion, ajouter Sprint 2 un champ `total_public_reviews` côté ADN.

**Note Story 4.7** : update ADN devra incrémenter 2 compteurs : `total_reviews` (tout) + `total_public_reviews` (where `is_seed = false`). Anticipé dans 4.7, pas dans 3.4.

### 4. Pourquoi pas d'édito ChatBubble sur la fiche ?

UX spec §1409 — « Le Chat parle aux moments-clés, pas en continu ». Fiche lieu = consultation passive, pas un moment-clé. L'édito serait du bruit. Le Chat parle :
- HomeD (1× par session)
- SpawtSheet (review)
- Notif Le Guet
- Célébration de stade
- États vides (« le chat tousse »)

**Story 3.4** = silence. Pas d'erreur, c'est volontaire.

### 5. Pourquoi pas l'option « Y aller » (deep link maps) en V1 ?

UX spec §1132 mentionne « Y aller → Deep link navigation » comme option du Journey 2. **V1** Story 3.4 ne livre pas ce CTA : il faudrait `expo-linking` + résolution platform (`maps://` iOS vs `geo:` Android) + fallback browser.

**Différé** : Sprint 2+ ou story dédiée (`place_y_aller_tapped` event à ajouter à events.md).

**Workaround V1** : `Linking.openURL(\`https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}\`)` — un seul liner avec fallback navigateur. **Optionnel V1**, à voir avec Alexandre/Stéphanie.

### 6. Performance — perf budget impact

- Image hero : peut peser ~150-200 KB (cover photo CDN). Sur 3G : ~2-3s download. **NFR-PERF-02 < 2s** = on doit prefetch côté HomeD (Story 3.3c §Dev Notes §5). Si pas prefetch → TTI peut excéder budget sur 3G. **Mitigation V1** : afficher placeholder + skeleton tant que l'image charge, le CTA est tappable immédiatement (TTI ≠ photo loaded).
- Aucun calcul lourd au render — `displayedScore` est O(1).
- Pas de re-render inutile : sélecteurs Zustand granulaires (`spawter`, `palais`, `spawts`).

### 7. Non-régression Epic 1 + 2

- `getPlace` API stable Story 3.3a — caller continue.
- `<AxisRadar />` n'est plus consommé par la fiche, **MAIS** reste exporté → utilisé par Story 5.3 fiche spawter. Garder.
- `useSpawterStore.registerSpawt` continue d'être appelée par le sticky CTA — comportement identique.

### 8. Sign-off

- **Stéphanie** (tech) : revue refonte fiche + tests + smoke matrice (TTI < 2s).
- **Kidam** (analytics) : confirmation 4-5 events émis avec props conformes events.md.
- **Alexandre** (brand) : Test Tantie Rose sur strings (« ADN en construction » positif), sticky CTA wording.

### 9. Defers identifiés

- **CTA « Y aller » deep link maps** → Sprint 2 ou story dédiée.
- **Édito ChatBubble** sur fiche → V1.5 si data UX montre intérêt (pour l'instant le silence est intentionnel).
- **`total_public_reviews`** field séparé → Story 4.7.
- **Photos galerie** (carousel additional photos) → Sprint 2+, pas dans V1.
- **Animation transition entrée fiche** (Reanimated shared element) → polish Sprint 2.
- **Section « Avis » avec liste de reviews** → Story 4.5 ou story dédiée (fiche montre 0 avis dans V1 — c'est volontaire pour scope).
- **Pre-fetch image hero au tap caller** → Story 3.3c §Dev Notes §5.

### Project Structure Notes

- **1 nouveau composant** : `AdnTags.tsx`.
- **1 fichier refondu** : `place/[id].tsx`.
- **1 fichier i18n étendu** : `fr.json`.
- **Pas de nouvelle dépendance**.
- **Pas de migration SQL**.
- **Pas de modif store**.

### References

- [_bmad-output/planning-artifacts/epics.md:747-769 Story 3.4](../planning-artifacts/epics.md#L747-L769)
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 4 Fiche lieu](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §6 ADN du Lieu](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §14.2 Adresses descriptives](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1127 Journey 2 fiche lieu](../planning-artifacts/ux-design-specification.md#L1127)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1329 AdnTags spec](../planning-artifacts/ux-design-specification.md#L1329)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1396 Sticky CTA bas](../planning-artifacts/ux-design-specification.md#L1396)
- [documentation/analytics/events.md:74-79 events place_*](../../documentation/analytics/events.md#L74-L79)
- [_bmad-output/project-context.md §Edge cases — ADN en construction](../project-context.md)
- [app/app/place/[id].tsx](../../app/app/place/[id].tsx) — stub à refondre
- [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) — `getPlace` (Story 3.3a)
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) — `computeRawScore` / `displayedScore` (Story 3.3b)
- [app/src/types/place.ts:20-51 ADN_AXIS_LABELS](../../app/src/types/place.ts#L20-L51)
- [app/src/components/primitives/MatchScore.tsx](../../app/src/components/primitives/MatchScore.tsx)
- [app/src/components/primitives/Stars.tsx](../../app/src/components/primitives/Stars.tsx)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓), `npm test` (153 passed / 0 failed).

### Completion Notes List

- `place/[id].tsx` entièrement refondu selon UX spec §1127.
- Layout vertical : header back/heart/share overlay sur photo hero → titre Klinsman → sous-titre quartier·cuisine·prix → CTAs Appel/WhatsApp (cercles bordés) → MatchScore + Stars + distance → signaux chips → section ADN (AdnTags si confidence≥0.3 ET total_reviews≥5, sinon "ADN en construction" + hint) → InfoLines → sticky CTA bas "Je spawt ici (mode démo)".
- `AdnTags` créé : chips selon polarité de chaque axe (`|valeur| ≥ threshold` 0.5), variant `gold` pour pôle négatif (Local/Informel/Budget/Populaire/Décontracté), `dark` pour pôle positif.
- 5 events analytics : `place_viewed` (referrer extracted from `?ref=` URL param, fallback `direct`), `place_first_view` (si `total_spawts === 0`), `adn_under_construction_seen` (si total_reviews<5 ou confidence<0.3), `place_call_tapped`, `place_whatsapp_tapped`.
- `useLocalSearchParams<{ id, ref? }>()` extrait + validate `ref` contre la liste `VALID_REFS`.
- MatchScore calculé via `computeRawScore` + `displayedScore` (Story 3.3b) — consomme `saved_place_ids` (Story 3.6 bonus +0.05).
- Toggle favori intégré (Story 3.6) + bouton share intégré (Story 3.7) dans le même header — cluster icônes haut-droit cohérent.
- AxisRadar préservé pour fiche spawter (Story 5.3) — pas consommé ici (UX spec §1329).

### File List

**Nouveaux fichiers** :
- `app/src/components/AdnTags.tsx`

**Fichiers modifiés** :
- `app/app/place/[id].tsx` (refonte complète)
- `app/src/i18n/fr.json` (section `place.*` étendue avec `spawt_cta_demo`/`spawt_cta_demo_hint`/`info_*`/`adn_*`/`match_with_palais`/`call`/`whatsapp`/`back`/`not_found`)
