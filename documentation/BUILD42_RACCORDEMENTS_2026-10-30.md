# Android 1.1.1 — build 42 : raccordements

## Mandat et référence

Périmètre : raccorder les fonctionnalités existantes au référentiel SPAWT et rendre le catalogue compatible avec le Guet, sans ajout de fonctionnalités.

Le référentiel SPAWT v2 d’octobre 2026 rend le B2C gratuit. Les parcours, les cinq axes affichés en barres, les poids de classement, les rayons et les délais du Guet sont conservés.

Base : `main` à `9641c461333e5dc4343a6b5fc9bff5674a9162f2`, descendant du code effectivement compilé dans le build 41 (`e38c8f3ee5c6287e179ef70927ca4ea618ed1878`). Le tag de provenance du build 41 désigne son workflow de compilation ; il ne remplace pas cette source.

## Raccordements

| Écart reçu | Correction du candidat 42 | Vérification |
|---|---|---|
| Restrictions Gold dans le B2C | Cinq axes ouverts, interceptions commerciales retirées de l’accueil, recherche, Rapide, profil et réglages ; noms des lieux lisibles | Tests du profil, carte, deck et écrans existants |
| Compteur public assimilé à un nombre de passages | Lieux distincts des visites explicites, hors seed, annulation, passage passif ou non confirmé ; favoris séparés | Répétitions, exclusions et annulation |
| Apprentissage sans signaux du lieu | Signaux chargés transmis au brouillon, conservés durant la saisie et utilisés par l’algorithme existant | Avis hors réseau, double envoi, reprise d’un ancien brouillon |
| Palais perdu après une panne d’écriture | Avis et snapshot Palais durables dans la file existante ; reprise au réseau, au redémarrage et à la reconnexion, isolation par propriétaire | Panne, réponse tardive, compte B et restauration |
| Vérification serveur non répercutée localement | Relecture de la vraie visite après le RPC de présence ; fusion puis recalcul des lieux vérifiés sans créer une nouvelle visite | Aucun doublon, données locales récentes conservées |
| Fraîcheur toujours nulle | Champ calculé `last_spawt_at(places)` : dernière visite vérifiée admissible, utilisé par accueil, fiche, carnet, Rapide et Crew | Tests du moteur, de l’adaptateur et SQL avec permissions |
| Guet armé seulement au démarrage / arrêt incomplet | Transitions du flag, des permissions et du compte raccordées au cycle natif existant ; anciennes régions désarmées | Tests de cycle de vie et erreurs natives |

## Contrôles source reçus

- TypeScript, vocabulaire et i18n : réussis.
- Jest complet : **167 suites et 1 146 tests réussis**, quatre tests ignorés préexistants ; quatre snapshots réussis.
- Contrats Expo Guet et partage public : réussis.
- Contrôles de configuration EAS/Firebase et canal de publication : réussis.
- Conformité du dépôt : 262 assertions réussies, seul avertissement attendu sur les identifiants de soumission aux stores.
- SQL réel PostgreSQL 15.8 : schéma vierge, permissions, tests existants, rollback et réapplication réussis. La migration 0091 passe trois fois dans cette séquence.
- HTTP réel en environnement isolé : PostgREST 14.6, version attestée par l’OpenAPI publique, retourne HTTP 200 pour les sélections simples, complètes et imbriquées du carnet. La vraie date est reçue ; un lieu sans visite conserve `null`.

Source candidate : `8cf7ea89ef7610b69c28f7608218f4e005dbdc30`, [PR 23](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/23). CI mobile/console `41100508359` terminée avec succès à 17:51:29 UTC ; CI SQL `41100508369` terminée avec succès à 17:54:20 UTC. Les deux contrôles portent sur cette source exacte.

Les exécutions déclenchées par la PR sont également reçues sur cette source : mobile/console `41100560372` et SQL `41100560407`. La première tentative de compilation `41102493944` a correctement refusé de commencer tant que la dernière CI PR n'était pas terminée. La même recette a été relancée après réception de tous les contrôles, sans modification de source ni de seuil.

La tentative 2 a terminé la compilation EAS à 19:33:47 UTC, puis a échoué avant les contrôles finaux : l'ancienne référence build 25 hébergée chez Expo renvoyait HTTP 404. L'APK brute est conservée comme artefact non reçu ; ce workflow n'est pas déclaré réussi. Le contrôle utilise désormais l'APK 41 livrée et son reçu, tous deux épinglés par SHA-256. Le reçu 41 atteste sa conformité à la signature 25 ; la nouvelle comparaison vérifie donc la chaîne 42 → 41 → 25. Les contrôles d'identité, de backend, de Firebase, de CRC et de signature restent bloquants. Une nouvelle exécution doit recevoir l'ensemble de ces contrôles.

Contrôle indépendant de cette première APK : **19 vérifications statiques réussies**, dont signature identique à la référence 41, identité/version, Firebase, backend et CRC. Empreinte des octets contrôlés : `61683457befed4b9028d87680e3af051a3bfc88163d39b19a635af0ed9b3e415`. Le rapport `android-build42-initial-static-check.json` porte explicitement `isCiReceipt=false` et `nativeExecutionPerformed=false`. La nouvelle exécution complète est `41117097867`, depuis le workflow `360d181c9c15c6378b06ec41893afeb6a653f120`, avec la même source applicative ; ses résultats et son APK ont été reçus séparément, ci-dessous.

Le nouveau binaire et son reçu ont été récupérés depuis l'artefact `13008287974` après réussite des étapes de compilation, de vérification et d'archivage. Les empreintes de l'archive puis de l'APK ont été contrôlées. Le binaire mesure **162 537 663 octets**, SHA-256 `2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7`. Son reçu propre, `android-build42-artifact.json`, confirme la source, l'identité native, la signature, Firebase, le backend et le CRC. Il s'agit de nouveaux octets ; les 19 contrôles indépendants du premier binaire ne leur sont pas attribués. La recette native cible exclusivement cette nouvelle APK et exige la conclusion globale `success` du run de compilation avant de démarrer.

## Lecture publique du champ de fraîcheur

La migration publique **0091_public_place_recency** définit le champ de fraîcheur lu par le build42. La lecture API publique du 30 octobre confirme la disponibilité de ce champ.

Elle expose seulement une date agrégée pour un lieu publié. Elle exclut visites seed, passives, non vérifiées, annulées, supprimées, sans date ou futures. Elle ne prend jamais la date d’édition de la fiche. Les anciennes APK restent compatibles. La relecture publique après déploiement retourne HTTP 200 pour les 155 lieux publiés. Aucune visite admissible n'étant présente, leurs dates sont `null` ; aucune date artificielle n'a été ajoutée.

Le runner `scripts/test-payment-sql.sh` couvre les migrations existantes, les nouvelles lectures sous rôle anonyme et propriétaire, puis le rollback et la réapplication de 0091. La compilation 42 exige la CI mobile/console et la CI SQL vertes sur sa source exacte.

## Guet : état constaté, puis mise en service

Les lectures API publiques du 30 octobre montraient encore **zéro** lieu dans `public_guet_places`.

Les lectures API publiques confirment les quatre scopes `internal`, `alpha`, `beta` et `prod` avec `enabled=true`, sans expiration. Le fonctionnement du Guet reste soumis au consentement et aux autorisations de chaque appareil.

Les relectures publiques du 30 octobre à **20:11:35 UTC**, puis à **20:41:30 UTC**, confirment les quatre scopes activés, zéro lieu Guet éligible et HTTP 200 pour les 155 lieux avec leur champ de fraîcheur.

Les positions simulées utilisées par les tests ne constituent pas des mesures GPS de terrain. Le code distingue la position documentée du lieu de la preuve de présence d’un Spawter.

Au terme du contrôle du 30 octobre, le catalogue Guet contenait **zéro lieu éligible** : le drapeau était actif, mais aucune région native ne pouvait être armée. Une proximité ne crée jamais une visite.

**Rectificatif du 31 octobre :** exiger une preuve GPS sur place pour chaque lieu était trop restrictif. Le référentiel accepte une position cartographique contrôlée, notamment via Google Maps. La recette sur téléphone vérifie le mécanisme du Guet ; elle ne constitue pas une condition d’admission de chaque restaurant au catalogue. Le correctif public repose sur la migration 0092 et le lot cartographique versionné. L’API relue à `2026-10-31T14:58:44.362559+00:00` confirme **100 lieux Guet éligibles** : 98 points conservés et deux corrections documentées, Chez Hao et Le Montmorency. Les 155 fiches publiées sont conservées et les quatre drapeaux restent actifs, sans échéance. L’APK42 reste inchangée et aucune réception sur téléphone réel n’est revendiquée. Le correctif du formulaire admin est également déployé ; ses fichiers publics ont été vérifiés le 31 octobre à 16 h 08, heure de Douala, sans essai du formulaire authentifié. Voir `GUET_CARTOGRAPHIE_2026-10-31.md` et `guet-cartography-2026-10-31.json` pour les sources, les fichiers SQL publics et les contrôles API.

La réception physique du Guet n’est pas déduite d’un test unitaire ou d’un émulateur. Le contrôle de publication existant qui réclame cette preuve lorsque le Guet est activé reste en place.

La recette historique `live` demandait l'approbation d'une position simulée pour tester l'affichage d'une récompense. Depuis la migration 0087, toute nouvelle approbation de localisation crée automatiquement une preuve de coordonnées pour le Guet. Ce scénario ne doit donc plus être approuvé en production. Une vraie contribution recevable reste nécessaire à la réception positive de la récompense.

### Réception terrain à compléter

1. Utiliser le binaire 42 reçu et noter son empreinte, le modèle de téléphone et la version Android. Aucun numéro de série n'est nécessaire.
2. Choisir l’un des lieux publiés dont la position cartographique contrôlée figure dans `public_guet_places`. Aucun relevé physique préalable par l’équipe n’est exigé pour cette position de référence.
3. Avec un compte consentant et les autorisations nécessaires, constater l'entrée réelle dans le rayon existant de 150 mètres et le rappel programmé après 120 secondes. Relever les horaires effectivement observés.
4. Recevoir aussi la sortie avant le rappel, la désactivation et le changement de compte. Vérifier qu'une simple proximité n'a créé ni visite ni avis.

Ces étapes sont en attente. La recette `raccordements` sur émulateur produit son propre reçu, avec `fullLiveReceipt=false` et `physicalGuetReceipt=false`. Elle ne produit pas le reçu `live-data.json` requis pour la publication.

## Livraison

La compilation complète `41117097867` est reçue `success` à 20:16:31 UTC. La première recette native `41121907854`, sur Android 35, est reçue `success` à 20:25:55 UTC : installation 41 → 42, 29 assertions automatiques, Firebase et animation d'ouverture réussis. L'examen de la capture confirme les cinq barres du Palais. Il révèle toutefois que le critère de fin de défilement du profil acceptait un nœud « Réglages » réduit à trois pixels, sans son texte visible. Cette assertion ne constitue donc pas une preuve de visibilité du lien. La révision 2 de la recette exige une zone tactile d'au moins 44 dp et son libellé visible dans le ScrollView réel ; elle reprend le même binaire, sans modification applicative.

**Réception finale du candidat :** la révision 2, [run `41123847019`](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41123847019), est reçue `success` à **20:40:58 UTC**, depuis le commit de recette `80672cc4b2b2ba5457ef40ee2151df3e3a074abf`. Les **31 assertions** sont réussies. Les contrôles App et SQL, push et PR, sont également verts sur ce commit. Le reçu complet est `android-build42-native-receipt.json`.

| Contrôle du binaire livré | Résultat reçu |
|---|---|
| Installation Android 35 | Mise à jour 41 → 42 sans désinstallation, permission de localisation en arrière-plan déclarée |
| Identité et configuration | APK SHA-256 conforme au reçu, version 1.1.1, build 42, Firebase initialisé |
| Ouverture | Animation détectée, mouvement et clin d'œil reçus, zéro image de surface noire |
| Sorties | Menu structuré et recherche de plat, sauvegarde hors connexion reprise, liste nommée, choix explicite sans visite |
| Partage | Lecture réelle dans un navigateur anonyme, App Link Android, révocation effective, isolation entre comptes |
| Lectures de l'application | Accueil, recherche et fiche sans erreur de lecture constatée |
| Palais et profil | Cinq barres vues sur la capture ; parcours jusqu'au lien Réglages entièrement visible et au badge `v1.1.1 — build 42 (2026-10-30)` |
| Réception complète et Guet physique | Toujours non reçus ; ces preuves ne sont pas déduites de l'émulateur |

Les archives de la révision 2 sont `android-proof` (`13009692791`) et `android-preview` (`13010361832`). Leurs empreintes, celles des reçus et celles des captures examinées sont consignées dans le reçu natif. La révision 1 est conservée comme historique et ne remplace pas cette réception corrigée.

Le libellé « Nomade » passe sur deux lignes dans la capture reçue. Le code de rendu `AxisBar` et ses styles sont identiques à la source du build 41 ; l'observation de ce retour à la ligne est documentée, sans prétendre disposer ici d'une capture comparative du build 41.

Numéro Android 42 et numéro iOS 42 dans la configuration source, version 1.1.1, date 2026-10-30. Seule l'APK Android a été compilée et reçue ici. Signature EAS existante. La recette d’installation est partie de l’APK 41 reçue, dont l’empreinte est épinglée, puis a réussi l’installation par-dessus sans désinstallation.

L'APK candidate 42 est remise avec son empreinte et ses reçus. Les actions de compilation, de recette et de publication restent distinctes. Le canal public relu reste sur le **build 41** ; aucune publication officielle ni fusion de cette PR n'a été effectuée. La réception console complète et la réception physique du Guet restent à compléter pour la publication. Le drapeau Guet actif ne constitue pas, à lui seul, une réception terrain.
