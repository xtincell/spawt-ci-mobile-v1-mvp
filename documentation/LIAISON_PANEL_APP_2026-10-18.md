> Mise à jour : le build 35 ajoute Firebase/FCM configuré et reçu sur émulateur, avec téléchargement officiel automatisé. Voir [le bilan Firebase](./FIREBASE_ANDROID_2026-10-18.md). La réception push sur téléphone reste distincte.

# Liaison panel / application — 18 octobre 2026

La console gère désormais les actualités et informations du fil mobile, en plus des lieux, avis éditoriaux, carnets, événements et promotions. Une publication peut être préparée en brouillon, programmée (heure UTC/Abidjan), corrigée, retirée et supprimée. Les écritures sont historisées ; une modification concurrente est refusée.

L’app recharge les surfaces concernées au retour au premier plan et lorsqu’une sonde commune détecte un changement serveur. Sonde toutes les 30 secondes au premier plan ; le temps serveur invalide aussi à chaque minute pour les débuts/fins programmés. Aucune note de recherche privée n’est transmise. Un retrait est reflété à la prochaine lecture réussie ; hors connexion, la dernière lecture peut rester affichée.

La page **Activité dans l’app** reçoit à partir du build 34 un signal authentifié par appareil au premier plan, toutes les 60 secondes. « En cours » expire après 90 secondes. La page expose dernière activité, version/build, statut d’enregistrement push, nombre d’appareils enregistrés sur le compte et écritures du compte en attente. Ce n’est pas un inventaire de sessions d’authentification ni une preuve de lecture à la seconde. Les anciennes versions n’émettent pas ce signal.

La page **Push** estime les cibles côté serveur, permet un compte précis ou les segments existants, et prépare un lien depuis une actualité enregistrée. Les lectures sont paginées ; une erreur de filtre n’élargit jamais le public. Une réservation SQL précède l’envoi, protège contre les doublons et applique la limite de trois campagnes quotidiennes, même en concurrence. Les résultats sont conservés dans `push_campaigns`, car l’ancien CHECK de `admin_audit_log.action` refusait `push_campaign`. `sent` signifie **accepté par Expo**, pas reçu/lu. Un état `sending` persistant doit être vérifié sans renvoi automatique.

## Pourquoi les données semblaient manquer

| Constat initial | Cause vérifiée | Résultat de l’intervention |
| --- | --- | --- |
| Panel ancien, champs éditoriaux absents | Code poussé sur une branche récente, mais ancien panel déployé et migration 0075 absente du serveur | Schéma migré, imports exécutés et panel reconstruit sur la source contrôlée |
| Seulement dix lieux | Les documents et collectes du Drive n’avaient pas été transformés en fiches | 145 fiches supplémentaires créées sans note, visibles comme brouillons dans le panel |
| Zéro dans la colonne des avis | Compteur communautaire excluant les textes fondateurs | Libellé explicite et accès aux textes même à zéro ; trente textes fondateurs conservés |
| Pas d’avis éditorial Xtincell | Espace éditorial non déployé, textes préparés non publiés | Dix avis éditoriaux publiés sous le compte staff Xtincell, un par lieu initial |
| Publications difficiles à voir dans une app déjà ouverte | Relectures des différentes surfaces non coordonnées | Invalidation commune au premier plan et nouveau fil d’actualités |
| Pas de visibilité sur les appareils actifs | Aucune remontée d’activité commune | Signal authentifié par installation à partir du build 34, avec expiration à 90 secondes |

Les 145 nouvelles fiches restent en brouillon parce que les documents ne donnent pas tous les éléments nécessaires à une publication fiable : 44 n’ont pas de coordonnées vérifiées et aucun prix moyen n’a été inventé. Leur provenance est conservée. Les 31 492 références de recherche sont consultables par le staff ; elles ne représentent pas autant de lieux uniques.

La base contient trois spawts mobiles hors fondateurs, tous sans texte libre, et neuf contributions du quiz sans note libre. Aucun commentaire perdu n’a été retrouvé dans ces lignes. Le parcours serveur de création, lecture et modification d’un avis a été vérifié sous les droits du compte mobile, puis annulé sans conserver de faux avis. La version récente transmet l’avis complet et conserve les écritures non acquittées dans une file locale durable. Un texte resté uniquement sur un téléphone ne peut pas être reconstruit depuis le serveur.

Les quatre dépôts accessibles et le Drive ont été comparés. Les 44 fichiers du ZIP d’intégration correspondent à la branche GitHub récente ; le problème principal venait du déploiement partiel. Les clones accessibles ne révèlent pas de commit local oublié avant intervention. Le Mac mentionné dans les documents n’est pas monté dans cet environnement ; ses éventuels commits locaux ne sont donc pas vérifiables ici.

## Données et déploiement

- Migrations 0077/0078 appliquées le 18/10 après sauvegarde PostgreSQL complète de 4 159 611 octets : `/var/lib/postgresql/data/spawt-backups/before-console-bridge-20261018.dump`.
- 155 lieux conservés, dont 145 brouillons sans note et dix publics ; dix avis éditoriaux Xtincell et trois carnets publiés conservés.
- Le chemin d’écriture des avis reste la file durable livrée en build 32 : un échec reste en attente, avec reprise. Les commentaires éventuellement absents du serveur ne peuvent pas être reconstitués sans leur texte local.

## Limite d’accès vérifiée

Aucun jeton push n’existe en production au début de cette intervention. Aucun `google-services.json` ni `android.googleServicesFile` n’est configuré dans la source, aucun fichier correspondant trouvé dans le Drive. La configuration Firebase Android et le compte de service FCM v1 dans Expo restent requis pour joindre des téléphones. Aucun message de campagne n’a été diffusé pendant la recette. Le fil d’actualités fonctionne par lecture de l’API indépendamment des notifications système.

## Vérifications

Tests SQL avec rôles réels (PGlite), tests mobile/admin, tests Edge isolés, recette HTTP/browser et preuves de déploiement consignées lors de la livraison. La compilation APK ne remplace pas une réception physique Android/iOS.

La recette a détecté puis corrigé la redirection prématurée des liens Explore pendant le chargement des fonctionnalités. Le build 33 a été annulé avant livraison ; le build 34 inclut cette correction et charge les fonctionnalités indépendamment du Guet.

## Livraison Android 34

Le [build 34 publié](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/tag/local-build-android-2026-10-18-34) compile la source `47cc174d2558ae0155f1847aac566a111e8ababd`. Le binaire de 162 451 883 octets possède l’empreinte SHA-256 `39875c39314c5da714e6179a5c412c80bfcf7f4061ea5a91dabbe4ee7a71628f`. Sa signature conserve la lignée Android existante ; l’installation par-dessus l’app actuelle préserve son stockage local.

La compilation [39133029325](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39133029325) vérifie paquet, version/build, configuration backend embarquée, CRC et signature. La recette [39135323263](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39135323263) contrôle cinq assertions de démarrage/réouverture sur Android 35, ainsi que la présence de l’animation, sans compte ni OTP. La publication [39135805050](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39135805050) exige ces deux résultats réussis et revérifie les octets avant d’exposer la release. Aucun IPA ni OTA publié.

Contrôles logiciels : 1 085 tests mobile réussis (quatre ignorés), 205 admin, 13 SQL, 16 Edge et 43 portail ; TypeScript, vocabulaire, i18n et constructions requis réussis. La recette navigateur utilise le serveur réel pour lire un avis éditorial et un carnet, créer/modifier/supprimer un brouillon d’actualité, vérifier son exclusion publique et recevoir l’activité d’un compte. Un changement de révision serveur recharge l’avis sans navigation. Zéro erreur API/JavaScript dans ces parcours. Aucune campagne ni faux avis conservé.

Les deux sessions temporaires de recette ont été fermées avec une déconnexion locale, et les quatre installations web de recette retirées. Les sessions du téléphone de l’utilisateur sont préservées.

Le portail est déployé sur `8f48c243aad6e59c654dcc306a70b1de307aefe5`, branche `codex/mobile-build34`, depuis 14:27:18 UTC. Les deux boutons Android proposent le [build 34 sur spawt.online](https://spawt.online/downloads/spawt-1.1.1-build34.apk). Le fichier servi et son fichier `.sha256` ont été téléchargés et vérifiés après déploiement : même taille et empreinte que la CI, type MIME APK correct, aucune erreur JavaScript dans le parcours. Les domaines www et portail servent également le binaire. Le Dockerfile refuse un téléchargement dont la taille ou l’empreinte diffère du manifeste.

Code et documents sont poussés : [PR produit/admin 16](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/16) et [PR portail 10](https://github.com/xtincell/project_spawt_mobile_ci/pull/10). Les déploiements sont épinglés sur les commits vérifiés ; aucune fusion de branches historiques n’a été effectuée.
