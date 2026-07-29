# Correction des écrans Spawt/Palais — diagnostic & approche

> **But de ce doc** : démarrer un contexte neuf déjà informé. Il explique
> *pourquoi* les écrans ont drifté de la maquette et *comment* corriger sans
> rejouer le patch réactif. Lis-le en entier avant de toucher au code.
>
> **Date** : 2026-05-29 · **Auteur** : handoff post-audit (Moka/Claude) ·
> **Statut** : à compléter avec le HTML des écrans-cibles (voir §5).

---

## 1. Cause racine (prouvée)

Le drift design→implémentation n'est **ni** un PRD bâclé **ni** une négligence
de dev. C'est un **handoff de process** :

- La maquette `documentation/ux/SPAWT Mid-fi v3.html` (+ `midfi-screens-*.jsx`)
  contient les écrans concrets (SpawtSheet, ProfilRadar, bulles…) mais est
  classée **« exploration, pas spec figée »** (`ux-design-specification.md` l.77).
- `ux-design-specification.md` **verrouille le flow** (Le Guet, l.787-824) et
  **réconcilie** 11 drifts kit↔PRD (D1-D11, l.92-104) — mais à la **l.828-829**
  il **reporte explicitement le design écran détaillé** à un *« step
  architecture de l'information / wireframes »*.
- **Ce step n'a jamais tourné** comme artefact contraignant. Donc
  `create-epics-and-stories` puis `dev-story` ont produit des écrans **sans AC
  par écran liés au pixel de la maquette** → re-dérivation de mémoire → drift →
  rattrapage en patchs (bundle retour user, Epic 4 PASS 2).

**Le maillon manquant = un artefact "spec écran" qui lie chaque story UI à son
écran-cible en critères d'acceptation testables.** Ce doc + le HTML commité (§5)
sont cet artefact.

---

## 2. Décision vocab — TRANCHÉE (2026-05-29)

`ux-design-specification.md` D5 avait renommé les favoris en « Mes spots ». Le
code utilise par ailleurs `uniqueSpots` (lieux uniques visités) comme stat. →
Deux « spots » coexistaient = le « spots ET spawts » signalé.

**Décision du fondateur (vaut pour TOUS les écrans, sans exception) :**
- **« spot » est banni de toute surface visible.** On dit **toujours « spawt »**
  (le nom, le verbe *spawter*, l'action). Donc « Mes spots » → **« Mes spawts »**
  (= favoris). Aucun libellé UI ne doit afficher « spot/spots ».
- Le compteur `uniqueSpots` (lieux uniques visités) reste un **moteur interne**
  de progression de stade, **non affiché tel quel**. S'il garde une surface UI,
  elle est libellée « spawts ». À terme, renommer l'identifiant en `uniqueSpawts`
  pour purger « spot » même du code (non visible ≠ prioritaire, mais cohérent).

Cette décision est **figée** : ne plus la re-litiger écran par écran.

---

## 3. Delta par écran (maquette → implémentation actuelle)

| Écran | Source maquette | Fichier impl | Écart constaté |
|---|---|---|---|
| **Palais / carte** | `ProfilRadar` (`midfi-screens-2.jsx:411`) | `app/app/(tabs)/profile.tsx` + `app/src/components/SpawterCard.tsx:171-175` | Card affiche **3 stats spawts/spots/avis** ; la maquette ne surface que « Mes spawts (38) » en quick-link, **pas de stat "spots"**. Retirer `stat_spots` de l'affichage. |
| **Liste « 3 en haut + numérotés »** (feedback #2) | à confirmer — candidat `Listes` (`midfi-screens-5.jsx:333`) | **introuvable dans l'impl** | Élément droppé. **Besoin user** : quel écran ? (bloc Palais / « Mes spawts » / feuilleton Home ?) |
| **Notation post-spawt** | `SpawtSheet` (`midfi-screens-2.jsx:70`) | `app/app/review/[spawt_id].tsx` | Maquette = **bottom-sheet léger** par-dessus la fiche : bulle Chat + note ★ **avec label qualitatif** (« Très bon — on revient ») + tags « **EN UN MOT** » + photo optionnelle + « Spawter ce lieu ». Impl = **modal plein écran** avec **champ texte libre « Ton mot » en plus** → sature. Alléger + label qualitatif + framing « EN UN MOT ». |
| **Flow spawt / bouton spawter** (feedback #4) | §4 « Le Spawt » = **Guet passif** (Notif → Sheet → Célébration) | `app/app/(tabs)/spawter.tsx` + `app/src/lib/nearby-places.ts:18` | Impl (Story 4.10) = **onglet manuel** listant les lieux ≤ **2 km** du GPS réel. Hors zone des seeds Abidjan ou perm refusée → écran « empty »/« perm_denied » → **aucun bouton à taper** = paraît cassé. `handleSpawt` lui-même **fonctionne**. Le parcours manuel n'était pas dans le design. |
| **Titres de bulles** (feedback #3) | bulles du Chat (`CatBubble`) | HomeD / journal / sheet — à confirmer | Doivent être **un seul mot / verbe d'engagement**. **Besoin user** : quel écran porte les bulles à corriger ? |

Décisions kit↔PRD déjà prises (ne pas re-litiger) : **D6** copy « Le Guet » (pas
VTC) · **D7** note **1-5** (pas 4) · **D8** axes Palais canoniques.

---

## 4. Approche propre (anti-patch)

1. **Commit le HTML des écrans-cibles** dans `documentation/ux/corrections/`
   (`SPAWT Hi-fi (offline).html`, versionné — pas un upload jetable). C'est
   l'artefact **de forme contraignant** (layout, hiérarchie, composants).
   ⚠️ **Caveat lecture** : la couche texte éditable du HTML est déjà propre
   (26× « spawt », 0× « spot »), mais les **écrans sont des JPEG rasterisés**
   (manifest base64 l.178). Si une capture affiche encore « spot », c'est du
   **texte cuit dans l'image** — non éditable ici. **Le lire comme « spawt »**
   et ne JAMAIS reporter « spot » dans les ACs ou le code (cf. §2, décision
   figée). Pour le copy, prioriser l'existant code/PRD, pas le pixel de l'image.
2. **Convertir en ACs par écran** (compléter la table §3 avec les critères
   concrets tirés du HTML).
3. **`bmad-correct-course` [CC]** (recommandé) → change proposal qui met à jour
   les ACs des stories 4.5 / 4.10 / 5.3 → puis `dev-story` + `code-review`.
   Alternative légère si périmètre réduit : **`bmad-quick-dev` [QQ]**, mais
   faire écrire les ACs avant de coder.
4. Trancher §2 (vocab « spots ») en premier.

---

## 5. À fournir par le user (pour finir cet artefact)

- [x] **HTML des écrans principaux** → déposé (`SPAWT Hi-fi (offline).html`,
      commité 2026-05-29). Voir caveat rasterisation §4.
- [ ] **Feedback #2** : sur quel écran la liste « 3 en haut non numérotés +
      reste numéroté, toujours 3 » ?
- [ ] **Feedback #3** : quel écran porte les bulles dont les titres doivent
      être un seul mot/verbe ?
- [x] **Décision vocab « spots »** (§2) — TRANCHÉE : « spot » banni, toujours
      « spawt ».

---

## 6. Pointeurs canoniques

- Maquette : `documentation/ux/SPAWT Mid-fi v3.html` + `midfi-screens-2.jsx`
  (SpawtSheet l.70, ProfilRadar l.411) + `midfi-screens-5.jsx` (Listes l.333).
- Spec UX : `_bmad-output/planning-artifacts/ux-design-specification.md`
  (cause l.828 ; décisions D1-D11 l.92).
- Code : `app/app/(tabs)/profile.tsx`, `app/src/components/SpawterCard.tsx`,
  `app/app/(tabs)/spawter.tsx`, `app/app/review/[spawt_id].tsx`,
  `app/src/lib/nearby-places.ts`.
- Brand/tokens canoniques : `documentation/ux/spawt-tokens.css` →
  `app/src/theme/tokens.ts`.
