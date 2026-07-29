# Code Review — Epic 5 (Chunk A)

- **Date** : 2026-05-27
- **Scope** : Commit `f009569` filtré aux fichiers Epic 5 (18 fichiers, 1860 lignes diff)
- **Stories couvertes** : 5.1 / 5.2 / 5.3 / 5.4
- **Reviewers** : 3 layers parallèles (Blind Hunter + Edge Case Hunter + Acceptance Auditor)
- **Findings bruts** : 64 → après dédup : 41 actionnables
- **Triage** : 16 PATCH · 6 DECISION · 11 DEFER · 8 DISMISS
- **Status** : ✅ **CLOSED** — 16/16 patches appliqués, 6/6 decisions résolues (no-tech-debt mode), 11 defers tracés, triple gate VERTE (326 passed / 4 skipped / 0 failed)
- **Decisions résolues** :
  - D1=A — RPC PL/pgSQL atomique `set_displayed_title` via migration 0022
  - D2=A — Vrai gate Gold dans `PalaisRadarGated` : 2 axes bars horizontales (free) vs radar 5 axes complet (Gold)
  - D3=A — Invariant `spawters.id = auth.users.id` vérifié live (11/11 OK), pas de fix nécessaire, documenté
  - D4=B — Sync writer client : `upsertProgression` envoie `current_title = displayed user-choice ?? STADE_TITLE_KEYS[stade]`, RPC server-side miroir aussi via `set_displayed_title`
  - D5=A — Pastille "Titre par défaut" en tête de `CollectionTitlesSection` pour désélection
  - D6=B — Note doc : "rang" UX-DR12 = "stade" déjà rendu (pas de tech debt server-side)
- **Migrations livrées** :
  - `0021_rls_review_visibility_and_staff_helpers.sql` (capture du fix RLS appliqué au matin du 2026-05-27)
  - `0022_spawter_progression_helpers.sql` (CR Chunk A : backfill + RPC + COMMENT)
- **Tests ajoutés** :
  - `app/src/lib/__tests__/titres-catalogue-stade-keys.test.ts` (5 tests M8)
  - `app/__tests__/store/spawter-store-cr-chunk-a.test.ts` (10 tests C1+M7+M8+M3+M2+D4)

---

## 🚨 CRITIQUE (1) — bloquant V1 alpha

### [Review][Patch] C1 — `is_seed` pas filtré dans `unique_spots` ⇒ stades artificiels
- **File** : `app/src/store/spawter-store.ts:413`
- **Source** : edge
- **Detail** : `unique_spots = Set(list.filter((x) => x.is_verified).map(place_id)).size` — les check-ins seed (`is_seed=true`, démo data) avec `is_verified=true` comptent dans `unique_spots`. Un nouveau user en mode démo peut franchir des stades artificiellement, déclencher célébrations, polluer `collection_titres` serveur. **Bypass PRD §4.3 anti-fraude**.
- **Fix** : `filter((x) => x.is_verified && !x.is_seed)`

---

## ⚠️ MAJEUR — PATCH (11)

- [ ] [Review][Patch] M1 — `dev-autologin` import statique sans gate `__DEV__` côté layout root [`app/app/_layout.tsx:439`]
  - L'import est inconditionnel; la fonction interne gate `__DEV__` mais le code et les credentials env vars restent dans le bundle prod. Fix : `if (__DEV__) await import('../src/lib/dev-autologin').then(m => m.maybeDevAutologin())`.
- [ ] [Review][Patch] M2 — `reset()` ne purge pas `spawt:collection_titres` ni `spawt:stade:celebrated:*` ⇒ fuite identité cross-user + célébrations skip au reconnect [`app/src/store/spawter-store.ts:1631-1639`]
- [ ] [Review][Patch] M3 — Anti-replay celebration : `set({ pendingStadeCelebration: null })` AVANT `await AsyncStorage.setItem(STADE_CELEBRATED_KEY)` ⇒ perte du flag si crash entre les deux [`app/src/store/spawter-store.ts:478-489 + 462-474`]
- [ ] [Review][Patch] M4 — Migration 0014 sans backfill `INSERT INTO spawter_progression SELECT id, 0, 'touriste' FROM spawters` ⇒ spawters existants n'ont pas de row, premier UPDATE échoue silencieux [`supabase/migrations/0014_create_progression_collection_titres.sql:1714+`]
- [ ] [Review][Patch] M5 — `SpawterCard` flip 3D : `backfaceVisibility: 'hidden'` no-op sans `transform: perspective(1000)` ⇒ flash binaire à 0.5 au lieu de transition 3D [`app/src/components/SpawterCard.tsx:565,570`]
- [ ] [Review][Patch] M6 — `StadeCelebration` : `useEffect` lance les animations Reanimated AVANT le `early return` du triplet `(visible, from, to)` ⇒ shared values continuent post-unmount [`app/src/components/StadeCelebration.tsx:815-833 + 838`]
- [ ] [Review][Patch] M7 — Spawts concurrents (double-tap) ⇒ 2 célébrations identiques levées car `isStadeCelebrated` n'est pas posé inline mais à `consumePendingStadeCelebration` [`app/src/store/spawter-store.ts:451-465`]. Fix : `Set<Stade>` in-flight guard.
- [ ] [Review][Patch] M8 — `unlockTitle` ne fire que pour le stade-cible ⇒ user qui saute `touriste → detective` (donnée corrompue ou seed) perd le titre `explorateur` intermédiaire ⇒ casse l'invariant "collection = mémoire d'identité" [`app/src/store/spawter-store.ts:1597-1602`]
- [ ] [Review][Patch] M9 — `unlockTitle` no-op si `spawter` null avant fin `hydrate` ⇒ overlay badge Premier Spawt peut s'afficher avant hydratation, le `BADGE_CELEBRATED_KEY` est posé l'instant suivant, badge perdu à jamais [`app/src/store/spawter-store.ts:492-496`]
- [ ] [Review][Patch] M10 — `STADE_UP_MOMENTS[to_stade]` : typage `Record<Exclude<Stade, "touriste">, ...>` mais accès direct sauvé uniquement par ternaire ⇒ cast implicite fragile [`app/src/components/StadeCelebration.tsx:843-844`]
- [ ] [Review][Patch] M11 — Trigger SQL `assert_stade_never_recedes` est `BEFORE UPDATE` uniquement ⇒ bypass-able via DELETE+INSERT [`supabase/migrations/0014_…sql:1760-1764`]. Fix : ajouter `BEFORE INSERT` ou audit log immutable.

## ⚠️ MAJEUR — DECISION (5)

- [ ] [Review][Decision] D1 — `setDisplayedTitre` 2-step non-atomique : step 1 reset `is_displayed=false` peut réussir, step 2 set `is_displayed=true` peut échouer (réseau/RLS) ⇒ état serveur "0 titre affiché" + violation possible de l'index unique partial [`app/src/lib/data-source.supabase.ts:256-274`]. **Choix** :
  - A) RPC PL/pgSQL atomique `set_displayed_title(spawter_id, key)` (propre, demande migration)
  - B) Swap order : set new=true puis clear others (collision unique index pendant ~1ms)
  - C) Retry exponential backoff step 2 (V1 quick, V2 RPC)
  - D) Accepter divergence V1 (logger warn, Sprint 2 = RPC)

- [ ] [Review][Decision] D2 — `PalaisRadarGated` rend TOUJOURS les 5 axes (Gold gate = teaser texte uniquement) ⇒ viole AC PRD §3.1 FR-008 + epics.md L1113 ("2 axes gratuit / 5 Gold") [`app/src/components/SpawterCard.tsx:720-748`]. **Choix** :
  - A) Implémenter le masquage des 3 axes Gold (cohérent PRD, plus de code)
  - B) Acter le drift V1 (Story 5.3 Dev Notes §3 déjà permissif, c'est un Sprint 2 issue)

- [ ] [Review][Decision] D3 — `spawters.id = auth.users.id` invariant non-asserté côté migration 0014 ⇒ si désaligné, toutes les RLS INSERT/UPDATE silencieusement rejetées [`supabase/migrations/0014_…sql:1769-1778, 1850-1858`]. **Choix** :
  - A) Vérifier que Story 2.4 garantit l'invariant + documenter (probable, à confirmer)
  - B) Ajouter `auth_user_id` séparé + adapter RLS (lourd)

- [ ] [Review][Decision] D4 — `current_title` sémantique drift : commentaire SQL dit "actuel/affiché" mais code écrit toujours `STADE_TITLE_KEYS[stade]` (= titre par défaut, pas le `is_displayed`) [`supabase/migrations/0014_…sql:1721` + `spawter-store.ts:1605-1613`]. **Choix** :
  - A) Renommer SQL `current_title` → `stade_default_title_key` + clarifier que l'`affiché` vit dans `collection_titres.is_displayed`
  - B) Sync les deux côté client : `current_title = displayedRow?.title_key ?? STADE_TITLE_KEYS[stade]`

- [ ] [Review][Decision] D5 — `CollectionTitlesSection` : impossible de désélectionner un titre (revenir au défaut du stade) [`app/src/components/profile/CollectionTitlesSection.tsx:1079-1082`]. **Choix** :
  - A) Ajouter "Revenir au titre par défaut" en pastille extra
  - B) Long-press → unset
  - C) Accepter V1 (titre toujours forcé, simple)

## ⚠️ MAJEUR — DEFER (2)

- [x] [Review][Defer] M16 — Pas d'enqueue offline pour `upsertProgression` / `insertTitre` / `setDisplayedTitre` (vs Story 4.3 offline-queue qui protégeait spawts) ⇒ écriture serveur perdue silencieusement en offline complet [`app/src/lib/data-source.ts:123-144`] — **Sprint 2** : router via offline-queue avec dédup PK
- [x] [Review][Defer] M17 — Migration 0014 `.down.sql` fait `DROP TABLE CASCADE` sans backup ⇒ perte irréversible `collection_titres` en cas de rollback prod [`supabase/migrations/0014_…down.sql:7,11`] — **process humain** : rollback prod requiert backup manuel pré-DROP (à inscrire dans runbook DBA)

---

## 🔵 MINEUR — PATCH (4)

- [ ] [Review][Patch] m1 — `SpawterCard` Avatar fallback : `display_name === ""` ⇒ `"".charAt(0)` = `""` ⇒ avatar lettre vide [`app/src/components/SpawterCard.tsx:620`]
- [ ] [Review][Patch] m2 — Reanimated `flipProgress` no cleanup unmount ⇒ warn "writing to shared value of unmounted component" si navigation pendant mid-flip [`app/src/components/SpawterCard.tsx:548`]
- [ ] [Review][Patch] m3 — `StadeCelebration` `haloScale.withSequence` non annulé sur `visible=false` ⇒ override le reset [`app/src/components/StadeCelebration.tsx:821-828`]
- [ ] [Review][Patch] m4 — `STADE_DESCRIPTORS[from_stade]` lookup unsafe si state corrompu ⇒ guard manquant [`app/src/components/StadeCelebration.tsx:840-841`]

## 🔵 MINEUR — DECISION (1)

- [ ] [Review][Decision] D6 — `SpawterCard` ne rend pas "rang" (numéro chronologique d'inscription) — UX-DR12 le mentionne explicitement [`app/src/components/SpawterCard.tsx:593-600`]. **Choix** : A) Ajouter `rang` calculé serveur Sprint 2 / B) Renommer "rang" UX-DR12 en "stade" (ce qui est déjà rendu)

## 🔵 MINEUR — DEFER (9)

- [x] [Review][Defer] m5 — `upsertProgression` sans batching/dedup ⇒ 20 round-trips Supabase en burst
- [x] [Review][Defer] m6 — `makeId()` collision rare (counter module-level + Date.now + Math.random) ⇒ utiliser Crypto.randomUUID strict
- [x] [Review][Defer] m7 — Race upsertProgression vs insertTitre : ordre serveur non garanti (analytics impact)
- [x] [Review][Defer] m8 — `unlockTitle` race interne double append low-probability (index unique serveur catch)
- [x] [Review][Defer] m9 — `pattern-dots-gold` absent du StadeCelebration (D-543 déjà loggué, Sprint 2)
- [x] [Review][Defer] m10 — `SpawterCard` aspectRatio sans width explicite (RN 0.83 OK probable)
- [x] [Review][Defer] m11 — Reanimated useAnimatedStyle ternaire vs interpolate (saut visuel à 0.5)
- [x] [Review][Defer] m14 — `hydrate` Promise.all muet sur partial failures (loadCollectionTitres swallow déjà)
- [x] [Review][Defer] m15 — Tests manquants : pgTAP trigger `assert_stade_never_recedes`, `consumePendingStadeCelebration` idempotence, transition voix Chat 24h
- [x] [Review][Defer] m16 — Test "rejouer même spawt idempotent" ne valide pas duplicat dans `spawts` list (déduplique via Set place_id, OK fonctionnel)

---

## 🗑 DISMISS (8 noise/false positive)

- B11 `chatKey` fragile si i18next `returnNull` (config standard ne le fait pas)
- B13 progress 100% pixel-fragile (cosmétique mineur)
- B16 `spawter-store-stade.test.ts` `setImmediate` (test pattern accepté)
- A11 `StadeCelebration` unique_spots undefined fall-through (early return l'attrape)
- A13 Migration `.down.sql` sans DROP POLICY explicite (CASCADE le fait)
- A14 Test catalogue clés sans validation i18n (audit `npm run i18n:check` le fait globalement)
- A18 `inset: 0` non-standard RN (triple gate `tsc` actuelle est verte, donc OK)
- A5 SpawterCard "citation" — `stadeDesc.behavior` rendu en bas du recto, AC respectée

---

## Failed layers : aucun (3/3 livré)
