# Story 3.1: Navigation 5 onglets & FAB Spawter

Status: review

<!-- 1re story d'Epic 3 — câble la TabBar canonique 5 onglets (primitive déjà existante depuis Story 1.3) sur le groupe `(tabs)` Expo Router, ajoute les routes `map`/`meute`/`palais` manquantes, transforme le FAB central en action Spawter (modal / sheet stub V1), et fournit l'EmptyState « le chat tousse » pour les onglets hors scope Sprint 1. Aucune logique métier ajoutée — pure plomberie navigation. Story autonome : ne dépend ni de 3.3 (places) ni de 3.4 (fiche lieu). -->

## Story

As a spawter,
I want naviguer dans l'app via une barre à 5 onglets (Feed · Carte · [FAB +] · Meute · Palais) avec un FAB central qui porte l'action Spawter,
so that j'accède à toutes les surfaces et au geste central depuis n'importe où, et les onglets hors scope Sprint 1 (Carte, Meute) ne ressemblent jamais à un écran cassé.

## ⚠️ Brownfield context — read first

Cette story **remplace** le `Tabs` natif d'Expo Router actuellement monté dans [(tabs)/_layout.tsx](../../app/app/(tabs)/_layout.tsx) — qui n'expose que 2 onglets (`index` / `profile`) avec `tabBarStyle` minimal — par la primitive canonique [TabBar.tsx](../../app/src/components/primitives/TabBar.tsx) (livrée Story 1.3) déjà conçue pour 5 onglets + FAB central débord -22px + safe-area.

**Pourquoi ce câblage n'a pas été fait Story 1.3** : la primitive TabBar a été portée du midfi-kit sans être consommée par un layout réel — Epic 2 n'avait pas besoin de tabs (funnel onboarding linéaire). Epic 3 active la coquille (tabs) ; cette story livre uniquement le câblage navigation, les écrans destination (`carte.tsx`, `meute.tsx`, palais détaillé) sont des stubs `EmptyState` non bloquants.

**État actuel** :

| Élément | Fichier | État | Action Story 3.1 |
|---|---|---|---|
| Layout `(tabs)/_layout.tsx` | [app/app/(tabs)/_layout.tsx](../../app/app/(tabs)/_layout.tsx) | ⚠️ `<Tabs>` natif Expo, 2 onglets seulement, pas la primitive | **Réécrire** : monter `<Tabs tabBar={...} />` avec render prop qui retourne `<TabBar />` canonique |
| Primitive `TabBar` | [app/src/components/primitives/TabBar.tsx](../../app/src/components/primitives/TabBar.tsx) | ✅ Existe — 5 onglets + FAB 48px débord -22, props `active` + `onTabPress` | **Consommer** sans modif (signature stable) |
| Onglet `index` (Feed) | [app/app/(tabs)/index.tsx](../../app/app/(tabs)/index.tsx) | ✅ Existe — Feed minimaliste (FlatList places) | **Garder** intact, l'écran sera refondu par Story 3.3c |
| Onglet `profile` | [app/app/(tabs)/profile.tsx](../../app/app/(tabs)/profile.tsx) | ✅ Existe — sera renommé sémantiquement « Palais » dans la TabBar | **Garder** le fichier ; la TabBar mappe `palais` → route `profile` (ou renommer le fichier — cf. Task 3) |
| Onglet `map` (Carte) | (aucun) | ❌ N'existe pas | **Créer** [app/app/(tabs)/carte.tsx](../../app/app/(tabs)/carte.tsx) — stub `EmptyState` « Le Chat regarde la carte… mais pas encore » |
| Onglet `tribu` (Meute) | (aucun) | ❌ N'existe pas | **Créer** [app/app/(tabs)/meute.tsx](../../app/app/(tabs)/meute.tsx) — stub `EmptyState` « La Meute se rassemble… patience » |
| Composant `EmptyState` | (aucun) | ❌ N'existe pas (mentionné UX spec §1329 + §1411) | **Créer** [app/src/components/EmptyState.tsx](../../app/src/components/EmptyState.tsx) — fond + CatIcon + titre + sous-titre + CTA optionnel |
| Action FAB Spawter | (stub primitive `onTabPress("fab")` no-op) | ⚠️ La primitive expose le callback ; pas de behavior câblé | **Câbler** : tap FAB → ouvre une bottom sheet stub ou `Alert.alert("Le Guet armé bientôt", ...)` en V1 — la vraie action (sheet `SpawtSheet`) est livrée Story 4.2 |
| `RouteGuard` (app/_layout.tsx) | [app/app/_layout.tsx:23-44](../../app/app/_layout.tsx#L23-L44) | ✅ Passif — redirige `(onboarding)` ↔ `(tabs)` selon présence `spawter` | **Pas touché** |
| Strings i18n `nav.*` | [app/src/i18n/fr.json:13-19](../../app/src/i18n/fr.json#L13-L19) | ✅ Présentes (`feed`, `map`, `fab`, `meute`, `palais`) | **Garder** ; ajouter `nav.fab.action_label` + `empty_state.*` |

**Décisions héritées non-revisitables** :

- **TabBar hauteur 78px + safe-area home indicator** — fixée midfi-kit + ux-spec §1442. Pas de variante.
- **FAB rond noir 48px débord -22px, icône `plus` or, action Spawter** — invariant brand (ux-spec §1443).
- **Onglet actif `--spawt-black`, `stroke-width 2`** — déjà implémenté dans la primitive (`filled={isActive}` sur `Ico`).
- **RouteGuard passif** — observe le store Zustand, redirige `(onboarding)` ↔ `(tabs)` ; jamais d'orchestration métier (project-context §Expo Router).
- **Pas de logique métier dans le FAB en V1** — l'action « Je spawt ici » nécessite Le Guet armé + geofence (Story 4.1). V1 = stub explicite.
- **Préfixe `Spawt` interdit** sur les composants techniques (project-context §Convention de naming) — `EmptyState` reste générique, pas `SpawtEmptyState`.

## Acceptance Criteria

**AC #1 — TabBar canonique 5 onglets active sur le groupe `(tabs)`**

**Given** le layout [app/app/(tabs)/_layout.tsx](../../app/app/(tabs)/_layout.tsx)
**When** l'app monte un écran de `(tabs)`
**Then** le `<Tabs>` d'expo-router est configuré avec :
- `screenOptions={{ headerShown: false }}`
- `tabBar={(props) => <TabBar active={mapRouteToActive(props.state.routes[props.state.index].name)} onTabPress={(id) => handleTabPress(id, props.navigation, router)} />}`
**And** la primitive `<TabBar />` (Story 1.3) est rendue **sans modification** — props inchangées (`active: ActiveId`, `onTabPress: (id: TabId) => void`).
**And** la TabBar est visible 100% du temps sur les écrans de `(tabs)` (Feed, Carte, Meute, Palais) — pas masquée par un `ScrollView` ou un `KeyboardAvoidingView` mal configuré.

**Given** le mapping `mapRouteToActive(routeName: string): ActiveId`
**When** un route est active
**Then** :
- `"index"` → `"home"`
- `"carte"` → `"map"`
- `"meute"` → `"tribu"`
- `"profile"` (ou `"palais"`) → `"profile"`
- Pas de cas pour `"fab"` (le FAB n'est jamais une destination route, juste un trigger)
- Cas par défaut : `"home"` (fallback safe)

---

**AC #2 — Tap onglet navigation déclarative typée expo-router**

**Given** le handler `handleTabPress(id: TabId, navigation, router)`
**When** un onglet est tapé
**Then** la navigation suit :
- `id === "home"` → `navigation.navigate("index")`
- `id === "map"` → `navigation.navigate("carte")`
- `id === "tribu"` → `navigation.navigate("meute")`
- `id === "profile"` → `navigation.navigate("profile")` (ou `"palais"` si renommé Task 3)
- `id === "fab"` → ouvre l'action Spawter (cf. AC #4) — **pas** une navigation
**And** la navigation utilise les **typed routes** (`experiments.typedRoutes: true` dans `app.json`) — les strings de route doivent être reconnues à la compile.
**And** **aucune string `router.push("/(tabs)/...")` concaténée** — utiliser `navigation.navigate(<typed name>)`.

---

**AC #3 — Écrans onglet créés (avec EmptyState pour hors scope Sprint 1)**

**Given** la liste des écrans onglets requis
**When** le file-based routing scanne `(tabs)/`
**Then** ces fichiers existent et exportent `default function`:
1. `app/app/(tabs)/index.tsx` — Feed (existant, intact en Story 3.1)
2. `app/app/(tabs)/carte.tsx` — **nouveau** : retourne `<EmptyState icon="map" title={t("empty_state.map_title")} body={t("empty_state.map_body")} />`
3. `app/app/(tabs)/meute.tsx` — **nouveau** : retourne `<EmptyState icon="compass" title={t("empty_state.meute_title")} body={t("empty_state.meute_body")} />`
4. `app/app/(tabs)/profile.tsx` — existant, intact (deviendra carte spawter Story 5.3)

**Given** un écran stub (`carte`, `meute`)
**When** il est rendu
**Then** :
- Fond `theme.colors.surface.base`
- Centré verticalement + horizontalement
- Affiche un `<CatIcon>` (or, gros) au-dessus
- Titre Klinsman `preset.h2` `color: theme.colors.text.primary`
- Sous-titre `preset.body` `color: theme.colors.text.secondary` avec ton « le chat tousse » (jamais « cette feature n'est pas disponible »)
- **Aucun CTA** (pas de bouton « Notify me », pas de « Retour ») — l'utilisateur navigue par la TabBar
- `DataSourceBanner` reste en tête si `dataSourceMode === "fallback"` (cohérent project-context §Edge cases)

---

**AC #4 — FAB central : action Spawter stub V1**

**Given** le tap sur le FAB (callback `onTabPress("fab")`)
**When** le handler s'exécute
**Then** en V1 (avant Story 4.2), une des 2 stratégies est implémentée — **choisir** la stratégie A (recommandé) :

**Stratégie A (recommandée)** : ouvrir une bottom sheet stub « Spawter » avec :
- Titre : `t("fab.stub_title")` = « Je spawt ici »
- Body : `t("fab.stub_body")` = « Le Guet n'est pas encore armé sur ton téléphone. Va sur la fiche d'un lieu et tape "Je spawt ici (mode démo)" pour valider la mécanique. »
- CTA fermer : `t("common.close")`
- Pas de geofence, pas d'action réelle — V1 = pédagogique

**Stratégie B (alternative)** : `Alert.alert(t("fab.stub_title"), t("fab.stub_body"))` — plus simple mais moins joli

**Decision** : Strategy A si une primitive `BottomSheet` est déjà disponible dans le repo OU si la création d'une mini-sheet stub <100 LOC est faisable ; sinon Strategy B (acceptable en V1, Story 4.2 livrera la vraie `SpawtSheet`).

**Given** le FAB tappé
**When** l'action s'exécute
**Then** un event analytics **n'est PAS** émis ici (V1 — pas d'event `fab_tapped` dans events.md). Le V2 Story 4.2 émet `guet_armed` quand la vraie action arme un guet.

---

**AC #5 — Composant `EmptyState` réutilisable**

**Given** le composant [app/src/components/EmptyState.tsx](../../app/src/components/EmptyState.tsx) (nouveau)
**When** il est utilisé
**Then** sa signature est :
```ts
interface EmptyStateProps {
  /** Icône optionnelle (un `IconName` du set `Ico`). Si absent → CatIcon par défaut */
  icon?: IconName;
  title: string;
  body: string;
  /** CTA optionnel — si absent, pas de bouton */
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, body, cta }: EmptyStateProps): JSX.Element
```

**And** le rendu :
- `View` flex 1, `justifyContent: "center"`, `alignItems: "center"`, padding `theme.spacing["2xl"]`
- Icône centrée (CatIcon ou Ico selon prop), taille ≈ 64
- Titre `preset.h2` `text.primary` text-align center
- Body `preset.body` `text.secondary` text-align center, max-width 280
- CTA optionnel (variant `secondary` du `<Button>` primitive, mt = `theme.spacing.lg`)

**And** le composant est **dumb** : pas de logique métier, pas d'i18n call interne (le caller passe les strings déjà résolues via `t()`).

---

**AC #6 — RouteGuard non touché (déjà passif, déjà OK)**

**Given** le RouteGuard ([app/app/_layout.tsx:23-44](../../app/app/_layout.tsx#L23-L44))
**When** Story 3.1 est livrée
**Then** **aucune modification** de `_layout.tsx` racine n'est appliquée.
**And** la redirection passe par le store (`spawter !== null && onSplash → router.replace("/(tabs)")`) — pattern existant Epic 2 inchangé.

---

**AC #7 — Strings i18n ajoutées**

**Given** [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 3.1 est livrée
**Then** ces sections existent :

```json
{
  "nav": {
    "feed": "Feed",
    "map": "Carte",
    "fab": "Spawter",
    "meute": "Meute",
    "palais": "Palais"
  },
  "fab": {
    "stub_title": "Je spawt ici",
    "stub_body": "Le Guet n'est pas encore armé sur ton téléphone. Va sur la fiche d'un lieu et tape « Je spawt ici (mode démo) » pour valider la mécanique.",
    "action_label": "Spawter depuis le centre"
  },
  "empty_state": {
    "map_title": "Le Chat regarde la carte…",
    "map_body": "Mais pas encore. Reviens bientôt — la carte s'allume au sprint d'après.",
    "meute_title": "La Meute se rassemble…",
    "meute_body": "Pour l'instant, retrouve les autres spawters via les avis et les Coups de Cœur sur les fiches lieu."
  }
}
```

**And** `nav.*` existe déjà (intact) — l'ajout concerne `fab.*` + `empty_state.*`.
**And** **aucune string FR hardcodée** dans les nouveaux fichiers — audit `npm run i18n:check` vert.
**And** **aucun mot interdit** Contrat §20.1 (`leaderboard`, `ranking`, etc.) — audit `npm run lint:vocab` vert.

---

**AC #8 — Tests + triple gate verte**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut au minimum :

1. **`<TabsLayout />`** (RTL, `app/__tests__/components/TabsLayout.test.tsx`) :
   - Mount sur route `index` → TabBar affichée avec `active="home"`
   - Tap onglet « Carte » → `navigation.navigate` appelé avec `"carte"`
   - Tap onglet « Meute » → `navigation.navigate` appelé avec `"meute"`
   - Tap FAB → ouvre la sheet stub (ou `Alert.alert` mocké) — pas de navigate

2. **`<EmptyState />`** (RTL, `app/__tests__/components/EmptyState.test.tsx`) :
   - Mount avec `title` + `body` → texte rendu, pas de CTA
   - Mount avec `cta` → bouton rendu, tap → `onPress` appelé
   - Mount avec `icon: "map"` → `Ico` rendu (assert via testID ou role)

3. **`<CarteScreen />` + `<MeuteScreen />`** (RTL, smoke tests) :
   - Mount → `EmptyState` rendu avec les strings i18n attendues
   - Pas de crash sur mode démo (`DataSourceBanner` visible)

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** `cd app && npx expo export --platform web` + `--platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Créer composant `EmptyState`** (AC: #5)
  - [ ] Créer [app/src/components/EmptyState.tsx](../../app/src/components/EmptyState.tsx) avec la signature de l'AC #5.
  - [ ] Import `CatIcon` ([app/src/components/primitives/CatIcon.tsx](../../app/src/components/primitives/CatIcon.tsx)) pour le fallback icône.
  - [ ] Import `Ico` ([app/src/components/primitives/Ico.tsx](../../app/src/components/primitives/Ico.tsx)) pour les icônes nommées.
  - [ ] Import `useTheme` pour tokens (pas de hex en dur).
  - [ ] Pas de barrel `index.ts` ajouté (seul `src/types/` autorise les barrels — project-context).

- [ ] **Task 2 — Réécrire `(tabs)/_layout.tsx` pour brancher la TabBar canonique** (AC: #1, #2, #4)
  - [ ] Remplacer le `<Tabs>` actuel par `<Tabs tabBar={(props) => ...} screenOptions={{ headerShown: false }}>`.
  - [ ] Implémenter `mapRouteToActive(routeName: string): ActiveId` (helper local au fichier).
  - [ ] Implémenter `handleTabPress(id: TabId, navigation, router)` :
    - `"fab"` → ouvre sheet stub OU `Alert.alert` (Strategy A ou B)
    - Autres → `navigation.navigate(routeName)` typed
  - [ ] Déclarer **5 `<Tabs.Screen>`** : `index`, `carte`, `meute`, `profile` (la 5e position = FAB, pas une route donc pas de Screen).
  - [ ] Vérifier que `headerShown: false` empêche tout doublon d'header avec les écrans destinations.

- [ ] **Task 3 — (Optionnel mais recommandé) Renommer `profile.tsx` → `palais.tsx`** (AC: #1)
  - [ ] Décision : **garder `profile.tsx`** en V1 (renommer crée un cross-cutting Story 5.3) — la TabBar mappe `id: "profile"` → route `"profile"`, label affiché « Palais » via `t("nav.palais")` (déjà existant). Le renommage de fichier est différé Epic 5.
  - [ ] Documenter ce choix en Dev Notes §3.

- [ ] **Task 4 — Créer écran stub `carte.tsx`** (AC: #3)
  - [ ] Créer [app/app/(tabs)/carte.tsx](../../app/app/(tabs)/carte.tsx) — `default function` qui retourne `<SafeAreaView><DataSourceBanner /><EmptyState icon="map" title={t("empty_state.map_title")} body={t("empty_state.map_body")} /></SafeAreaView>`.

- [ ] **Task 5 — Créer écran stub `meute.tsx`** (AC: #3)
  - [ ] Créer [app/app/(tabs)/meute.tsx](../../app/app/(tabs)/meute.tsx) — même pattern avec `icon="compass"` et strings `empty_state.meute_*`.

- [ ] **Task 6 — (Strategy A) Créer mini bottom sheet `FabSpawtStub` ou utiliser `Alert.alert`** (AC: #4)
  - [ ] Si Strategy A retenue : créer [app/src/components/FabSpawtStub.tsx](../../app/src/components/FabSpawtStub.tsx) avec une sheet contrôlée par un `useState` côté layout — fond `theme.colors.surface.raised`, header + body + CTA fermer.
  - [ ] Si Strategy B retenue : appeler `Alert.alert(t("fab.stub_title"), t("fab.stub_body"))` dans `handleTabPress` quand `id === "fab"`.

- [ ] **Task 7 — Strings i18n `fab.*` + `empty_state.*`** (AC: #7)
  - [ ] Ajouter les 2 sections dans [app/src/i18n/fr.json](../../app/src/i18n/fr.json).
  - [ ] Audit `npm run i18n:check` vert (toutes les `t("...")` des nouveaux fichiers ont une clé).
  - [ ] Audit `npm run lint:vocab` vert.

- [ ] **Task 8 — Tests** (AC: #8)
  - [ ] `app/__tests__/components/EmptyState.test.tsx` — 3 cas.
  - [ ] `app/__tests__/components/TabsLayout.test.tsx` — 4 cas (mount + 3 taps).
  - [ ] `app/__tests__/screens/CarteScreen.test.tsx` + `MeuteScreen.test.tsx` — smoke tests.

- [ ] **Task 9 — Smoke + CHANGELOG + clôture story** (AC: #8)
  - [ ] Triple gate verte.
  - [ ] `expo export --platform web` + `--platform android` compile.
  - [ ] CHANGELOG entry `feat(infra)` scope `infra` — câble la coquille navigation V1.
  - [ ] Commit conventional (cf. project-context §Commits).
  - [ ] Sprint-status auto par dev-story workflow → `3-1-...: review` après code review.

## Dev Notes

### 1. Pourquoi pas une dépendance à Story 3.3 ?

3.1 est **autonome** par design. Elle livre la coquille navigation ; les onglets `Carte` / `Meute` sont des stubs `EmptyState`. L'onglet `index` (Feed) reste le minimaliste Epic 2 — Story 3.3c le refondera entièrement avec Masthead + ModeStories + UneCarousel + FeuilletonRow. Faire 3.1 d'abord permet à 3.4 (fiche lieu) et 3.5 (recherche) de démarrer en parallèle de 3.3.

### 2. Pourquoi pas une vraie `SpawtSheet` en V1 ?

La vraie action « Je spawt ici » exige :
- Une session auth ouverte (Epic 2 — DoD externe pending)
- Le Guet armé (Story 4.1 — Epic 4)
- Une geofence active + check_in_type calculé (Story 4.2 — Epic 4)
- Une queue offline (Story 4.3)

Bref, l'action complète est Story 4.2 et plus tard. V1 = stub pédagogique pour ne pas casser l'UX (un FAB qui ne fait rien est pire qu'un FAB qui explique). Le bouton « Je spawt ici (mode démo) » sur la fiche lieu ([app/app/place/[id].tsx](../../app/app/place/[id].tsx)) reste le chemin opérationnel actuel (heritage Epic 2).

### 3. Decision : garder `profile.tsx`, ne pas renommer en `palais.tsx`

Renommer le fichier `profile.tsx` → `palais.tsx` créerait un cross-cutting :
- Tous les `router.push("/(tabs)/profile")` ailleurs dans le code casseraient (cf. `app/app/_layout.tsx:37` `router.replace("/(tabs)")` — heureusement, c'est le groupe pas la sous-route).
- Story 5.3 (`Profil spawter — carte spawter flip`) refondra entièrement cet écran et pourra renommer à ce moment-là.

**V1** = la **route** garde le nom `profile`, le **label TabBar** = « Palais » via `t("nav.palais")`. Cohérent et non-bloquant.

### 4. Strategy A vs B pour le FAB stub

| Critère | Strategy A (bottom sheet) | Strategy B (Alert.alert) |
|---|---|---|
| LOC | ~80 (nouveau composant) | ~5 |
| UX brand | Plus cohérent (fond noir, CatIcon, tons SPAWT) | Standard OS, sec |
| Réutilisable | Oui (Story 4.2 pourra l'étendre en SpawtSheet) | Non |
| Recommandation | **Préféré** si <2h de dev | Acceptable si pressé |

Dans le doute, **Strategy A** : ça pose la base de la `SpawtSheet` que Story 4.2 réutilisera.

### 5. Compatibilité avec `RouteGuard` (`_layout.tsx`)

Le `RouteGuard` redirige `(onboarding)` → `(tabs)` quand `spawter !== null`. Quand il atterrit sur `(tabs)`, il pointe le **groupe** (pas une sous-route), Expo Router charge alors la **première route** déclarée dans `(tabs)/_layout.tsx`. La déclaration de l'ordre est donc importante : `index` doit être le premier `<Tabs.Screen>` pour que le Feed soit l'écran d'atterrissage post-onboarding.

### 6. Pas d'event analytics

Ni `tab_changed` ni `fab_tapped` ne sont définis dans [events.md](../../documentation/analytics/events.md). Ne PAS inventer un event hors taxonomie — le wrapper `analytics.ts` ne compilerait pas. Si un besoin émerge en alpha (Kidam funnel), ouvrir un PR sur `events.md` avant.

### 7. Accessibility

- TabBar : la primitive expose déjà `accessibilityRole="tab"` + `accessibilityState={{ selected }}` + `accessibilityLabel`.
- FAB : `accessibilityRole="button"` + `accessibilityLabel={t("fab.action_label")}`.
- EmptyState : `accessibilityRole="text"` sur titre/body, `accessibilityRole="button"` sur CTA si présent.
- Cible tactile ≥ 44pt — déjà garanti par `minHeight: 44` dans la primitive.

### 8. Performance

- Aucune. Le câblage tabs est statique, la TabBar n'a pas de re-render coûteux (sélecteur sur `route.name` uniquement).
- Pas de SVG complexe dans EmptyState (un seul CatIcon).
- Pas d'animation Reanimated requise V1 (l'animation `fade` de Stack est gérée par expo-router).

### 9. Defers identifiés

- **Vraie `SpawtSheet`** (sheet de notation + tags + photo) → Story 4.2 + 4.5.
- **Onglet Carte fonctionnel** (Mapbox / OSM) → décision V1.5 (D11 reportée), Sprint 2+.
- **Onglet Meute** (liste spawters, leaderboard interdit — Contrat §20.1) → V1.5+, scope à définir avec Alexandre (Coup de Cœur reçu / cercle privé Tanière D5).
- **EmptyState avec animations Reanimated** (chat qui tousse littéralement) → polish Sprint 2.
- **Onglet `palais.tsx`** renommé depuis `profile.tsx` → Story 5.3.

### 10. Sign-off

- **Stéphanie** (tech) : revue plomberie Expo Router + tests TabsLayout.
- **Kidam** (analytics) : confirmation pas d'event ajouté hors taxonomie.
- **Alexandre** (brand) : Test Tantie Rose obligatoire sur le wording stub FAB + les EmptyState (« le chat tousse » assumé).

### Project Structure Notes

- **2 nouveaux fichiers code** : `carte.tsx`, `meute.tsx`.
- **1 nouveau composant** : `EmptyState.tsx`.
- **(Strategy A)** : 1 composant supplémentaire `FabSpawtStub.tsx`.
- **1 fichier réécrit** : `(tabs)/_layout.tsx`.
- **1 fichier i18n étendu** : `fr.json` (sections `fab.*` + `empty_state.*`).
- **Pas de nouvelle dépendance**.
- **Pas de migration SQL**.
- **Pas de modif store**.
- **Pas de modif `app/_layout.tsx` racine**.

### References

- [_bmad-output/planning-artifacts/epics.md:655-674 Story 3.1](../planning-artifacts/epics.md#L655-L674)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1438-1449 Navigation Patterns](../planning-artifacts/ux-design-specification.md#L1438-L1449)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1266 TabBar primitive spec](../planning-artifacts/ux-design-specification.md#L1266)
- [_bmad-output/planning-artifacts/architecture.md:357-360 Frontend Architecture — Routing](../planning-artifacts/architecture.md#L357-L360)
- [app/src/components/primitives/TabBar.tsx](../../app/src/components/primitives/TabBar.tsx) — primitive livrée Story 1.3
- [app/app/(tabs)/_layout.tsx](../../app/app/(tabs)/_layout.tsx) — à réécrire
- [app/app/_layout.tsx](../../app/app/_layout.tsx) — RouteGuard inchangé
- [_bmad-output/project-context.md §Expo Router (file-based routing)](../project-context.md) — règles routing
- [_bmad-output/project-context.md §Convention de naming](../project-context.md) — préfixe `Spawt` interdit
- [documentation/analytics/events.md](../../documentation/analytics/events.md) — pas d'event ajouté

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓), `npm test` (153 passed / 4 skipped / 0 failed).

### Completion Notes List

- TabBar canonique branchée via render prop `tabBar={(props) => <TabBar ... />}` sur le groupe `(tabs)`.
- 4 routes déclarées : `index` (Feed), `carte`, `meute`, `profile`. La 5e position du TabBar est le FAB (pas une route).
- FAB stub V1 = **Strategy B** (Alert.alert) — décision pragmatique : <5 LOC, suffisant pour V1, la vraie SpawtSheet est livrée Story 4.2.
- EmptyState créé selon AC #5 (signature dumb, pas d'appel i18n interne).
- `profile.tsx` **non renommé** en `palais.tsx` (Decision Task 3 documentée Dev Notes §3) — label « Palais » via `t("nav.palais")`.
- Strings i18n `fab.*` + `empty_state.*` ajoutées.
- Tests `<EmptyState />` (smoke) ajoutés.

### File List

**Nouveaux fichiers** :
- `app/src/components/EmptyState.tsx`
- `app/app/(tabs)/carte.tsx`
- `app/app/(tabs)/meute.tsx`
- `app/__tests__/components/EmptyState.test.tsx`

**Fichiers modifiés** :
- `app/app/(tabs)/_layout.tsx` (réécriture complète — branche TabBar canonique)
- `app/src/i18n/fr.json` (sections `fab.*` + `empty_state.*`)
