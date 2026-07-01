# SPAWT — Releases (vue testeur)

Journal des **APK publiés** pour l'alpha, destiné aux testeurs. Pour citer un
build dans un bug report, recopie la ligne affichée dans l'app (écran Profil →
« À propos ») : **`v1.0.0 — build N (YYYY-MM-DD)`**.

> Ce fichier est **distinct de [`CHANGELOG.md`](./CHANGELOG.md)** :
> - `CHANGELOG.md` = vue **dev** par sprint/epic (`vMAJEURE.SPRINT.ITERATION`).
> - `RELEASES.md` = vue **testeur** par APK publié (build N).

## Schéma de versioning (Story 7.1)

- **Version app** : `1.0.0`, figée jusqu'à la beta publique.
- **`android.versionCode` / `ios.buildNumber`** : entier **N**, incrémenté à chaque APK publié.
- **Format d'affichage canonique** : `v1.0.0 — build N (YYYY-MM-DD)`.
- **Tag CI Android** : `build-android-YYYY-MM-DD-N` (N = `versionCode`). Pousser ce tag
  déclenche le build EAS (`.github/workflows/eas-build.yml`), qui injecte
  `versionCode = N` et `extra.buildDate = YYYY-MM-DD` avant le build.
- **Tag CI iOS** : `build-ios-YYYY-MM-DD-N` (N = `buildNumber`). Même workflow,
  profil `production` (.ipa store-ready pour TestFlight via `eas submit`).
  Prérequis : credentials Apple configurés côté EAS (cf. `HUMAN_TODO.md`) —
  sans eux le build échoue à l'étape signing, la triple gate tourne quand même.
- **Source de vérité runtime** : `Application.nativeBuildVersion` (expo-application)
  + `extra.buildDate` (Constants) / `EXPO_PUBLIC_BUILD_DATE`.

Format d'une entrée :

```
## v1.0.0 — build N — YYYY-MM-DD
**APK** : <url eas> · **Tag CI** : build-android-YYYY-MM-DD-N · **Commit** : <sha>
### Nouveau / ### Corrigé / ### À tester en priorité / ### Limitations connues
```

---

## v1.0.0 — build 3 — 2026-06-03

**APK** : n/a (récupérable dans les logs du job EAS Build) · **Tag CI** : `build-android-2026-06-03-3` · **Commit** : (lot v2 dev — voir `git log`)

### Nouveau
- **Fiche lieu v2** (Story 4.12) : carte de localisation (image statique, tappable → Maps), horaires **jour par jour** (7 jours, jour courant en évidence), **galerie photos** (≥ 3), et écran **« Voir tous les avis »** quand un lieu a plus de 5 avis.
- **Release ops** (Story 7.1) : numéro de build visible in-app — **Profil → « À propos »** affiche `v1.0.0 — build N (date)`, copiable pour les bug reports. Ce fichier `RELEASES.md` + le schéma de versioning.

### Corrigé
- (rien de spécifique — itération de forme/UX sur la fiche lieu.)

### À tester en priorité
- **Fiche d'un lieu** : la carte s'affiche-t-elle ? Le tap ouvre-t-il Maps ? Les horaires des 7 jours sont-ils corrects (jour du jour mis en avant, « Fermé » quand fermé) ? La galerie montre-t-elle au moins 3 vignettes ? « Voir tous les avis » ouvre-t-il bien la liste complète ?
- **Profil → À propos** : le build affiché correspond-il bien à `build 3 (2026-06-03)` ? (Recopie-le tel quel dans tout bug report.)

### Limitations connues
- La carte n'apparaît que si une clé API carte est configurée côté build ; sinon seule l'adresse texte s'affiche (comportement attendu).
- Les ajustements onboarding/Home du lot v2 (communes en liste déroulante, libellés calibration, icônes des modes, etc.) **ne sont pas encore** dans ce build.
- `react-native-maps` interactif : prévu plus tard (carte statique pour l'instant).

## v1.0.0 — build 2 — 2026-06-01

**APK** : n/a (récupérable dans les logs du job EAS Build) · **Tag CI** : `build-android-2026-06-01` · **Commit** : `67851ec`

### Nouveau
- Bascule sur **Supabase live** (mode démo désactivé) — premier test sur données réelles.

### Corrigé
- `GoogleButton` : garde aussi contre les `clientIds` Google absents (crash post-consent évité).

### À tester en priorité
- Parcours auth Google de bout en bout (consentement → session).
- Affichage des lieux / avis depuis Supabase réel.

### Limitations connues
- Avant Story 7.1 : pas de numéro de build visible in-app (d'où ce journal).
- Fiche lieu v2 (carte / horaires 7 jours / galerie / tous les avis) pas encore dans ce build.

## v1.0.0 — build 1 — 2026-05-28

**APK** : n/a (premier APK alpha) · **Tag CI** : `build-android-2026-05-28` · **Commit** : `b92fbf1`

### Nouveau
- Premier APK alpha sideloadable (EAS Build preview Android, via CI).
- Epics 1–6 livrés en `review` (onboarding, découverte, Le Spawt, identité, panel admin).

### Corrigé
- `i18n` : linters no-op sur Windows + 8 violations cachées Epic 4.

### À tester en priorité
- Onboarding complet (consentement ARTCI, calibrage du Palais).
- Le Guet (géofence + spawt), fiabilité sur Android mid-range.

### Limitations connues
- Mode démo (seeds) selon configuration — pas encore Supabase live.
- OTP non câblé à un provider réel (stub).
