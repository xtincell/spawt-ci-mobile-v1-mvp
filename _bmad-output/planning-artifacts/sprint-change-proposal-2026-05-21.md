---
type: sprint-change-proposal
date: 2026-05-21
trigger: retour user mobile test 2026-05-20 (15 points)
scope_classification: Moderate
mode: Batch
status: approved-by-user (autonomous mode)
related_memory: spawt-ux-retour-user-v1, feedback-adversarial-timing, project-spawt-ux-canonical
---

# Sprint Change Proposal — Bundle UX retour user v1 (post-Epic 4 PASS 1)

## 1. Issue Summary

Le 2026-05-20, Alexandre a testé l'APK preview v2 (`https://expo.dev/artifacts/eas/6F27JHYPvnZVu8eFisvQxf.apk`) et a renvoyé **15 points de feedback** UX/produit structurés sur :

- Wording onboarding/CGU/calibration (« Meute » → « Bande », vocab voix du Chat).
- Calibration cards (q_racines_horizons remappées, q_exigeant reorder, q_foule/secret refonte 4 cards).
- Date de naissance dynamique au lieu de tranche d'âge figée (collecte + funnel KPI).
- Place page : rating/grille tarifaire trop petits, bouton WhatsApp ambigu, doublon coeur vs Coup de Cœur, **commentaires spawters en DB mais non affichés**.
- Onglet « Spawter » (FAB) = stub `Alert` alors que GPS est dispo (la fonction principale du produit !).
- Activation Supabase (DB setup mais pas exploitée → corrigé via env vars EAS preview).

**12/15 points sont déjà livrés en working tree non commité** (voir memory `spawt-ux-retour-user-v1` table « Déjà livré »). Reste **3 chantiers structurels** qui touchent type system + schéma DB + nouveaux écrans :

| Point | Chantier | Surface impactée |
|---|---|---|
| 2 | `age_range` → `date_of_birth` (Story 4.8) | Type `Spawter` + migration Supabase + onboarding profile + finalize + analytics |
| 10 | Place page refonte + reviews fetch (Story 4.9) | `place/[id].tsx` + `data-source.ts` + `data-source.supabase.ts` + composant `PlaceReviews` |
| 14 | Onglet Spawter géolocalisé (Story 4.10) | `(tabs)/_layout.tsx` + nouvel écran `(tabs)/spawter.tsx` + `lib/nearby-places.ts` |

## 2. Impact Analysis

### Epic Impact

- **Epic 4 « Le Spawt »** est `in-progress` (7 stories `review`, retro `optional`). Les 3 chantiers restants prolongent Epic 4 sans rouvrir Epic 5/6.
- **Pas de réouverture Epic 2 / Epic 3** : les modifs working tree non-commitées (i18n, ModeStories, calibration-mapping, profile QuickLink) sont des polish dans Epic 2/3 — elles seront commit-ées telles quelles dans le commit de clôture bundle, sans formaliser de nouvelles stories.
- **Epic 4 retrospective** : déplacée de `optional` → `pending` (livrée après les 3 stories).

### Story Impact

- **Aucune story existante ne recule** — pas de rollback.
- **3 nouvelles stories** (4.8 / 4.9 / 4.10) ajoutées à Epic 4 (8 → 10 stories).
- Sprint 1 backlog total : 39 → 42 stories.

### Artifact Conflicts

| Artefact | Conflit | Résolution |
|---|---|---|
| `_bmad-output/planning-artifacts/epics.md` | Epic 4 ne liste que 7 stories | **Append section 4.8/4.9/4.10** à la fin d'Epic 4 dans `epics.md` |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | YAML ne référence que 4.1-4.7 | **Ajouter** `4-8-...`, `4-9-...`, `4-10-...` à `backlog → ready-for-dev` |
| `app/src/types/spawter.ts` (Spawter.age_range) | Story 4.8 le remplace par date_of_birth | Garder helper `ageRangeFromDateOfBirth(date)` pour KPI funnel |
| `documentation/SPAWT_PRD_V1.docx` PRD §3.1 Feature 6 | PRD V1 dit `age_range` collecté | **PRD non muté pour V1** — la collecte évolue, l'output funnel reste identique via helper |

### Technical Impact

- **Migration Supabase 0020** (Story 4.8) : `alter table spawters add column date_of_birth date; alter column age_range drop not null;` + .down.sql. **Aucune perte de données** — `age_range` reste calculable depuis `date_of_birth`.
- **Nouvelle dépendance native** Story 4.8 : `@react-native-community/datetimepicker` → force rebuild EAS final (pas hot-reload OTA-able même avec expo-updates).
- **Nouvelle Edge Function** : aucune. Story 4.9 reviews fetch utilise SDK Supabase RLS public (read seed reviews).
- **OTA hook (expo-updates)** : installé après merge des 3 stories pour ne plus avoir à rebuild à chaque polish JS-only. Channel `preview` ↔ branche `spawt/v1-bmad`.

## 3. Recommended Approach — **Epic 4 PASS 2** (vs stories standalone)

### Décision : Epic 4 PASS 2 — 3 stories formalisées (4.8 / 4.9 / 4.10) dans Epic 4

**Rationale** :

1. **Cohérence narrative** — Les 3 chantiers prolongent directement « Le Spawt » (mécanique cœur Epic 4) : le profil PII (4.8) supporte la confiance des spawters, la fiche lieu enrichie (4.9) est le résultat d'un spawt + avis, l'onglet géolocalisé (4.10) est le **point d'entrée principal** d'un spawt manuel. Les caser dans Epic 5/6 ou dans un mini-Epic 7 forcerait un découpage artificiel.
2. **Adversarial sweep timing** — Conformément à [[feedback-adversarial-timing]], l'adversarial code review reste **à la toute fin** (post-Epic 4 PASS 2 + Epic 5 + Epic 6). On évite de fragmenter en plusieurs sweeps.
3. **EAS rebuild groupé** — Une seule rebuild EAS finale couvre les 3 stories + la dépendance native datetimepicker. Pas de re-build intermédiaire.
4. **Vs stories standalone** : créer un Epic 7 « Polish UX » casse la traçabilité PRD ↔ Epic (PRD V1.0.2 = 6 epics figés Sprint 1).

### Effort estimé

| Story | Effort dev (passe 1) | Effort review |
|---|---|---|
| 4.8 date_of_birth | 1.5h (migration + types + écran + tests) | 30min adversarial |
| 4.9 place refonte | 2h (refonte UI + fetch reviews + tests) | 30min adversarial |
| 4.10 onglet géoloc | 2.5h (écran nouveau + perms + nearby helper + tests) | 30min adversarial |
| **Total** | **6h dev parallélisable** | 1.5h |

Parallélisation cible : **3 worktrees Git parallèles**, conflits potentiels limités à :
- `i18n/fr.json` (4.10 ajoute des clés `fab.*` déjà présentes — confirm no-op)
- `data-source.ts` + `data-source.supabase.ts` (4.9 ajoute `listReviewsForPlace`, 4.10 ajoute `listNearbyPlaces`) — résolution par segment (lignes différentes).
- `app/(tabs)/_layout.tsx` (4.10 modifie FAB handler) — fichier seul touché par 4.10, OK.

### Risk

| Risque | Probabilité | Mitigation |
|---|---|---|
| Migration 0020 casse RLS spawters | Moyenne | Migration additive `add column`, pas de drop ; .down.sql appariée |
| Place reviews fetch lent (N+1 avatars) | Faible | Join `spawt_checkin → spawters(avatar_url, display_name)` en un seul `select` |
| Geoloc perm refusée → écran 4.10 vide | Haute | `nearby_perm_required` i18n + CTA settings, déjà strings en place |
| Conflits merge entre worktrees | Faible | Surface chirurgicale par story, validation post-merge via triple gate |

## 4. Detailed Change Proposals

### 4.1 Nouvelles stories à créer

Voir fichiers dédiés à produire dans le même cycle :

- `_bmad-output/implementation-artifacts/4-8-refactor-date-of-birth-dynamique.md`
- `_bmad-output/implementation-artifacts/4-9-place-page-refonte-reviews-fetch.md`
- `_bmad-output/implementation-artifacts/4-10-onglet-spawter-geolocalise.md`

### 4.2 Mise à jour `epics.md`

```diff
@@ Epic 4 stories @@
 - 4.7 Mise à jour de l'ADN du Lieu
+- 4.8 Refactor date_of_birth dynamique (post-PASS-1 retour user 2026-05-20)
+- 4.9 Place page refonte + reviews fetch (post-PASS-1 retour user 2026-05-20)
+- 4.10 Onglet Spawter géolocalisé (post-PASS-1 retour user 2026-05-20)
```

### 4.3 Mise à jour `sprint-status.yaml`

```diff
@@ epic-4 block @@
   4-7-mise-a-jour-de-l-adn-du-lieu: review
+  4-8-refactor-date-of-birth-dynamique: ready-for-dev
+  4-9-place-page-refonte-reviews-fetch: ready-for-dev
+  4-10-onglet-spawter-geolocalise: ready-for-dev
-  epic-4-retrospective: optional
+  epic-4-retrospective: pending  # livré après PASS 2 terminé
```

### 4.4 Strings i18n — déjà présentes dans `fr.json`

- `onboarding.age_title` = "Ta date de naissance"
- `onboarding.age_body` = "On te souhaitera ton anniversaire, promis. (Et on garde ça discret.)"
- `place.reviews_title` / `place.reviews_empty` / `place.reviews_loading` / `place.reviews_see_all`
- `fab.nearby_*` (title/empty/loading/perm_required/cta_spawt)

**Aucune nouvelle clé i18n** à ajouter pour les 3 stories — les strings sont déjà dans le bundle UX wording (point 1 du retour user, commit pending).

### 4.5 Polish working tree non-commité — à commit séparément

Pré-requis avant lancement worktrees : commit du polish actuel sur `spawt/v1-bmad`.

Fichiers modifiés à commit (`status: M` actuels) :
- `app/src/i18n/fr.json` (wording bundle UX)
- `app/src/lib/calibration-mapping.ts` (q_racines_horizons + q_exigeant reorder)
- `app/src/components/ModeStories.tsx` (display fix maxWidth 72→96)
- `app/app/(tabs)/profile.tsx` (QuickLink "Mes avis")
- `app/src/store/spawter-store.ts` (reviewsCount derivation)
- `app/src/lib/analytics.ts` + `documentation/analytics/events.md` (events si ajoutés)
- `app/app.json` (sanity)

Commit type : `feat(ux): bundle retour user v1 — wording, calibration cards, modes display, profile reviews link`.

## 5. Implementation Handoff

### Scope classification : **Moderate**

- Touche schéma DB + type system Spawter (4.8) → review tech-lead requise.
- Nouvel écran (4.10) → review brand voice (Alexandre).
- Pas de fundamental replan PRD/architecture → pas escalation PM/Architect.

### Routing

| Phase | Agent / Recipient | Deliverable |
|---|---|---|
| Spec | bmad-create-story (auto, dans ce même cycle) | 3 fichiers `.md` story Epic 4 |
| Dev | 3× bmad-dev-story en parallèle (Agent isolation=worktree) | 3 PR-ready branches |
| Merge | Main agent (commit `feat(epic-4-pass-2)` consolidé) | Merge worktrees → `spawt/v1-bmad` |
| Verify | Main agent | `data-source.supabase.ts` mapping audit + triple gate verte |
| Infra | Main agent | `expo-updates` installé + channel preview + runtimeVersion |
| Build | Main agent | `npx eas-cli build --profile preview --platform android` |
| Review | bmad-code-review adversarial (Blind Hunter + Edge Case Hunter + Acceptance Auditor) sur Epic 3-6 + nouveau code | Findings report + triage |

### Success criteria

1. Triple gate verte (`tsc --noEmit` + `lint:vocab` + `i18n:check`) après merge worktrees.
2. Tous tests passants (cible : ~250+ passed/4 skipped/0 failed).
3. APK preview installable + scenarios manuels :
   - Onboarding profile demande date de naissance, joyeux anniv affiché si match.
   - Place page affiche 3-5 reviews seed avec avatar+nom+note+texte.
   - Onglet Spawter (FAB) → écran liste 5 lieux proches + CTA « Spawter ici » fonctionnel.
4. Bmad-code-review adversarial sweep sans dette technique critique.

---

**Approuvé en mode autonome** (user a indiqué `work without stopping for clarifying questions`). Le cycle complet est exécuté dans la foulée.
