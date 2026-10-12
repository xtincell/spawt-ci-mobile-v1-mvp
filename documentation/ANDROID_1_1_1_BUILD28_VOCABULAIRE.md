# SPAWT 1.1.1 — vocabulaire du build 28

## État au 12 octobre 2026

Source préparée dans la PR #13 existante, branche `codex/audit-avant-compilation`.
Les contrôles source ci-dessous réussissent. La compilation APK signée et la
recette native du build 28 restent à confirmer. Les preuves du build 27 ne
valident pas ce nouveau binaire.

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

## Compilation prévue

Réutiliser `.github/workflows/android-local-build.yml` avec source épinglée,
profil `preview`, EAS local 22.5.0 et signature existante. Le tag réservé est
`local-build-android-2026-10-12-28`. Les déclencheurs du dépôt ont été vérifiés :
ce préfixe ne lance que la compilation signée et son dépôt d'artefact GitHub,
sans release, OTA, déploiement ou publication store.

La configuration et les preuves QA du build 27 restent inchangées ; la source
du build 28 sera consignée séparément pour ne pas réutiliser ses résultats.
