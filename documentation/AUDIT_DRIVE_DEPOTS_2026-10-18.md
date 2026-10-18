# Complément d'audit — Drive, collectes et dépôts SPAWT

Vérification du 18 octobre 2026, complément de `AUDIT_ADMIN_COMMENTAIRES_2026-10-18.md`. Lecture des sources, comparaison d'archives et de code ; aucun import ni déploiement en production.

## Sources retrouvées et lues

- [Drive principal Spawt The App](https://drive.google.com/drive/folders/1gEV2mlcql7nx0Li3LJLKdxQ_7xoiJBE8) : documentation active, application, archives et preuves terrain.
- [Dossier d'étude et d'intégration du 17 octobre](https://drive.google.com/drive/folders/1xrxyJl73Vpkf677V2E-LlhLMRr_PexZV) : étude, base de recherche, code, carnets et build 32.
- [Livraison du 17 octobre](https://drive.google.com/file/d/1YOKv7IDx7G94LwsZvFQ7RHS4QzcdZRf2/view) et [mode d'emploi rédaction/déploiement](https://drive.google.com/file/d/1ddy2mxI4fCzEOF2uuEgQ7C2PPiq0wkGr/view) : migration 0075, admin et imports explicitement non déployés.
- [Mission 1](https://docs.google.com/document/d/1BHR3WbKyYgbnPRv9VNA58ytkek2Yeqvs/edit) : 13 visites, 10 fiches complètes et trois visites rapides. Origine des dix lieux en production et matière de première main pour leurs textes.
- [Mission 2](https://docs.google.com/document/d/1hp4VX4xjeyo1HdgQx8BMX-rzrt1zMqGl/edit) : observations complémentaires Pouripouri/Yopougon et Féféivoire/Anyama ; aucun inventaire de nouvelles fiches complètes à importer n'est établi par ce rapport.
- [Bilan de consolidation du Mac](https://drive.google.com/file/d/1EHOb-wAVaaZF38IMr9yAbPrbR5Si3VDO/view) : les archives documentaires du 15 octobre excluent explicitement les dépôts de code complets. Elles ne prouvent pas la sauvegarde des commits locaux du Mac.

## Volume et nature des données

La [base SQLite](https://drive.google.com/file/d/1DIFr6ButW3nNkOFZ9Ws7KCjcZVx60B5M/view) a été téléchargée et interrogée en lecture seule. Elle contient 31 363 références et 29 sources, ainsi qu'un instantané des dix lieux SPAWT.

| Type de référence | Lignes SQLite |
| --- | ---: |
| Fiches sources `place` | 12 921 |
| Avis codés `review` | 14 468 |
| Articles | 2 184 |
| Discussions | 1 659 |
| Observations manuelles | 26 |
| Sources candidates | 57 |
| Observations de sources | 48 |

Ces lignes ne représentent pas autant de lieux uniques, clients ou avis publiables. Le [classeur de recherche](https://docs.google.com/spreadsheets/d/10EuG64boZRbPXeKVqsRu5S6DI1-0ntBhJm8H8yOGUBc/edit) distingue notamment 11 812 avis/notes retenus pour la restauration et 2 656 exclus. Les dates de publication, collecte et visite ne sont pas interchangeables.

Le [lot d'enrichissement](https://drive.google.com/file/d/1uknz9UThE93Nxqx_hZs0MeWFTUkFU4hb/view), également ouvert, contient 129 fiches sources et un JSONL d'import : 120 menus marchands et neuf autres fiches de sites. Le [classeur modifiable associé](https://docs.google.com/spreadsheets/d/1enWKCbqICFpUnqd6IyW43Gm2jckCii1-ZpagLNFMXIo/edit) conserve les mêmes contrôles :

- 106 points dans le district d'Abidjan, 18 hors périmètre, cinq sans coordonnées ;
- 64 fiches renseignent nom, adresse, point, téléphone, cuisine et horaires ;
- 48 rapprochements candidats et dix conflits de coordonnées ;
- 12 prix de produits sourcés ; zéro fiche déclarée prête à publier et zéro écriture en production.

Le [lot de collecte v0.4](https://drive.google.com/file/d/1UKgYLh51x6aJPduWO3nuAexMQHGw6DhK/view) contient 313 fichiers, dont 30 fichiers Python de collecte, scripts et tests. Le lot d'enrichissement ajoute quatre scripts Python. Ces archives n'embarquent pas de dossier `.git` : elles sauvegardent du code et des données, sans permettre de reconstituer un historique de commits. Aucun de ces chemins de scripts n'est présent dans les HEAD locaux inspectés ; leur rattachement à un dépôt Git dédié n'est pas établi. Le dépôt privé `datacollector` a été vérifié : il concerne la collecte marketing Shinkiro, pas ce collecteur SPAWT.

Les [dix brouillons factuels](https://drive.google.com/file/d/1bJhk0P5PEqpjJx_owm-yRylMkQvyQcVp/view) ont été ouverts : profils non publiés, faits pratiques de la fiche existante et champs restant à rédiger. Ils ne sont pas dix commentaires vécus signés Xtincell. Les [trois carnets](https://drive.google.com/drive/folders/1g1Q_ZrBcEXVMigsm5Moh_81fzrNcdu_I) préparent sept entrées sur six lieux ; leurs sources et SQL sont disponibles.

## Circuits distincts : pourquoi tout n'arrive pas dans le même panel

| Origine | Stockage ou contrat constaté dans le code | Conséquence |
| --- | --- | --- |
| Formulaire terrain historique, `project_spawt`, branche `claude/field-collection-form-4jEIX` | `localStorage`, brouillon local, export CSV ; le `fetch` observé sert au géocodage Nominatim | Aucun envoi de ces fiches au backend SPAWT n'est câblé dans ce formulaire |
| Quiz, `spawt-meute-quiz` | `POST /api/spawt` écrit dans `spawts` : lieu saisi, commune, ancienneté de connaissance, entourage, type, note libre et axes | Ces contributions ne sont pas des lignes `spawt_checkin`, ni des lieux validés `places` |
| App mobile | `spawt_checkin`, texte `texte_avis`, trois notes, tags et photos ; lecture publique via `public_reviews` | Circuit audité au tour précédent : 30 textes fondateurs et deux avis communautaires sans texte |
| Recherche Drive | SQLite/JSONL et classeurs ; import prévu par `import_research_records` de 0075 | Le corpus peut être intégré à la recherche privée, mais 0075 manque actuellement sur l'API de production |
| Profils et rédaction d'équipe | `place_editorial_profiles`, notes internes, `place_editorial_reviews`, publication explicite | Code présent sur GitHub ; schéma et admin correspondants non disponibles en ligne |
| Vitrine récente, `project_spawt_mobile_ci`, branche `claude/vitrine-one-page` | `loadPublicPlaces()` lit `/data/places-public.json` | Instantané statique ; modifier la base n'actualise pas automatiquement ce fichier |

La vitrine publique répond en HTTP 200 et son fichier JSON contient dix lieux. Le quiz répond `{"status":"ok","db":"ok"}` à `/api/health`. Cela confirme la disponibilité de ces surfaces, sans établir les nombres privés de contributions ou le routage SQL réel de toutes les tables.

Dans la migration 0075, la liste des faits admis à l'import comprend coordonnées, adresse, quartier, cuisine, menus, téléphone, horaires et provenance. Le principal blocage constaté n'est pas la disparition de ces champs dans le code d'import : c'est l'absence du schéma et de son import en production. Les enrichissements et rapprochements restent ensuite à examiner avant projection sur les fiches publiques.

## Commits poussés, branches et limites de l'inventaire local

Quatre dépôts SPAWT ont été vérifiés : produit/admin/backend, vitrine/portail, quiz et documentation/formulaire. Les branches distantes ont été actualisées. Le dépôt produit a été désuperficialisé pour mesurer l'ascendance réelle.

- [PR 15](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/15), branche `codex/editorial-research-admin`, commit `ef87f8a53a2799d328825891371c98b3d860f288` : 154 commits devant `origin/main`, zéro commit de divergence côté `main`. Le travail est poussé, mais n'est pas fusionné dans la branche par défaut.
- [ZIP d'intégration Drive](https://drive.google.com/file/d/1AXgg-KDTalAEfb0UO4mkuuKtPpvH-jYA/view) : les **44 fichiers sous `code/` sont identiques octet pour octet à cette branche GitHub**, y compris migration, admin, mobile, documentation et couvertures. Aucun correctif de ce paquet ne manque au push.
- Vitrine : branche distante `claude/vitrine-one-page`, commit `4e5ff04`, changements du 18 octobre ; la branche par défaut historique ne porte pas ces derniers changements. Aucun besoin de les reconstruire depuis une ancienne copie.
- Quiz : `main` au commit `7743cb4`, daté du 14 octobre ; écritures de contributions présentes dans le code serveur.
- Documentation : `main` au commit `010eb3b` ; passation finale `140ddf9` sur `claude/app-finale-ios-android-f8ewrp` et formulaire sur une autre branche.

Dans les clones accessibles de cette session, `git rev-list --count --branches --not --remotes` retourne zéro et les arbres de travail étaient propres avant ce complément documentaire. Cela ne vérifie pas les commits détachés, historiques locaux ou modifications sur un autre ordinateur. Les clones ont été récupérés dans cette session ; le Mac cité par le bilan n'est pas monté ici. L'archive d'intégration n'a pas de `.git`, et la consolidation documentaire n'en sauvegarde pas : une vérification du Mac reste distincte de cet audit.

## Suite concrète

1. Conserver les quatre contrats de collecte explicites et décider des vues staff nécessaires pour consulter les contributions du quiz et les exports terrain ; ne pas les confondre avec des visites ou avis mobiles.
2. Appliquer 0075 et déployer l'admin avec les bons paramètres de build, après sauvegarde et vérification des accès.
3. Importer les 31 363 références minimisées et les 129 enrichissements dans la recherche privée, contrôler les identités source/type/ID, puis rapprocher les lieux et traiter les conflits.
4. Enrichir et publier les profils, carnets et avis nominatifs ; les trente avis fondateurs restent déjà attribués au profil mobile Alexandre. Les dix textes éditoriaux préparés au tour précédent restent non publiés.
5. Vérifier les collectes locales du formulaire et les contributions du quiz sous session autorisée ; vérifier séparément les clones du Mac si l'on veut conclure sur tous les commits non poussés.

Ce complément change l'explication : la matière existe et le code éditorial est bien sur GitHub. Les intégrations manquantes et le déploiement partiel empêchent sa visibilité dans le panel. Aucun accès serveur d'écriture n'est disponible dans cette session ; aucune modification du Drive, du serveur ou des droits des comptes n'a été effectuée.
