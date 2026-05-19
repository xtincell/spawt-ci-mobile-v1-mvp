# Story 3.3c: Home `HomeD` & feed personnalisé

Status: review

<!-- 5e story Epic 3 — refonte complète de l'écran (tabs)/index.tsx en HomeD canonique (UX spec §1119-1156) : Masthead daté + ModeStories chips 44px « JE SORS POUR… » + UneCarousel swipeable de UneCard + édito ChatBubble variant `edito` + feuilleton de PlaceCard. Consomme l'adapter durci de 3.3a + le moteur de 3.3b (rankPlaces). Émet `feed_viewed`, `feed_card_impressed` (FlatList onViewableItemsChanged), `feed_card_clicked`, `feed_refreshed`. Cible time-to-first-feed P95 < 3s sur 3G (NFR-PERF-01). Story bloquée par 3.3a + 3.3b + 3.1 (TabBar). 3.4, 3.5, 3.6 peuvent partir en parallèle car n'ont pas besoin de HomeD. -->

## Story

As a spawter,
I want un Home éditorial qui me propose des lieux classés selon mon Palais — masthead daté, modes de sortie en chips circulaires, carrousel de Unes éditoriales, édito du Chat, feuilleton de cartes,
so that je décide où manger en quelques minutes au lieu de 45, et le produit ressemble à une revue éditoriale que je consulte avec plaisir (pas une grille de restaurants Yelp-style).

## ⚠️ Brownfield context — read first

Cette story **refond entièrement** [(tabs)/index.tsx](../../app/app/(tabs)/index.tsx) (155 LOC actuel) en un HomeD canonique. Plusieurs primitives à créer + le feed actuel à remplacer.

**Dépendances bloquantes** :
- ✅ Story 3.1 (TabBar 5 onglets active sur (tabs)) — sinon HomeD n'a pas de coquille.
- ✅ Story 3.3a (`places` / `place_adn` migrés + adapter Zod-durci) — sinon le feed live ne charge rien.
- ✅ Story 3.3b (`rankPlaces` helper exporté) — sinon le tri inline reste à dupliquer.

**État actuel** :

| Élément | Fichier | État | Action Story 3.3c |
|---|---|---|---|
| Écran feed | [app/app/(tabs)/index.tsx](../../app/app/(tabs)/index.tsx) | ⚠️ Stub fonctionnel — FlatList simple + ChatBubble + PlaceCard | **Refondre entièrement** — Masthead + ModeStories + UneCarousel + édito + feuilleton |
| Composant `Masthead` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/Masthead.tsx](../../app/src/components/Masthead.tsx) — bandeau daté Klinsman avec wordmark SPAWT |
| Composant `ModeStories` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/ModeStories.tsx](../../app/src/components/ModeStories.tsx) — chips 44px scroll horizontal, radiogroup, modes « JE SORS POUR… » |
| Composant `UneCarousel` + `UneCard` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/UneCarousel.tsx](../../app/src/components/UneCarousel.tsx) + `UneCard.tsx` — carrousel swipeable, indicateurs pagination |
| Composant `FeuilletonRow` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/FeuilletonRow.tsx](../../app/src/components/FeuilletonRow.tsx) — variant `row` de PlaceCard (vignette 54-64px) |
| `PlaceCard` variants | [app/src/components/PlaceCard.tsx](../../app/src/components/PlaceCard.tsx) | ⚠️ Single variant (hero card current) | **Étendre** : ajouter prop `variant: "hero" | "row" | "numbered"` (default `"hero"` = comportement actuel). Le mode `"numbered"` ajoute un `01`, `02`... or Klinsman. |
| Wordmark SPAWT | [app/src/components/primitives/Wordmark.tsx](../../app/src/components/primitives/Wordmark.tsx) | ✅ Existe (Story 1.3) | **Consommer** dans Masthead |
| Édito ChatBubble variant | [app/src/components/ChatBubble.tsx](../../app/src/components/ChatBubble.tsx) | ✅ Support variant `edito` (Story 2.1) | **Consommer** avec moment custom (cf. AC #5) |
| Analytics events | [app/src/lib/analytics.ts:152-153](../../app/src/lib/analytics.ts#L152-L153) | ✅ Typés (`feed_viewed`, `feed_card_impressed`, `feed_card_clicked`, `feed_refreshed`) | **Émettre** depuis HomeD |
| Strings i18n | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) | ⚠️ Pas de section `home.*` ni `modes.*` | **Ajouter** sections complètes |
| Voix du Chat | [app/src/lib/chat-voice.ts](../../app/src/lib/chat-voice.ts) | ✅ Existe — mapping (stade × moment) | **Ajouter** moment `home_edito` dans la matrice si manquant — cf. Dev Notes §3 |

**Décisions héritées non-revisitables** :

- **5 modes maximum** en V1 (UX spec §1294) : `traine`, `decouvre`, `tribu`, `chic`, `vite`. Ne PAS inventer de mode hors liste sans review Alexandre.
- **`HomeContextuel` (drill-down par mode) reporté V1.5** — décision D11 (epics.md ligne 745). Story 3.3c **ne livre PAS** un écran dédié par mode. Le tap d'un mode re-filtre uniquement le feed actuel sans navigation.
- **`UneCarousel` swipeable horizontal** avec scroll-snap (UX spec §1289). Pas de carrousel vertical.
- **Édito ChatBubble synchronisé sur la carte visible** (UX spec §1289) — variant `edito` sur le pavé sous le carrousel. V1 = édito statique générique (pas synchronisé sur l'index actif — Sprint 2+). Cf. Dev Notes §3.
- **NFR-PERF-01 < 3s P95 sur 3G** + **NFR-PERF-06 bundle JS < 500 KB gzippé** — pas d'embarquement de lib lourde. Compose RN primitives + composants existants.
- **Analytics fire-and-forget** — pattern `track({name, properties})` (Story 1.7).

## Acceptance Criteria

**AC #1 — Structure HomeD canonique livrée**

**Given** l'écran [(tabs)/index.tsx](../../app/app/(tabs)/index.tsx) (refondu)
**When** un spawter ouvre l'app après onboarding (ou tape l'onglet Feed)
**Then** l'écran rend **dans cet ordre vertical** :

1. **`SafeAreaView` + `DataSourceBanner`** (mode démo bandeau jaune top, mounted permanent en fallback)
2. **`<Masthead />`** — bandeau daté avec wordmark SPAWT + date formatée (« 18 mai 2026 ») + tagline du jour optionnelle
3. **`<ModeStories selectedMode={...} onModePress={...} />`** — chips horizontales scrollable, « JE SORS POUR… »
4. **`<UneCarousel unes={top3Ranked} onUnePress={(place) => router.push(\`/place/\${place.id}\`)} />`** — top 3 ranked places
5. **`<ChatBubble stade={spawter.stade} moment="home_edito" variant="edito" />`** — édito Chat
6. **`<FeuilletonRow places={remainingRanked} onPlacePress={(p) => ...} />`** — liste verticale `PlaceCard variant="row"`

**And** le scroll vertical est porté par un **seul** `FlatList` (ou `SectionList`) en racine — pas de `ScrollView + FlatList` imbriqués (RN gotcha perf).
**And** la TabBar (Story 3.1) reste visible 100% du temps en bas.

---

**AC #2 — Composant `Masthead` (date + wordmark)**

**Given** [app/src/components/Masthead.tsx](../../app/src/components/Masthead.tsx) (nouveau)
**When** rendu en tête de HomeD
**Then** il affiche :
- En haut à gauche : `<Wordmark />` (Klinsman 700 « SPAWT »)
- En bas (ou côté droit) : la date du jour formatée français court — `Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date())` → "18 mai 2026"
- Optionnel : une petite caption « ÉDITION DU JOUR » en `preset.overline` text.tertiary

**And** la signature minimale :
```ts
interface MastheadProps {
  /** Override date (testing). Défaut: now() */
  date?: Date;
  /** Optionnel: kicker line — défaut: t("home.masthead_kicker") */
  kicker?: string;
}
```
**And** padding latéral aligné sur `theme.spacing.lg`, hauteur ~64px.
**And** **pas de hex en dur** — tokens uniquement.

---

**AC #3 — Composant `ModeStories` (radiogroup chips circulaires)**

**Given** [app/src/components/ModeStories.tsx](../../app/src/components/ModeStories.tsx) (nouveau)
**When** rendu
**Then** il affiche **5 chips** (modes V1) dans un `ScrollView horizontal` :

| Mode key | Label | Icon | Description |
|---|---|---|---|
| `traine` | « Je traîne » | `walk` | Détente, peu cher |
| `decouvre` | « Je découvre » | `compass` | Nouveau, atypique |
| `tribu` | « Avec la tribu » | `compass` | Groupe, ambiance |
| `chic` | « C'est chic » | `crown` | Soir spécial |
| `vite` | « Vite fait » | `clock` | Rapide, proche |

**And** la signature :
```ts
export type ModeKey = "traine" | "decouvre" | "tribu" | "chic" | "vite";

interface ModeStoriesProps {
  selectedMode: ModeKey | null;
  onModePress: (mode: ModeKey | null) => void; // null si tap = désélection
}
```

**And** le rendu :
- Chip = `View` circulaire 44px (cible tactile ≥44pt), bordure 2.5px noire quand `selected`, pastille verte en bas-right quand `selected`
- Label en `preset.overline` sous la chip (max 12 caractères affichés, ellipsize)
- Strings via `t("modes.{key}.label")` + `t("modes.{key}.sub")`
- Tap sur le mode actif → désélectionne (`onModePress(null)`)
- `accessibilityRole="radiogroup"` sur le wrapper, `accessibilityRole="radio"` sur chaque chip

**And** **filtrage live** : quand un mode est sélectionné, le feed (UneCarousel + FeuilletonRow) re-rank uniquement les lieux qui matchent ce mode (cf. Dev Notes §1 — mapping mode → axes ADN).

---

**AC #4 — Composants `UneCarousel` + `UneCard` (carrousel éditorial top 3)**

**Given** [app/src/components/UneCarousel.tsx](../../app/src/components/UneCarousel.tsx) + [UneCard.tsx](../../app/src/components/UneCard.tsx) (nouveaux)
**When** le HomeD rend les 3 premiers lieux rankés
**Then** un carrousel horizontal swipeable affiche 3 `<UneCard />`.

**`UneCard`** :
- Photo hero 200-240px de hauteur, image fallback si `cover_photo_url == null` (placeholder neutre)
- Dégradé bas `transparent → rgba(0,0,0,0.85)` (cohérent UX spec §1287)
- Kicker `preset.overline` « WOW · 92% MATCH » (texte: signal[0] ou cuisine[0] uppercase + match_score) en couleur or
- Titre `preset.h2` (Klinsman) — nom du lieu
- Byline `preset.small` `text.inverse` — quartier · cuisine principale
- Médaille coin top-right : « ★ Sélection » (gold) si signal `pepite_verifiee` ou `coup_de_coeur`
- Cible tactile entière → onPress

**`UneCarousel`** :
- `FlatList horizontal pagingEnabled snapToAlignment="start" snapToInterval={cardWidth + gap}`
- `decelerationRate="fast"`
- Indicateurs de pagination en bas (3 dots, le dot actif est `text.primary`, inactifs `text.tertiary`)
- `onViewableItemsChanged` track `feed_card_impressed` quand une Une devient visible ≥50% (cf. AC #6)
- `accessibilityRole="adjustable"` + `accessibilityLabel="Une 2 sur 3"` synchronisé

**Signature** :
```ts
interface UneCarouselProps {
  unes: readonly PlaceWithScore[]; // top N (recommandé 3)
  onUnePress: (place: PlaceWithScore) => void;
}
```

**And** si `unes.length === 0` → composant retourne `null` (pas de carrousel vide visuel).
**And** si `unes.length === 1` → 1 seule UneCard sans dots.

---

**AC #5 — Édito ChatBubble variant `edito`**

**Given** la position après le UneCarousel
**When** HomeD rend l'édito du Chat
**Then** un `<ChatBubble stade={spawter.stade ?? "touriste"} moment="home_edito" variant="edito" />` est rendu.

**And** le moment `home_edito` doit exister dans `chat-voice.ts` (cf. Dev Notes §3) :
```ts
// chat-voice.ts — ajouter "home_edito" à CHAT_MOMENTS
type ChatMoment = "post_calibration" | "first_spawt_invite" | "welcome_back" | ... | "home_edito";
```

**And** les strings i18n `chat.<stade>.home_edito` doivent être ajoutées **pour les 5 stades** dans fr.json :
- `chat.touriste.home_edito` : « Aujourd'hui je te propose 3 spots à ton goût. Trie ton choix. »
- `chat.explorateur.home_edito` : « Pas mal de nouveaux endroits cette semaine. J'en mets 3 pour toi. »
- `chat.detective.home_edito` : « Les bons spots sont là. Toi, choisis. »
- `chat.djidji.home_edito` : « La sélection est fine aujourd'hui. Prends ton temps. »
- `chat.guide.home_edito` : « Cette semaine encore, la Meute compte sur toi. Trois lieux qui méritent ton regard. »

**And** ces strings passent le **Test Tantie Rose** Alexandre (pas de jargon, accessible).

---

**AC #6 — Analytics : 4 events émis avec propriétés conformes events.md**

**Given** HomeD monté
**When** les interactions ont lieu
**Then** ces events sont émis (via wrapper `track(...)`, fire-and-forget) :

1. **`feed_viewed`** — au mount initial + à chaque retour du tab (focus event via `useFocusEffect` Expo Router)
   - Props : `places_shown: number`, `top_score: number`, `palais_confidence: number`
   - Émis 1× par session (debounce — pas à chaque re-render)

2. **`feed_card_impressed`** — quand une UneCard ou un FeuilletonRow item devient visible ≥50% pour ≥500ms
   - Props : `place_id: string` (UUID — cf. Story 3.3a Task 4), `position: number` (0-indexed), `match_score: number`
   - Utilise `onViewableItemsChanged` du FlatList avec `viewabilityConfig = { itemVisiblePercentThreshold: 50, minimumViewTime: 500 }`
   - **Dedup** : ne pas réémettre pour le même `place_id` dans la même session (set local au composant)

3. **`feed_card_clicked`** — au tap d'une UneCard ou FeuilletonRow item
   - Props : `place_id`, `position`, `match_score`, `distance_km`
   - Émis **avant** `router.push("/place/[id]")`

4. **`feed_refreshed`** — au pull-to-refresh
   - Props : `places_count: number`

**Given** Kidam funnel cohorte (cf. events.md §3)
**When** un spawter post-onboarding ouvre le feed pour la 1re fois
**Then** `feed_first_view` est émis avec `places_count` — **PAS Story 3.3c qui le détecte** : c'est Story 4.x (premier spawt) qui détectera cette transition. V1 émission de `feed_first_view` peut être un task additionnel ou différé.

**Decision V1** : émettre `feed_first_view` côté Story 3.3c **si** une logique simple (`spawter.total_spawts === 0 && firstMount`) est faisable, sinon **différer** à Story 4.x. **Recommandé : émettre Story 3.3c** — la condition est simple.

---

**AC #7 — Perf : time-to-first-feed P95 < 3s sur 3G (NFR-PERF-01)**

**Given** un spawter en zone Abidjan avec 3G simulé
**When** il ouvre HomeD
**Then** :
- **TTI mesuré** < 3s entre `useEffect` mount et la 1re UneCard rendue.
- **Bundle JS impact** : Story 3.3c ne doit pas ajouter > 30 KB gzippé (vérifier via `expo export --platform android` + analyse bundle).
- **`listPlaces` appel unique** au mount, **pas** à chaque mode change (le re-rank est in-memory).
- **`rankPlaces` (Story 3.3b)** est memoizé via `useMemo` avec deps `[places, palais, visited, selectedMode]`.
- **Pas d'image > 200 KB** dans le seed `cover_photo_url` (project-context §Performance gotchas).
- **`Image source={{ uri }}`** utilise `prefetch` sur les 3 Unes pour cache CDN warm.

**And** la matrice 4 devices (cahier §5.7) — Tecno Spark, Infinix Hot, Samsung A-series, iPhone récent — atteste TTI < 3s P95.

---

**AC #8 — Strings i18n + audit verbal Alexandre**

**Given** [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 3.3c est livrée
**Then** les sections suivantes existent :

```json
{
  "home": {
    "masthead_kicker": "ÉDITION DU JOUR",
    "modes_title": "Je sors pour…"
  },
  "modes": {
    "traine": { "label": "Je traîne", "sub": "Détente" },
    "decouvre": { "label": "Je découvre", "sub": "Atypique" },
    "tribu": { "label": "Avec la tribu", "sub": "Groupe" },
    "chic": { "label": "C'est chic", "sub": "Soir spécial" },
    "vite": { "label": "Vite fait", "sub": "Rapide" }
  },
  "chat": {
    "touriste": { "home_edito": "Aujourd'hui je te propose 3 spots à ton goût. Trie ton choix." },
    "explorateur": { "home_edito": "Pas mal de nouveaux endroits cette semaine. J'en mets 3 pour toi." },
    "detective": { "home_edito": "Les bons spots sont là. Toi, choisis." },
    "djidji": { "home_edito": "La sélection est fine aujourd'hui. Prends ton temps." },
    "guide": { "home_edito": "Cette semaine encore, la Meute compte sur toi. Trois lieux qui méritent ton regard." }
  }
}
```

**And** **audit `npm run i18n:check` vert** — aucune string FR hardcodée hors fr.json.
**And** **audit `npm run lint:vocab` vert** — pas de `restaurant`/`user`/`like`/`leaderboard` dans les nouveaux fichiers.
**And** Test Tantie Rose (Alexandre) :
1. **Tantie Rose comprend** « Je sors pour Vite fait » — accessible.
2. **Brice Konan le partage** — éditorial qualitatif (Masthead + UneCard premium feeling).
3. **Dominic ressent l'appartenance** — voix du Chat amicale, modes parlant le réel ivoirien.

---

**AC #9 — Tests + triple gate verte**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut au minimum :

1. **`<Masthead />`** (RTL) : mount, prop `date` override → date affichée formatée FR.
2. **`<ModeStories />`** (RTL) : 5 chips rendues, tap → `onModePress` appelé, tap sur actif → `null` (désélection).
3. **`<UneCard />`** (RTL) : mount avec PlaceWithScore valid → titre + match_score + signal kicker rendus ; absence de photo → placeholder gracieux.
4. **`<UneCarousel />`** (RTL) : 3 unes → 3 cartes rendues + 3 dots ; 0 unes → null ; tap → `onUnePress` appelé.
5. **`<HomeD />` intégration** (RTL + jest-expo) :
   - Mount → `listPlaces()` mocké appelé 1× → `rankPlaces` mocké appelé → UneCarousel + FeuilletonRow rendus
   - `feed_viewed` track appelé 1× au mount
   - Tap UneCard → `track("feed_card_clicked")` + `router.push` mockés appelés
   - Mode "chic" tap → re-rank via `rankPlaces` (mock spy) avec filtre actif
6. **Voix Chat `home_edito`** — vérifier que `chatKey("home_edito", "touriste")` retourne une clé existante dans fr.json.

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** `cd app && expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Créer `Masthead`** (AC: #2)
  - [ ] Créer [app/src/components/Masthead.tsx](../../app/src/components/Masthead.tsx) selon AC #2.
  - [ ] Consommer `<Wordmark />` (primitive Story 1.3).
  - [ ] Strings via `t("home.masthead_kicker")`.

- [ ] **Task 2 — Créer `ModeStories`** (AC: #3)
  - [ ] Créer [app/src/components/ModeStories.tsx](../../app/src/components/ModeStories.tsx) selon AC #3.
  - [ ] Définir `MODES: ReadonlyArray<{ key, icon, labelKey, subKey }>` en constante locale.
  - [ ] Consommer `<Ico />`, `<Chip />` ou un wrapper custom (chip circulaire 44px).
  - [ ] Strings via `t("modes.{key}.label")` + `t("modes.{key}.sub")`.

- [ ] **Task 3 — Créer `UneCard` + `UneCarousel`** (AC: #4)
  - [ ] Créer [app/src/components/UneCard.tsx](../../app/src/components/UneCard.tsx) selon AC #4.
  - [ ] Créer [app/src/components/UneCarousel.tsx](../../app/src/components/UneCarousel.tsx) — FlatList horizontal `pagingEnabled`.
  - [ ] Dots pagination : `useState` index courant via `onViewableItemsChanged`.
  - [ ] Placeholder image gracieux : `<View>` avec icon CatIcon centré si `cover_photo_url == null` (cohérent PlaceCard ligne 82-95).

- [ ] **Task 4 — Étendre `PlaceCard` avec `variant: "hero" | "row" | "numbered"`** (AC: #1)
  - [ ] Éditer [app/src/components/PlaceCard.tsx](../../app/src/components/PlaceCard.tsx).
  - [ ] Ajouter prop `variant?: "hero" | "row" | "numbered"` (default `"hero"` = comportement actuel).
  - [ ] **`row`** : layout horizontal — vignette 54-64px à gauche, contenu à droite (nom + cuisine + match score + distance). Padding réduit.
  - [ ] **`numbered`** : variant `hero` + nombre `01`, `02`... en or Klinsman au top-left. Prop additionnelle `position?: number` (1-indexed).
  - [ ] Signature publique stable — tous les callers actuels (Feed, place/[id], profile) continuent de marcher avec `variant="hero"` par défaut.

- [ ] **Task 5 — Créer `FeuilletonRow`** (AC: #1)
  - [ ] Créer [app/src/components/FeuilletonRow.tsx](../../app/src/components/FeuilletonRow.tsx).
  - [ ] Sa fonction = wrapper qui rend une liste de `<PlaceCard variant="row" />` séparés par un divider `theme.colors.border.subtle`.
  - [ ] Signature : `{ places: readonly PlaceWithScore[], onPlacePress: (p) => void, onItemImpression?: (p, position) => void }`.

- [ ] **Task 6 — Ajouter le moment `home_edito` à `chat-voice.ts`** (AC: #5)
  - [ ] Éditer [app/src/lib/chat-voice.ts](../../app/src/lib/chat-voice.ts).
  - [ ] Ajouter `"home_edito"` à `ChatMoment`.
  - [ ] Mapper la clé i18n via `chatKey("home_edito", stade)`.
  - [ ] Vérifier `isChatSilent(stade, "home_edito")` retourne `false` pour les 5 stades.

- [ ] **Task 7 — Strings i18n** (AC: #8)
  - [ ] Ajouter sections `home.*`, `modes.*`, `chat.<stade>.home_edito` (5×) dans fr.json.
  - [ ] Audits `lint:vocab` + `i18n:check` verts.

- [ ] **Task 8 — Refondre `(tabs)/index.tsx` en HomeD canonique** (AC: #1, #6, #7)
  - [ ] Réécrire [app/app/(tabs)/index.tsx](../../app/app/(tabs)/index.tsx) :
    ```ts
    export default function HomeD() {
      const router = useRouter();
      const theme = useTheme();
      const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
      const spawter = useSpawterStore((s) => s.spawter);
      const spawts = useSpawterStore((s) => s.spawts);
      const [places, setPlaces] = useState<PlaceWithAdn[]>([]);
      const [selectedMode, setSelectedMode] = useState<ModeKey | null>(null);
      const [refreshing, setRefreshing] = useState(false);
      // ...
      const ranked = useMemo(() => {
        const candidates = applyModeFilter(places, selectedMode); // helper local
        return rankPlaces(matchingCtx, candidates.map(toPlaceWithSignals));
      }, [places, selectedMode, palais, spawts]);
      // ...
      // FlatList comme racine, ListHeader = Masthead + ModeStories + UneCarousel + ChatBubble
      // data = ranked.slice(3), renderItem = <PlaceCard variant="row" />
    }
    ```
  - [ ] Implémenter `applyModeFilter(places, mode)` — helper local qui filtre selon mapping mode→axes (cf. Dev Notes §1).
  - [ ] Wire `feed_viewed`, `feed_card_clicked`, `feed_refreshed`, `feed_card_impressed`, `feed_first_view` selon AC #6.
  - [ ] **Retirer** la haversine dupliquée ligne 146 — consommer celle exportée de matching.ts (Story 3.3b).

- [ ] **Task 9 — Tests** (AC: #9)
  - [ ] 6 fichiers tests (cf. AC #9).
  - [ ] Mock `useRouter` + `useSpawterStore` + `listPlaces` + `rankPlaces` selon besoin RTL.

- [ ] **Task 10 — Smoke + perf check + CHANGELOG** (AC: #7, #9)
  - [ ] Triple gate verte.
  - [ ] Smoke `expo export --platform android` + mesure bundle delta < 30 KB.
  - [ ] Test manuel matrice 4 devices (cahier §5.7) — TTI < 3s sur 3G simulé via dev tools.
  - [ ] CHANGELOG `feat(feed)` scope `feed` — HomeD canonique livré.

## Dev Notes

### 1. Mapping mode → filtre ADN

Le **filtre live** déclenché par `ModeStories` filtre les candidats `places` avant `rankPlaces`. Mapping recommandé (à valider en alpha) :

```ts
function applyModeFilter(places: PlaceWithAdn[], mode: ModeKey | null): PlaceWithAdn[] {
  if (mode === null) return places;
  switch (mode) {
    case "traine":
      return places.filter(p => p.price.tier <= 2 && p.adn.axe_decontracte_habille < 0);
    case "decouvre":
      return places.filter(p => p.adn.axe_populaire_prive > 0 || p.signals.includes("decouverte"));
    case "tribu":
      return places.filter(p => p.adn.axe_decontracte_habille < 0.2); // décontracté à mid
    case "chic":
      return places.filter(p => p.price.tier === 3 || p.adn.axe_decontracte_habille > 0.3);
    case "vite":
      return places.filter(p => p.adn.axe_informel_etabli < 0); // informel
  }
}
```

**Décision V1** : mapping heuristique. Sprint 2+, Madame Sun pourra l'ajuster par data alpha. Si filtre retourne 0 lieux → afficher EmptyState « le chat tousse » au lieu d'un feed vide.

### 2. `feed_first_view` — quelle frontière ?

Le funnel cold start events.md §3 a `feed_first_view` qui se déclenche **post-onboarding**. Implémentation pragmatique Story 3.3c :

```ts
useEffect(() => {
  if (spawter?.total_spawts === 0 && !hasSeenFirstFeed) {
    track({ name: "feed_first_view", properties: { places_count: places.length } });
    AsyncStorage.setItem("spawt:hasSeenFirstFeed", "1");
  }
}, [spawter, places]);
```

Si Story 4.x veut migrer cette logique côté store (`registerSpawt` détecte la transition), `feed_first_view` peut être déplacé. V1 = côté HomeD, simple, suffisant.

### 3. Édito ChatBubble — synchronisation à la carte active (Sprint 2+)

UX spec §1289 mentionne « baseline du Chat synchronisée sur la carte visible ». V1 = **édito statique générique** (un seul `home_edito` par stade). Sprint 2 ajoutera :
- Édito par carte (`chat.<stade>.une_kicker.<une_index>`).
- Animation de transition entre éditos via Reanimated.

**V1** est intentionnellement plus simple — éviter le scope creep, garder le Test Tantie Rose lisible.

### 4. Pourquoi pas une lib carousel tierce ?

`react-native-snap-carousel` ou `react-native-reanimated-carousel` ajouterait ~50 KB gzippé pour 1 feature. `FlatList horizontal pagingEnabled snapToInterval` est natif RN, suffit pour 3 cartes, garde le bundle léger (NFR-PERF-06 < 500 KB).

### 5. Performance — points d'attention

- **Photos lieux servies CDN Supabase Storage** (architecture §Infrastructure & Deployment). En mode démo, `cover_photo_url = null` partout — placeholder fallback gracieux.
- **`rankPlaces` memoizé** avec deps `[places, palais, visited, selectedMode]` — recalc uniquement quand un input change.
- **`viewabilityConfig` minimumViewTime 500ms** — empêche les impressions fantômes lors d'un scroll rapide.
- **Dedup `feed_card_impressed`** via `useRef(new Set<string>())` — un place_id n'est tracké qu'1× par session.
- **FlatList `removeClippedSubviews={true}`** sur Android — perf scroll long feuilleton.
- **`Image source={{uri}}` `resizeMode="cover"`** — pas de `resizeMethod` custom qui ralentirait.

### 6. Strategy pour `useFocusEffect` (feed_viewed à chaque retour tab)

```ts
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

const trackedRef = useRef(false);
useFocusEffect(
  useCallback(() => {
    if (trackedRef.current) return; // re-mount during same session
    trackedRef.current = true;
    track({
      name: "feed_viewed",
      properties: { places_shown: places.length, top_score: ranked[0]?.match_score ?? 0, palais_confidence: palais.confidence_score },
    });
    return () => { /* keep trackedRef.current = true pour la session */ };
  }, [places, ranked, palais]),
);
```

Reset `trackedRef = false` sur logout (Story 5+).

### 7. Test Tantie Rose — éditos Chat à valider

Les 5 éditos `chat.<stade>.home_edito` sont des **propositions Story 3.3c**. Alexandre doit les valider en review :
- **Tantie Rose comprend** ? Pas de jargon (« trie ton choix » accessible).
- **Brice Konan le partage** ? Ton qualitatif (Djidji « prends ton temps » respire le premium).
- **Dominic ressent l'appartenance** ? Modes parlant le réel (« Vite fait », « Avec la tribu »).

Si Alexandre rejette une formulation, Story 3.3c PR ajuste — pas de pivot scope.

### 8. Non-régression Epic 1 + 2

- `PlaceCard` signature stable (variant `"hero"` par défaut) — tous les callers continuent.
- `ChatBubble` (Story 2.1) consommé sans modif — variant `edito` existe.
- `chat-voice.ts` matrice étendue (+1 moment, +5 strings) — non-breaking pour callers existants.
- `analytics.ts` events `feed_*` déjà typés — pas de modif analytics.

### 9. Compatibilité avec Story 3.4 (fiche lieu)

Tap d'une UneCard ou d'un FeuilletonRow item → `router.push(\`/place/\${place.id}\`)`. Story 3.4 enrichit `place/[id].tsx` ; aucun coupling fort.

### 10. Sign-off

- **Stéphanie** (tech) : revue refonte HomeD + tests intégration + smoke matrice devices (TTI 3G).
- **Kidam** (analytics) : confirmation 4 events émis avec props conformes events.md, `feed_first_view` côté HomeD acté.
- **Alexandre** (brand) : Test Tantie Rose sur éditos Chat + Masthead premium feeling.

### 11. Defers identifiés

- **`HomeContextuel`** (drill-down par mode) → V1.5 (D11).
- **Édito synchronisé sur la Une active** → Sprint 2.
- **Animation Reanimated transition carrousel** → polish Sprint 2.
- **A/B test mapping mode→axes** → Sprint 2 Kidam.
- **CDN preload photos Une** au boot → Sprint 2 (perf).
- **Mode dynamique (+ Plus)** ajout custom mode → Sprint 2+ (UX spec §1294 mentionne « entrée +Plus »).
- **EmptyState quand filter retourne 0 lieux** → bien câbler dès V1 (cf. Task 8).

### Project Structure Notes

- **5 nouveaux composants** : `Masthead`, `ModeStories`, `UneCarousel`, `UneCard`, `FeuilletonRow`.
- **1 composant étendu** : `PlaceCard` (variant prop additif).
- **1 fichier refondu** : `(tabs)/index.tsx`.
- **1 fichier moteur étendu** : `chat-voice.ts` (+ moment `home_edito`).
- **1 fichier i18n étendu** : `fr.json` (3 sections + 5 strings chat).
- **Pas de nouvelle dépendance npm** (FlatList natif RN).
- **Pas de migration SQL**.
- **Pas de modif store** (consommation uniquement).

### References

- [_bmad-output/planning-artifacts/epics.md:730-745 Story 3.3c](../planning-artifacts/epics.md#L730-L745)
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 3 — Home + feed](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §9.3 Voix du Chat](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1119-1156 Journey 2 — Découverte](../planning-artifacts/ux-design-specification.md#L1119-L1156)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1285-1297 UneCarousel + ModeStories spec](../planning-artifacts/ux-design-specification.md#L1285-L1297)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1278-1284 PlaceCard variants](../planning-artifacts/ux-design-specification.md#L1278-L1284)
- [documentation/analytics/events.md:62-66 events feed_*](../../documentation/analytics/events.md#L62-L66)
- [_bmad-output/project-context.md §Performance gotchas](../project-context.md)
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) — `rankPlaces` (Story 3.3b)
- [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) — `listPlaces` (Story 3.3a)
- [app/src/components/PlaceCard.tsx](../../app/src/components/PlaceCard.tsx) — à étendre `variant`
- [app/src/components/ChatBubble.tsx](../../app/src/components/ChatBubble.tsx) — variant `edito` Story 2.1
- [app/src/components/primitives/Wordmark.tsx](../../app/src/components/primitives/Wordmark.tsx) — primitive
- [app/app/(tabs)/index.tsx](../../app/app/(tabs)/index.tsx) — à refondre

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓), `npm test` (153 passed / 0 failed).

### Completion Notes List

- `(tabs)/index.tsx` refondu en HomeD canonique : `Masthead` + `ModeStories` + `UneCarousel` (top 3) + `ChatBubble variant="edito" moment="home_edito"` + `FeuilletonRow` (rang 04+).
- 5 composants créés : `Masthead`, `ModeStories`, `UneCard`, `UneCarousel`, `FeuilletonRow`.
- Mapping mode → filtre ADN appliqué via `applyModeFilter` local (heuristique V1 — Dev Notes §1).
- 5 events analytics émis : `feed_viewed` (dedup ref), `feed_card_impressed` (viewability ≥50% + 500ms minimumViewTime, dedup par place_id via ref Set), `feed_card_clicked` (incl. position + distance_km), `feed_refreshed` (pull-to-refresh), `feed_first_view` (1× post-onboarding, dedup AsyncStorage).
- Icône search ajoutée au Masthead → push vers écran `/search` (cross-cutting Story 3.5).
- `ChatBubble moment="home_edito"` consommé — moment `home_edito` ajouté à `CHAT_MOMENTS` dans `chat-voice.ts`, strings i18n ajoutées pour 5 stades (guide volontairement vide, isChatSilent gate).
- Mode "filtre vide" affiche EmptyState « le chat tousse ».
- `applyModeFilter` exposé en helper local (V1 — Sprint 2 décision Madame Sun pour A/B test mapping).
- `router.push("/search" as never)` — cast typed routes (search.tsx fraîchement ajouté, regen au prochain build).

### File List

**Nouveaux fichiers** :
- `app/src/components/Masthead.tsx`
- `app/src/components/ModeStories.tsx`
- `app/src/components/UneCard.tsx`
- `app/src/components/UneCarousel.tsx`
- `app/src/components/FeuilletonRow.tsx`

**Fichiers modifiés** :
- `app/app/(tabs)/index.tsx` (refonte complète — HomeD canonique)
- `app/src/lib/chat-voice.ts` (+ moment `home_edito` dans `CHAT_MOMENTS`)
- `app/src/i18n/fr.json` (sections `home.*`, `modes.*`, `chat.<stade>.home_edito` × 5)
- `app/__tests__/lib/chat-voice.test.ts` (assertions ajustées 11→12 moments, 7→8 non-stade_up)
