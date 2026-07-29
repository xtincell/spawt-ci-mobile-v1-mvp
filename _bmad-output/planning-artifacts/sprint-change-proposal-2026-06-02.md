# Sprint Change Proposal v2 — Retour test live APK build-2 (UX batches + release ops)

> **Date** : 2026-06-02 · **Auteur** : correct-course (Moka/Claude) · **Demandeur** : Alexandre
> **Mode** : Batch (proposition complète, validation en un bloc) · **Statut** : à approuver
> **Déclencheur** : test mobile live Alexandre sur APK `build-android-2026-06-01`
> (commit `67851ec`, Supabase **live**, mode démo désactivé) → 7 batches UX + 3 items structurels.
> **Lien amont** : **étend / co-existe** avec
> [`sprint-change-proposal-2026-05-29.md`](./sprint-change-proposal-2026-05-29.md) (proposal v1,
> Batches 0-1, 5 stories — 5.3 / 4.5 / 4.10 / 3.8 / 4.11 — **toujours en attente de dev-story**).
> **Source brute** : [`ux-batches-2026-06-02-input.md`](./ux-batches-2026-06-02-input.md).
>
> **Artefacts de forme contraignants (figés)** :
> - [`documentation/ux/corrections/SPAWT Hi-fi (offline).html`](../../documentation/ux/corrections/SPAWT%20Hi-fi%20(offline).html) — **FORME contraignante**.
> - [`documentation/ux/corrections/README-diagnostic.md`](../../documentation/ux/corrections/README-diagnostic.md) — cause racine du drift.
>
> **Contrainte de la passe** : **aucune modification de code**. Ce document **réaligne les ACs**.
> Le code suit en `create-story` → `dev-story` après approbation. Sweep adversarial **en fin de lot**.

---

## Section 1 — Résumé du problème (Issue Summary)

### 1.1 Contexte de capture

Premier test sur **Supabase réel** (mode démo OFF) du build alpha #2. Les retours sont des
**ajustements de forme/UX par écran** (pas des bugs fonctionnels) + **3 demandes d'outillage release**
(versioning, RELEASES.md testeur, surface in-app du build) pour que les testeurs puissent **citer le
build exact** dans leurs bug reports. Le lot prolonge la logique de la proposal v1 : lier chaque
écran à son écran-cible HTML en ACs testables, plutôt que re-dériver de mémoire.

### 1.2 Périmètre par batch (écrans concernés)

| # | Écran / domaine | Fichier impl | Demande synthétisée |
|---|---|---|---|
| **1** | Profile — commune & pays | [`profile.tsx`](../../app/app/%28onboarding%29/profile.tsx) | « Ta commune » + « Pays de résidence » → **dropdown** (primitive à scaffolder) |
| **2** | Profile — date de naissance | [`profile.tsx`](../../app/app/%28onboarding%29/profile.tsx) | Placeholder `jj/mm/aaaa`, format rempli `jj/mm/aaaa`, hint réécrit + règle tonalité « tu » |
| **3** | Calibration Palais | [`calibration.tsx`](../../app/app/%28onboarding%29/calibration.tsx) | Renommer les 4 cards `taniere_nomade` (concept, pas quartier) |
| **4** | Palais reveal | [`palais-reveal.tsx`](../../app/app/%28onboarding%29/palais-reveal.tsx) | Retirer le radar (→ illustration), retirer le bloc texte noir, remonter le titre |
| **5** | Home (FEED) | [`index.tsx`](../../app/app/%28tabs%29/index.tsx) + [`ModeStories.tsx`](../../app/src/components/ModeStories.tsx) | Label mode « En duo », refonte icônes 5 modes, ChatBubble édito contextuelle |
| **6** | Place fiche | [`place/[id].tsx`](../../app/app/place/%5Bid%5D.tsx) | CTA « Localisation » + carte, « Spawt le ! », horaires par jour, galerie ≥3, « Voir tous les avis » |
| **7** | SpawterCard (RE-CONFIRM) | [`SpawterCard.tsx`](../../app/src/components/SpawterCard.tsx) | « Spawts uniques » — **déjà** couvert v1 §4.1 Story 5.3, re-confirmé live |
| **S1-S3** | Release ops | infra / `profile.tsx` | Schéma versioning + `RELEASES.md` + `BuildBadge` in-app |

### 1.3 Corrections d'hypothèses de l'input (vérifiées contre le code — **importantes**)

La passe a vérifié l'input brut contre l'implémentation réelle. **Trois hypothèses de l'input sont
fausses** et sont corrigées ici — elles changent significativement le périmètre :

| Hypothèse input | Réalité vérifiée | Conséquence |
|---|---|---|
| Migrations `0024_opening_hours_jsonb` + `0025_gallery_photos` à créer ; `opening_hours` « probablement texte simple ou nul » | [`0010_create_places_place_adn.sql:26,30`](../../supabase/migrations/0010_create_places_place_adn.sql#L26-L30) : **`hours JSONB`** (`Record<DayOfWeek, OpeningSlot[]>`, [`place.ts:98`](../../app/src/types/place.ts#L98)) **et** **`gallery_urls TEXT[]`** existent **déjà**, schéma zod + seeds + admin CRUD inclus. | **ZÉRO migration** pour ce lot. Batch 6.4/6.5 = **pur rendu front-end** (les colonnes existent, l'admin les édite déjà). Pas de collision avec le `0024` réservé par v1. |
| Mode à renommer = clé interne **`pour_un_date`** | Les vraies `ModeKey` sont **`traine / decouvre / tribu / chic / vite`** ([`ModeStories.tsx:9`](../../app/src/components/ModeStories.tsx#L9), [`index.tsx:46-66`](../../app/app/%28tabs%29/index.tsx#L46-L66)). « Pour une date » est le **label i18n** de la clé **`chic`** ([`fr.json:107`](../../app/src/i18n/fr.json#L107)). `pour_un_date` n'existe pas. | Batch 5.1 = changer **`modes.chic.label`** (i18n) « Pour une date » → « En duo ». Clé interne `chic` **inchangée** V1. |
| Nouvelle story place fiche = « **6.6** » | Epic 6 = **panel admin**. La fiche lieu appartient à **Epic 4** (4.9 PASS 2) / Epic 3 (3.4). | Story **4.12** (suite de 4.9). Story infra release = **nouvel Epic 7 / Story 7.1** (epics actuels s'arrêtent à 6.5). |

---

## Section 2 — Analyse d'impact (Impact Analysis)

### 2.1 Impact Epic

- **Epic 2 (Entrée / onboarding)** : 3 stories à amender (2.4 profile, 2.5 calibration, 2.6 palais-reveal) + cross-ref 4.8 (DOB).
- **Epic 3 (Découverte / Home)** : 1 story à amender (3.3c HomeD : label mode + ChatBubble + icônes) ; coexiste avec 3.8 (v1).
- **Epic 4 (Le Spawt / fiche lieu)** : 2 stories à amender (3.4 / 4.9 copy & CTA) + **1 story nouvelle (4.12)**.
- **Epic 5 (Identité)** : re-confirmation priorité 5.3 (déjà amendée v1) — **aucun nouveau changement**.
- **Epic 7 (NOUVEAU — Release ops & versioning)** : **1 story nouvelle (7.1)**.

### 2.2 Impact Stories

| Story | Statut actuel | Action | Nature |
|---|---|---|---|
| **2.4** Profil & PII | review (codée) | Amender ACs : commune+pays **dropdown** ; DOB placeholder/format `jj/mm/aaaa` ; hint + tonalité « tu » | Form + nouveau primitif `Select` |
| **4.8** DOB dynamique | review (codée) | Cross-ref (format d'affichage DOB) | Léger |
| **2.5** Calibration 5Q | review (codée) | Amender AC : renommage 4 cards `taniere_nomade` (concept) + emoji concept | Form + i18n |
| **2.6** Palais initial | review (codée) | Amender ACs : radar → illustration ; retrait bloc texte ; titre remonté | Form |
| **3.3c** HomeD | review (codée) | Amender ACs : `modes.chic.label` « En duo » ; refonte icônes 5 modes ; ChatBubble édito **contextuelle (option B)** | Form + glyphes `Ico` |
| **3.4 / 4.9** Fiche lieu | 4.9 ready-for-dev | Amender ACs copy/CTA : « Localisation », « Spawt le ! » | Léger (copy + CTA) |
| **4.12** Fiche lieu v2 | **nouvelle** | create-story : carte statique + horaires par jour + galerie ≥3 + route « Voir tous les avis » | Front (**0 migration**) |
| **7.1** Release ops | **nouvelle** | create-story : schéma versioning + `RELEASES.md` + `BuildBadge` in-app | Infra + 1 primitif |
| **5.3** Carte spawter | review — **amendée v1** | RE-CONFIRM priorité « Spawts uniques » (déjà v1 §4.1) | **Aucun re-AC** |

### 2.3 Conflits d'artefacts

1. **Décision « radar pour exploitation interne »** (Batch 4.1 rationale user) : *aucune trace* dans
   `_bmad-output/planning-artifacts/` ni en mémoire. Tracée ici comme **nouvelle décision** (retrait
   du radar de la surface utilisateur `palais-reveal`), **pas** un re-rappel d'une décision antérieure.
2. **Radar SpawterCard verso (Story 5.3)** : tranché — **le radar reste sur le verso** (gate Gold),
   retiré **uniquement** de `palais-reveal`. Pas d'amendement à 5.3 AC#5 (cf. décision §4.0.c).
3. **Tonalité « on » vs « tu »** : le copy onboarding mélange les deux. Décision transverse §4.0.b :
   bannir « on », garder « tu » (sweep copy onboarding/Chat).
4. **Vocab « spot »** : inchangé — déjà banni par v1 §4.0 (lint-vocab). Re-confirmé Batch 7. Aucun AC
   ne doit produire « spot ».

### 2.4 Impact technique

- **Migrations SQL** : **AUCUNE** (cf. §1.3 — `hours` et `gallery_urls` existent déjà en JSONB/TEXT[]).
- **Nouveaux primitifs UI à scaffolder** :
  - `Select` / `Dropdown` (absent de `app/src/components/primitives/` — à créer, Story 2.4).
  - 3 glyphes à ajouter à [`Ico.tsx`](../../app/src/components/primitives/Ico.tsx) (`cup`, `users`, `bolt`) pour la refonte icônes modes (Story 3.3c, cf. §4.4).
  - `BuildBadge` (Story 7.1).
- **Nouvelle route Expo Router** : `app/app/place/[id]/reviews.tsx` (Story 4.12, « Voir tous les avis »).
- **Dépendance externe carte** : Static map image (Mapbox Static API **ou** Google Static Maps) — **1 GET image, pas de native dep** (décision §4.5). `react-native-maps` interactif = **defer Sprint 2**.
- **Pas d'impact moteur** (`matching.ts`, `palais-engine.ts`, `ANTIFRAUD_RULES`). Le filtre `applyModeFilter` (clés `chic`, etc.) reste **inchangé** — seul le label visible change.
- **Build metadata** : `Application.nativeBuildVersion` (expo-application) + `EXPO_PUBLIC_BUILD_DATE` packagée au build (Story 7.1).

---

## Section 3 — Approche recommandée (Recommended Approach)

**Chemin retenu : Direct Adjustment** — amender les ACs des stories existantes (2.4, 2.5, 2.6,
3.3c, 3.4/4.9) liées à l'écran-cible HTML, et **créer 2 stories** (4.12 front-end, 7.1 infra). Pas
de rollback (les écrans marchent fonctionnellement, l'écart est de **forme**), pas de réduction de
scope MVP. **Aucune migration** (data model déjà structuré).

**Rationale** :
- Cohérent avec la proposal v1 : la correction passe par des **ACs liés à la maquette**, pas du re-patch.
- Le périmètre data (horaires, galerie) **existe déjà** côté schéma → le travail est du **rendu** et
  du **seeding admin**, ce qui réduit fortement le risque et l'effort vs l'estimation initiale de l'input.

**Effort estimé** (indicatif, dev) :
- 2.4 : **M** (nouveau primitif `Select` + 2 champs + DOB format). 2.5 : **S** (renommage i18n + emoji).
- 2.6 : **S** (retrait radar/bloc + repositionnement titre). 3.3c : **M** (label + 3 glyphes `Ico` + ChatBubble contextuelle option B).
- 3.4/4.9 : **S** (copy/CTA). 4.12 : **M** (static map + rendu horaires/galerie + route reviews — **0 migration**).
- 7.1 : **M** (versioning EAS + RELEASES.md + BuildBadge + backfill 2 entrées).

**Risques** : (1) ChatBubble **option B** (overlay contextuel sur la 1ère une) plus délicate qu'un
bloc simple — mitigé : overlay positionné, pas de lib ; (2) Static map = clé API + quota — mitigé :
1 GET caché, fallback texte adresse conservé ; (3) refonte icônes = 3 glyphes SVG à dessiner main
dans `Ico` — mitigé : set restreint, validation brand Alexandre.

**Timeline** : lot unique, séquencé `create-story → dev-story → code-review`. Sweep adversarial
**en fin de lot** (politique projet — `feedback_adversarial_timing`), pas par story.

**Ordonnancement vs v1** : ce lot v2 est **indépendant** des 5 stories v1 (pas de fichier partagé
critique sauf 5.3 — déjà tranché §4.0.c). Recommandation : livrer v1 (socle testeurs 4.11 d'abord)
**puis** v2, ou en parallèle si deux devs. À l'arbitrage d'Alexandre.

---

## Section 4 — Propositions de changement détaillées (Detailed Change Proposals)

### 4.0 Décisions transverses (figées dans cette passe)

**4.0.a — Vocabulaire** : « spot » banni, toujours « spawt » (re-confirmé Batch 7, déjà gouverné par
v1 §4.0). Aucun AC ne produit « spot ».

**4.0.b — Tonalité « tu » (NOUVELLE règle transverse)** : bannir « **on** » dans le copy
onboarding/Chat, garder « **tu** ». Appliqué d'abord au hint DOB (§4.1) ; **sweep copy** onboarding à
faire en dev (vérifier les strings `onboarding.*` et `home.*` de [`fr.json`](../../app/src/i18n/fr.json)).
La voix du Chat (phrases parlées édito) peut garder un « on » narratif si naturel — au cas par cas.

**4.0.c — Radar Palais (décision tranchée 2026-06-02)** : le radar `AxisRadar` est retiré de la
**surface utilisateur `palais-reveal`** (→ illustration/emoji). Il **reste** sur le **verso de la
SpawterCard** (Story 5.3, gate Gold) et **reste calculé en interne** (exploitation interne). **Pas**
d'amendement à Story 5.3 AC#5.

---

### 4.1 Story 2.4 — Profil : dropdowns commune/pays + DOB `jj/mm/aaaa`

**Section : Acceptance Criteria — AC commune (« Ta commune »)**

**OLD** (impl [`profile.tsx`](../../app/app/%28onboarding%29/profile.tsx) l.216-229) :
```
« Ta commune » est un TextInput libre (placeholder "Cocody, Yopougon, Marcory…").
```
**NEW** :
```
« Ta commune » est un composant Select/Dropdown (NOUVEAU primitif à scaffolder dans
app/src/components/primitives/ — Select n'existe pas encore).
  - Options : liste FIGÉE des communes d'Abidjan + grandes villes CIV (extensible ultérieurement).
  - Le champ `neighborhood` reste un free-text côté store/data model (seule la SAISIE change) —
    permet l'extension future sans migration.
  - Nouveau hint i18n `onboarding.neighborhood_body` = "Pour t'afficher des lieux proches de toi."
```

**Section : AC pays (« Pays de résidence ») — décision Batch 1.2 = OUI dropdown**

**OLD** (impl l.236-247) :
```
Chips horizontaux (Choice component) pour le pays de résidence.
```
**NEW** :
```
« Pays de résidence » devient un Select/Dropdown (même primitif que « Ta commune »,
cohérence visuelle). Options = CountryCode[] existants (inchangés). Comportement de
sélection unique conservé.
```

**Section : AC date de naissance — décision Batch 2.1 = `jj/mm/aaaa` rempli**

**OLD** (impl l.289-361) :
```
Pressable affiche "Choisir ma date" jusqu'à interaction, puis formatDobFr (« 15 mars 1990 »).
```
**NEW** :
```
1. AVANT interaction : placeholder visuel "jj/mm/aaaa" (format numérique).
2. APRÈS sélection : afficher la date au format NUMÉRIQUE REMPLI "jj/mm/aaaa" (ex. "15/03/1990") —
   cohérence avec le placeholder. `formatDobFr` (long FR) n'est plus utilisé pour CE champ
   (peut rester dispo ailleurs si besoin).
3. Hint i18n `onboarding.age_body` réécrit (tonalité « tu », cf. §4.0.b) :
   "Pour te souhaiter Joyeux anniversaire, promis. (Et ça restera secret)"
   (remplace "On te souhaitera ton anniversaire, promis. (Et on garde ça discret.)")
```

**Cross-ref Story 4.8** : le refactor DOB dynamique (4.8) doit rester cohérent — la valeur stockée
(`date_of_birth`) est inchangée, **seul l'affichage** passe en `jj/mm/aaaa`.

**Section : AC i18n + Tests**
```
- i18n : `onboarding.neighborhood_body` (nouveau libellé), `onboarding.age_body` (réécrit).
- Test : Select commune rend la liste figée ; Select pays rend CountryCode[] ; DOB affiche
  "jj/mm/aaaa" avant ET après sélection (format numérique). Aucune occurrence « spot ». tonalité « tu ».
```

---

### 4.2 Story 2.5 — Calibration : renommer les 4 cards `taniere_nomade` (concept)

**Section : Acceptance Criteria — AC cards `taniere_nomade`**

**OLD** (i18n `calibration.q_taniere_nomade.card.*`, [`fr.json`](../../app/src/i18n/fr.json) l.252-258) :
```
maquis_garba = « Maquis garba » · foodtruck_riviera = « Foodtruck Riviera »
resto_chic_plateau = « Restaurant chic Plateau » · brunch_cocody = « Brunch Cocody »
```
**NEW** (retirer le quartier, garder le **concept de cadre**) :
```
| Clé i18n            | Nouveau label       |
|---------------------|---------------------|
| maquis_garba        | « Garbadrome »      |
| foodtruck_riviera   | « Foodtruck »       |
| resto_chic_plateau  | « Restaurant chic » |
| brunch_cocody       | « Brunch »          |

Les CLÉS i18n internes restent inchangées (pas de rename de clé V1). Seuls les LABELS changent.
Le user choisit un TYPE de cadre, pas un lieu précis.
```

**Section : AC emoji — décision Batch 3.1 = GARDER un emoji par concept**
```
Chaque card conserve UN emoji représentatif du CONCEPT (pas du quartier). Mapping proposé
(à valider brand Alexandre — Test Tantie Rose) :
  Garbadrome 🍤 · Foodtruck 🚚 · Restaurant chic 🍷 · Brunch 🥐
L'emoji précède le label. Cohérent avec la forme actuelle (emoji devant).
```

**Section : AC Tests**
```
Les 4 cards rendent les nouveaux labels (sans quartier) + leur emoji. Clés i18n inchangées.
Aucune occurrence « spot ».
```

---

### 4.3 Story 2.6 — Palais reveal : illustration au lieu du radar, titre en haut

**Section : AC structure de l'écran palais-reveal**

**OLD** (impl [`palais-reveal.tsx`](../../app/app/%28onboarding%29/palais-reveal.tsx)) :
```
ChatBubble noire d'en-tête (« Premier coup d'œil sur ton Palais. Encore très flou — c'est normal.
Va spawter, je précise au fur et à mesure. ») AU-DESSUS d'un AxisRadar 5 axes. Titre « Voici ton
palais » en BAS de l'écran.
```
**NEW** :
```
1. RETRAIT du radar AxisRadar de cet écran (décision §4.0.c — surface utilisateur).
   Remplacé par une ILLUSTRATION / emoji brand (suggestion : glyphe ✦ doré déjà utilisé par
   BadgePremierSpawt, OU une mascotte du Chat — choix designer/Alexandre).
   Le radar RESTE calculé en interne + RESTE sur le verso SpawterCard (5.3) — non régressé.
2. RETRAIT du bloc texte noir d'en-tête (ChatBubble « Premier coup d'œil… »).
3. Titre « Voici ton palais » REMONTÉ EN TÊTE DE PAGE (décision Batch 4.3), au-dessus de
   l'illustration. Hiérarchie : Titre → Illustration → (CTA continuer).
```

**Section : AC Tests**
```
palais-reveal ne rend PLUS d'AxisRadar ni le bloc texte d'en-tête. Le titre « Voici ton palais »
est le premier élément. L'illustration/emoji est présente. SpawterCard verso (5.3) inchangée.
```

---

### 4.4 Story 3.3c — HomeD : label « En duo », icônes modes, ChatBubble contextuelle

**Section : AC label du mode `chic`** (correction d'hypothèse §1.3)

**OLD** (i18n [`fr.json:107`](../../app/src/i18n/fr.json#L107)) :
```
"modes": { "chic": { "label": "Pour une date", "sub": "Soir spécial" } }
```
**NEW** :
```
"modes": { "chic": { "label": "En duo", "sub": "Soir spécial" } }
La clé interne ModeKey `chic` et `applyModeFilter` (index.tsx) restent INCHANGÉES (defer rename
interne Sprint 2). Seul le label visible « Pour une date » → « En duo ».
```

**Section : AC refonte des icônes des 5 modes** (décision Batch 5.2 = **agent UX propose un set**)

Set proposé par l'agent UX (Sally), à valider brand Alexandre. Contrainte : `Ico` est un primitif
SVG à set restreint ([`Ico.tsx:9`](../../app/src/components/primitives/Ico.tsx#L9)) — 3 glyphes à
ajouter, 1 re-map, 1 inchangé :

```
| Mode (clé) | Label     | Icône actuelle | Icône proposée | Action                       |
|------------|-----------|----------------|----------------|------------------------------|
| traine     | Chiller   | walk           | cup            | + AJOUTER glyphe `cup` à Ico |
| decouvre   | Découvrir | compass        | compass        | inchangé (déjà parlante)     |
| tribu      | En groupe | user           | users          | + AJOUTER glyphe `users`     |
| chic       | En duo    | crown          | heart          | re-map (heart existe déjà)   |
| vite       | Vite fait | clock          | bolt           | + AJOUTER glyphe `bolt`      |

Rationale : heart = duo/romantique (En duo) ; users = groupe pluriel (vs user singulier) ;
bolt = rapidité (vs horloge ambiguë) ; cup = détente/chiller. Les 3 nouveaux glyphes sont des
Path SVG hand-drawn (cohérents avec le style trait 1.6 de Ico). Validation finale Alexandre.
```

**Section : AC ChatBubble édito Home** (décision Batch 5.3 = **option B contextuelle**)

**OLD** (impl [`index.tsx`](../../app/app/%28tabs%29/index.tsx)) :
```
ChatBubble noire APRÈS le UneCarousel (top 3), texte « Aujourd'hui je te propose 3 spawts à ton
goût. Trie ton choix. »
```
**NEW** :
```
La ChatBubble édito devient une BULLE CONTEXTUELLE (option B) attachée à la 1ère « une » du
UneCarousel : overlay micro-bubble / tooltip positionné sur la première carte, plutôt qu'un bloc
séparé après le carousel. Le texte (voix du Chat) reste une phrase parlée (exemptée de la règle
mot/verbe). Forme à vérifier contre l'écran HomeD du HTML-cible pendant la dev.
Note : option B plus impactante UX, plus délicate à positionner — overlay sans lib, pas de FlatList
externe.
```

**Cross-ref Story 3.8 (v1)** : 3.8 (feuilleton numéroté + bulles mot/verbe) **coexiste**. La
ChatBubble édito contextuelle de cette AC est la **même** bulle « voix du Chat » exemptée par 3.8 AC#2.
Pas de double composant ; 3.8 et 3.3c-v2 touchent le même écran → **livrer ensemble** pour éviter les
conflits de merge sur `index.tsx`.

---

### 4.5 Story 3.4 / 4.9 — Fiche lieu : CTA « Localisation » & « Spawt le ! »

**Section : AC CTA secondaire** (Batch 6.1)

**OLD** (impl [`place/[id].tsx`](../../app/app/place/%5Bid%5D.tsx)) :
```
Pressable icône `walk` + label « Appeler » (incohérent : icône marche + label téléphone).
```
**NEW** :
```
Label « Localisation » + icône carte/pin (`pin` ou `map` de Ico). Action = ouvrir la carte
(deeplink natif `geo:` / `maps:`) OU scroll vers la section carte (Story 4.12 §4.6).
Le contact téléphone reste accessible plus bas dans le bloc Adresse/Téléphone (déjà tappable, `tel:`)
— le user a noté le doublon « il y a déjà le contact plus bas pour appeler ».
```

**Section : AC CTA principal** (Batch 6.3)
```
Le CTA principal « Spawter ici » devient « Spawt le ! » (clé i18n place à grepper — `place.spawt_cta`
ou équivalent). Espace avant « ! » selon convention typo FR.
```

**Section : AC i18n + Tests**
```
- i18n : libellé CTA secondaire « Localisation » ; CTA principal « Spawt le ! ».
- Test : le CTA secondaire affiche « Localisation » + icône carte (plus « Appeler » + walk) ;
  CTA principal = « Spawt le ! ». Aucune occurrence « spot ».
```

---

### 4.6 Story 4.12 (NOUVELLE) — Fiche lieu v2 : carte + horaires par jour + galerie + tous les avis

**Justification** : Batches 6.2, 6.4, 6.5, 6.6 — structurels sur la fiche lieu, suite de 4.9.
**Périmètre data** : **AUCUNE migration** — `hours JSONB` et `gallery_urls TEXT[]` existent déjà
(§1.3). Story = **rendu front-end + 1 route + seeding admin**.

**AC #1 — Carte de localisation (static map image)** (décision Batch 6.2 = **static**)
```
Sous l'adresse texte, embed une CARTE STATIQUE (image) centrée sur place.location (lat/lng) :
  - Static map image (Mapbox Static API OU Google Static Maps) — 1 GET image, PAS de native dep.
  - Tappable → deeplink natif `geo:`/`maps:` (cohérent avec le CTA « Localisation » §4.5).
  - Fallback : si pas de coords / pas de réseau → l'adresse texte seule (déjà présente) reste affichée.
  - react-native-maps interactif = DEFER Sprint 2 (noté, hors périmètre).
  - Clé API via EXPO_PUBLIC_* (pas de secret en clair). Quota à surveiller.
```

**AC #2 — Horaires par jour (rendu du JSONB existant)**
```
Given place.hours : Record<DayOfWeek, OpeningSlot[]> (déjà peuplé, [place.ts:98])
When la fiche lieu est rendue
Then afficher les 7 jours (Lun→Dim) avec leurs créneaux respectifs (open–close), pas une ligne plate.
  - Jour courant mis en évidence (le code lit déjà Date.getDay(), [place/[id].tsx:242]).
  - Jour fermé (slot vide []) → « Fermé ».
  - AUCUN changement de data model ni de migration (les données existent).
```

**AC #3 — Galerie photos (≥ 3 slots, rendu de `gallery_urls` existant)**
```
Section « Photos » affichant gallery_urls (TEXT[], déjà existant) :
  - Minimum 3 slots ; si gallery_urls < 3 → placeholders (seedables côté admin Story 6.2/6.3).
  - La cover (cover_photo_url) reste le hero ; la galerie est distincte.
  - Storage : réutiliser le bucket place-photos existant (migration 0013) — PAS de nouveau bucket.
  - AUCUNE migration (gallery_urls existe déjà).
```

**AC #4 — Voir tous les avis (nouvelle route)**
```
Given PlaceReviews limite l'affichage à 5 avis (Story 4.9 AC#1)
When count(avis) > 5
Then afficher un lien « Voir tous les avis (N) » naviguant vers une NOUVELLE route
     app/app/place/[id]/reviews.tsx (Expo Router) :
  - Liste défilable de tous les avis du lieu (paginée par offset OU listReviewsForPlace avec limite relâchée).
  - Réutilise le composant d'item d'avis existant (pas de doublon de rendu).
```

**AC #5 — i18n + Tests + vocab**
```
- i18n : libellés « Photos », « Voir tous les avis (N) », jours Lun-Dim, « Fermé ».
- Tests : horaires rendent 7 jours depuis un hours mocké ; galerie rend ≥3 slots/placeholders ;
  lien « Voir tous les avis » apparaît si count>5 et route vers reviews.tsx ; carte statique présente.
- Aucune occurrence « spot ». Strings via fr.json. tsc/lint:vocab/i18n:check/test verts.
```

---

### 4.7 Story 7.1 (NOUVELLE — Epic 7) — Versioning, RELEASES.md & BuildBadge in-app

**Justification** : items structurels S1/S2/S3. Permet aux testeurs de **citer le build exact** en
bug report et trace les APK publiés. **Nouvel Epic 7 « Release ops & versioning »** (les epics
actuels s'arrêtent à 6.5 ; un epic dédié est plus propre qu'un greffon dans Epic 1).

**AC #1 — Schéma de versioning (S1, à acter)**
```
- App version = 1.0.0 (figée jusqu'à beta).
- android.versionCode + ios.buildNumber = entier incrémental N par APK publié.
- Format d'affichage canonique : "v1.0.0 — build N (YYYY-MM-DD)".
- Tag CI = build-android-YYYY-MM-DD-N (N matche versionCode).
- Source de vérité runtime : Application.nativeBuildVersion (expo-application)
  + EXPO_PUBLIC_BUILD_DATE injectée au build.
```

**AC #2 — `RELEASES.md` à la racine repo (S2)**
```
Créer RELEASES.md (DISTINCT de CHANGELOG.md) :
  - CHANGELOG.md = vue dev par sprint/epic (existe déjà, vMAJEURE.SPRINT.ITERATION).
  - RELEASES.md = vue TESTEUR par APK publié.
Format d'une entrée :
  ## v1.0.0 — build N — YYYY-MM-DD
  **APK** : <url eas>  **Tag CI** : build-android-YYYY-MM-DD-N  **Commit** : <sha>
  ### Nouveau / ### Corrigé / ### À tester en priorité / ### Limitations connues

BACKFILL historique obligatoire (2 entrées) :
  - build 1 = build-android-2026-05-28 (commit b92fbf1) — premier APK alpha.
  - build 2 = build-android-2026-06-01 (commit 67851ec) — patch GoogleButton + bascule Supabase live.
```

**AC #3 — Surface in-app du build (S3)**
```
Footer / écran « À propos » affichant "v1.0.0 — build N (date)" pour citation en bug report.
  - Nouveau primitif `BuildBadge` OU section dédiée dans profile.tsx.
  - Source : Application.nativeBuildVersion + EXPO_PUBLIC_BUILD_DATE.
  - Visible et copiable (le testeur doit pouvoir recopier le build exact).
```

**AC #4 — i18n + Tests + gate**
```
- i18n : libellé « À propos », format build.
- Tests : BuildBadge rend "v1.0.0 — build N (date)" depuis des valeurs mockées ;
  RELEASES.md présent avec les 2 entrées backfill. tsc/lint:vocab/i18n:check/test verts.
```

---

### 4.8 Story 5.3 (RE-CONFIRM, pas de re-AC) — « Spawts uniques »

**Action** : Batch 7 re-confirme en live test le retrait de la stat « Spawts uniques » du recto,
**déjà rédigé** en proposal v1 §4.1 (Story 5.3 AC#1/#7/#8). **Aucun nouveau AC.** Note de priorité :

> **Confirmé en live test 2026-06-02** — à livrer dans le prochain dev-story du lot v1. Priorité dev élevée.

---

## Section 5 — Handoff d'implémentation (Implementation Handoff)

### 5.1 Classification du scope

**MODÉRÉ** — réorganisation de backlog (amendements ACs sur 5 stories + 2 stories nouvelles 4.12 /
7.1) + dev. Pas de backend/sécurité (≠ v1 qui touchait 4.11). **Zéro migration.** Story 7.1 touche la
config EAS/CI (versioning) → revue infra légère.

### 5.2 Séquence ordonnée

```
1. AMENDER LES STORIES EXISTANTES (ce doc → fichiers stories)
   - 2.4 (dropdowns commune+pays + DOB jj/mm/aaaa + hint « tu »)
   - 2.5 (renommage cards calibration + emoji concept)
   - 2.6 (radar → illustration + retrait bloc texte + titre en haut)
   - 3.3c (label « En duo » + icônes modes + ChatBubble contextuelle)
   - 3.4 / 4.9 (CTA « Localisation » + « Spawt le ! »)

2. CREATE-STORY (nouvelles)
   - 4.12 — Fiche lieu v2 (static map + horaires/jour + galerie + tous les avis). 0 migration.
   - 7.1  — Release ops (versioning + RELEASES.md + BuildBadge). NOUVEL Epic 7.

3. PRÉ-DEV (primitifs partagés à scaffolder en premier)
   - Primitif `Select`/`Dropdown` (Story 2.4).
   - 3 glyphes `Ico` (`cup`, `users`, `bolt`) (Story 3.3c).
   - Primitif `BuildBadge` (Story 7.1).

4. DEV-STORY (toutes les stories du lot, ACs liés au HTML-cible)
   Ordre suggéré : primitifs → 2.4 → 2.5 → 2.6 → 3.3c (+ coordonner avec 3.8 v1 sur index.tsx)
                   → 3.4/4.9 → 4.12 → 7.1.

5. CODE-REVIEW
   - UN sweep adversarial EN FIN DE LOT (pas par story) → triple sign-off → merge main.
```

### 5.3 Destinataires

- **Developer (dev-story)** : amendements (2.4/2.5/2.6/3.3c/3.4-4.9) + 2 stories nouvelles (4.12, 7.1) + 3 primitifs.
- **Alexandre (brand)** : valider le set d'icônes modes (§4.4), les emoji calibration (§4.2),
  l'illustration palais-reveal (§4.3), les CTA (« Localisation », « Spawt le ! »), tonalité « tu ».
  Test Tantie Rose sur le copy.
- **Infra / CI** : schéma versioning EAS + tag CI build-android-YYYY-MM-DD-N + EXPO_PUBLIC_BUILD_DATE (7.1).
- **Kidam (analytics)** : aucun changement d'events dans ce lot (events feed/mode inchangés).

### 5.4 Critères de succès

- Chaque écran corrigé est **lié à l'écran-cible HTML** en ACs testables (plus de re-dérivation mémoire).
- Dropdowns commune/pays fonctionnels (nouveau primitif `Select`) ; DOB en `jj/mm/aaaa`.
- Cards calibration = concept (sans quartier) ; palais-reveal sans radar (illustration) ; titre en tête.
- Home : label « En duo », icônes refondues, ChatBubble contextuelle ; coordination 3.8 sur `index.tsx`.
- Fiche lieu : carte statique, horaires 7 jours (depuis JSONB existant), galerie ≥3, route « tous les avis ».
- Versioning acté, `RELEASES.md` créé + 2 backfills, `BuildBadge` visible in-app.
- **Zéro migration** ; triple gate verte + sweep adversarial + triple sign-off avant merge.

---

## Annexe — Décisions figées (ne pas re-litiger)

**Décisions de cette passe (2026-06-02)** :
- **Batch 1.2** : pays de résidence → **dropdown** (oui).
- **Batch 2.1** : DOB affiché **`jj/mm/aaaa` rempli** après sélection.
- **Batch 3.1** : **garder un emoji par concept** sur les cards calibration (🍤🚚🍷🥐, à valider).
- **Batch 4.2 / §4.0.c** : radar retiré **uniquement de palais-reveal** ; **reste** sur verso SpawterCard (5.3).
- **Batch 4.3** : titre « Voici ton palais » **remonté en haut** de page.
- **Batch 5.2** : icônes modes — **l'agent UX propose un set** (cup/compass/users/heart/bolt), validation Alexandre.
- **Batch 5.3** : ChatBubble édito Home = **option B (bulle contextuelle)** sur la 1ère une.
- **Batch 6.2** : carte = **static image map** (react-native-maps = defer Sprint 2).
- **§4.0.b** : tonalité « **tu** » (bannir « on ») — sweep copy onboarding/Chat.

**Corrections d'hypothèses input (vérifiées code, §1.3)** :
- `hours JSONB` + `gallery_urls TEXT[]` **existent déjà** → **0 migration** (vs 0024/0025 proposés).
- ModeKey « Pour une date » = clé **`chic`** (pas `pour_un_date`) ; on change le **label i18n**.
- Story place fiche = **4.12** (Epic 4), pas 6.6 ; story infra = **Epic 7 / 7.1**.

**Hérité de v1 (DO NOT re-litigate)** : « spot » banni · HTML = forme, copy = priorité code/PRD ·
5.3/4.5/4.10/3.8/4.11 v1 toujours en attente de dev-story.
