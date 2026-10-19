# Accueil, catalogue public et retours dans l’app

## Comportement livré

Une fiche publiée rend un lieu découvrable. Elle ne crée pas de spawt, de visite, d’avis ou de note. Les 145 fiches issues de l’inventaire documentaire rejoignent les dix lieux déjà publics : **155 lieux**, dont **111 positions renseignées** et **44 localisations à préciser**. Les 44 fiches sans coordonnées restent dans la liste et n’obtiennent aucun repère fictif. Les prix inconnus restent inconnus.

L’exploration est propre au compte : **Tous les lieux**, **À explorer**, **Mes spawts**. Seuls ses spawts confirmés, non annulés et non fondateurs comptent ; les détections passives ne valent pas exploration personnelle. Le catalogue de l’équipe ne remplit jamais automatiquement cet historique.

L’accueil utilise « Choisir vite ». Les titres sont en Gotham Bold et les sous-textes en Gotham Book, rapprochés. La rangée peut défiler sur les petits écrans ou avec une grande taille de texte afin de conserver les libellés complets.

## Contributions de la communauté

Chaque fiche propose **Compléter ce lieu** : photographier/importer 1 à 3 pages du menu avec un budget facultatif, ou relever ponctuellement sa position sur place. Le relevé doit dater de moins de dix minutes et annoncer une précision de 100 mètres maximum. Il ne vaut pas preuve inviolable de présence ; l’équipe examine la proposition. Ce geste n’active pas Le Guet ni la localisation permanente.

Les preuves restent privées jusqu’à modération. L’app conserve un brouillon par compte et par lieu ; l’identifiant stable rend les reprises sans doublon. Les images déposées sont immuables. Les contributions en attente sont limitées à cinq par compte, avec vingt dépôts par jour.

Le panel **Contributions aux lieux** affiche les preuves, les valeurs actuelles et les valeurs retenues. Accepter met à jour la fiche et crédite les Paws dans la même transaction. Une modification concurrente de la fiche impose une nouvelle comparaison. Un refus exige un motif et ne crédite rien. L’auteur lit le statut, le motif et les Paws dans l’app. Aucune contribution ne crée un spawt ou une note.

Le barème initial reprend la reconnaissance existante d’un avis publié : **5 Paws** par contribution validée, pour le menu/prix comme pour la position. Un admin peut changer ce barème (0 à 100), avec motif et historique. La récompense est figée au dépôt, jamais modifiée rétroactivement.

La migration 0085 a été appliquée après sauvegarde complète. Tests SQL des droits, photos privées/publiques, deux auteurs, reprises, quotas, conflit de fiche, récompense unique, refus, compte banni, suppression de compte et retour arrière reçus. Le navigateur a parcouru l’envoi réel d’une photo de test, sa lecture et son refus dans le panel Xtincell, puis un relevé GPS simulé identique aux coordonnées existantes, sa validation et la réception de 5 Paws. Les champs publics du lieu sont restés identiques ; le compte de recette n’a aucun spawt. Aucun faux menu n’a été publié.

## Cause de l’erreur du Fil du Chat

Trois appels récents utilisaient `AbortSignal.timeout`, absent du polyfill `abort-controller` réellement chargé par React Native 0.83. L’appel échouait avant la requête réseau ; il affectait les actualités, la révision des contenus et les remontées d’activité. Le serveur public répondait correctement.

Les trois appels utilisent maintenant le délai existant de 15 secondes basé sur `AbortController`, avec annulation et nettoyage. Un test charge le même polyfill que React Native, sans `AbortSignal.timeout`. Une réponse vide reste distincte d’un échec réseau.

## Plusieurs contrôles indépendants

- [Carte publique](https://spawt.online/carte) : lecture des fiches publiées dans la base, sans copie figée du catalogue.
- [Vérifier les contenus](https://spawt.online/statut) : cinq lectures depuis le navigateur, nombres, heure, nouvel essai et version Android disponible.
- App → Palais → Paramètres → **Aide et retours** : mêmes catégories de contenus, version native et partage du diagnostic. Les écrans en erreur proposent aussi ce lien.
- Panel → **Retours de l’app** : réception privée, statut, réponse visible uniquement par l’auteur et l’équipe. Le brouillon reste sur l’app après un échec ; l’accusé exige l’identifiant retourné par le serveur. Les répétitions avec le même identifiant ne créent pas de doublon.
- Panel → **Activité** : activité récente remontée par l’app, version, plateforme et envois en attente. Cela indique une présence récente, pas une connexion permanente.

La publication Android exige désormais le contrôle du binaire signé sur Android avec connexion réelle, lecture d’un avis éditorial, d’un carnet et d’une actualité, catalogue complet, exploration personnelle vide pour un compte neuf, panne/reprise réseau et aller-retour d’un message privé via le panel. Les captures et le résultat JSON sont joints à la release publique.

## Base et console

Les migrations 0082 (retours privés), 0083 (publication sans prix/GPS) et 0084 (lecture anonyme des seuls carnets publiés) ont été appliquées après sauvegardes PostgreSQL complètes. Aucun redémarrage du stack Supabase. Les brouillons restent privés ; les tests incluent les droits anonymes, propriétaire, staff, les répétitions, les limites de débit et les retours arrière SQL.

À la publication des 145 fiches, les compteurs sont restés identiques : **33 spawts**, **10 avis éditoriaux**, **32 avis publics**. Les 145 ADN ont toujours `sample_size=0`, `total_reviews=0`, `weighted_rating=0`. Les avis éditoriaux existants portent la signature Alexandre (compte staff Xtincell).

Une actualité réelle a été publiée puis modifiée depuis le panel : « Les premiers regards du Chat sont en ligne ». Le texte mis à jour est arrivé dans un écran de l’app déjà ouvert, sans rechargement de page ; la boucle contrôle la révision au premier plan toutes les 30 secondes. Une fiche publique sans prix ni coordonnées a aussi été enregistrée depuis le panel sans altérer ses champs ni ses compteurs. Les cinq lectures web, la panne/reprise du contrôle public et le circuit de retour privé ont été reçus avec Chromium, sans erreur JavaScript.

## Livraison et limites

Le build40 final reprend le catalogue, les contributions et une correction supplémentaire de l’isolation des brouillons par compte. Le build 37 a été arrêté avant publication ; le build 38 a compilé les corrections de lecture et le catalogue. Le build39 ajoutait les contributions demandées ensuite ; il a été annulé avant livraison lors de la revue des brouillons. La lignée de signature reste celle du build 36. Compilation39 `39339756785` annulée. Source40 `e0725071615e4724eca179c11f7bcd4b5ce4d35c`, CI `39341526784`, compilation `39341782221`. La recette native finale reste à recevoir.

Recette intermédiaire 38 **réussie** : compilation `39335327191`, recette native `39339443365`. L’APK signé a lu les données réelles, affiché 155 fiches / 111 positions, laissé vide l’exploration personnelle, reçu les avis éditoriaux et carnets, puis testé panne réseau, brouillon après redémarrage, accusé serveur et réponse du panel. Les captures 393 dp et fiche documentaire ont été examinées. Firebase a été initialisé dans le processus Android. Cette recette intermédiaire ne remplace pas la réception du build40 final.

Les détails de compilation, recette native, empreinte APK et publication seront consignés dans `RELEASES.md` et le fichier JSON de preuve à la réception finale.

Les coordonnées renseignées ne constituent pas toutes une vérification GPS sur place ; les inconnues restent explicites. Installer la nouvelle APK par-dessus l’ancienne conserve les données locales en attente. Une recette sur émulateur ne prouve ni la récupération d’un commentaire resté sur un téléphone personnel, ni la réception d’un push sur ce téléphone. Aucun envoi de campagne à des personnes réelles dans cette recette. Aucun IPA ni OTA publié.

Les tests d’isolation vérifient le changement de compte avant les effets React, la lecture tardive de l’ancien brouillon et un callback tardif. La restauration normale des deux formulaires et les cinq lectures web ont aussi été reçues sur la source40.
