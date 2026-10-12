# SPAWT 1.1.1 — vocabulaire du build 28

## État au 12 octobre 2026

Source préparée dans la PR #13 existante, branche `codex/audit-avant-compilation`.
Les contrôles source et la compilation APK signée ont réussi. Le manifeste
compilé confirme `com.upgraders.spawt`, version **1.1.1**, build **28**.
La recette native sur appareil du build 28 reste à faire ; les preuves du
build 27 ne la remplacent pas.

- Source applicative : `adb12e452861dde5e4215551f82864da8f72ff67`.
- [Compilation signée](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/38262258947), terminée le 12 octobre à 15:02 UTC.
- [Artefact APK GitHub](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/38262258947/artifacts/11754938097), disponible jusqu’au 26 octobre.
- Fichier : `spawt-1.1.1-build28.apk`, **162 284 355 octets**.
- SHA-256 : `2d7fa6bef35354b0284eacbfb8f6ebb84e0da93dd06c052583451dedabb82838`.
- Signature vérifiée sur le runner et identique au build 25 ; certificat SHA-256 : `6c909bf0eddc02b8b50a0bbdc149f5deda87103ad18bc9fecc663d7ef6b52e74`.
- Après téléchargement : empreinte identique aux métadonnées du runner,
  CRC de l’archive et de l’APK valides, manifeste relu et nouveaux libellés
  Accueil/La bande/Ton Crew présents dans le bundle compilé.
- Les checks distants de la source et du retrait du déclencheur sont verts :
  1 023 tests mobile, 191 tests admin, TypeScript, vocabulaire, i18n, garde EAS,
  export web, lint et build admin.

## Périmètre

- « Feed » devient « Accueil » : onglet, secours français et retours du mode Rapide.
- « La bande » désigne la communauté : fil, badges, défis, invitations, partages,
  suggestions, signalements, bilan annuel et textes d'héritage.
- 46 valeurs françaises modifiées ; les 1 030 clés et tous les paramètres
  d'interpolation sont conservés. Aucun autre catalogue de langue n'existe
  actuellement ; le repli français a été testé depuis la locale anglaise.
- Les libellés accessibles des onglets reprennent leur libellé visible. Les
  valeurs de secours viennent du catalogue français, sans copie divergente.
- « Cercle du Spawter » est absent du code mobile actuel. Les anciennes
  maquettes distinguent un cercle privé ; le code implémente « Ton Crew »,
  accessible par invitation/code derrière `mode-crew`. Cette distinction reste
  explicite dans les textes. Les invitations vers le Crew passent par « La bande ».
- Aucun renommage de route (`meute`, `crew`), clé i18n, URL de partage, événement,
  API, schéma SQL, feature flag ou droit. Aucun changement de quiz séparé.
- La suggestion « GbonEat » n'est pas appliquée.
- Version 1.1.1 conservée ; compteurs natifs portés de 27 à 28 conformément au
  versioning existant. Aucun IPA, OTA, déploiement ou envoi aux stores.

## Vérifications exécutées sur la source

- `npm run typecheck` : réussi.
- `npm run lint:vocab` : réussi.
- `npm run i18n:check` : réussi.
- `npm test -- --ci --runInBand` : 145 suites réussies, une ignorée ;
  1 023 tests réussis, quatre ignorés ; quatre snapshots réussis.
- Six nouveaux tests : catalogue, pluriels/interpolations, Crew distinct,
  libellés visibles/accessibles, secours et appuis répétés avec sélection.
- `node --test scripts/__tests__/check-eas-env.test.mjs` : quatre tests réussis.
- `npx expo export --platform web` : compilation réussie.
- Comparaison avant/après du catalogue : clés et paramètres d'interpolation
  identiques ; aucune valeur affichée contenant Feed, Meute ou GbonEat.
- `git diff --check` : réussi.

Ces contrôles ne remplacent pas une inspection sur téléphone, TalkBack ni une
recette Android native. Le backend et l'admin ne sont pas modifiés.

## Compilation exécutée

Le workflow `.github/workflows/android-local-build.yml` a compilé la source
épinglée avec le profil `preview`, EAS local 22.5.0 et la signature existante.
Un déclenchement ponctuel sur la branche existante a été protégé par un job
sans secret : branche, parent source, message et commit unique vérifiés.
Aucun tag n’a été créé. Le déclencheur temporaire a été retiré immédiatement
après admission dans `fbbd8d996cf415e546d6eeaa9bbfad1b9859f9ea` ; seul
le déclencheur historique par tag demeure. Le run n’a produit qu’un artefact,
sans release, OTA, déploiement ou publication store.

La configuration et les preuves QA du build 27 restent inchangées ; la source
du build 28 est consignée séparément dans `documentation/android-build28.json`
pour ne pas réutiliser ses résultats.
