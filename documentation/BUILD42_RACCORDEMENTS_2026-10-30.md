# Android 1.1.1 — build 42 : raccordements

## Mandat et référence

Demandes du 30 octobre 2026 : « Fais ça avec le build42. Pas d’innovation, juste le raccordement », puis « Et active le guet ».

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
- Contrôles de configuration EAS/Firebase et canal de publication : réussis. Le test EAS qui lance des sous-processus a été reçu hors du sandbox local, sans modifier son code ni simuler un succès de production.
- Conformité du dépôt : 262 assertions réussies, seul avertissement attendu sur les identifiants de soumission aux stores.
- SQL réel PostgreSQL 15.8 : schéma vierge, permissions, tests existants, rollback et réapplication réussis. La migration 0091 passe trois fois dans cette séquence.
- HTTP réel en environnement isolé : PostgREST 14.6, version attestée par l’OpenAPI publique, retourne HTTP 200 pour les sélections simples, complètes et imbriquées du carnet. La vraie date est reçue ; un lieu sans visite conserve `null`.

Source candidate : `8cf7ea89ef7610b69c28f7608218f4e005dbdc30`, [PR 23](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/23). CI mobile/console `41100508359` terminée avec succès à 17:51:29 UTC ; CI SQL `41100508369` terminée avec succès à 17:54:20 UTC. Les deux contrôles portent sur cette source exacte.

## Déploiement serveur

La migration appariée **0091_public_place_recency** a été appliquée en production le 30 octobre 2026 avant la réception native. Sauvegarde PostgreSQL au format custom réalisée et catalogue de restauration vérifié ; fichier SQL téléchargé depuis la source exacte, empreinte SHA-256 vérifiée avant exécution. Application dans une transaction unique avec verrou du migrateur et enregistrement dans `schema_migrations`.

Elle expose seulement une date agrégée pour un lieu publié. Elle exclut visites seed, passives, non vérifiées, annulées, supprimées, sans date ou futures. Elle ne prend jamais la date d’édition de la fiche. Les anciennes APK restent compatibles. La relecture publique après déploiement retourne HTTP 200 pour les 155 lieux publiés. Aucune visite admissible n'étant présente, leurs dates sont `null` ; aucune date artificielle n'a été ajoutée.

Le runner `scripts/test-payment-sql.sh` couvre les migrations existantes, les nouvelles lectures sous rôle anonyme et propriétaire, puis le rollback et la réapplication de 0091. La compilation 42 exige la CI mobile/console et la CI SQL vertes sur sa source exacte.

## Guet : état constaté, puis mise en service

Avant intervention, `guet-proximity-v2` était désactivé dans les quatre scopes et `public_guet_places` contenait **zéro** lieu. L'accès API Coolify refusé a été remplacé par une connexion opérateur authentifiée au terminal du service existant.

Le drapeau global a été **activé dans les scopes internal, alpha, beta et prod à 17:52:33 UTC le 30 octobre 2026**. Les quatre lignes mises à jour ont été relues via l'API publique : `enabled=true`, sans expiration. Les consentements, les choix individuels et les autorisations des appareils n'ont pas été modifiés. Reçu : `documentation/android-build42-server-receipt.json`.

Les quatre contributions de localisation approuvées ont été examinées. Leurs commentaires et décisions de modération attestent des positions simulées pour les recettes antérieures, sans nouveau relevé terrain. Elles ne constituent pas une preuve GPS admissible. Aucun enregistrement de validation n'a été créé à partir de ces simulations.

Le catalogue Guet reste donc à **zéro lieu éligible** : le drapeau est actif, mais aucune région native ne peut encore être armée. La réception terrain doit porter sur un lieu réellement validé : permissions, entrée dans la zone, rappel après le délai existant, sortie anticipée, désactivation et changement de compte. Une proximité ne crée jamais une visite.

La réception physique du Guet n’est pas déduite d’un test unitaire ou d’un émulateur. Le contrôle de publication existant qui réclame cette preuve lorsque le Guet est activé reste en place.

## Livraison

Numéro Android 42 et numéro iOS 42, version 1.1.1, date 2026-10-30. Signature EAS existante. La recette d’installation doit partir de l’APK 41 reçue, dont l’empreinte est épinglée, puis vérifier l’installation par-dessus sans désinstallation.

Les actions de compilation, de recette et de publication sont déclenchées séparément depuis la branche de travail, avec leurs recettes et preuves épinglées. Le canal public n’avance qu’après les contrôles existants. Les identifiants de runs, empreintes et résultats effectifs seront ajoutés à réception. Le drapeau Guet actif ne constitue pas, à lui seul, une réception terrain.
