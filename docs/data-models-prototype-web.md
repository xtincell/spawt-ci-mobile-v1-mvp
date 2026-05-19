# Data Models — `prototype-web` (Vite/React)

> ⚠️ Le prototype web n'est **pas** la baseline canonique. Il a précédé la décision méthode de produit (PRD V1) et utilise un vocabulaire d'archétypes/stades plus large que le scope V1. Conserver pour références visuelles et exploration brand — mais ne pas y ajouter de logique métier nouvelle (la canonical lives dans [`mobile-app`](./data-models-mobile-app.md)).

---

## 1. Stockage

Le prototype n'a **aucune base de données**. Tout vit dans `localStorage` côté navigateur :

| Clé | Contenu | Source |
|---|---|---|
| `spawt_user` | Objet `user` complet (palais, spawts, badges, archetype, ...) | [`src/context/UserContext.jsx:5`](../src/context/UserContext.jsx#L5) |
| `spawt_community_menu` | Map `{ spotId: [{ nom, totalRating, count }] }` — agrégat plats certifiés | [`src/context/UserContext.jsx:6`](../src/context/UserContext.jsx#L6) |

Hydratation au boot : `useState(() => localStorage.getItem(STORAGE_KEY))`. Persistance : `useEffect` global qui re-écrit à chaque mutation.

---

## 2. Modèle `User` (forme JS)

[`src/context/UserContext.jsx:8-40`](../src/context/UserContext.jsx#L8-L40)

```js
const DEFAULT_USER = {
  name, username, memberSince,

  palais: {
    racinesHorizons,        // ⚠️ nom différent du mobile (camelCase, pas snake)
    taniereNomade,
    exigeantEnthousiaste,
    fouleSecret,
    gargoteTable,           // ⚠️ "gargote" — mobile dit "maquis_table" (PRD canonique)
  },

  stade: "chaton",          // ⚠️ vocab différent du mobile
  spotsCount,
  archetype: null,
  currentTitle, displayedTitle,
  titleCollection: [],

  spawts: [],
  coupsDeCoeur: { used, available },
  badges: [],

  markedSpots: [],          // 📌 marquage "à tester" (pas dans PRD V1)
  onSite: { spotId, startedAt } | null,  // ⏱ alternative au geofence (déclaration manuelle)

  onboarded: false,
};
```

### Divergences notables vs canonical (mobile)

| Champ | Prototype web | Mobile (canonical PRD V1) |
|---|---|---|
| Axe 5 | `gargoteTable` | `maquis_table` |
| Stades | `chaton/chat/matou/djidji/guide` (5 niveaux animaliers) | `touriste/explorateur/detective/djidji/guide` (5 niveaux comportementaux) |
| Seuils stades | 0/15/40/80/150 spots | 0/11/21/31/51 spots |
| Archétypes | 13 archétypes nommés (Pisteur, Fantôme, Bouche d'Or, ...) | Reportés Sprint 2 (`archetype_id` reste null en V1) |
| Badges | 5 badges actifs | 1 badge (Premier Spawt) en Sprint 1 |
| Marquage `markedSpots` | Implémenté | Pas dans PRD V1 |
| `onSite` (timer 20min) | Implémenté | Remplacé par geofence 10m / timer 15min |
| `community_menu` | Implémenté | Pas dans PRD V1 |

---

## 3. Modèle `Spawt` (entrée)

```js
{
  id: "spawt-<ts>-<rand>",
  spotId,
  date,            // ISO
  rating?: 1..5,
  review?: string,
  plats?: [{ nom, rating }],
  certified?: boolean,    // GPS<150m OU sur place ≥20min
  lastEditedAt?: ISO,
}
```

[`src/context/UserContext.jsx:177-186`](../src/context/UserContext.jsx#L177-L186)

---

## 4. Données statiques

| Fichier | Contenu | LOC |
|---|---|---|
| [`src/data/restaurants.js`](../src/data/restaurants.js) | Liste de lieux d'Abidjan avec ADN — explore plus de cuisines que les 12 seeds mobiles | 573 |
| [`src/data/archetypes.js`](../src/data/archetypes.js) | 13 archétypes × 5 stades chacun + matcher `findArchetype()` | 177 |
| [`src/data/badges.js`](../src/data/badges.js) | 5 badges + `checkBadges()` | 42 |

---

## 5. Pourquoi conserver

- **Référence visuelle** des écrans onboarding/Home/Profile/SpotDetail/Discover (pages ~larger que le scope MVP)
- **Catalogue d'archétypes nommés** (Pisteur, Fantôme, Bouche d'Or, Gardien du Maquis, ...) qui pourra alimenter Sprint 2 (Feature 18 reportée)
- **Patterns d'écran** réutilisables côté design tokens (`src/theme.js` documente les ratios WCAG AA — héritage utilisé dans `app/src/theme/tokens.ts`)

---

## 6. Pourquoi **ne pas** y rajouter de logique

- Vocabulaire en dérive avec PRD V1 (cf. tableau §2)
- Pas de typage TS — la canonical mobile est strict
- Pas d'instrumentation analytics (cf. [`documentation/analytics/events.md`](../documentation/analytics/events.md))
- Pas de RLS / pas de Supabase
