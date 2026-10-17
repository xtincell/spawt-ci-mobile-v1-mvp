# Recherche, profils identitaires et rédaction — 17 octobre 2026

État : implémentation sur la lignée du build 31 (615b8b0), migration additive 0075 testée localement. Aucun déploiement serveur ni import de production reçu. Les accès Supabase serveur et Coolify ne sont pas configurés dans l’environnement. La compilation du build 32 est autorisée par Alexandre ; une APK ne remplace pas la migration et le déploiement de l’admin.

## Livrables de l’étude

- Dossier Drive : https://drive.google.com/drive/folders/1xrxyJl73Vpkf677V2E-LlhLMRr_PexZV
- Classeur modifiable, 13 onglets : https://docs.google.com/spreadsheets/d/10EuG64boZRbPXeKVqsRu5S6DI1-0ntBhJm8H8yOGUBc/edit
- Portail privé : https://spawt-etude-marche-abidjan.sunsetbream2.chatgpt.site

Le portail présente un instantané daté ; il permet recherche, tri, pagination, export CSV et chargement local d’un classeur actualisé. Il ne synchronise pas automatiquement Google Sheets. Le dossier contient rapport, corpus minimisé, CSV, Excel et historique des analyses. La présence dans le corpus ne vaut ni validation terrain ni autorisation de republication.

## Contrat de données

`research_records` accueille les 31 363 références de recherche et leurs codes lexicaux. Ce sont des lignes sources, pas 31 363 lieux abidjanais ni autant de clients uniques. RLS staff uniquement ; import par lots, unicité source/type/identifiant, conservation des rapprochements manuels et refus d’une actualisation plus ancienne. Aucun texte d’avis externe, auteur ni fichier photo n’est importé. Les dates de publication restent distinctes des dates de visite et de vérification. Les informations pratiques issues des sources restent des assertions à vérifier.

`place_editorial_profiles` conserve le brouillon partagé : identité, spécialités, occasions, budget, service, accès, preuve/date de vérification, statut d’activité, droits photo et jusqu’à 12 rubriques libres. L’admin indique les manques. La publication explicite exige les données pratiques requises et projette uniquement les champs publics dans `places.editorial_profile`. Sources privées, droits et notes ne sont pas exposés. Cette publication ne remplace pas le statut `places.is_published`.

`place_editorial_notes` contient les notes internes attribuées au compte staff. L’auteur ou un admin peut les modifier ; la version précédente est conservée dans `editorial_history`. Les brouillons partagés et les notes refusent un écrasement concurrent. L’historique est consultable dans la fiche de rédaction.

`place_editorial_reviews` contient des observations réellement vécues, avec date de visite et appréciations cuisine/cadre/service facultatives. Les auteurs staff rédigent, les admins publient. La vue publique ne retourne que les avis publiés de lieux publiés et d’auteurs actifs. Aucun effet sur les visites, la progression ou les compteurs communautaires. Aucun avis collecté ne devient automatiquement un avis éditorial.

Les axes ADN éditoriaux sont écrits dans `base_axe_*`, puis le moteur existant recalcule les axes observés. Les faits pratiques et l’ADN sont enregistrés dans une transaction unique, avec contrôle de version sur les deux lignes. Les vrais avis restent dans le calcul ; aucune note Google ne gonfle la confiance SPAWT.

Les carnets disposent d’un champ `audience` général/duo. Les titres, textes, couvertures, lieux, ordre et publication restent gérés dans Explore. Le mode En duo lit uniquement les carnets explicitement catégorisés, sans classer les lieux d’après leur prix.

## Usage de la console

1. Recherche & rédaction → choisir l’export `records.jsonl` du corpus → contrôler le nombre → importer. Les lots de 100 peuvent être interrompus entre deux écritures ; une reprise ne duplique pas les sources.
2. Examiner une référence, contrôler son identité, la rattacher à un lieu existant ou créer une fiche après vérification. Aucun nom similaire n’est fusionné automatiquement.
3. Lieux → modifier → « Profil éditorial » : compléter identité, informations pratiques, photos dont les droits sont confirmés et axes ADN. Horaires multi-créneaux et galerie sont désormais éditables. Jour inconnu = « À confirmer » ; liste vide explicite = fermé.
4. Stéphanie et Alexandre utilisent chacun leur compte staff nominatif actif ; aucun compte n’a été créé ou promu par cette livraison. Les notes internes restent privées. Un admin publie les contenus relus.
5. Si une fermeture est confirmée : dépublier la fiche pratique immédiatement, puis documenter le signal dans la rédaction. Enregistrer un statut dans le brouillon ne dépublie pas automatiquement un lieu déjà visible.
6. Explore → choisir l’usage Les sélections/En duo → composer et publier le carnet. Les flags existants sont respectés ; aucun flag de production n’est activé par la migration.

Une fiche incomplète doit être enrichie par vérification. Remplir artificiellement les prix, horaires, photos ou descriptions donnerait une fausse impression de qualité. La collecte n’établit pas les droits d’utilisation des photos. Le travail éditorial de terrain reste nécessaire avant publication.

## Mise en service

1. Sauvegarder le schéma et les tables existantes ; vérifier que le backend réel a reçu 0074 et qu’aucune autre 0075 n’a été déployée.
2. Appliquer `0075_editorial_workspace.sql` avec le migrateur du dépôt et des secrets serveur injectés, jamais une clé serveur dans le bundle web. Le script `migrate-http.mjs --status` crée sa table de suivi si elle manque : ne pas le traiter comme une lecture pure.
3. Déployer `spawt-admin` sur Coolify avec VITE_SUPABASE_URL et la clé anon au moment du build. Le bundle de recette local utilise un backend fictif ; ne pas le déployer.
4. Vérifier deux sessions staff nominatives, conflits, droits de publication et impossibilité de lire les notes/recherche avec une session publique.
5. Importer le corpus minimisé dans la zone de recherche privée, vérifier les comptes puis rattacher les sources. Les fiches existantes ne sont pas écrasées.
6. Installer le nouveau client pour lire les rubriques et avis éditoriaux et les carnets duo. Les anciennes APK continuent à lire leurs champs existants. Ensuite, les modifications de contenu prévues ici ne nécessitent plus de recompilation. Un nouveau type d’interaction peut toujours nécessiter du code.

Rollback : exporter les brouillons, notes, avis et historique AVANT le `.down.sql`, qui retire ces nouvelles tables. Les lieux et l’ADN préexistants sont conservés ; la nouvelle colonne publique et audience sont supprimées. Le client tolère l’absence de profil et de vue des avis.

## Validation

- Mobile : TypeScript, vocabulaire, i18n ; 1 080 tests réussis, 4 ignorés, 4 snapshots.
- Admin : ESLint, TypeScript/build, 197 tests réussis.
- SQL : PGlite/PostgreSQL embarqué, migration réelle 0075 et recompute réel 0071 sur prérequis de test ; permissions, RLS, publication, import, conflits, audit, rollback et atomicité. Le corpus réel de 31 363 lignes a été importé dans cette base locale.
- Reproductible : installer `@electric-sql/pglite` dans un répertoire temporaire, puis `PGLITE_MODULE=/chemin/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/editorial-workspace.mjs`. Option `RESEARCH_JSONL=/chemin/records.jsonl` pour le corpus réel.
- Le portail a été vérifié dans Chromium, dont écran 360 px et navigation des tableaux. L’admin a une recette navigateur locale avec backend simulé ; les captures doivent être identifiées comme telles.
- Restent : migration sur l’instance réelle, déploiement admin, rapprochements/compléments éditoriaux terrain, recette native et accès nominatifs de l’équipe. Une compilation réussie seule ne prouve pas ces points.

## Audit public effectué ce jour

Lecture anonyme autorisée du backend : 10 fiches publiques retournées. Dans les champs pratiques audités, seul le téléphone manque pour 6 fiches ; présence d’une valeur ne signifie pas validation terrain, droits photo ou profil identitaire complet. Une seule fiche présente un rapprochement candidat strict (nom normalisé identique et coordonnées à moins de 500 m) dans le corpus. Aucune fusion ni mise à jour appliquée. Le CSV de complétude, les fiches publiques auditées et la règle de rapprochement sont livrés dans le dossier d’intégration Drive.

## Livraison complétée — build 32 et première édition

APK compilé : run 39069028308, source applicative aff0e1f2129539659ff0ead4790fa2d899d39344. SHA256 ed1693324b285237276116396102bd76447ea08ed8caf1810eda1a82927267e1. Recette Android 35 de démarrage : run 39071413946 réussi (sans connexion ; parcours éditoriaux et MapLibre non validés).

Première édition : `editorial/edition-2026-10/`, trois carnets, sept entrées sur six lieux existants, couvertures dessinées titrées. SQL de publication transactionnel et idempotent, arrêté si une édition existante a été modifiée. Aucun carnet écrit en production faute d’accès serveur. Aperçu HTML = contenu préparé, pas capture de l’app.

L’enrichissement web du 17 octobre recoupe sites d’établissements et menus marchands ; les cuisines brutes, liens de menus et dates de modification sont conservés dans la zone de recherche. Une publication ou un avis daté ne devient jamais une date de visite. Une date de collecte ne devient pas une activité récente. Les conflits de succursale, coordonnées et cuisine restent à arbitrer avant publication.

Correction d’audit : une lecture anonyme vide d’explore_collections ne prouve pas l’absence de carnets publiés ; cette table exige une session authentifiée.
