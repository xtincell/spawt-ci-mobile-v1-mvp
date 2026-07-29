# Code Review — Epic 6 (Chunk B)

- **Date** : 2026-05-28
- **Scope** : Commit `f009569` filtré aux fichiers Epic 6 (44 fichiers, 3061 lignes diff hors package-lock)
- **Stories couvertes** : 6.1 / 6.2 / 6.3 / 6.4 / 6.5
- **Reviewers** : 3 layers parallèles (Blind Hunter + Edge Case Hunter + Acceptance Auditor)
- **Findings bruts** : ~105 → après dédup : ~50 actionnables
- **Triage** : 6 CRITIQUE · 17 MAJEUR · 16 MINEUR · 11 DEFER (justifiés Sprint 2)
- **Mode** : no-tech-debt — toutes les CRITIQUE/MAJEUR sont patches ou décisions documentées
- **Failed layers** : aucun (3/3 livrés)

---

## 🚨 CRITIQUE (6) — bloquant compliance + sécurité

### C1 — Soft-delete review cassé (CHECK constraint viol)
**Sources** : Blind#6 + Edge#23 + Auditor#1
**File** : `spawt-admin/src/pages/moderation/index.tsx:1734-1738`
**Detail** : `onDelete` UPDATE n'envoie que `{deleted_at, deleted_reason}`. Le CHECK constraint `spawt_checkin_delete_coherence` (migration 0019) exige les 3 colonnes ensemble OU aucune. **Toute action delete est rejetée par Postgres** → audit log écrit (action ghost) mais review jamais supprimée.
**Fix** : ajouter `deleted_by_staff_id: identity.id` côté client + trigger BEFORE UPDATE auto-populate (migration 0023) pour défense en profondeur.

### C2 — `spawters_update_staff` RLS sans gate column-level (escalade)
**Sources** : Blind#14 + Edge#21
**File** : `supabase/migrations/0019_alter_spawters_moderation.sql:3017-3030`
**Detail** : Un `operator` (rôle non-admin) peut UPDATE n'importe quelle colonne de n'importe quel spawter via API REST : `phone_e164`, `stade`, `is_seed`, `total_spawts`. Privilege escalation totale.
**Fix** : migration 0023 — DROP policy + recréer avec WITH CHECK + trigger BEFORE UPDATE qui rejette les colonnes hors whitelist (is_banned, banned_at, banned_reason, warning_count uniquement).

### C3 — `spawt_checkin_soft_delete_staff` RLS sans gate column-level (altération preuves)
**Sources** : Blind#29 + Edge#23
**File** : `supabase/migrations/0019_alter_spawters_moderation.sql:3000-3013`
**Detail** : Un staff peut UPDATE `note_etoiles`, `texte_avis`, `tags` de n'importe quel avis utilisateur via API REST. Modération devient édition arbitraire = altération de preuves.
**Fix** : migration 0023 — trigger BEFORE UPDATE qui rejette si une colonne hors `deleted_at, deleted_by_staff_id, deleted_reason` est modifiée par un staff.

### C4 — `moderate-spawter` audit log mensonger (no error checks)
**Sources** : Blind#1 + Edge#13/#14/#15 + Auditor#2
**File** : `supabase/functions/moderate-spawter/index.ts:2401-2452`
**Detail** : Les `.update().eq()` ne capturent ni `error` ni `count`. Si la policy rejette silencieusement (0 ligne), la fonction renvoie `applied: true` et insère un audit log mensonger. `auth.admin.signOut()` non-vérifié → ban "réussi" peut laisser session active.
**Fix** : Edge Function réécrite avec capture des erreurs + check `data` non-vide + signOut try/catch avec rollback du ban si signOut fail + audit log avant retour 200.

### C5 — `otp-send` `account_banned` format incompatible spec
**Sources** : Auditor#10
**File** : `supabase/functions/otp-send/index.ts:2475`
**Detail** : Spec Story 6.4 AC #7 exige `{error: {code: "ACCOUNT_BANNED", message: "Compte suspendu..."}}`. Diff renvoie `{error: "account_banned"}` string plate. Le mobile (Story 2.3 follow-up) ne peut pas distinguer `code` du `message`. Compliance PRD schéma d'erreur cassé.
**Fix** : changer la réponse en objet `{error: {code, message}}` + i18n key côté mobile pour le message localisé.

### C6 — `App.tsx` sans `<Authenticated>` route guard (bypass UX trivial)
**Sources** : Blind#23 + Edge#37
**File** : `spawt-admin/src/App.tsx:374-417`
**Detail** : Les `<Route>` ne sont pas wrappés dans `<Authenticated>` ou équivalent. Visiter `/lieux` sans login = page chargée puis crash sur queries non-authentifiées. Sidebar + topbar s'affichent sans session.
**Fix** : wrap protected routes dans `<Authenticated fallback={<Navigate to="/login" />}>` de Refine v5.

---

## ⚠️ MAJEUR (17) — patches obligatoires

| # | Source(s) | Surface | Detail | Fix |
|---|---|---|---|---|
| M1 | Blind#2 + Edge#11/#12 | `moderate-spawter` | Pas de Zod input validation. `spawter_id` peut être non-UUID, `action` peut être string arbitraire. | Schema Zod `ModerationRequestSchema` + parse fail-safe. |
| M2 | Edge#3/#4 | `seed-inventory` | Pas de Zod sur body ni sur chaque place. CSV malformé crash 500 ou injecte garbage. | `SeedRequestSchema` + `SeedPlaceSchema` Zod parse. |
| M3 | Blind#3 + Edge#1/#2 | `seed-inventory` | N'importe quel staff actif peut invoquer (= operator/viewer). Spec exige admin-only. | Check `staff.role === 'admin'` au début. |
| M4 | Blind#4 + Edge#5/#6 | `seed-inventory` | `ilike` sans escape `%`/`_` → collision wildcard. `maybeSingle()` jette si 2 matches. | Escape pattern + `limit(1)` ou UNIQUE constraint. |
| M5 | Auditor#4 + Edge#7 | `seed-inventory` | `check_in_type: "active"` au lieu de `"manual"` (viol CHECK enum). Idempotence non filtrée par `seed_spawter_id` (re-seed avec nouveau spawter = no-op). | Corriger les 2 champs. |
| M6 | Auditor#3 | `seed-inventory` | Pas de recompute ADN après insert : `confidence_score` figé à 0.5, `weighted_rating` reste à 0. Mobile voit rating 0 alors que reviews existent. | Recompute serveur `applyReviewToAdn` après chaque batch. |
| M7 | Blind#11 + Edge#8 | `seed-inventory` | Pas de transaction. Partial fail laisse place visible sans ADN. | RPC PL/pgSQL `seed_place_atomic(place, adn, reviews[])` ou rollback explicite. |
| M8 | Edge#48 | `moderate-spawter` | Ban ne soft-delete pas les reviews du banned. Spec implicite + intent FR-017. | Après ban UPDATE : UPDATE spawt_checkin SET deleted_at=now(), deleted_by_staff_id=staff.id, deleted_reason='spawter_banned: <reason>' WHERE spawter_id=X AND deleted_at IS NULL. |
| M9 | Blind#5 + Edge#24/#25 | `spawt-admin/src/lib/audit.ts` | `logAuditAction` swallow l'erreur (console.warn + continue). Action destructive procède sans audit. | Throw au caller au lieu de swallow. Caller décide rollback. |
| M10 | Blind#7 + Edge#29/#30 | `spawt-admin/src/lib/storage.ts` | `uploadPlacePhoto` accepte n'importe quel `file.type` + ext from filename. XSS-via-SVG possible. | Whitelist MIME `image/(jpe?g|png|webp)` + size cap 5MB + ext from MIME. |
| M11 | Blind#8 + Edge#28 + Auditor#7 | `PlaceForm.tsx:748-753` | Upload draft photo `places/draft-<timestamp>/` orpheline si user annule. Storage filled. | Disable cover upload en create mode jusqu'à create OK. |
| M12 | Blind#9/#10 + Edge#26/#27 + Auditor#13 | `PlaceForm.tsx` | createPlaceAdn non-awaited → place sans ADN si fail. Audit log avant commit. | Chain await + check error + audit après. |
| M13 | Blind#20 + Edge#31/#32 + Auditor#9 | `metriques/index.tsx:1552-1566` | Fetch all `spawt_checkin` 30j → OOM à scale. `count:'exact'` expose tot users si key leak. | Server-side RPC `metrics_snapshot()` agrégé. |
| M14 | Auditor#9 | `metriques/index.tsx` | Manque 3 KPI (places_published, avg_weighted_rating, flagged_reviews_total) + chart spawters_30d + bouton actualiser + filter `is_seed=false`. | Ajout des KPI cards + chart + filter. |
| M15 | Edge#16/#17 | `otp-send` | `phone_e164` normalisation mismatch + pas de UNIQUE constraint sur spawters.phone_e164. Banned user avec format different = bypass. | Normaliser dans Edge + ajouter UNIQUE constraint migration 0023. |
| M16 | Auditor#15 | `scripts/setup-seed-spawter.ts` | Script absent. SEED_SPAWTER_ID référencé en Edge mais aucune row → FK violation au premier seed. | Créer le script + documenter dans README. |
| M17 | Edge#48 (signature SDK) | `moderate-spawter:2401` | `supabase.auth.admin.signOut(spawter_id, 'global')` — SDK v2.45 attend `(jwt, scope)`. Si no-op silencieux, JWT reste valide. | Vérifier signature SDK + adapter (admin.signOut prend JWT ou admin API. Si invalide, switch sur `admin.deleteSession` ou flagger côté client `is_banned` check). |

---

## 🔵 MINEUR (16) — patches utiles (no-debt mode)

| # | Source(s) | Surface | Fix |
|---|---|---|---|
| m1 | Blind#18 + Edge#38 | `LoginPage` rate-limit + audit fail | Audit login_failed inclus + back-off 3 attempts. |
| m2 | Blind#19 + Auditor partial | `comptes/show.tsx` unmask phone + bad mask | Apply mask everywhere + show only last 2 digits. |
| m3 | Edge#33 | `metriques` setInterval not visibility-aware | Pause sur document.visibilityState !== 'visible'. |
| m4 | Blind#22 | `ErrorBoundary` leak stack en prod | Hide stack si `import.meta.env.PROD`. |
| m5 | Blind#17 + Edge#39 | `authProvider` no cache | Cache check result 30s in-memory. |
| m6 | Blind#25 + Edge#41 | `scripts/seed-inventory.ts` CSV BOM/CRLF/JSON parse | Strip BOM, try/catch JSON.parse, warn et skip ligne. |
| m7 | Edge#53 | `PlaceForm` dirty wipe on refetch | useRef guard pour ne sync values qu'au mount initial. |
| m8 | Auditor#18 | `index.html` viewport meta drift | Retirer `width=1024` ou aligner avec spec (warning visible si réel viewport < 1024). |
| m9 | Edge#50 | `ReasonModal` regex sémantique | Ajouter `/[a-zA-Z]/` check après trim. |
| m10 | Edge#46 | Audit `ip_address` jamais peuplée | Capturer `x-forwarded-for` en Edge + propager. |
| m11 | Blind#15 (audit visibility) | `admin_audit_log_select_own` policy | Restreindre à staff actif (déjà fait via `is_active=true` dans Edge), patch policy SELECT. |
| m12 | Auditor#8 | Refine `place_adn` resource manquant | Déclarer dans `<Refine resources>`. |
| m13 | Blind#30/#31 | `PlaceFormSchema` lat/lng / hours regex | Borner lat/lng à Abidjan (5.2-5.5 / -4.1 -3.8). Regex heure stricte. |
| m14 | Edge#35/#36 + Auditor#11 | `moderation/index.tsx` alert() + onKeep flood | Disable button on click + replace alert par toast. |
| m15 | Blind#21 | `MetriquesDashboard` re-trigger interval | Combine avec m3 (visibility-aware). |
| m16 | Edge#42 | `seed-inventory.ts` cuisine split | trim + filter Boolean. |

---

## 📋 DEFER (11) — explicitement Sprint 2 avec rationale

| # | Source | Item | Rationale defer |
|---|---|---|---|
| D-CR-B-1 | Auditor#9 partial | Metriques full spec (6 KPI + 3 charts + Sprint 2 hooks isolés) | Spec Story 6.5 dit V1-pragmatique. On livre les KPI/chart manquants critiques (M14), le reste = Sprint 2 dashboard PostHog Madame Sun. |
| D-CR-B-2 | Auditor#12 | LieuxList dropdowns + tri colonnes | UX V1 acceptable (5 staff alpha). Sprint 2 quand catalogue > 50 lieux. |
| D-CR-B-3 | Auditor#14 | `validate-inventory.mjs` script + --dry-run / --force / batching | Alpha staff trust assumed. Sprint 2 = blind seed prod. |
| D-CR-B-4 | Auditor#16 | `PlaceReviewsList` composant dans /lieux/show | Pas dans le critical path V1 (modération via `moderation/` suffit). |
| D-CR-B-5 | Edge#44 | `cuisine` enum strict côté admin | Currently free-text, alpha tolère. Sprint 2 dropdown enum aligné mobile filters. |
| D-CR-B-6 | Blind#27 | CORS handlers OPTIONS Edge Functions | Supabase Functions ajoute auto les headers CORS si runtime config OK. À tester live, fix si reproduit. |
| D-CR-B-7 | Edge#42 | Authentik refine adapter v2 + react-router v7 mismatch | Build vert + dev server tourne. Si runtime route fail = upgrade adapter. Pas observé V1. |
| D-CR-B-8 | Auditor#5 | `review_warning` audit `payload_before` snapshot complet | Ajout possible mais V1 staff peut consulter live via Studio. Sprint 2 = ARTCI deep audit. |
| D-CR-B-9 | Blind#26 | `SEED_SPAWTER_ID`/`STAFF_PASSWORD` env vars script | Géré humainement (1 script, alpha team). Sprint 2 = vault Doppler / 1Password. |
| D-CR-B-10 | Edge#43 | `togglePublish` pre-log intent | Audit après UPDATE est OK V1. Sprint 2 = audit two-phase commit. |
| D-CR-B-11 | Auditor#19 | Vocab user_agent / user dans audit | Acceptable (API native Supabase Auth). Pas drift. |

---

## 🗑 DISMISS (8 noise/false positive)

- Blind#13 `seed-inventory` arrived_at = now() pour tous reviews — démo posture acceptée, déjà documenté
- Blind#16 audit policy SELECT own minor info leak — V1 acceptable
- Blind#26 STAFF_PASSWORD script secrets — couverte par D-CR-B-9
- Blind#28 ErrorBoundary cosmétique (déjà classé m4)
- Edge#9 audit log granular per-place errors — V1 stats batch suffisent
- Edge#19/#20 path traversal foldername — Supabase Storage normalise, défense en profondeur déjà via RLS
- Edge#33 metriques interval — déjà classé m3
- Edge#51 ComptesList search debounce — UX cosmétique, V1 OK
