---
name: spawt-release
description: 'Builds, releases et CI SPAWT : profils EAS, conventions de tags, versioning, OTA, soumission stores. Use when building APK/IPA, configuring EAS, releasing, or touching CI workflows.'
---

# SPAWT — Release & CI

## Identités

- EAS : projet `15ac2301-e901-4caa-a8c8-864c6621bcd0`, owner `xtincell`, slug `spawt-mobile-ci`.
- Bundle IDs : iOS `com.upgraders.spawt`, Android `com.upgraders.spawt`.
- Keystore Android : **managé côté EAS** (aucun secret local — la continuité dépend du compte Expo `xtincell`).
- Secret GitHub Actions : `EXPO_TOKEN` (seul requis pour les builds).

## Profils EAS (`app/eas.json`)

- `development` : dev client, APK interne.
- `preview` : APK Android sideload + simulateur iOS, channel `preview`.
- `production` : AAB Android (+ profil iOS device ajouté au MVP), channel `production`.
- `submit.production` : squelettes iOS/Android — les credentials réels sont côté humain (voir `HUMAN_TODO.md`).

## CI (`.github/workflows/`)

- `eas-build.yml` : déclenché par `workflow_dispatch` ou tag `build-android-YYYY-MM-DD-N`. Enchaîne triple gate (typecheck, lint:vocab, i18n:check, jest --ci) puis build EAS. Injecte `versionCode`/`EXPO_PUBLIC_BUILD_DATE`.
- `eas-update.yml` : OTA push **manuel uniquement** (choix délibéré — pas d'OTA auto sur commit).
- Convention iOS (MVP) : tags `build-ios-YYYY-MM-DD-N`, même triple gate.

## Versioning

- `version` : lire `app/app.json` et `RELEASES.md` ; valeur actuelle `1.1.1`.
- `versionCode` (Android) / `buildNumber` (iOS) : incrémentés par build, journalisés dans `RELEASES.md` (numéro, date, tag, contenu). **Toujours** logger un build livré dans RELEASES.md.
- `runtimeVersion.policy: nativeVersion` dans `app/app.json` : relire ce contrat avant toute OTA ; sa compatibilité reste une réception distincte.

## Procédure de build Android (éprouvée, 3 APK livrés)

```bash
# Sélectionner d'abord une source et un numéro réconciliés avec les livraisons.
# Pousser uniquement le tag voulu, jamais tous les tags locaux.
: "${SPAWT_BUILD_TAG:?Renseigner le tag CI vérifié}"
: "${SPAWT_SOURCE_COMMIT:?Renseigner le commit vérifié}"
git tag "$SPAWT_BUILD_TAG" "$SPAWT_SOURCE_COMMIT"
git push origin "refs/tags/$SPAWT_BUILD_TAG"
# ou : gh workflow run eas-build.yml  (via MCP GitHub actions_run_trigger)
```
Le suivi se fait sur expo.dev (compte xtincell) — le workflow CI logue l'URL du build.

## Points de vigilance

- Expo SDK 55 / RN 0.83 impose la New Architecture ; la clé `newArchEnabled` a été retirée du schéma et ne doit plus figurer dans app.json. Tester chaque nouveau module natif en build EAS avant de merger.
- Plugin `expo-application` RETIRÉ de app.json (commit `9f6b325`) pour débloquer CI — ne pas le réintroduire sans vérifier le build.
- Expo Go ≠ environnement de test valide pour géofencing background, notifications, Apple Sign-In : utiliser les APK/dev builds.
- Icônes/splash : `app/assets/` + clés `icon`, `splash`, `android.adaptiveIcon` dans app.json. Source brand : `documentation/ux/uploads/logos/` (SVG dispo).
- Taille APK cible < 50 Mo (NFR PRD).
- Avant soumission stores : CGU/CGV + politique de confidentialité hébergée (juriste — humain), Data Safety Android, privacy manifest iOS (généré par Expo, à vérifier), target API Android (défaut SDK 55).

## Portail admin — déploiement Coolify (VPS, depuis 2026-07-01)

- URL : https://spawt-admin.76-13-128-23.sslip.io (HTTPS Let's Encrypt via sslip.io)
- Coolify : projet SPAWT, app `spawt-admin` (uuid culwmw8rbc5zcs2t0wf3vwpm), instance https://76-13-128-23.sslip.io (API v1, token requis)
- Build : nixpacks, base `/spawt-admin`, publish `/dist` (relatif au contexte — PAS /spawt-admin/dist), nginx custom base64 avec fallback SPA try_files
- Env build-time : VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (champ API `is_buildtime`)
- Auto-redéploiement sur push GitHub (GitHub App Coolify installée) ; manuel : POST /api/v1/deploy?uuid=<app>&force=true
- Le VPS héberge aussi `spawt-postgres-shared` (Postgres nu — cible potentielle de migration Sprint 2, cf. HUMAN_TODO)

## Ce qui reste côté humain

Voir `HUMAN_TODO.md` à la racine : compte Apple Developer, service account Play Console, secrets Supabase (MOCK_TERMII/ALLOWED_ORIGINS/TERMII_API_KEY), DSN Sentry, juriste, sign-offs, merge vers main.

## Numéro déjà livré hors branche (reçu le 2026-10-16)

- **Symptôme** : `app.json` sur la branche d’audit annonce 28, mais le manifeste
  de l’APK publié annonce 29 et une compilation réussie annonce 30.
- **Fausse piste** : incrémenter le numéro de cette seule branche et traiter sa
  CI verte comme preuve que l’application actuelle est préservée.
- **Cause racine** : les interfaces du 13 octobre sont dans les trois commits
  menant au tag/source `3cc5e92`, sans branche à sa tête. Lire les seules branches
  omet donc une application déjà existante. Le run 38897200580 préparé ainsi a
  été annulé, sans APK livré.
- **Fix** : rapprocher `gh release list`, `gh run list --workflow
  android-local-build.yml`, les tags et le manifeste du dernier APK ; récupérer
  puis intégrer la lignée compilée avant les gates. Pour ce cas :
  `git fetch origin 3cc5e92112576cd21b2fb8a427bdbbdb8842043c`, puis intégrer
  cette source en conservant ses interfaces. La recette suivante sélectionne
  31 et refuse un numéro occupé par un autre tag ; elle vérifie aussi la
  compilation précédente et `git merge-base --is-ancestor` sur sa source.
- **Signature** : une release ou un run réussi plus récent que la tête
  documentée, avec un `versionCode` supérieur dans son manifeste.
- **Portée** : général à toute livraison par tags ou branches de travail.
  Le dossier de preuves n’est pas une branche canonique, mais peut révéler
  qu’une lignée manque. Ne jamais déduire le prochain numéro d’un seul fichier.
