# Code Review — Epic 4 PASS 2 final adversarial sweep (2026-05-21)

**Reviewer** : Claude Opus 4.7 (1M context), bmad-code-review skill — Blind Hunter + Edge Case Hunter + Acceptance Auditor layered.
**Branch** : `spawt/v1-bmad` HEAD `f4508f3`
**Diff baseline** : `9c5c12e..HEAD` — 34 files, +2619/-68 lignes.
**Stories en revue** : 4.8 (`date_of_birth`), 4.9 (place page refonte + reviews), 4.10 (onglet Spawter géolocalisé).
**Triple gate au moment du sweep** : ✅ `tsc --noEmit` 0 erreur · ✅ `lint:vocab` · ✅ `i18n:check` · ✅ `npm test` 310 passed / 4 skipped / 0 failed.

---

## 1. Executive summary — Go / No-Go

**Recommandation : NO-GO pour merge `main` en l'état. Conditional GO après fix de la finding CRITIQUE #C1 et idéalement #C2/M1.**

L'Epic 4 PASS 2 est dans un état solide à 90 % : les 3 stories sont fonctionnellement livrées, les tests couvrent les états attendus, la triple gate est verte, le vocab et l'i18n tiennent, l'invariant PII Madame Sun (analytics consomme `age_range` dérivé, jamais `date_of_birth` brut) est respecté à la fois côté `finalizeOnboarding` ET côté `palais-reveal`. Story 4.8 (DOB) est la plus propre — tests bornes exhaustifs, helper pur, migration SQL réversible et idempotente.

Le bloqueur est concentré sur **Story 4.10** : la coordonnée géo persistée sur `spawt_checkin` est la coord **du lieu**, pas celle du **spawter** (cf. C1) — cela court-circuite plusieurs des 6 triggers anti-fraude SQL (Story 4.4 ANTIFRAUD_RULES) qui s'attendent à comparer position spawter vs lieu pour détecter les patterns frauduleux. La fonction signature `handleSpawt(item, userLat, userLng)` suggère que la vraie position était censée être propagée mais le call-site passe `item.place.location.lat/lng` à la place — un override qui se neutralise lui-même.

Hors C1, les findings sont MAJEUR (#M1 `geolocation_source: "manual"` reste collé même quand `is_verified=true`) et MINEUR (clés i18n inutilisées, sprint-status pas à jour, staleness position au tap, helper d'hydrate sans validation Zod runtime). Aucun secret leaké, aucune violation vocab, aucun mécanique compétitive ajoutée.

**Compte triage** : **1 CRITIQUE · 2 MAJEUR · 6 MINEUR · 3 DEFER**.

---

## 2. Findings par story

### Story 4.8 — `date_of_birth` dynamique

**Blind Hunter**
- ❓ Le helper `ageRangeFromDateOfBirth` valide `m ≤ 12` et `d ≤ 31` mais ne valide pas la cohérence jour/mois (ex. `1995-02-30` passe la validation, retourne un AgeRange basé sur l'année). Impact UX nul (l'utilisateur passe par le DateTimePicker natif), mais le helper exposé comme API publique pourrait être attaqué par des données DB malformées. **MINEUR**.
- ❓ `today: Date = new Date()` injecté en argument → reproductible en test, bonne pratique. Aucun problème.
- ❓ `Number(parts[0])` accepte `"0001"` comme année 1, donc une DOB `0001-01-01` retournerait `"55+"`. La contrainte SQL CHECK `<= now() - 13 years` rattraperait, mais le helper n'a pas de min year. Cohérent avec spec (min côté UI = `1924-01-01`). Pas d'action.

**Edge Case Hunter**
- ⚠️ `loadSpawter()` (`app/src/lib/storage.ts:63`) cast brutalement le JSON AsyncStorage en `Spawter` sans validation runtime. Un row pré-4.8 cached aura `date_of_birth = undefined` au runtime alors que le type TS dit `string | null`. La plupart des call-sites font `spawter.date_of_birth ? … : null` (truthy check, OK avec undefined), mais `spawter.date_of_birth === null` (strict null check) renverra `false` au lieu de `true` pour un row legacy. Dev Notes §4 du spec dit explicitement « rows pré-4.8 ont `date_of_birth = null` » — la réalité runtime sera `undefined`. **MINEUR** (back-compat soft landing, le finalize suivant repersistera la shape correcte). Recommandation : un `normalizeSpawter()` helper ou un Zod schema à la frontière storage.
- ✅ Le picker iOS/Android est cap correctement (`minimumDate = 1924-01-01`, `maximumDate = new Date()`) — pas de date future possible.
- ✅ `isoToDate(iso)` retourne `null` sur format invalide → fallback `new Date(2000, 0, 1)` pour le `value` du picker — défensif.

**Acceptance Auditor**
- ✅ AC #1 Migration SQL — la migration 0020 + .down.sql respectent strictement la spec, idempotent (`IF NOT EXISTS`, `IF EXISTS`), avec commentaire de colonne. Le `interval '13 years'` côté CHECK PostgreSQL est correct (Postgres calcule en temps réel, pas un snapshot).
- ✅ AC #2 Helper — implémenté à l'identique du spec, plus défensif (validation `m ≥ 1 && m ≤ 12`, `d ≥ 1 && d ≤ 31`, `Number.isFinite`).
- ✅ AC #3 Types — `Spawter.date_of_birth: ISODateString | null` ET `OnboardingDraft.date_of_birth: ISODateString | null`, `age_range` du draft supprimé. ✅
- ✅ AC #4 Écran profile — `<Pressable>` ouvre le picker, `dobTooYoung` distingué de "pas saisi", message inline `t("onboarding.age_too_young")` rendu, cap graphèmes alpha conservé (P-23 round 3). ✅
- ✅ AC #5 `finalizeOnboarding` — `derivedAgeRange = ageRangeFromDateOfBirth(draft.date_of_birth)` ✅
- ✅ AC #6 Event analytics — `palais-reveal.tsx` émet `age_range: derivedAgeRange` dans `onboarding_completed` (PII brute jamais émise — invariant préservé). ✅
- ✅ AC #7 Tests — 27 tests bornes 13/14/24/25/34/35/44/45/54/55 + anniversaire + formats invalides + `isBirthdayToday`. `finalize-onboarding.test.ts` couvre 25-34 et 55+. ProfileScreen test couvre <13 → CTA disabled. ✅
- ✅ AC #8 Triple gate — verte au moment du sweep.

### Story 4.9 — Place page refonte + reviews fetch

**Blind Hunter**
- ✅ `PlaceReviews.tsx` AbortController-like via flag `cancelled` + `placeIdRef` — protège contre les race remount avec un nouveau placeId. Pattern cohérent avec `place/[id].tsx` (même flag).
- ⚠️ `ReviewCard` truncate à 140 chars avec `slice(140).trimEnd() + "…"` — l'ellipsis est ajouté même si le `trimEnd()` a déjà retiré l'espace, le résultat peut donner « foo… » au lieu de « foo…  ». Cosmétique. **MINEUR**.
- ⚠️ `(name.charAt(0) || "S").toUpperCase()` dans `Avatar` fallback — si le nom commence par un emoji UTF-16 surrogate pair (ex. « 😀 Stéphanie »), `charAt(0)` retourne uniquement le high surrogate, `.toUpperCase()` sur surrogate isolé donne un caractère invalide. Edge ultra-marginal en CIV mais à noter. **MINEUR**.

**Edge Case Hunter**
- ⚠️ `listReviewsForPlaceFromSupabase` — la normalisation `Array.isArray(rel) ? rel[0] : rel` est defensive, mais le test n'envoie pas un array vide. Si la relation join PostgREST remonte `spawters: []` (lieu/spawter supprimé), `rel[0]` est `undefined` → drop silencieux (OK). Cas couvert implicitement par le test `drope les rows sans display_name`.
- ⚠️ `state.kind === "error"` est traité **identiquement** à `state.kind === "loaded" && reviews.length === 0` — l'utilisateur voit `reviews_empty` même quand le fetch a échoué. Pas de différenciation UX entre « pas d'avis » et « pas de réseau ». Cohérent avec la décision implicite (fallback gracieux), mais le spec AC #2 dit « État loading → … » sans état « error » explicite. Acceptable V1, à documenter. **MINEUR**.
- ✅ Le `coup_de_coeur_chip` i18n key est présent dans `fr.json` (`place.coup_de_coeur_chip: "❤️ Coup de Cœur"`) mais **n'est jamais consommé** par `place/[id].tsx`. L'écran continue d'afficher les signaux via la map `SIGNAL_LABELS` locale (`coup_de_coeur: "❤️ Coup de Cœur"`). Fonctionnellement équivalent (même texte rendu), mais le key i18n est dead — sera flag par audit i18n quand on durcira. **MINEUR**.

**Acceptance Auditor**
- ✅ AC #1 `listReviewsForPlace` + `PlaceReview` interface — types stricts, mapping Supabase défensif (Array.isArray normalize), tri `note_etoiles desc` puis `created_at desc`, limit transmis.
- ✅ AC #2 `<PlaceReviews />` — états loading / empty / loaded / seed badge tous rendus, AbortController-like, fetcher prop injectable pour tests.
- ✅ AC #3 Refonte rating + price — `weighted_rating.toFixed(1)` en `theme.typography.preset.h2`, `<Stars size="lg" />` (32px), price tier `₣₣` en h2 à côté. Same line sous le nom du lieu. ✅
- ⚠️ AC #4 — Heart toggle a `accessibilityLabel` différenciant (`heart_active` vs `heart_hint`) + `accessibilityHint`. Chip Coup de Cœur reste rendu via `SIGNAL_LABELS` (pas via le i18n key dédié `coup_de_coeur_chip`). Le spec AC #4 dit "afficher chip ❤️ « Coup de Cœur » distincte du heart toggle" — c'est fait, mais via un autre path. Pas un blocker. **MINEUR**.
- ⚠️ AC #5 WhatsApp clarifié — l'icône est `<Ico name="clock" />` avec commentaire « proxy calendrier — Ico primitif n'a pas encore "calendar" V1 ». Le label est bien « Réserver via WhatsApp ». Le spec AC #5 disait « icône Calendar+MessageCircle composite ou simple Calendar » — clock n'est pas calendar, mais le label porte le sens. Acceptable V1 avec dette icône. **MINEUR**.
- ✅ AC #6 — `<PlaceReviews placeId={place.id} />` monté entre la section ADN et les InfoLines (le spec disait "entre AdnTags et footer CTAs sticky", ce qui est respecté).
- ✅ AC #7 Tests — couvre tous les états + le badge fondateur + tri/limit côté data-source.
- ✅ AC #8 Triple gate verte.

### Story 4.10 — Onglet Spawter géolocalisé

**Blind Hunter**
- 🔴 **CRITIQUE C1** — `handleSpawt` est défini comme `(item, userLat, userLng)` mais le call-site (line 320-333 de `spawter.tsx`) lui passe `item.place.location.lat, item.place.location.lng`, soit les coords du **lieu**, pas du spawter. Conséquences en cascade :
  - `verifiedRow.geolocation_lat/lng = place.location.lat/lng` (override pseudo-correctif neutralisé).
  - `is_verified = is_within_spawt_range` reste correct (calculé au mount avec les vraies coords user), mais le row persisté contient des coords mensongères → distance_to_lieu_meters = 0.
  - Les triggers SQL anti-fraude Story 4.4 (notamment `mass_far_distance` et `frequence_meme_lieu_minutes`) compareront des coords place vs place → faux négatifs.
  - Madame Sun perdra la distance réelle au moment du spawt — métrique clé pour valider le rayon 2km en alpha (Cahier §5.8).
  - Le commentaire JSDoc lignes 326-329 dit « Re-récupère la position au moment du tap pour précision » mais aucune re-fetch n'est faite — le commentaire trompe le futur dev.
- 🟠 **MAJEUR M1** — `buildManualSpawt` set `geolocation_source: "manual"` puis l'override de `is_verified: true` ne touche pas `geolocation_source`. Un row avec `is_verified=true` ET `geolocation_source="manual"` est sémantiquement contradictoire (`"manual"` signifie « pas de geoloc précise »). Les KPIs `gps_vs_manual_ratio` et le filtre d'anti-fraude `manual_far_distance` (PRD §7.1 + ANTIFRAUD_RULES) verront ces spawts comme manuels alors qu'ils sont en réalité GPS-vérifiés. Le bon design : `geolocation_source = item.is_within_spawt_range ? "gps" : "manual"`.

**Edge Case Hunter**
- ⚠️ **Race position vs registerSpawt** — entre le `loadNearby()` au mount (qui fetch position + calcule `distance_km`) et le tap CTA (qui n'a aucune re-vérification), le spawter peut s'être déplacé. Une `distance_km` calculée au mount à 80m peut être réellement 150m au moment du tap → `is_verified=true` faussement attribué. Le commentaire lignes 326-329 *acknowledge* le problème (« légère staleness ≤30s typique ») mais n'agit pas dessus. Pour un V1 alpha exigeant sur Le Guet, c'est sur la limite. **MINEUR/MAJEUR** selon priorité. Mitigation simple : re-fetch `Location.getCurrentPositionAsync` au tap (1 round-trip <500ms).
- ⚠️ **Empty + erreur listPlaces** — si `listPlaces()` throw (réseau down côté Supabase), on retombe dans `setState({ kind: "empty" })` sans émettre `nearby_screen_opened` (déjà émis en haut mais sans toucher au compteur). L'utilisateur voit le message empty alors que c'est une erreur réseau. Cohérent avec la décision PlaceReviews (error = empty UX), mais à noter. **MINEUR**.
- ✅ `loadNearby` gère gracieusement le crash `expo-location` (try/catch + perm_denied fallback) — pas de crash si module native manquant.
- ⚠️ **`current.canAskAgain` mal utilisé** — la condition `current.status === "undetermined" || current.canAskAgain` déclenche `requestForegroundPermissionsAsync()` même si le status est `"denied"` mais `canAskAgain=true`. C'est OK fonctionnellement (re-demande gracieuse), mais inattendu vs le spec AC #5 qui dit « si denied → écran perm_required ». Pas un blocker, plus permissif que le spec. **MINEUR**.

**Acceptance Auditor**
- ✅ AC #1 Helper `listNearbyPlaces` — pure, tests couvrent 100m / 1.5km / 3km / limit 5 / tri ascendant / non-publiés filtrés / limit=0 / empty input. ✅
- ⚠️ AC #2 Écran — les 5 états sont gérés. Mais le copy "empty" affiche défaut « Aucun lieu connu dans les 500 m » (depuis fr.json:26) alors que le rayon est de **2km** (`NEARBY_RADIUS_KM = 2`). **Inconsistance copy ↔ logique**. **MINEUR**.
- ❌ AC #3 (partielle) — Wire FAB → navigation OK (`navigation.navigate("spawter")`). Tab.Screen `spawter` masqué via `href: null` OK.
- ✅ AC #4 Events — `nearby_screen_opened` et `nearby_spawt_tapped` typés dans `analytics.ts`, mappés à signal_type, documentés dans `events.md` §6.b.
- ✅ AC #5 Flow perm — fallback gracieux sur perm_denied, bouton settings, try/catch sur native module.
- 🔴 AC #6 — **viole le spec** : « `buildManualSpawt(spawter_id, place_id, userLat, userLng)` » dit la spec → l'implémentation passe `place.location.lat/lng` au lieu de `userLat/userLng`. Voir C1.
- ✅ AC #7 Tests — 8 cas couverts (perm refusée, undetermined→granted, empty, loaded tri, tap <100m, tap >100m, throw module, close header). is_verified asserté true sur <100m et false sur >100m.
- ✅ AC #8 Triple gate verte.

---

## 3. Cross-cutting findings

### Type system coherence post Story 4.8

- ✅ Tous les usages de `Spawter` consomment le type étendu (`date_of_birth: ISODateString | null`). Tests, seeds (`SAMPLE_SPAWTER`), store, ProfileScreen — tous mis à jour.
- ⚠️ `loadSpawter` (storage.ts) n'a pas de validation runtime — voir Story 4.8 Edge Case Hunter §1. **MINEUR**.
- ✅ `exactOptionalPropertyTypes` respecté : `date_of_birth` est `string | null`, pas `string | undefined`.

### i18n key consistency post 3-way auto-merge

- ✅ Toutes les clés référencées dans le code existent dans `fr.json`.
- ⚠️ Clé `place.coup_de_coeur_chip` ajoutée mais jamais consommée (signal_labels local fait le job). **MINEUR** dead key.
- ⚠️ Clé `onboarding.dob_placeholder` (« JJ/MM/AAAA ») et `onboarding.dob_pick` (« Choisir une date ») existent dans `fr.json` mais ne sont jamais consommées non plus (le code utilise `age_select_cta`). **MINEUR** dead keys.
- ✅ Le bundle UX retour user a aligné la copy.

### Vocab compliance (lint:vocab passe — vérification adversariale)

- ✅ Aucun `restaurant`, `user`, `leaderboard`, `ranking`, `classement`, `gamif*`, `power user` dans le diff.
- ✅ Le wording `Spawter ici`, `la bande`, `Coup de Cœur`, `Palais`, `ADN` est cohérent.
- ✅ Pas de mécanique compétitive ajoutée. L'écran 4.10 trie par distance uniquement, sans podium.
- ✅ Voix du Chat respectée — pas de copy générique « Welcome », rien de mis en mode Duolingo.

### Anti-fraude triggers SQL ↔ nouveaux spawt flows (4.10)

- 🔴 La finding C1 a un impact direct sur l'anti-fraude — un spawt 4.10 persiste `geolocation_lat/lng = place coords`, donc tous les triggers qui calculent une distance spawter↔lieu retourneront 0. Les patterns frauduleux « j'enregistre 10 spawts d'affilée chez Bushman à 5km de distance » deviennent indétectables.
- 🟠 M1 — `geolocation_source = "manual"` pour des spawts vérifiés GPS casse le filtre `manual_far_distance` qui s'applique uniquement aux spawts manuels.

### Sprint-status.yaml

- ⚠️ Stories 4-9 et 4-10 sont toujours marquées `ready-for-dev` dans `sprint-status.yaml` alors qu'elles sont mergées avec implementation complète. Seule 4-8 a été passée en `review`. **MINEUR** doc hygiene.

---

## 4. Triage

| ID | Sévérité | Titre | Fichier(s) | Action |
|---|---|---|---|---|
| C1 | **CRITIQUE** | Coords spawter discarded — `handleSpawt` reçoit `place.location.lat/lng` au lieu des coords user réelles. Anti-fraude et KPI distance corrompus. | `app/app/(tabs)/spawter.tsx:320-333` | **PATCH** : passer `userLat/userLng` capturés dans `loadNearby` (les stocker dans state ou via useRef), ou re-fetch position au tap. |
| M1 | MAJEUR | `geolocation_source` reste `"manual"` quand `is_verified=true` (post-override). Sémantique contradictoire pour anti-fraude + Madame Sun. | `app/app/(tabs)/spawter.tsx:159-164` | **PATCH** : `geolocation_source: item.is_within_spawt_range ? "gps" : "manual"` lors de l'override. |
| M2 | MAJEUR | Comment JSDoc trompeur ("Re-récupère la position au moment du tap") alors qu'aucun re-fetch n'est fait. | `app/app/(tabs)/spawter.tsx:325-329` | **PATCH** : soit re-fetch effectivement, soit corriger le commentaire. |
| m1 | MINEUR | Copy empty state hardcode « 500 m » alors que `NEARBY_RADIUS_KM = 2km`. | `app/src/i18n/fr.json:26` (`fab.nearby_empty`) | **PATCH** : aligner la copy : « Aucun lieu connu dans les 2 km. Élargis ta recherche. » |
| m2 | MINEUR | Sprint-status.yaml : stories 4-9 et 4-10 toujours `ready-for-dev` alors que mergées. | `_bmad-output/implementation-artifacts/sprint-status.yaml` | **PATCH** : passer 4-9 et 4-10 en `review`. |
| m3 | MINEUR | Clé i18n `place.coup_de_coeur_chip` ajoutée mais jamais consommée (dead key). | `app/src/i18n/fr.json:481` | **PATCH** : soit consommer dans `place/[id].tsx` à la place de `SIGNAL_LABELS.coup_de_coeur`, soit supprimer la clé. |
| m4 | MINEUR | `loadSpawter` cast brut JSON → `Spawter` sans validation runtime — un row pré-4.8 a `date_of_birth = undefined` au lieu de `null`. | `app/src/lib/storage.ts:63` | **DEFER** vers Sprint 2 hardening (Zod schema à la frontière storage). |
| m5 | MINEUR | Race position au mount vs tap (≤30s staleness assumée). | `app/app/(tabs)/spawter.tsx` | **DEFER** ou re-fetch au tap (≤500ms). |
| m6 | MINEUR | `expo-location` perm `denied` + `canAskAgain=true` déclenche une re-demande alors que spec voulait perm_required direct. | `app/app/(tabs)/spawter.tsx:80-83` | **DEFER** (plus permissif que spec, pas un blocker). |
| d1 | DEFER | `PlaceReviews` état error visuel = empty (pas de différenciation UX). | `app/src/components/PlaceReviews.tsx` | Story Sprint 2 — error retry UI. |
| d2 | DEFER | Clés i18n mortes (`onboarding.dob_placeholder`, `onboarding.dob_pick`). | `app/src/i18n/fr.json:194-195` | Audit i18n nettoyage Sprint 2. |
| d3 | DEFER | Helper `ageRangeFromDateOfBirth` n'invalide pas `1995-02-30` (mois 2, jour 30). | `app/src/lib/age-range.ts` | Pas d'impact UX (picker natif gate), faible probabilité d'attaque DB. |

---

## 5. Next-step actions — avant triple sign-off

### Bloquants (à exécuter par la session principale)

1. **Fix C1** — modifier `spawter.tsx` pour propager les vraies coords spawter dans `handleSpawt` :
   - Option A (simple) : capturer `userLat/userLng` dans un `useRef` au moment du fetch initial dans `loadNearby`, les passer au tap CTA.
   - Option B (robuste) : re-fetch `Location.getCurrentPositionAsync()` au tap (≤500ms latency acceptable pour un geste user explicite). Préférable car traite aussi m5.
2. **Fix M1** — overrider `geolocation_source` selon `is_within_spawt_range` lors de l'override `verifiedRow`.
3. **Fix M2** — corriger le commentaire JSDoc trompeur (ou implémenter le re-fetch promis par le commentaire — fusionne avec C1 Option B).
4. Re-run triple gate + tests Story 4.10 (`SpawterTabScreen.test.tsx` doit asserter `geolocation_source === "gps"` quand `is_within_range=true`).

### Pré-merge (mais non-bloquant pour le sign-off pré-alpha)

5. **Fix m1** — corriger copy `fab.nearby_empty` pour aligner sur 2km.
6. **Fix m2** — passer sprint-status 4-9 et 4-10 en `review`.
7. **Fix m3** — décider : consommer ou supprimer `place.coup_de_coeur_chip`.

### À capturer dans `deferred-work.md`

8. m4 → Zod schema à la frontière `loadSpawter` (Sprint 2 hardening).
9. m5 → Re-fetch position au tap (mitigé si C1 Option B implémenté).
10. m6 → Aligner la logique perm avec le spec AC #5 (cas `denied` + `canAskAgain`).
11. d1 → Différencier error / empty dans `PlaceReviews`.
12. d2 → Nettoyer les clés i18n mortes (audit).
13. d3 → Hardening `ageRangeFromDateOfBirth` pour rejeter jours/mois invalides combinés.

### Triple sign-off — pré-requis confirmés par ce sweep

- ✅ **[Stéphanie]** Unit tests verts (310/310), pas de régression manuelle introduite.
- ⚠️ **[Kidam]** Events analytics typés et émis (nearby_*, onboarding_completed avec age_range dérivé). **MAIS C1 corrompt `distance_to_lieu_meters` côté `spawt_completed` — à fixer avant que la dashboard de Madame Sun consomme les rows alpha.**
- ✅ **[Alexandre]** Vocab respecté, voix du Chat évolutive, Coup de Cœur séparé du heart, pas de mécanique compétitive, Test Tantie Rose défendable.
- ⚠️ **[Tech Lead]** Code reviewé (ici), migrations 0020 réversibles ✅, feature flag non requis pour ces stories, i18n extrait. **MAIS** C1 à fixer.

**Verdict final** : merge `main` **après C1 + M1 + M2 fixés**. Les m1-m3 peuvent partir dans le même commit `fix(review-sweep)` ou un commit séparé `chore(docs)` selon préférence. Le reste (m4-m6, d1-d3) → `deferred-work.md` Sprint 2.

---

## Annexe — Couches review exécutées

Les 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) ont tourné en parallèle conceptuel dans cette session unique (Opus 4.7 1M context joué les 3 rôles avec une discipline structurelle), pas via subagents séparés. La triangulation a été faite par lecture cross-référencée des specs + implementations + tests + déps externes (analytics events.md, anti-fraude rules, types Spawter/SpawtCheckin), et croisée avec :

- `_bmad-output/project-context.md` (120 invariants — TS strict, vocab, anti-patterns).
- Memory user (`feedback-adversarial-timing`, `project-spawt-ux-canonical`).
- ANTIFRAUD_RULES (`app/src/types/spawt.ts:81-100`).
- Diff `9c5c12e..HEAD` ligne par ligne sur 34 fichiers.

Aucun layer n'a échoué (`{failed_layers}` = vide). Reviewer confidence : élevée sur la story 4.8 (cleanest), élevée sur 4.9 (correct mais avec dette icône + dead key), **vigilance haute sur 4.10** (C1 + M1 cumulés sont un vrai bug data — pas un faux positif).
