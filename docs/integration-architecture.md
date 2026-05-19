# Integration Architecture

> Le repo héberge **deux applications distinctes**. Elles **ne communiquent pas en runtime** : c'est de la coexistence dans un monorepo, pas une architecture multi-services. Ce doc clarifie cette coexistence pour qu'aucun agent (humain ou LLM) ne se trompe de cible.

---

## 1. Topologie

```
┌────────────────────────────────────────────────────────────┐
│                     Repository (1 Git remote)              │
│                                                            │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │  prototype-web   │          │   mobile-app     │        │
│  │  (racine)        │          │   (app/)         │        │
│  │                  │          │                  │        │
│  │  Vite + React    │          │  Expo + RN + TS  │        │
│  │  localStorage    │          │  AsyncStorage    │        │
│  │  Pas de backend  │          │  Supabase (opt.) │        │
│  │                  │          │                  │        │
│  │  STATUT : figé   │          │  STATUT : actif  │        │
│  │  Vocab : pré-V1  │          │  Vocab : V1 ✓    │        │
│  └──────────────────┘          └──────────────────┘        │
│           │                              │                 │
│           └──────────────┬───────────────┘                 │
│                          │                                 │
│                  ❌ Pas de communication runtime           │
│                                                            │
└────────────────────────────────────────────────────────────┘
                          │
                          │ partage : design tokens (chemin manuel)
                          │           PRD V1 (source amont commune)
                          ▼
                  ┌────────────────┐
                  │ documentation/ │  ← source de vérité produit
                  └────────────────┘
```

---

## 2. Points de couplage (et leur nature)

| Couplage | Type | Source canonique | Risque |
|---|---|---|---|
| **Design tokens** (palette, typo) | manuel | [`app/src/theme/tokens.ts`](../app/src/theme/tokens.ts) hérite des choix testés dans [`src/theme.js`](../src/theme.js) | drift si on modifie l'un sans l'autre — pas de mécanisme bloquant |
| **PRD V1** | source amont | `documentation/SPAWT_PRD_V1.docx` (John BMad, 9 avril 2026) | les deux apps doivent rester alignées, mais seul mobile a l'audit `lint-vocab` |
| **Datasets** (lieux Abidjan) | duplicat | mobile : 12 lieux dans [`app/src/data/seed/places.ts`](../app/src/data/seed/places.ts) ; web : 573 LoC dans [`src/data/restaurants.js`](../src/data/restaurants.js) | bases de noms différentes (web : exploration plus large) |
| **Vocabulaire produit** | divergent ⚠️ | mobile = canonical PRD V1 ; web = pré-PRD | cf. [data-models-prototype-web §2](./data-models-prototype-web.md#divergences-notables-vs-canonical-mobile) |

---

## 3. Pourquoi pas de communication runtime ?

- Le prototype web vise **un seul user, en local**, sans backend.
- L'app mobile a son propre stack (Supabase) accessible **uniquement via SDK**, sans API publique côté mobile.
- Aucun deep link, aucun protocole partagé, aucun bus d'event.

**En pratique** : un spawter qui utilise l'app mobile ne voit jamais le prototype, et vice-versa.

---

## 4. Quand toucher au prototype

Cas légitimes :
- Revue brand visuelle (Alexandre)
- Exploration UX nouvelle (avant de la porter mobile)
- Étude des 13 archétypes (préparation Sprint 2 — Feature 18 reportée)

Cas illégitimes :
- Ajouter une feature attendue par les spawters → **doit aller dans `mobile-app`**
- Modifier un dataset → la canonical est le seed mobile + Supabase

---

## 5. Quand toucher à la canonical (`mobile-app`)

Toujours, sauf cas rares ci-dessus. Triple gate impérative :

```bash
cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check
```

+ triple sign-off Stéphanie / Kidam / Alexandre avant merge sur `main` (cf. cahier §8).

---

## 6. Évolution probable

Hypothèse : à terme (V1.5 / V2), le prototype Vite peut être :

| Option | Effort | Trade-off |
|---|---|---|
| **A. Devenir un admin panel React** (Feature 19 du PRD) | élevé | refonte UI, mais réutilise bcp d'archétypes/badges |
| **B. Devenir un site marketing public** | moyen | choix produit Alexandre |
| **C. Être supprimé** | nul | perte de la collection archétypes/badges, à back-up dans `documentation/` |

Décision pas encore prise.

---

## 7. Fichier metadata

[project-parts.json](./project-parts.json) — métadonnées machine-readable des deux parties (id, root_path, project_type_id) pour les futurs workflows BMad.

---

## 8. Liens

- Architecture mobile (canonical) : [architecture-mobile-app.md](./architecture-mobile-app.md)
- Architecture prototype : [architecture-prototype-web.md](./architecture-prototype-web.md)
- Source tree global : [source-tree-analysis.md](./source-tree-analysis.md)
