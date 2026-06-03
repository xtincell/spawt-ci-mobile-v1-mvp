# Story 7.1: Release ops — schéma de versioning, RELEASES.md & BuildBadge in-app

Status: review

<!-- NOUVELLE story + NOUVEL Epic 7 « Release ops & versioning » — Sprint Change Proposal v2
(2026-06-02), §4.7 / items structurels S1/S2/S3. Déclencheur : test live APK build-android-2026-06-01.
Objectif : les testeurs doivent pouvoir CITER LE BUILD EXACT dans leurs bug reports, et tracer
les APK publiés. Source ACs : sprint-change-proposal-2026-06-02.md §4.7. -->

## Story

As a testeur alpha de SPAWT (et l'équipe qui traite ses bug reports),
I want un schéma de version clair, un journal des builds publiés, et le numéro de build visible dans l'app,
so that je puisse citer le build exact (« v1.0.0 — build 2 ») dans un bug report et que l'équipe sache de quel APK je parle.

## ⚠️ Brownfield context — read first

Story **infra + 1 primitif UI**. État vérifié contre le code (proposal §1.3 + exploration) :

| Élément | Fichier | État actuel | Action |
|---|---|---|---|
| Version app | [app/app.json:5](../../app/app.json#L5) | `"version": "1.0.0"` | **Figer** jusqu'à beta (inchangé) |
| Android versionCode | [app/app.json:43](../../app/app.json#L43) | `"versionCode": 1` (int) | **Incrémenter** N par APK (via CI) |
| iOS buildNumber | [app/app.json:30](../../app/app.json#L30) | `"buildNumber": "1"` (string) | **Incrémenter** N par APK (via CI) |
| Bloc `extra` | [app/app.json:67-74](../../app/app.json#L67-L74) | `router.origin`, `eas.projectId` — **pas** de `EXPO_PUBLIC_*` | **Ajouter** `buildDate` / `buildNumber` (injectés CI) |
| Plugins | [app/app.json:51-63](../../app/app.json#L51-L63) | `expo-application` **ABSENT** | **Ajouter** `expo-application` |
| `expo-application` dep | [app/package.json](../../app/package.json) | **ABSENT** (seul `expo-constants ~55.0.15` présent) | **Ajouter** `~55.0.x` |
| `eas.json` | [app/eas.json](../../app/eas.json) | `appVersionSource: "local"`, profils dev/preview/production, **aucune** injection versionCode | **Injecter** version au build (étape CI) |
| CI build | [.github/workflows/eas-build.yml](../../.github/workflows/eas-build.yml) | trigger `push.tags: "build-android-*"` (l.41-43) + triple gate + `eas build` (`secrets.EXPO_TOKEN`) | **Ajouter** une étape qui parse le tag → injecte date + N |
| CI update (OTA) | [.github/workflows/eas-update.yml](../../.github/workflows/eas-update.yml) | OTA only, pas d'incrément natif | inchangé (OTA ≠ nouveau build natif) |
| CHANGELOG.md | [CHANGELOG.md](../../CHANGELOG.md) | vue **dev** par sprint/epic, format `## v<MAJ>.<SPRINT>.<ITER> — …` | **Ne pas toucher** — RELEASES.md est distinct |
| Écran profil | [app/app/(tabs)/profile.tsx](../../app/app/%28tabs%29/profile.tsx) | ScrollView (sections SpawterCard, stade, CollectionTitles, QuickLinks, reset démo) | **Insérer** une section « À propos » / BuildBadge |
| Primitives | [app/src/components/primitives/](../../app/src/components/primitives/) (`index.ts` barrel) | 13 primitives (Button, Chip, Ico…), pattern `export function X({}: Props)` + `useTheme()` | **Créer** `BuildBadge` + barrel export |
| Pattern lecture env | [app/src/lib/supabase.ts:6-16](../../app/src/lib/supabase.ts#L6-L16) | `Constants.expoConfig?.extra?.x ?? process.env.EXPO_PUBLIC_X ?? ""` | **Réutiliser** ce pattern |
| `BuildBadge` existant | — | aucun (grep vide) | **Créer** from scratch |

### Décisions figées (proposal §4.7 + Annexe)

- App version `1.0.0` **figée** jusqu'à beta. Seuls `versionCode` (Android) / `buildNumber` (iOS) incrémentent = entier `N` par APK publié.
- **Format d'affichage canonique** : `v1.0.0 — build N (YYYY-MM-DD)`.
- **Tag CI** : `build-android-YYYY-MM-DD-N` (N matche `versionCode`). Le trigger `build-android-*` **existe déjà** — la convention ajoute le suffixe `-N`.
- **Source de vérité runtime** : `Application.nativeBuildVersion` (expo-application) **+** `EXPO_PUBLIC_BUILD_DATE` injectée au build.
- **`RELEASES.md` ≠ `CHANGELOG.md`** : CHANGELOG = vue dev par sprint/epic (existe, ne pas toucher) ; RELEASES = vue **testeur** par APK publié.

## Acceptance Criteria

**AC #1 — Schéma de versioning (acté + documenté)**

**Given** la config EAS/Expo
**When** Story 7.1 est livrée
**Then** le schéma est acté et appliqué :

- `app.json` : `version` reste `1.0.0` ; `android.versionCode` (int) et `ios.buildNumber` (string) = entier incrémental `N` par APK.
- Format d'affichage canonique partout : `v1.0.0 — build N (YYYY-MM-DD)`.
- Convention de tag CI : `build-android-YYYY-MM-DD-N` (N = versionCode).
- Source runtime : `Application.nativeBuildVersion` (expo-application) + `EXPO_PUBLIC_BUILD_DATE` (injectée au build).
- Le schéma est **documenté** (en tête de `RELEASES.md` ou dans le dev guide) pour qu'un build futur suive la même règle sans deviner.

**AC #2 — Injection build-time (CI)**

**Given** [.github/workflows/eas-build.yml](../../.github/workflows/eas-build.yml) déclenché par un tag `build-android-YYYY-MM-DD-N`
**When** le workflow s'exécute
**Then** une étape **avant `eas build`** :

- **Parse le tag** pour extraire `DATE` (YYYY-MM-DD) et `N`.
- Injecte `EXPO_PUBLIC_BUILD_DATE=<DATE>` dans l'environnement / le bloc `extra` lu par l'app.
- Positionne `android.versionCode = N` (et `ios.buildNumber = "N"` si build iOS).
- La triple gate (`typecheck`/`lint:vocab`/`i18n:check`/`test`) reste **avant** le build (ne pas la déplacer/contourner).
- **Fallback** : si le workflow est lancé via `workflow_dispatch` (sans tag), valeurs par défaut sûres (`BUILD_DATE` = date du jour CI, `N` = versionCode courant app.json) — pas d'échec dur.
- **Ne pas** committer de secret ; `EXPO_TOKEN` reste un secret GitHub (déjà en place).

> ⚠️ Décision historisée (project-context §Décisions) : OTA Expo Updates / appVersionSource auto-remote = **non tranché**. Rester sur `appVersionSource: "local"` + injection explicite ; **ne pas** activer l'auto-increment remote EAS sans validation infra. Si l'injection in-place de `app.json` en CI est jugée fragile, signaler et livrer au minimum `EXPO_PUBLIC_BUILD_DATE` + le `BuildBadge` (AC #3) + le backfill (AC #2bis), l'incrément versionCode pouvant rester manuel en attendant.

**AC #2bis — `RELEASES.md` à la racine + backfill**

**Given** le repo
**When** Story 7.1 est livrée
**Then** un fichier `RELEASES.md` **à la racine** (distinct de CHANGELOG.md) existe, vue **testeur par APK** :

Format d'une entrée :
```
## v1.0.0 — build N — YYYY-MM-DD

**APK** : <url eas>  ·  **Tag CI** : build-android-YYYY-MM-DD-N  ·  **Commit** : <sha>

### Nouveau
- …
### Corrigé
- …
### À tester en priorité
- …
### Limitations connues
- …
```

**Backfill historique obligatoire (2 entrées)** :
- **build 1** — tag `build-android-2026-05-28`, commit `b92fbf1` — premier APK alpha.
- **build 2** — tag `build-android-2026-06-01`, commit `67851ec` — patch GoogleButton (garde clientIds Google absents) + bascule Supabase **live** (mode démo OFF).

(Renseigner les sections Nouveau/Corrigé du mieux possible depuis CHANGELOG.md + git log ; les URLs EAS peuvent être « n/a » si non récupérables.)

**AC #3 — Surface in-app du build (`BuildBadge`)**

**Given** un testeur sur l'app
**When** il ouvre l'écran profil / « À propos »
**Then** un affichage `v1.0.0 — build N (YYYY-MM-DD)` est visible **et copiable** :

- Nouveau primitif `app/src/components/primitives/BuildBadge.tsx` (pattern Button/Chip : `export function BuildBadge(props): JSX.Element`, `useTheme()`, **aucun hex en dur**), exporté via [primitives/index.ts](../../app/src/components/primitives/index.ts).
- Données : `version` depuis `Application.nativeApplicationVersion` (ou constante `"1.0.0"`), `buildNumber` depuis `Application.nativeBuildVersion`, `buildDate` depuis `Constants.expoConfig?.extra?.buildDate ?? process.env.EXPO_PUBLIC_BUILD_DATE ?? "—"` (pattern [supabase.ts:6-16](../../app/src/lib/supabase.ts#L6-L16)).
- **Copiable** : `onPress` → `Clipboard.setStringAsync(...)` (expo-clipboard si déjà présent, sinon `Share`/feedback) afin que le testeur recopie exactement le build. Au minimum : texte sélectionnable + un retour visuel « Copié ».
- Inséré dans [profile.tsx](../../app/app/%28tabs%29/profile.tsx) — section « À propos » discrète (suggestion : après `CollectionTitlesSection`, ou en footer du ScrollView). Ne pas perturber les sections existantes.
- Fallback gracieux : valeurs manquantes (dev / Expo Go) → afficher `build —` plutôt que crash.

**AC #4 — i18n + Tests + gate**

**Given** la triple gate locale
**When** Story 7.1 est livrée
**Then** :

- **i18n** (via [fr.json](../../app/src/i18n/fr.json), scope `profile.*`) : `profile.about_title` (« À propos »), `profile.build_format` (template `"v{{version}} — build {{n}} ({{date}})"`), `profile.build_copied` (« Build copié »). Aucune string FR hardcodée.
- **Tests** :
  - `BuildBadge` rend `"v1.0.0 — build N (YYYY-MM-DD)"` depuis des valeurs mockées (mock `expo-application` + `expo-constants`).
  - Fallback : valeurs absentes → rend `build —` sans crash.
  - `RELEASES.md` présent à la racine avec les **2 entrées backfill** (test léger : fichier existe + contient `build-android-2026-05-28` et `build-android-2026-06-01`).
- `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` **verts**. Aucune occurrence « spot ».

## Tasks / Subtasks

- [x] **Task 1 — Versioning & deps** (AC: #1)
  - [x] Ajouter `expo-application ~55.0.x` à `app/package.json` (`npm install --legacy-peer-deps` si besoin)
  - [x] Ajouter `"expo-application"` au tableau `plugins` de `app.json`
  - [x] Ajouter `extra.buildDate` (placeholder) à `app.json`
  - [x] Documenter le schéma (en-tête `RELEASES.md` ou dev guide)
- [x] **Task 2 — CI injection** (AC: #2)
  - [x] Étape « parse tag → DATE + N » dans `eas-build.yml` avant `eas build`
  - [x] Injecter `EXPO_PUBLIC_BUILD_DATE` + positionner `versionCode`/`buildNumber`
  - [x] Fallback `workflow_dispatch` sans tag ; ne pas déplacer la triple gate
- [x] **Task 3 — RELEASES.md + backfill** (AC: #2bis)
  - [x] Créer `RELEASES.md` racine + format documenté
  - [x] Backfill build 1 (b92fbf1) + build 2 (67851ec) depuis CHANGELOG + git log
- [x] **Task 4 — BuildBadge** (AC: #3)
  - [x] `primitives/BuildBadge.tsx` (theme, copiable, fallback) + barrel export
  - [x] Lecture `Application.nativeBuildVersion` + `extra.buildDate`
  - [x] Insérer dans `profile.tsx` (section « À propos »)
- [x] **Task 5 — i18n + tests + gate** (AC: #4)
  - [x] Clés `profile.about_title` / `build_format` / `build_copied`
  - [x] Tests BuildBadge (nominal + fallback) + présence RELEASES.md
  - [x] `tsc` + `lint:vocab` + `i18n:check` + `jest` verts

## Dev Notes

### §1 — `expo-application` (API)

- `Application.nativeApplicationVersion` → `"1.0.0"` (string ou null). `Application.nativeBuildVersion` → versionCode Android / buildNumber iOS (string ou null). Sous Expo Go / dev ces valeurs peuvent être `null` → **fallback** obligatoire.
- Le plugin doit être dans `app.json.plugins` (rebuild natif requis pour que les valeurs natives remontent — pas dispo via OTA seul, normal pour de l'info de build).

### §2 — Injection CI : approche recommandée

- Le tag déclencheur a la forme `build-android-2026-06-02-3`. Une étape shell parse : `DATE=$(echo "$TAG" | grep -oP '\d{4}-\d{2}-\d{2}')`, `N=${TAG##*-}`.
- Exposer `EXPO_PUBLIC_BUILD_DATE` comme variable d'env du job (lue par Expo au bundling) **et/ou** patcher `extra.buildDate` dans `app.json` (ex. `jq`). Choisir une seule source de vérité pour éviter la divergence (préférer `extra` lu via `Constants` — pattern supabase.ts).
- `versionCode`/`buildNumber` : avec `appVersionSource: "local"`, patcher `app.json` avant `eas build` (jq), ou passer par les flags EAS. **Ne pas** activer l'auto-increment remote sans validation (décision historisée).

### §3 — `BuildBadge` : pattern primitif

Calquer sur `Button.tsx`/`Chip.tsx` : `export function BuildBadge({ onCopied }: Props)`, `const theme = useTheme()`, styles via `theme.colors/spacing/radius/typography.preset`, touch target ≥ 44pt si `Pressable`. Pas de `Spawt`-prefix (réservé métier). Ajouter `export { BuildBadge } from "./BuildBadge";` au barrel.

### §4 — Copie presse-papier

Vérifier si `expo-clipboard` est déjà installé ; sinon, soit l'ajouter, soit utiliser `Share.share({ message })` comme repli (déjà utilisé par le partage WhatsApp Story 3.7). Au minimum, le texte doit être recopiable à la main (sélectionnable) — l'objectif est que le testeur cite le build exact.

### §5 — Décisions à NE PAS trancher seul (project-context §Décisions historisées)

- **OTA Expo Updates** (#10) non configuré, **iOS production EAS** (#9) à compléter : 7.1 ne les débloque pas, il **structure le versioning**. Si l'implémentation CI bute sur l'un d'eux, signaler et livrer le périmètre dégradé (BuildBadge + RELEASES + EXPO_PUBLIC_BUILD_DATE), incrément versionCode manuel en attendant.

### §6 — Anti-patterns à éviter

- ❌ Secret serveur sous `EXPO_PUBLIC_*` (build date est OK — non sensible).
- ❌ Toucher/renommer `CHANGELOG.md` (RELEASES.md est un fichier **distinct**).
- ❌ `git add -A` pour committer (stager explicitement — project-context).
- ❌ Contourner / déplacer la triple gate dans le workflow CI.
- ❌ Hex en dur dans `BuildBadge` (tokens only).

### §7 — Test Tantie Rose (Alexandre)

- *Comprend-elle ?* « v1.0.0 — build 2 » est lisible, pas de jargon. ✅
- *Brice partagerait ?* Section « À propos » discrète, premium. ✅
- *Dominic appartient ?* Pouvoir signaler un bug précis = se sentir écouté. ✅

### Project Structure Notes

- Canonical = `app/`. `RELEASES.md` vit **à la racine du repo** (vue testeur transverse), comme `CHANGELOG.md`.
- Nouvel **Epic 7 « Release ops & versioning »** (les epics s'arrêtaient à 6.5). Un epic dédié plutôt qu'un greffon dans Epic 1 (proposal §4.7).
- `BuildBadge` = primitif UI réutilisable → `app/src/components/primitives/` + barrel.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-02.md#47-story-71-nouvelle--epic-7--versioning-releasesmd--buildbadge-in-app]
- [Source: app/app.json#L5,L30,L43,L51-L74] (version, buildNumber, versionCode, plugins, extra)
- [Source: app/package.json] (expo-constants présent, expo-application absent, scripts gate)
- [Source: app/eas.json] (appVersionSource local, profils)
- [Source: .github/workflows/eas-build.yml#L41-L43] (trigger build-android-*) + eas-update.yml
- [Source: app/app/(tabs)/profile.tsx] (point d'insertion section À propos)
- [Source: app/src/components/primitives/index.ts + Button.tsx] (pattern primitif)
- [Source: app/src/lib/supabase.ts#L6-L16] (pattern lecture Constants.expoConfig.extra / EXPO_PUBLIC_*)
- [Source: CHANGELOG.md] (format dev — RELEASES.md doit en être distinct)
- [Source: _bmad-output/project-context.md] (EXPO_PUBLIC_* inliné = pas de secret ; staging explicite ; décisions historisées OTA/iOS prod)

## Files touched (estimation)

| Fichier | Type | Notes |
|---|---|---|
| `app/package.json` | modif | + `expo-application` |
| `app/app.json` | modif | + plugin `expo-application`, + `extra.buildDate` |
| `.github/workflows/eas-build.yml` | modif | étape parse-tag → inject date/versionCode |
| `RELEASES.md` (racine) | **new** | vue testeur + 2 backfills |
| `app/src/components/primitives/BuildBadge.tsx` | **new** | primitif copiable |
| `app/src/components/primitives/index.ts` | modif | barrel export |
| `app/app/(tabs)/profile.tsx` | modif | section « À propos » + BuildBadge |
| `app/src/i18n/fr.json` | modif | `profile.about_title` / `build_format` / `build_copied` |
| `app/src/components/primitives/__tests__/BuildBadge.test.tsx` | new | nominal + fallback |

## Done definition

- Triple gate verte (`tsc --noEmit` + `lint:vocab` + `i18n:check` + `jest`).
- `RELEASES.md` présent racine avec les 2 builds backfillés.
- APK preview : écran profil affiche `v1.0.0 — build N (date)`, copiable.
- Schéma de versioning documenté ; prochain tag CI suit `build-android-YYYY-MM-DD-N`.
- Aucune occurrence « spot ». Sweep adversarial **en fin de lot**, pas par story. Revue infra légère (versioning CI) avant merge.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — dev-story workflow.

### Debug Log References

- Triple gate conjointe (lot v2, avec 4.12) : `tsc --noEmit` exit 0 · `lint:vocab` ✓ · `i18n:check` ✓ · `jest` **353 passed / 4 skipped / 0 failed** (exit 0, +5 tests : BuildBadge 2 + releases 3).
- `expo-application@55.0.15` déjà présent en transitif → ajouté à `package.json` (résolution immédiate, pas de `npm install` réseau requis).
- `expo-clipboard` absent → copie via `Share.share` (déjà utilisé Story 3.7), pas de dépendance ajoutée.

### Completion Notes List

- **AC #1 (versioning)** : `app.json` `version` figée `1.0.0` ; schéma `v1.0.0 — build N (YYYY-MM-DD)` + tag CI `build-android-YYYY-MM-DD-N` documentés en tête de `RELEASES.md`. Plugin `expo-application` ajouté ; `extra.buildDate` (placeholder vide, patché en CI).
- **AC #2 (injection CI)** : étape « Inject build metadata » dans `eas-build.yml` **avant** `Setup EAS`/`Build APK`. Parse le tag → `versionCode`/`buildNumber` = N + `extra.buildDate` = date (via `node -e` JSON patch) + `EXPO_PUBLIC_BUILD_DATE` dans `$GITHUB_ENV`. Fallback `workflow_dispatch` (sans tag) : date du jour, versionCode courant. Tags backfill sans `-N` (suffixe = jour) → garde le versionCode courant. Triple gate inchangée (toujours avant le build). Aucun secret touché.
- **AC #2bis (RELEASES.md)** : créé à la racine, distinct de `CHANGELOG.md` (vue testeur), + schéma documenté + **2 backfills** (build 1 `build-android-2026-05-28` / b92fbf1 ; build 2 `build-android-2026-06-01` / 67851ec).
- **AC #3 (BuildBadge)** : `primitives/BuildBadge.tsx` (+ barrel). Lit `Application.nativeApplicationVersion`/`nativeBuildVersion` + `Constants.expoConfig.extra.buildDate` / `EXPO_PUBLIC_BUILD_DATE` via helper `pick()` (premier non-vide). Fallback gracieux `build —` si natif absent (dev/Expo Go). Tappable → `Share.share(label)` (copie). Texte `selectable`. Inséré en footer de `profile.tsx` (« À propos »).
- **AC #4 (i18n + tests)** : clés `profile.about_title` / `build_format` (`v{{version}} — build {{n}} ({{date}})`) / `build_copied`. Tests : BuildBadge nominal + fallback ; présence/contenu `RELEASES.md` (2 backfills + distinction CHANGELOG). Aucune occurrence « spot ».
- **Décisions historisées respectées** : `appVersionSource` reste `local` + injection explicite ; OTA remote / iOS prod EAS **non tranchés** (incrément versionCode reste manuel/CI sans auto-increment remote).
- **À faire au commit** (Moka phase 7) : `npm install` côté CI régénère le lockfile pour `expo-application` (déjà résolu transitif localement) — vérifier `package-lock.json`. Entrée CHANGELOG.md à ajouter pour le lot v2.
- **DoD externe restant** (hors dev) : sweep adversarial fin de lot v2 + triple sign-off + revue infra légère du workflow (tester un vrai tag `build-android-YYYY-MM-DD-N` en CI). Vérifier que le BuildBadge affiche bien la date sur un APK produit par la CI (le build local/dev affichera `build —`).

### File List

**New**
- `RELEASES.md` (racine repo)
- `app/src/components/primitives/BuildBadge.tsx`
- `app/src/components/primitives/__tests__/BuildBadge.test.tsx`
- `app/__tests__/releases.test.ts`

**Modified**
- `app/package.json` (+ `expo-application ~55.0.15`)
- `app/app.json` (+ plugin `expo-application`, + `extra.buildDate`)
- `.github/workflows/eas-build.yml` (+ étape « Inject build metadata »)
- `app/src/components/primitives/index.ts` (+ barrel `BuildBadge`)
- `app/app/(tabs)/profile.tsx` (+ section « À propos » / `<BuildBadge />`)
- `app/src/i18n/fr.json` (+ `profile.about_title` / `build_format` / `build_copied`)

## Change Log

- 2026-06-02 — Story 7.1 implémentée (dev-story). Nouvel Epic 7 « Release ops ». Schéma versioning + injection CI tag→versionCode/buildDate + `RELEASES.md` (2 backfills) + primitif `BuildBadge` in-app (Profil → À propos, copiable). Triple gate verte (353 tests). Status → review.
